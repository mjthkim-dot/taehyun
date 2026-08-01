import { NextRequest } from 'next/server';
import { rateLimit, clientIp, tooManyRequests } from '../../../lib/rateLimit';

/**
 * Groq Chat Completions 서버 프록시 — "No-key UX" (Phase 3).
 * 서버 환경변수 GROQ_API_KEY가 설정돼 있으면 사용자는 앱에서 키를 직접 등록할 필요가
 * 없다. 클라이언트가 로컬에 저장한 키가 있으면 그걸 fallback으로 함께 보내고,
 * 둘 다 없으면 기존과 동일하게 NO_GROQ_KEY 에러를 돌려준다.
 *
 * 주의: 이 라우트는 인증 없이 누구나 호출할 수 있다. 개인용 배포라면 Vercel의
 * Deployment Protection(비공개 URL/암호 보호) 등으로 접근을 제한해 무료 한도가
 * 외부에 의해 소진되지 않도록 하는 것을 권장한다.
 */

const GROQ_MODEL = 'llama-3.3-70b-versatile';

/* ── 남용 방어(상용화 Phase 0) — IP당 호출 제한 + 입력 크기 상한 ── */
const RATE_LIMIT_PER_MIN = 30;
/** 대화 메시지 배열 최대 길이·전체 문자수 — 정상 사용(시스템+최근 8턴)의 여유 상한. */
const MAX_MESSAGES = 24;
const MAX_TOTAL_CHARS = 16000;
const MAX_TOKENS_CAP = 1200;

export async function GET() {
  return Response.json({ hasServerKey: !!process.env.GROQ_API_KEY });
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`groq:${clientIp(req.headers)}`, RATE_LIMIT_PER_MIN, 60_000)) {
    return tooManyRequests();
  }
  const body = await req.json().catch(() => null);
  const { messages, temperature, maxTokens, json, stream, key } = body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return Response.json({ error: { message: '잘못된 요청입니다.' } }, { status: 400 });
  }
  const totalChars = messages.reduce((a: number, m: { content?: unknown }) => a + String(m?.content ?? '').length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return Response.json({ error: { message: '요청이 너무 깁니다.' } }, { status: 413 });
  }
  const apiKey = process.env.GROQ_API_KEY || key;
  if (!apiKey) {
    return Response.json({ error: { message: 'NO_GROQ_KEY' } }, { status: 401 });
  }

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      stream: !!stream,
      temperature: Math.min(Math.max(Number(temperature ?? 0.7) || 0.7, 0), 2),
      max_tokens: Math.min(Number(maxTokens ?? 400) || 400, MAX_TOKENS_CAP),
      ...(json ? { response_format: { type: 'json_object' } } : {}),
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

  if (stream) {
    return new Response(resp.body, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    });
  }
  const data = await resp.json();
  return Response.json(data);
}
