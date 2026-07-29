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

/* ── 남용 방어(상용화 Phase 0) ──
 * rate limit: 정상 사용도 버스트가 크다 — 대화문 전체 재생(10줄) + 다음 줄
 * 프리페치 + 문장 분할 재생이 겹치면 분당 20을 훌쩍 넘어, 우리가 만든 제한이
 * 우리 재생을 429로 죽였다("음성이 안 나온다"의 공범). 60/분으로 완화.
 * MAX_TEXT_CHARS: Groq Orpheus는 요청당 200자 제한 — 초과분은 어차피 400이므로
 * 서버 한도도 여기에 정렬한다(클라이언트는 180자 기준으로 미리 분할). */
const RATE_LIMIT_PER_MIN = 60;
const MAX_TEXT_CHARS = 220;

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

  const resp = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: voice || DEFAULT_VOICE,
      input: text,
      response_format: 'wav', // Orpheus는 현재 wav만 지원 (mp3 요청 시 오류)
    }),
  }).catch(() => null);

  if (!resp) {
    return Response.json({ error: { message: 'Groq 연결 실패' } }, { status: 502 });
  }
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const e = await resp.json();
      detail = e.error?.message || detail;
    } catch {
      /* ignore */
    }
    if (resp.status === 401) detail = 'API 키가 올바르지 않습니다.';
    return Response.json({ error: { message: detail } }, { status: resp.status });
  }

  return new Response(resp.body, { headers: { 'Content-Type': 'audio/wav' } });
}
