'use client';

/**
 * TTS 재생 — Groq Orpheus(Canopy Labs) 신경망 음성을 1순위로 쓴다. React 전 버전에서
 * 가장 자연스럽게(사람처럼) 들렸던 모델로, [cheerful]/[curious] 같은 보컬 디렉션 태그를
 * 문장 앞에 붙이면 진짜 감정 억양으로 발화한다(emotionDirectionTag).
 *
 * iOS 사파리 대응: 오디오 재생은 사용자 제스처(클릭) 안에서 시작돼야 한다. 그런데 Groq
 * 음성은 네트워크로 받아오므로(비동기) 제스처 컨텍스트를 벗어나 차단된다. 그래서 클릭 순간
 * 공용 <audio> 엘리먼트에 무음 클립을 동기적으로 play()해 "언락"해 두고(primeAudio),
 * 음성이 도착하면 같은 엘리먼트의 src만 바꿔 재생한다 — 한 번 언락된 엘리먼트는 이후
 * 비동기 재생도 허용된다(Howler 등이 쓰는 표준 기법).
 *
 * 합성 결과(blob URL)는 캐싱해 다시듣기·반복 재생 시 추가 호출/지연이 없게 한다.
 * 키가 없거나 합성에 실패하면 브라우저 내장 음성으로 폴백한다.
 */
import { speechRate, groqKey, SERVER_GROQ_SENTINEL } from '../lib/state';
import { bumpDiag, bumpTtsMeta } from '../lib/diag';

/** idb 캐시 모듈은 합성할 때만 지연 로딩 — 홈 카드(DramaCard)가 이 파일을 쓰므로 홈 첫 청크에 idb를 넣지 않는다 */
let storageMod: Promise<typeof import('../lib/storage')> | null = null;
const storage = () =>
  (storageMod ||= import('../lib/storage').catch((e) => {
    storageMod = null; // 청크를 못 받았으면(오프라인) 다음에 다시 시도
    throw e;
  }));

/**
 * 신경망 음성이 한도(429)·네트워크로 막혀 브라우저 음성으로 내려갔음을 알리는 전역 신호(M1).
 * 드라마·회화 화면이 상단에 작은 칩('🔈 지금은 기기 음성으로')을 띄운다. 다시 성공하면 TTS_RESTORED_EVENT.
 */
export const TTS_DEGRADED_EVENT = 'va:tts-degraded';
export const TTS_RESTORED_EVENT = 'va:tts-restored';
let ttsDegraded = false;
/** 지금 기기 음성으로 내려가 있나(칩이 늦게 마운트돼도 상태를 알 수 있게) */
export function isTtsDegraded(): boolean {
  return ttsDegraded;
}
function setDegraded(on: boolean) {
  if (ttsDegraded === on || typeof window === 'undefined') return;
  ttsDegraded = on;
  try {
    window.dispatchEvent(new CustomEvent(on ? TTS_DEGRADED_EVENT : TTS_RESTORED_EVENT));
  } catch {
    /* 구형 브라우저 */
  }
}

/** AI 내레이터 기본 보이스(Orpheus). */
export const GROQ_TTS_VOICE = 'austin';
/** 화자별 Orpheus 보이스 — 대화문을 두 사람 목소리로 들려준다. */
export const SPEAKER_GROQ_VOICE: Record<string, string> = { A: 'hannah', B: 'daniel' };

/**
 * 예전에는 여기서 0.84배속을 **항상** 곱했다. "또박또박 들린다"는 의도였지만, 결과적으로
 * 느리게 듣기를 누르지 않아도 늘 느렸고 원어민 리듬(연음·강세)을 들을 기회가 없었다.
 * 이제 기본은 자연 속도(1.0)이고, 사용자가 고른 값을 따른다.
 */
function baseRate(): number {
  try {
    return speechRate();
  } catch {
    return 1; // SSR·저장소 접근 불가
  }
}

/** 한글이 섞여 있으면 한국어로 읽어야 한다 — 영어 목소리로는 뭉개지거나 아예 안 읽힌다. */
const HANGUL_RE = /[\uac00-\ud7a3\u3131-\u318e]/;

export function isKorean(text: string): boolean {
  return HANGUL_RE.test(String(text || ''));
}

/**
 * 문장의 어조를 Orpheus 보컬 디렉션 태그로 변환한다 — 모델이 pitch/rate 흉내가 아니라
 * 실제 감정 표현으로 발화하게 한다. React 전 버전(voice-assistant)의 판정 기준을 그대로 옮겼다.
 */
function emotionDirectionTag(text: string): string {
  const t = String(text || '').trim();
  if (/\b(wow|whoa|oh my|oh my gosh|no way|amazing!|really\?!|seriously\?!)\b/i.test(t)) return '[excited]';
  if (/!/.test(t) || /\b(great|awesome|amazing|excellent|perfect|wonderful|fantastic|congrat(ulation)?s?|well done|good job|nice job|bravo|love it|so (fun|good|cute))\b/i.test(t)) return '[cheerful]';
  if (/\b(actually|the correct (way|form)|instead of|should be|let'?s fix|one small (thing|note))\b/i.test(t)) return '[serious]';
  if (/\b(sorry|unfortunately|mistake|oops|no worries|don'?t worry|that'?s okay|it'?s okay|i understand)\b/i.test(t)) return '[sympathetic]';
  if (/\.\.\.|\bhmm+\b|\bwell,/i.test(t)) return '[hesitant]';
  if (/\?\s*$/.test(t)) return '[curious]';
  return '';
}

// iOS 오디오 언락용 무음 WAV(8kHz·mono·0샘플).
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/* ── 공용 오디오 엘리먼트(언락 상태 공유) ── */
let sharedAudio: HTMLAudioElement | null = null;
function audioEl(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    // iOS 인라인/백그라운드 재생: 잠금화면에서도 오디오가 끊기지 않게 한다.
    sharedAudio.setAttribute('playsinline', '');
    sharedAudio.setAttribute('webkit-playsinline', '');
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

/* ── Media Session(잠금화면 재생 유지 + 잠금화면 컨트롤) ──
 * iOS는 단순 <audio> 재생을 화면이 꺼지면 곧 중단시키지만, Media Session 메타데이터와
 * 액션 핸들러가 등록돼 있으면 "지금 재생 중인 미디어"로 취급해 오디오 세션을 살려두고,
 * 잠금화면에 재생/일시정지 컨트롤을 띄운다. 그래서 화면을 꺼도 AI 음성이 계속 들린다.
 * (단, 브라우저 내장 합성 음성은 잠금 시 OS가 멈추므로 Groq 신경망 음성 경로에서만 유효하다.) */
function mediaSession(): MediaSession | null {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return null;
  return navigator.mediaSession;
}

let mediaHandlersBound = false;
function activateMediaSession() {
  const ms = mediaSession();
  if (!ms) return;
  try {
    if (typeof MediaMetadata !== 'undefined' && !ms.metadata) {
      ms.metadata = new MediaMetadata({
        title: 'AI 영어 회화',
        artist: '내 영어 코치',
        album: '회화 연습',
      });
    }
    if (!mediaHandlersBound) {
      ms.setActionHandler('play', () => {
        const a = audioEl();
        a.play().catch(() => {});
        ms.playbackState = 'playing';
      });
      ms.setActionHandler('pause', () => {
        audioEl().pause();
        ms.playbackState = 'paused';
      });
      ms.setActionHandler('stop', () => stopSpeaking());
      mediaHandlersBound = true;
    }
    ms.playbackState = 'playing';
  } catch {
    /* 일부 핸들러 미지원 — 무시 */
  }
}

function markMediaPaused() {
  const ms = mediaSession();
  if (ms) {
    try {
      ms.playbackState = 'paused';
    } catch {
      /* ignore */
    }
  }
}

/** 오디오 언락 상태 — 한 번 성공하면 이후 primeAudio는 no-op. */
let audioUnlocked = false;

/** 반드시 사용자 제스처(클릭) 안에서 동기적으로 호출 — iOS 오디오 재생을 언락한다.
 * 이미 언락됐으면 아무것도 안 한다 — 예전엔 매 제스처마다 play()를 다시 걸어
 * 직전 TTS 소리가 '유령처럼' 다시 재생되는 버그가 있었다. */
let speechPrimed = false;

export function primeAudio() {
  if (typeof window === 'undefined') return;
  // 키 없는 기본 경로(브라우저 음성)도 iOS는 제스처 안에서 한 번 깨워야 첫 대사가 들린다
  // (예전엔 <audio>만 언락해서 키 없는 아이폰에선 첫 대사가 무음이었다 — 감사 v1.31 비평 #10)
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !speechPrimed && window.speechSynthesis && !window.speechSynthesis.speaking) {
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
      speechPrimed = true;
    } catch {
      /* 미지원 */
    }
  }
  if (audioUnlocked) return;
  try {
    const a = audioEl();
    if (!a.src) a.src = SILENT_WAV;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        audioUnlocked = true;
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/* ── 브라우저 내장 음성(폴백) ── */
const PREFERRED_VOICE_NAMES = [
  'Microsoft Aria Online (Natural)',
  'Microsoft Jenny Online (Natural)',
  'Google US English',
  'Samantha',
  'Google UK English Female',
];

let voiceCache: SpeechSynthesisVoice[] = [];
if (typeof window !== 'undefined' && window.speechSynthesis) {
  voiceCache = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    voiceCache = window.speechSynthesis.getVoices();
  };
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (!voiceCache.length) return undefined;
  const prefix = lang.split('-')[0];
  for (const name of PREFERRED_VOICE_NAMES) {
    const v = voiceCache.find((v) => v.name === name && v.lang.startsWith(prefix));
    if (v) return v;
  }
  return voiceCache.find((v) => v.lang === lang) || voiceCache.find((v) => v.lang.startsWith(prefix));
}

/**
 * 품질 순으로 정렬한 영어 음성 목록 — 대화문 폴백 재생(dialogueAudio)이 화자
 * A/B에 서로 다른 목소리를 고를 때 쓴다. 예전엔 getVoices()의 **첫 두 개**를
 * 그대로 썼는데, 많은 기기에서 첫 항목이 가장 로봇 같은 구형 음성이라
 * "원어민 대화에서 기계음이 난다"의 원인이 됐다. 이름에 Natural/Neural/
 * Online/Google/Premium이 붙은 신형 음성을 앞세운다.
 */
export function rankedEnVoices(): SpeechSynthesisVoice[] {
  const en = voiceCache.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const score = (v: SpeechSynthesisVoice) => {
    const exact = PREFERRED_VOICE_NAMES.indexOf(v.name);
    if (exact >= 0) return 100 - exact;
    if (/natural|neural|online/i.test(v.name)) return 50;
    if (/google|premium|enhanced|siri/i.test(v.name)) return 40;
    if (/samantha|aria|jenny|ava|zoe/i.test(v.name)) return 30;
    if (v.lang === 'en-US') return 10;
    return 0;
  };
  return [...en].sort((a, b) => score(b) - score(a));
}

/* ── 인물별 브라우저 목소리 — 키가 없어도 여자 CEO와 태오가 같은 목소리로 말하지 않게(비평 #11) ── */
const FEMALE_HINTS = new Set(['hannah', 'diana', 'autumn']);
/** 같은 성별 안에서 몇 번째 목소리를 쓸지(인물마다 다르게) */
const HINT_SLOT: Record<string, number> = { austin: 0, daniel: 1, troy: 2, hannah: 0, diana: 1, autumn: 2 };
/** 목소리가 하나뿐인 기기에서의 음높이 차이 */
const HINT_PITCH: Record<string, number> = { austin: 1, daniel: 0.9, troy: 0.82, hannah: 1.12, diana: 1.22, autumn: 1.05 };
const FEMALE_RE = /female|samantha|aria|jenny|zira|karen|moira|tessa|victoria|allison|ava|susan|serena|fiona|kate|zoe|joanna|salli|kimberly|google us english/i;
const MALE_RE = /male|daniel|alex|fred|guy|david|mark|tom|aaron|arthur|oliver|rishi|matthew|joey|justin/i;

function voiceFor(lang: string, hint?: string): { voice?: SpeechSynthesisVoice; pitch: number } {
  const base = pickVoice(lang);
  if (!hint || !lang.startsWith('en')) return { voice: base, pitch: 1 };
  const female = FEMALE_HINTS.has(hint);
  const pool = rankedEnVoices().filter((v) => (female ? FEMALE_RE.test(v.name) && !/\bmale\b/i.test(v.name) : MALE_RE.test(v.name) && !FEMALE_RE.test(v.name)));
  if (pool.length) {
    // 같은 성별 목소리가 모자라 다른 인물과 겹치면(예: 남성 목소리 2개에 남자 인물 3명) 음높이로 구분한다
    const slot = HINT_SLOT[hint] ?? 0;
    const reused = slot >= pool.length;
    return { voice: pool[slot % pool.length], pitch: reused || pool.length === 1 ? HINT_PITCH[hint] ?? 1 : 1 };
  }
  return { voice: base, pitch: HINT_PITCH[hint] ?? 1 };
}

function speakWithBrowser(text: string, lang: string, rate: number, onend?: () => void, voiceHint?: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  const gen = speakGen;
  const fire = () => {
    if (gen !== speakGen) return; // 그 사이 멈춤·새 재생이 있었으면 늦은 발화는 버린다
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const { voice, pitch } = voiceFor(lang, voiceHint);
    if (voice) u.voice = voice;
    u.pitch = pitch;
    if (onend) {
      u.onend = onend;
      // iOS 'not-allowed'·Chrome 'synthesis-failed' 등은 onend가 오지 않는다 — 기다리다 멈추지 않게
      u.onerror = (e: SpeechSynthesisErrorEvent) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') onend();
      };
    }
    try {
      synth.resume(); // Chrome: cancel() 후 paused에 갇히면 speak()가 무음이 된다
    } catch {
      /* ignore */
    }
    synth.speak(u);
  };
  // iOS/WebKit 버그: cancel() 직후 같은 틱에서 speak()하면 새 발화까지 같이 지워져
  // 아무 소리도 안 날 수 있다. 재생 중이던 게 있을 때만 취소하고, 취소 효과가
  // 반영될 시간을 살짝 준 뒤에 새 발화를 큐에 넣는다.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(fire, 60);
  } else {
    fire();
  }
}

/* ── Groq 신경망 음성 ── */
const ttsCache = new Map<string, string>(); // `${voice}:${text}` -> objectURL
const ttsInflight = new Map<string, Promise<string | null>>(); // 진행 중인 요청(중복 합치기)

// 타임아웃을 두 단계로 분리한다:
// - 헤더(응답 시작)까지 8초 — 서버가 죽었는지 판단.
// - 본문(오디오 전체) 다운로드는 30초 — Orpheus WAV(48kHz)는 문장당 수백 KB~1MB라
//   모바일 회선에선 8초로 부족했고, 다 받는 중에 abort돼 무음 폴백으로 떨어졌다
//   ("소리가 안 난다"의 실제 원인 후보).
const TTS_HEADER_TIMEOUT_MS = 8000;
const TTS_BODY_TIMEOUT_MS = 30000;

/** 429 재시도 대기 상한 — 이보다 길면 기다리지 않고 바로 브라우저 음성으로 */
const TTS_RETRY_MAX_MS = 10000;
const TTS_RETRY_DEFAULT_MS = 2000;

/** Retry-After(초 또는 HTTP 날짜) → ms. 없거나 못 읽으면 기본 2초, 상한 10초 */
export function retryAfterMs(header: string | null, now = Date.now()): number {
  if (!header) return TTS_RETRY_DEFAULT_MS;
  const sec = Number(header);
  let ms = Number.isFinite(sec) ? sec * 1000 : Date.parse(header) - now;
  if (!Number.isFinite(ms) || ms < 0) ms = TTS_RETRY_DEFAULT_MS;
  return Math.min(TTS_RETRY_MAX_MS, ms);
}

/** 서버 TTS 한 번 호출 — 헤더 8초/본문 30초 타임아웃. 네트워크 오류는 null */
async function requestTts(input: string, voice: string, key: string): Promise<Response | null> {
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), TTS_HEADER_TIMEOUT_MS);
  try {
    const resp = await fetch('/app/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input, voice, key: key === SERVER_GROQ_SENTINEL ? undefined : key }),
      signal: controller.signal,
    });
    // 헤더가 도착했으면 본문 다운로드용 긴 타이머로 교체
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), TTS_BODY_TIMEOUT_MS);
    if (!resp.ok) return resp;
    const blob = await resp.blob();
    // 빈/손상 응답(예: rate-limit 직전의 잘린 본문)을 캐싱하면 재생 시 onended가 오지
    // 않아 그 줄에서 영영 멈춘다 — 유효한 오디오만 돌려준다.
    if (!blob || blob.size < 256) return null;
    return new Response(blob, { status: 200, headers: { 'Content-Type': blob.type || 'audio/wav' } });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Groq에서 음성을 받아 objectURL을 돌려준다(캐시). 실패·타임아웃 시 null.
 * 문장 앞에 감정 디렉션 태그를 붙여 Orpheus가 사람처럼 감정을 실어 발화하게 한다.
 * 속도는 재생 단계에서 음높이를 유지한 채(preservesPitch) 조절하므로 여기선 속도 무관하게
 * 한 번만 합성해 캐싱한다.
 *
 * M1 — 캐시는 두 겹: 메모리(objectURL) → IndexedDB('tts', LRU 300). 미스일 때만 합성하고 결과를
 * idb에 넣어 두므로 같은 대사를 내일 다시 들어도 합성 한도(10/분·100/일)를 쓰지 않는다.
 * 429면 Retry-After(≤10초)만큼 한 번 기다렸다 재시도, 그래도 안 되면 null(호출부가 브라우저 음성으로)
 * + 'va:tts-degraded' 신호. 적중/미스/합성/429는 va_tts_meta에 일별로 센다.
 */
export async function fetchGroqTTS(text: string, voice = GROQ_TTS_VOICE, opts?: { tagless?: boolean }): Promise<string | null> {
  const key = groqKey();
  if (!key) return null;
  const cacheKey = `${voice}:${opts?.tagless ? 'flat:' : ''}${text}`;
  const cached = ttsCache.get(cacheKey);
  if (cached) {
    bumpTtsMeta('hit');
    return cached;
  }
  // 같은 문장을 동시에(미리받기 + 실제재생) 두 번 요청하면 호출이 두 배가 돼 rate-limit에
  // 걸리고, 그러면 그 줄에서 폴백/멈춤이 난다. 진행 중인 요청이 있으면 그걸 함께 기다린다.
  const pending = ttsInflight.get(cacheKey);
  if (pending) return pending;

  // 회의록/이메일 같은 격식체 문서는 잡담용 감정 디렉션 태그([cheerful]/[curious] 등)를
  // 붙이면 오히려 부자연스럽게 들린다 — tagless 옵션으로 끌 수 있게 한다.
  const tag = opts?.tagless ? '' : emotionDirectionTag(text);
  const input = tag ? `${tag} ${text}` : text;
  const job = (async (): Promise<string | null> => {
    // ① idb 캐시(사설 모드 등 idb 불가 → null → 합성)
    const st = await storage().catch(() => null);
    const idbKey = st ? st.ttsKey(voice, !!opts?.tagless, text) : '';
    const hit = st ? await st.getTts(idbKey) : null;
    if (hit) {
      const url = URL.createObjectURL(hit.blob);
      ttsCache.set(cacheKey, url);
      bumpTtsMeta('hit');
      return url;
    }
    bumpTtsMeta('miss');
    // ② 합성(429면 Retry-After만큼 한 번 대기 후 재시도)
    let resp = await requestTts(input, voice, key);
    if (resp && resp.status === 429) {
      bumpTtsMeta('tts429');
      bumpDiag('tts429');
      await new Promise((r) => setTimeout(r, retryAfterMs(resp!.headers.get('retry-after'))));
      resp = await requestTts(input, voice, key);
      if (resp && resp.status === 429) bumpTtsMeta('tts429');
    }
    if (!resp || !resp.ok) {
      // 키가 틀린 경우(401)는 '저하'가 아니라 설정 문제 — 칩을 띄우지 않는다
      if (!resp || resp.status !== 401) setDegraded(true);
      return null;
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    ttsCache.set(cacheKey, url);
    bumpTtsMeta('synth');
    setDegraded(false);
    if (st) void st.putTts(idbKey, blob, blob.type || 'audio/wav');
    return url;
  })();
  ttsInflight.set(cacheKey, job);
  try {
    return await job;
  } finally {
    ttsInflight.delete(cacheKey);
  }
}

/**
 * 공용 엘리먼트로 objectURL(Orpheus 음성)을 재생한다. Promise는 play() 결과.
 * 기본 0.84배속에 rate(느리게 듣기 등)를 곱하되 preservesPitch로 음높이를 유지해,
 * 느려져도 음이 낮아지거나 뭉개지지 않고 사람이 천천히 또박또박 말하듯 들린다.
 */
export function playUrl(url: string, rate: number, onended?: () => void): Promise<void> {
  const a = audioEl();
  window.speechSynthesis?.cancel();
  a.pause();
  a.src = url;
  // 일부 브라우저는 벤더 프리픽스가 필요 — 셋 다 시도해 음높이 보존을 보장한다.
  type PitchAudio = HTMLAudioElement & { mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean };
  const pa = a as PitchAudio;
  try { pa.preservesPitch = true; pa.mozPreservesPitch = true; pa.webkitPreservesPitch = true; } catch { /* ignore */ }
  a.playbackRate = baseRate() * rate;
  // onended뿐 아니라 onerror에서도 다음으로 진행 — 한 줄의 오디오가 깨졌어도
  // 그 줄에서 영영 멈추지 않게 한다(한 번만 호출되도록 핸들러를 즉시 해제).
  const finish = () => { a.onended = null; a.onerror = null; markMediaPaused(); };
  if (onended) {
    const advance = () => { finish(); onended(); };
    a.onended = advance;
    a.onerror = advance;
  } else {
    a.onended = finish;
    a.onerror = finish;
  }
  const p = a.play();
  if (p && typeof p.then === 'function') p.then(() => { audioUnlocked = true; }).catch(() => {});
  // 잠금화면에서도 계속 재생되도록 "재생 중" 미디어 세션을 활성화한다.
  activateMediaSession();
  return p && typeof p.then === 'function' ? p : Promise.resolve();
}

/**
 * Groq Orpheus는 요청당 입력이 200자로 제한된다 — 이를 넘는 텍스트는 문장 →
 * 쉼표 → 공백 순으로 잘라 순차 재생한다. 그동안 200자를 넘는 요청은 조용히
 * 400으로 실패해 브라우저 폴백(기기에 따라 무음)으로 떨어졌다 — "음성이 안
 * 나온다"의 핵심 원인.
 */
const TTS_MAX_CHARS = 180; // 감정 태그([cheerful] 등) 여유분 포함 200자 안쪽

export function splitForTTS(text: string, max = TTS_MAX_CHARS): string[] {
  const sentences = String(text).split(/(?<=[.!?])\s+/).filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    if (s.length <= max) {
      out.push(s);
      continue;
    }
    let rest = s;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(', ', max);
      if (cut < 40) cut = rest.lastIndexOf(' ', max);
      if (cut < 40) cut = max;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).replace(/^[,\s]+/, '');
    }
    if (rest) out.push(rest);
  }
  return out.length ? out : [String(text)];
}

/**
 * 텍스트 재생. voice: Groq 보이스 이름(대화문 화자별로 다르게 줄 때).
 * 키가 있으면 Groq 신경망 음성, 없거나 실패하면 브라우저 음성.
 * 긴 텍스트는 자동으로 조각내 순차 재생하고(다음 조각은 미리 받아 끊김 최소화),
 * onend는 마지막 조각이 끝난 뒤 한 번만 호출된다.
 */
/**
 * 한국어와 영어가 섞인 글을 스크립트별로 잘라 각각 제 목소리로 읽는다.
 *
 * 코치가 "막혔을 때 한국어로" 답하면 한 문단 안에 두 언어가 함께 온다
 * ("~라는 뜻이에요. 영어로는 이렇게 말해요: Could you clarify that?").
 * 통째로 한 목소리에 넘기면 한쪽이 반드시 뭉개진다 — 한국어 목소리로 영어를 읽으면
 * 알파벳을 하나씩 읽어버리고, 영어 목소리로 한글을 읽으면 대개 아무 소리도 안 난다.
 */
function splitByScript(text: string): { text: string; ko: boolean }[] {
  const parts = String(text)
    .split(/(?<=[.!?。？！:])\s+|\n+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out: { text: string; ko: boolean }[] = [];
  for (const p of parts) {
    const ko = isKorean(p);
    const last = out[out.length - 1];
    if (last && last.ko === ko) last.text += ' ' + p;
    else out.push({ text: p, ko });
  }
  return out;
}

export function speakText(text: string, lang = 'en-US', rate = 1, onend?: () => void, voice?: string, opts?: { tagless?: boolean }) {
  primeAudio(); // 제스처 안에서 동기 언락
  // 한국어는 Orpheus(영어 전용)로 보내면 안 된다 — 호출부가 기본값 'en-US'를 그대로
  // 넘기는 곳이 많아, 텍스트를 보고 직접 판단한다. 그래야 한국어 뜻·설명도 들린다.
  if (isKorean(text)) {
    const segs = splitByScript(text);
    // 한국어만 있으면 그대로, 섞여 있으면 조각마다 언어를 바꿔가며 이어서 읽는다
    if (segs.length <= 1) {
      speakWithBrowser(text, 'ko-KR', baseRate() * rate, onend);
      return;
    }
    let i = 0;
    const step = () => {
      if (i >= segs.length) {
        onend?.();
        return;
      }
      const seg = segs[i++];
      if (seg.ko) speakWithBrowser(seg.text, 'ko-KR', baseRate() * rate, step);
      else speakText(seg.text, lang, rate, step, voice, opts);
    };
    step();
    return;
  }
  if (!lang.startsWith('en') || !groqKey()) {
    speakWithBrowser(text, lang, baseRate() * rate, onend, voice);
    return;
  }
  const chunks = splitForTTS(text);
  const v = voice || GROQ_TTS_VOICE;
  // 세대 번호 — stopSpeaking()이 불리면 올라간다. 합성(fetch)이 늦게 끝나도 세대가 바뀌었으면
  // 재생하지 않는다(예전엔 멈춘 뒤 도착한 이전 대사 음성이 현재 대사 위에 재생됐다).
  const gen = speakGen;
  let i = 0;
  const step = () => {
    if (gen !== speakGen) return;
    if (i >= chunks.length) {
      onend?.();
      return;
    }
    const idx = i++;
    if (idx + 1 < chunks.length) fetchGroqTTS(chunks[idx + 1], v, opts).catch(() => {});
    // 한 번 합성한 음성을 재생 단계에서 rate로 조절(음높이 유지) — 느리게 들어도 자연스럽다.
    fetchGroqTTS(chunks[idx], v, opts).then((url) => {
      if (gen !== speakGen) return;
      if (url) {
        playUrl(url, rate, step).catch(() => speakWithBrowser(chunks[idx], lang, baseRate() * rate, step, v));
      } else {
        speakWithBrowser(chunks[idx], lang, baseRate() * rate, step, v);
      }
    });
  };
  step();
}

/** 진행 중인 모든 음성(Groq 오디오 + 브라우저 합성)을 멈춘다. */
let speakGen = 0;

export function stopSpeaking() {
  speakGen++;
  sharedAudio?.pause();
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  markMediaPaused();
}

import { SpeakerIcon } from './icons';
import { rateLabel, useSlowRate } from './SpeechRate';

export default function SpeakButton({ text, lang = 'en-US', slow = false }: { text: string; lang?: string; slow?: boolean }) {
  // 느리게 듣기 배속은 사용자가 고른 값을 따른다(기본 0.6배속)
  const rate = useSlowRate();
  return (
    <button
      type="button"
      className="speak-mini"
      onClick={() => speakText(text, lang, slow ? rate : 1)}
      title={slow ? `${rateLabel(rate)} 느리게` : '듣기'}
    >
      {slow ? <span className="speak-mini-slow">{rateLabel(rate)}</span> : <SpeakerIcon />}
    </button>
  );
}
