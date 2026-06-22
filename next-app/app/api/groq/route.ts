import { NextRequest } from 'next/server';

/**
 * Groq Chat Completions 서버 프록시 — "No-key UX" (Phase 3).
 * 서버 환경변수 GROQ_API_KEY가 설정돼 있으면 태현은 앱에서 키를 직접 등록할 필요가
 * 없다. 클라이언트가 로컬에 저장한 키가 있으면 그걸 fallback으로 함께 보내고,
 * 둘 다 없으면 기존과 동일하게 NO_GROQ_KEY 에러를 돌려준다.
 *
 * 주의: 이 라우트는 인증 없이 누구나 호출할 수 있다. 개인용 배포라면 Vercel의
 * Deployment Protection(비공개 URL/암호 보호) 등으로 접근을 제한해 무료 한도가
 * 외부에 의해 소진되지 않도록 하는 것을 권장한다.
 */

const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function GET() {
  return Response.json({ hasServerKey: !!process.env.GROQ_API_KEY });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages, temperature, maxTokens, json, stream, key } = body || {};
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
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 400,
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
