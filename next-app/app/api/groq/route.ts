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

/**
 * 모델 폴백 체인 — llama-3.3-70b-versatile이 2026-08-16 서비스 종료됐다
 * (Groq 공지, 권장 대체: GPT OSS 120B / Qwen3.6 27B). 같은 일이 또 생겨도
 * 앱이 통째로 죽지 않도록, 모델 오류(종료·미존재)면 체인의 다음 모델로
 * 자동 재시도한다. 성공한 모델은 모듈 캐시에 남아 이후 요청은 재시도 없이
 * 바로 그 모델을 쓴다(콜드스타트마다 1회 탐색).
 */
const MODEL_CHAIN = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'llama-3.3-70b-versatile'];
let resolvedModel: string | null = null;

/** 이 오류면 키·요청 문제가 아니라 모델 문제 — 다음 모델로 넘어갈 근거 */
function isModelError(status: number, detail: string): boolean {
  return (status === 400 || status === 404) && /decommission|deprecat|not found|does not exist|invalid model|no longer|unknown model/i.test(detail);
}

/* ── 남용 방어(상용화 Phase 0) — IP당 호출 제한 + 입력 크기 상한 ── */
const RATE_LIMIT_PER_MIN = 30;
/** 대화 메시지 배열 최대 길이·전체 문자수 — 정상 사용(시스템+최근 8턴)의 여유 상한. */
const MAX_MESSAGES = 24;
const MAX_TOTAL_CHARS = 16000;
const MAX_TOKENS_CAP = 1200;

export async function GET() {
  return Response.json({ hasServerKey: !!process.env.GROQ_API_KEY, model: resolvedModel || MODEL_CHAIN[0] });
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

  // 캐시된 모델을 앞세우고, 실패하면 나머지 체인으로
  const models = resolvedModel ? [resolvedModel, ...MODEL_CHAIN.filter((m) => m !== resolvedModel)] : MODEL_CHAIN;
  let lastStatus = 502;
  let lastDetail = 'Groq 연결 실패';
  for (const model of models) {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        stream: !!stream,
        temperature: Math.min(Math.max(Number(temperature ?? 0.7) || 0.7, 0), 2),
        max_tokens: Math.min(Number(maxTokens ?? 400) || 400, MAX_TOKENS_CAP),
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    }).catch(() => null);

    if (!resp) {
      lastStatus = 502;
      lastDetail = 'Groq 연결 실패';
      break; // 네트워크 문제는 모델을 바꿔도 소용없다
    }
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
        continue; // 다음 모델로
      }
      if (resp.status === 401) detail = 'API 키가 올바르지 않습니다.';
      return Response.json({ error: { message: detail } }, { status: resp.status });
    }

    resolvedModel = model;
    if (stream) {
      return new Response(resp.body, {
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
      });
    }
    const data = await resp.json();
    return Response.json(data);
  }
  return Response.json({ error: { message: `사용 가능한 모델이 없습니다 — ${lastDetail}` } }, { status: lastStatus });
}
