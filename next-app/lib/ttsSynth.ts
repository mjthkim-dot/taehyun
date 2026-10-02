/**
 * 신경망 음성(Groq Orpheus) 합성 경로 — components/SpeakButton의 fetchGroqTTS가 **메모리 캐시에 없을 때만**
 * 지연 로딩한다. SpeakButton은 홈 카드(DramaCard)를 통해 홈 첫 청크에 실리므로, 합성·한도·캐시 정리 코드는
 * 이 파일에 두어 홈 청크를 늘리지 않는다(idb 캐시 모듈 lib/storage도 여기서만 정적으로 부른다).
 *
 * 한도(429) 정책(리뷰 B2):
 *   · Retry-After ≤ 10초면 그만큼 한 번 기다렸다 재시도. 그래도 429면 degradedUntil = 지금 + max(Retry-After, 15초).
 *   · Retry-After > 10초(또는 헤더 없음 → 60초)면 기다리지 않고 바로 degradedUntil을 세우고 null(→ 기기 음성).
 *   · degradedUntil 전에는 미리 받기를 포함해 **Groq를 부르지 않는다** — 예전엔 줄마다 ~10초 대기 + 재시도로
 *     한도가 다 찬 동안 매 줄이 10초씩 침묵했다. idb에 이미 있는 음성은 그대로 쓴다(한도와 무관).
 * 간격 제한(리뷰 B3): gapMs를 준 요청(HVPT — Orpheus 10회/분)은 직전 합성 요청과 그만큼 띄워 순서대로 보낸다.
 * 메모리 캐시 상한(리뷰 B11): objectURL은 최근 TTS_URL_CACHE_MAX개만 — 밀려나는 URL은 revoke(재생 중인 것은 제외).
 */
import { getTts, putTts, ttsKey } from './storage';
import { bumpDiag, bumpTtsMeta } from './diag';
import { SERVER_GROQ_SENTINEL } from './state';

/** 이보다 긴 Retry-After는 기다리지 않고 바로 기기 음성으로 */
export const TTS_WAIT_MAX_MS = 10_000;
/** Retry-After를 못 읽었을 때 신경망 음성을 쉬는 시간 */
export const TTS_DEGRADE_DEFAULT_MS = 60_000;
/** 재시도까지 429면 최소 이만큼은 쉰다 — Retry-After 1초짜리가 줄마다 대기+재시도를 되풀이하지 않게 */
export const TTS_DEGRADE_MIN_MS = 15_000;
/** 메모리 objectURL 캐시 상한 */
export const TTS_URL_CACHE_MAX = 60;

// 헤더(응답 시작)까지 8초 — 서버가 죽었는지 판단. 본문(오디오 전체)은 30초 — Orpheus WAV는 문장당 수백 KB~1MB라
// 모바일 회선에선 8초로 부족했다("소리가 안 난다"의 실제 원인 후보).
const TTS_HEADER_TIMEOUT_MS = 8000;
const TTS_BODY_TIMEOUT_MS = 30000;

let degradedUntil = 0;
/** 지금 신경망 음성을 쉬는 중인가(한도) */
export function ttsPaused(now = Date.now()): boolean {
  return now < degradedUntil;
}
/** 쉬는 시간 끝 시각(ms, 0이면 안 쉼) */
export function ttsPausedUntil(): number {
  return degradedUntil;
}
/** ms만큼 쉰다(이미 더 길게 쉬는 중이면 그대로) */
export function pauseTts(ms: number, now = Date.now()): void {
  degradedUntil = Math.max(degradedUntil, now + ms);
}
/** 테스트용 — 쉼 해제·간격 기록 초기화 */
export function resetTtsPause(): void {
  degradedUntil = 0;
  lastNetAt = 0;
  gapChain = Promise.resolve();
}

/** Retry-After(초 또는 HTTP 날짜) → ms. 없거나 못 읽으면 null */
export function parseRetryAfter(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const sec = Number(header);
  const ms = Number.isFinite(sec) ? sec * 1000 : Date.parse(header) - now;
  return Number.isFinite(ms) ? Math.max(0, ms) : null;
}

/** 첫 429 → 기다렸다 재시도할지(wait), 바로 쉴지(pause) */
export function plan429(header: string | null, now = Date.now()): { wait: number } | { pause: number } {
  const ms = parseRetryAfter(header, now);
  if (ms != null && ms <= TTS_WAIT_MAX_MS) return { wait: ms };
  return { pause: ms ?? TTS_DEGRADE_DEFAULT_MS };
}

/** 메모리 캐시에 넣고 상한을 넘으면 오래된 것부터 revoke — 방금 넣은 것·재생 중인 것은 남긴다 */
export function rememberUrl(cache: Map<string, string>, key: string, url: string, playing = '', max = TTS_URL_CACHE_MAX): void {
  cache.delete(key);
  cache.set(key, url);
  for (const [k, u] of cache) {
    if (cache.size <= max) break;
    if (k === key || (playing && u === playing)) continue;
    cache.delete(k);
    try {
      URL.revokeObjectURL(u);
    } catch {
      /* 구형 환경 */
    }
  }
}

/* ── 요청 간격(HVPT 등 gapMs) ── */
let lastNetAt = 0;
let gapChain: Promise<void> = Promise.resolve();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
function waitGap(gapMs: number): Promise<void> {
  const p = gapChain.then(async () => {
    const w = lastNetAt + gapMs - Date.now();
    if (w > 0) await sleep(w);
    lastNetAt = Date.now();
  });
  gapChain = p.catch(() => {});
  return p;
}

/** 서버 TTS 한 번 호출 — 헤더 8초/본문 30초 타임아웃. 네트워크 오류는 null */
async function requestTts(input: string, voice: string, key: string): Promise<Response | null> {
  lastNetAt = Date.now();
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), TTS_HEADER_TIMEOUT_MS);
  try {
    const resp = await fetch('/app/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input, voice, key: key === SERVER_GROQ_SENTINEL ? undefined : key }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), TTS_BODY_TIMEOUT_MS);
    if (!resp.ok) return resp;
    const blob = await resp.blob();
    // 빈/손상 응답을 캐싱하면 재생 시 onended가 오지 않아 그 줄에서 영영 멈춘다 — 유효한 오디오만
    if (!blob || blob.size < 256) return null;
    return new Response(blob, { status: 200, headers: { 'Content-Type': blob.type || 'audio/wav' } });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface SynthArgs {
  /** 원문(캐시 키) */
  text: string;
  /** 실제로 보낼 문장(감정 태그 포함) */
  input: string;
  voice: string;
  tagless: boolean;
  key: string;
  /** 직전 합성 요청과 최소 간격(ms) — HVPT */
  gapMs?: number;
  cache: Map<string, string>;
  cacheKey: string;
  /** 지금 재생 중인 objectURL(revoke하지 않게) */
  playing: () => string;
  /** 기기 음성으로 내려감(true)/복구(false) 신호 */
  onDegraded: (on: boolean) => void;
}

/** idb 캐시 → (쉬는 중이 아니면) 합성. 실패·쉬는 중이면 null(호출부가 브라우저 음성으로) */
export async function synthTts(a: SynthArgs): Promise<string | null> {
  const idbKey = ttsKey(a.voice, a.tagless, a.text);
  const hit = await getTts(idbKey).catch(() => null);
  if (hit) {
    const url = URL.createObjectURL(hit.blob);
    rememberUrl(a.cache, a.cacheKey, url, a.playing());
    bumpTtsMeta('hit');
    return url;
  }
  bumpTtsMeta('miss');
  const paused = () => {
    if (!ttsPaused()) return false;
    a.onDegraded(true);
    return true;
  };
  if (paused()) return null;
  if (a.gapMs) {
    await waitGap(a.gapMs);
    if (paused()) return null;
  }
  let resp = await requestTts(a.input, a.voice, a.key);
  if (resp && resp.status === 429) {
    bumpTtsMeta('tts429');
    bumpDiag('tts429');
    const plan = plan429(resp.headers.get('retry-after'));
    if ('pause' in plan) {
      pauseTts(plan.pause);
      a.onDegraded(true);
      return null;
    }
    await sleep(plan.wait);
    if (paused()) return null;
    resp = await requestTts(a.input, a.voice, a.key);
    if (resp && resp.status === 429) {
      bumpTtsMeta('tts429');
      pauseTts(Math.max(parseRetryAfter(resp.headers.get('retry-after')) ?? TTS_DEGRADE_DEFAULT_MS, TTS_DEGRADE_MIN_MS));
    }
  }
  if (!resp || !resp.ok) {
    // 키가 틀린 경우(401)는 '저하'가 아니라 설정 문제 — 칩을 띄우지 않는다
    if (!resp || resp.status !== 401) a.onDegraded(true);
    return null;
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  rememberUrl(a.cache, a.cacheKey, url, a.playing());
  bumpTtsMeta('synth');
  a.onDegraded(false);
  void putTts(idbKey, blob, blob.type || 'audio/wav');
  return url;
}
