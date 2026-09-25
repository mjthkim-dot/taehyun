import { NextRequest } from 'next/server';
import { rateLimit, clientIp, tooManyRequests } from '../../../../lib/rateLimit';

/**
 * Groq 키 유효성 검증 — 토큰 과금이 없는 /models 조회로 키가 살아있는지 확인한다.
 * 배경: 무효한 키(만료·폐기)를 등록해도 앱이 아무 경고 없이 받아들여, 모든
 * AI 기능이 조용히 401로 죽는 사고가 실제로 발생했다(음성 무음의 최종 원인).
 * 반환: { valid: true | false | null } — null은 네트워크 문제로 판단 불가(경고 금지).
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`validate:${clientIp(req.headers)}`, 10, 60_000)) {
    return tooManyRequests();
  }
  const body = await req.json().catch(() => null);
  const key = typeof body?.key === 'string' ? body.key : '';
  const apiKey = key || process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ valid: false, reason: 'NO_KEY' });
  }
  const resp = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  }).catch(() => null);
  if (!resp) return Response.json({ valid: null, reason: 'NETWORK' }); // 판단 불가 — 오경보 금지
  if (resp.ok) return Response.json({ valid: true });
  if (resp.status === 401 || resp.status === 403) return Response.json({ valid: false, status: resp.status });
  return Response.json({ valid: null, status: resp.status });
}
