import { NextRequest } from 'next/server';
import { rateLimit, clientIp, tooManyRequests } from '../../../lib/rateLimit';

/**
 * Groq Whisper 프록시 — 브라우저 내장 음성인식(Web Speech)을 대체한다.
 *
 * 배경: Web Speech는 기기·브라우저마다 정확도가 크게 달라 발음 채점의 신뢰도를
 * 깎았고, iOS 설치형 PWA에서는 아예 동작하지 않는 경우도 있었다. TTS는 이미
 * 신경망(Orpheus)으로 올렸으므로 입력도 같은 급으로 맞춘다.
 *
 * 모델은 whisper-large-v3-turbo — 정확도 대비 응답이 빨라 실시간 학습에 맞는다.
 * 오디오는 그대로 흘려보내고(서버에 저장하지 않음), 키는 /api/groq와 동일하게
 * 서버 환경변수 우선 → 없으면 클라이언트가 보낸 키를 쓴다.
 */
const STT_MODEL = 'whisper-large-v3-turbo';
const RATE_LIMIT_PER_MIN = 40;
/** 25MB는 Groq 한도. 학습용 발화는 길어야 30초라 4MB로 충분하고, 사고를 막는다. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!rateLimit(`stt:${clientIp(req.headers)}`, RATE_LIMIT_PER_MIN, 60_000)) {
    return tooManyRequests();
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: { message: '오디오가 필요합니다.' } }, { status: 400 });
  }

  const file = form.get('audio');
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: { message: '오디오가 필요합니다.' } }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: { message: '오디오가 너무 깁니다.' } }, { status: 413 });
  }

  const key = typeof form.get('key') === 'string' ? (form.get('key') as string) : '';
  const apiKey = process.env.GROQ_API_KEY || key;
  if (!apiKey) {
    return Response.json({ error: { message: 'NO_GROQ_KEY' } }, { status: 401 });
  }

  const upstream = new FormData();
  upstream.append('file', file, 'speech.webm');
  upstream.append('model', STT_MODEL);
  upstream.append('language', 'en'); // 영어 학습이므로 고정 — 한국어 혼입을 줄인다
  upstream.append('response_format', 'json');
  // 학습 문맥을 알려주면 고유명사·전문 용어 인식률이 올라간다(선택).
  const prompt = form.get('prompt');
  if (typeof prompt === 'string' && prompt.trim()) upstream.append('prompt', prompt.slice(0, 200));

  const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream,
  }).catch(() => null);

  if (!resp) {
    return Response.json({ error: { message: 'Groq 연결 실패' } }, { status: 502 });
  }
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      detail = (await resp.json()).error?.message || detail;
    } catch {
      /* 본문 없음 */
    }
    if (resp.status === 401) detail = 'API 키가 올바르지 않습니다.';
    return Response.json({ error: { message: detail } }, { status: resp.status });
  }

  const data = await resp.json().catch(() => ({}));
  return Response.json({ text: String(data.text || '').trim() });
}
