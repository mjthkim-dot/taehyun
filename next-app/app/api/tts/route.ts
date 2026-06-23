import { NextRequest } from 'next/server';

/**
 * Groq PlayAI TTS 프록시 — /api/groq와 동일한 "No-key UX" 패턴(서버 키 우선, 로컬 키 fallback).
 * 합성 음성을 그대로 audio/wav로 돌려준다.
 */
const TTS_MODEL = 'playai-tts';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text, voice, key, speed } = body || {};
  const apiKey = process.env.GROQ_API_KEY || key;
  if (!apiKey) {
    return Response.json({ error: { message: 'NO_GROQ_KEY' } }, { status: 401 });
  }
  if (!text || typeof text !== 'string') {
    return Response.json({ error: { message: 'text가 필요합니다.' } }, { status: 400 });
  }

  // 느린 발화는 오디오를 늘려 재생(playbackRate)하면 음높이가 낮아져 뭉개진다.
  // Groq playai-tts의 네이티브 speed(0.5~5.0)로 합성하면 모델이 사람이 천천히
  // 말하듯 자연스러운 억양으로 직접 생성한다.
  const sp = typeof speed === 'number' && isFinite(speed) ? Math.min(5, Math.max(0.5, speed)) : 1;

  const resp = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: voice || 'Fritz-PlayAI',
      input: text,
      response_format: 'wav',
      ...(sp !== 1 ? { speed: sp } : {}),
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
