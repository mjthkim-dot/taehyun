import { NextRequest } from 'next/server';
import { rateLimit, clientIp, tooManyRequests } from '../../../lib/rateLimit';

/**
 * Groq TTS 프록시 — /api/groq와 동일한 "No-key UX" 패턴(서버 키 우선, 로컬 키 fallback).
 * 합성 음성을 그대로 audio/wav로 돌려준다.
 *
 * 모델은 Canopy Labs Orpheus v1 English — React 전 버전(voice-assistant)에서 쓰던,
 * 실제 사람에 가장 가깝게 들렸던 모델이다. playai-tts와 달리 [cheerful]/[curious] 같은
 * 보컬 디렉션 태그로 진짜 감정 억양을 낸다(태그는 클라이언트에서 문장 앞에 붙여 보낸다).
 * Orpheus는 현재 wav만 지원하고 네이티브 speed 파라미터가 없어, 속도는 클라이언트에서
 * preservesPitch로 음높이를 유지한 채 조절한다.
 */
const TTS_MODEL = 'canopylabs/orpheus-v1-english';
const DEFAULT_VOICE = 'austin';

/**
 * TTS 폴백 체인 — 채팅 모델(llama-3.3-70b)이 예고 후 종료된 것처럼 TTS 모델도
 * 언제든 내려갈 수 있다. Orpheus가 모델 오류를 내면 playai-tts로 자동 재시도해
 * "신경망 음성이 조용히 브라우저 기계음으로 폴백"되는 최악을 막는다.
 * 목소리 이름은 모델마다 달라서 화자 성별을 유지하며 매핑한다.
 */
const PLAYAI_MODEL = 'playai-tts';
const PLAYAI_VOICE: Record<string, string> = {
  austin: 'Fritz-PlayAI',
  daniel: 'Fritz-PlayAI',
  hannah: 'Arista-PlayAI',
  diana: 'Arista-PlayAI',
  troy: 'Fritz-PlayAI',
};
let ttsModelIdx: 0 | 1 = 0; // 0=Orpheus, 1=playai (모듈 캐시)

/**
 * Orpheus 영어 목소리(Groq 문서: autumn·diana·hannah 여성, austin·daniel·troy 남성).
 * 목록 밖 값은 기본값으로, 특정 목소리를 거부하면(없어지거나 이름이 바뀌면) 같은 성별의 다른
 * 목소리로 한 번 더 — 그 인물만 기계음으로 떨어지지 않게(감사 v1.31 비평 #13).
 */
const ORPHEUS_VOICES = new Set(['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy']);
const VOICE_FALLBACK: Record<string, string> = { diana: 'hannah', autumn: 'hannah', hannah: 'diana', troy: 'daniel', daniel: 'austin', austin: 'daniel' };
/** 거부된 목소리 → 대신 통한 목소리(모듈 캐시) — 첫 줄만 두 번 부르고 다음 줄부터는 바로 대체 목소리로 */
const rejectedVoices = new Map<string, string>();

function isModelError(status: number, detail: string): boolean {
  return (status === 400 || status === 404) && /decommission|deprecat|not found|does not exist|invalid model|no longer|unknown model/i.test(detail);
}

function ttsPayload(idx: 0 | 1, text: string, voice: string) {
  if (idx === 0) return { model: TTS_MODEL, voice, input: text, response_format: 'wav' };
  // playai는 Orpheus의 보컬 디렉션 태그([cheerful] 등)를 글자 그대로 읽는다 — 벗겨낸다
  const clean = text.replace(/^\s*\[[a-z ]+\]\s*/i, '');
  return { model: PLAYAI_MODEL, voice: PLAYAI_VOICE[voice] || 'Fritz-PlayAI', input: clean, response_format: 'wav' };
}

/* ── 남용 방어(상용화 Phase 0) ──
 * rate limit: 정상 사용도 버스트가 크다 — 대화문 전체 재생(10줄) + 다음 줄
 * 프리페치 + 문장 분할 재생이 겹치면 분당 20을 훌쩍 넘어, 우리가 만든 제한이
 * 우리 재생을 429로 죽였다("음성이 안 나온다"의 공범). 60/분으로 완화.
 * MAX_TEXT_CHARS: Groq Orpheus는 요청당 200자 제한 — 초과분은 어차피 400이므로
 * 서버 한도도 여기에 정렬한다(클라이언트는 180자 기준으로 미리 분할). */
const RATE_LIMIT_PER_MIN = 60;
const MAX_TEXT_CHARS = 220;

/**
 * 서버→Groq 실연결 진단 — 음성 진단 화면에서 호출한다. 서버 키로 초소형
 * 합성을 실제 시도해 Groq가 뭐라고 답하는지(모델 접근 거부 등)를 그대로
 * 돌려준다(키 값은 절대 노출하지 않음). 클라이언트 쪽 원인과 서버/키 등급
 * 원인을 분리하는 관측 지점.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`tts:${clientIp(req.headers)}`, RATE_LIMIT_PER_MIN, 60_000)) {
    return tooManyRequests();
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, where: 'server-key', detail: '서버에 GROQ_API_KEY가 없어요 — 로컬 키 경로만 사용 중' });
  }
  // ?voices=1 — 드라마 인물 목소리(austin·daniel·troy·hannah·diana)를 하나씩 실제로 합성해 본다.
  // 특정 목소리만 막혔을 때(그 인물만 기계음) 원인을 바로 찾게(감사 v1.31 비평 #13)
  if (req.nextUrl.searchParams.get('voices') === '1') {
    const result: Record<string, string> = {};
    for (const v of ['austin', 'daniel', 'troy', 'hannah', 'diana']) {
      const r = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(ttsPayload(0, 'Hi.', v)),
      }).catch(() => null);
      result[v] = !r ? 'network' : r.ok ? 'ok' : rejectedVoices.has(v) ? `rejected→${rejectedVoices.get(v)}` : `HTTP ${r.status}`;
    }
    return Response.json({ ok: Object.values(result).every((x) => x === 'ok'), voices: result });
  }
  // 체인 순서대로 실제 합성을 시도 — 어느 모델이 살아 있는지까지 보고한다
  let lastDetail = '';
  let lastStatus = 0;
  for (const idx of [0, 1] as const) {
    const resp = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(ttsPayload(idx, 'Hi there.', DEFAULT_VOICE)),
    }).catch(() => null);
    if (!resp) {
      return Response.json({ ok: false, where: 'network', detail: '서버에서 Groq 연결 실패' });
    }
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try {
        detail = (await resp.json()).error?.message || detail;
      } catch {
        /* ignore */
      }
      lastDetail = detail;
      lastStatus = resp.status;
      if (isModelError(resp.status, detail)) continue;
      return Response.json({ ok: false, where: 'groq', status: resp.status, detail });
    }
    ttsModelIdx = idx;
    const buf = await resp.arrayBuffer();
    return Response.json({ ok: true, bytes: buf.byteLength, model: idx === 0 ? TTS_MODEL : PLAYAI_MODEL });
  }
  return Response.json({ ok: false, where: 'groq', status: lastStatus, detail: `모든 TTS 모델 실패 — ${lastDetail}` });
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`tts:${clientIp(req.headers)}`, RATE_LIMIT_PER_MIN, 60_000)) {
    return tooManyRequests();
  }
  const body = await req.json().catch(() => null);
  const { text, voice, key } = body || {};
  if (!text || typeof text !== 'string') {
    return Response.json({ error: { message: 'text가 필요합니다.' } }, { status: 400 });
  }
  if (text.length > MAX_TEXT_CHARS) {
    return Response.json({ error: { message: '텍스트가 너무 깁니다.' } }, { status: 413 });
  }
  const apiKey = process.env.GROQ_API_KEY || key;
  if (!apiKey) {
    return Response.json({ error: { message: 'NO_GROQ_KEY' } }, { status: 401 });
  }

  // 캐시된 모델부터 — 모델 오류(종료·미존재)면 다음 모델로 자동 재시도
  const order: (0 | 1)[] = ttsModelIdx === 0 ? [0, 1] : [1, 0];
  let lastStatus = 502;
  let lastDetail = 'Groq 연결 실패';
  let v = typeof voice === 'string' && ORPHEUS_VOICES.has(voice) ? voice : DEFAULT_VOICE;
  v = rejectedVoices.get(v) ?? v;
  for (const idx of order) {
    const send = () =>
      fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(ttsPayload(idx, text, v)),
      }).catch(() => null);
    let resp = await send();
    // 목소리를 거부하면 같은 성별의 다른 목소리 → 기본 목소리 순으로(성공한 걸 기억해 다음 줄은 바로)
    if (resp && resp.status === 400 && idx === 0) {
      const txt = await resp.clone().text().catch(() => '');
      if (/voice/i.test(txt)) {
        const original = v;
        const tried = new Set([v]);
        for (const alt of [VOICE_FALLBACK[v], DEFAULT_VOICE]) {
          if (!alt || tried.has(alt)) continue;
          tried.add(alt);
          v = alt;
          resp = await send();
          if (resp && resp.ok) {
            rejectedVoices.set(original, alt);
            break;
          }
        }
      }
    }

    if (!resp) break; // 네트워크 문제 — 모델 교체 무의미
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try {
        const e = await resp.json();
        detail = e.error?.message || detail;
      } catch {
        /* ignore */
      }
      if (isModelError(resp.status, detail)) {
        lastStatus = resp.status;
        lastDetail = detail;
        continue;
      }
      if (resp.status === 401) detail = 'API 키가 올바르지 않습니다.';
      // 한도(429)는 Groq의 Retry-After를 그대로 전달 — 클라이언트가 그만큼(≤10초) 한 번 기다렸다가
      // 재시도하고, 그래도 안 되면 브라우저 음성으로 내려간다(M1). 헤더가 없으면 2초.
      if (resp.status === 429) {
        const ra = resp.headers.get('retry-after') || '2';
        return Response.json({ error: { message: detail } }, { status: 429, headers: { 'Retry-After': ra } });
      }
      return Response.json({ error: { message: detail } }, { status: resp.status });
    }
    ttsModelIdx = idx;
    return new Response(resp.body, { headers: { 'Content-Type': 'audio/wav' } });
  }
  return Response.json({ error: { message: lastDetail } }, { status: lastStatus });
}
