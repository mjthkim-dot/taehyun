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
 *
 * detail 필드(소리 레일):
 *   none(기본)  → 현행 그대로 {text}
 *   segments    → verbose_json + 세그먼트 확신도 → 품질 게이트(무음 환각·불명확)
 *   words       → + 단어 타임스탬프 → WPM·멈춤·절 내부 멈춤(lib/fluency.ts)
 * 응답은 {text, duration, words?, segments?} — 세그먼트는 게이트에 필요한 필드만 남긴다
 * (원본 세그먼트에는 토큰 배열이 붙어 전사 한 건이 수십 KB가 된다).
 */
const STT_MODEL = 'whisper-large-v3-turbo';
const RATE_LIMIT_PER_MIN = 40;
/** 앱 자체 한도에 걸렸을 때 클라이언트가 기다릴 초 — 분당 한도라 짧게 */
const RATE_LIMIT_RETRY_SEC = 5;
/** 25MB는 Groq 한도. 학습용 발화는 길어야 30초라 4MB로 충분하고, 사고를 막는다. */
const MAX_BYTES = 4 * 1024 * 1024;

type Detail = 'none' | 'segments' | 'words';

interface UpstreamSegment {
  start?: number;
  end?: number;
  text?: string;
  avg_logprob?: number;
  no_speech_prob?: number;
  compression_ratio?: number;
}
interface UpstreamWord {
  word?: string;
  start?: number;
  end?: number;
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`stt:${clientIp(req.headers)}`, RATE_LIMIT_PER_MIN, 60_000)) {
    return tooManyRequests(RATE_LIMIT_RETRY_SEC);
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
  // 클라이언트가 보낸 파일명을 그대로 넘긴다 — Whisper는 확장자로 포맷을 판별하므로
  // iOS(mp4) 녹음을 webm이라고 속이면 디코딩에 실패한다.
  const name = file instanceof File && file.name ? file.name : 'speech.webm';
  upstream.append('file', file, name);
  upstream.append('model', STT_MODEL);
  // 기본은 영어 고정(영어 학습이므로 한국어 혼입을 줄인다). "막혀서 한국어로 물어보는"
  // 경로는 'ko'를, 회화 탭(이중언어)은 'auto'를 명시한다 — auto면 upstream에 language를
  // 아예 보내지 않아 Whisper가 감지한다.
  const langRaw = form.get('language');
  const lang = typeof langRaw === 'string' && /^(en|ko|auto)$/.test(langRaw) ? langRaw : 'en';
  if (lang !== 'auto') upstream.append('language', lang);

  const detailRaw = form.get('detail');
  const detail: Detail = detailRaw === 'words' || detailRaw === 'segments' ? detailRaw : 'none';
  if (detail === 'none') {
    upstream.append('response_format', 'json');
  } else {
    upstream.append('response_format', 'verbose_json');
    // 대괄호가 붙은 배열 필드명이어야 Groq가 받는다(timestamp_granularities만 보내면 무시됨)
    upstream.append('timestamp_granularities[]', 'segment');
    if (detail === 'words') upstream.append('timestamp_granularities[]', 'word');
  }

  // 채점 경로는 temperature 0으로 고정한다(같은 소리 → 같은 전사, 재측정 변동 억제)
  const tempRaw = form.get('temperature');
  if (typeof tempRaw === 'string' && /^(0|0\.\d+|1)$/.test(tempRaw)) upstream.append('temperature', tempRaw);

  // 학습 문맥을 알려주면 고유명사·전문 용어 인식률이 올라간다(선택).
  // ⚠️ 채점 경로는 목표 문장을 넣지 않는다 — 넣으면 전사가 목표 쪽으로 끌려가 점수가 부푼다.
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
    let detailMsg = `HTTP ${resp.status}`;
    try {
      detailMsg = (await resp.json()).error?.message || detailMsg;
    } catch {
      /* 본문 없음 */
    }
    if (resp.status === 401) detailMsg = 'API 키가 올바르지 않습니다.';
    // Groq의 429는 Retry-After를 그대로 넘긴다 — 클라이언트가 그만큼 기다렸다 한 번 재시도
    const headers: Record<string, string> = {};
    if (resp.status === 429) {
      const ra = resp.headers.get('retry-after');
      if (ra) headers['Retry-After'] = ra;
    }
    return Response.json({ error: { message: detailMsg } }, { status: resp.status, headers });
  }

  const data = (await resp.json().catch(() => ({}))) as {
    text?: string;
    duration?: number;
    words?: UpstreamWord[];
    segments?: UpstreamSegment[];
  };
  const text = String(data.text || '').trim();
  if (detail === 'none') return Response.json({ text });

  const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const out: {
    text: string;
    duration: number;
    segments?: { start: number; end: number; text: string; avg_logprob: number; no_speech_prob: number; compression_ratio: number }[];
    words?: { word: string; start: number; end: number }[];
  } = { text, duration: num(data.duration) };
  if (Array.isArray(data.segments)) {
    out.segments = data.segments.map((s) => ({
      start: num(s.start),
      end: num(s.end),
      text: String(s.text || '').trim(),
      avg_logprob: num(s.avg_logprob),
      no_speech_prob: num(s.no_speech_prob),
      compression_ratio: num(s.compression_ratio),
    }));
  }
  if (detail === 'words' && Array.isArray(data.words)) {
    out.words = data.words.map((w) => ({ word: String(w.word || '').trim(), start: num(w.start), end: num(w.end) }));
  }
  return Response.json(out);
}
