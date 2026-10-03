import { APP_VERSION } from '../../../lib/version';

/**
 * 지금 배포된 빌드 — '새 버전이 있어요' 배너가 이미 최신을 받은 직후에도 뜨던 문제(감사 v1.31
 * 견고성 #5)를 막으려고, 클라이언트는 실행 중인 빌드와 이 값이 다를 때만 배너를 띄운다.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ v: APP_VERSION, c: process.env.NEXT_PUBLIC_COMMIT || '' }, { headers: { 'Cache-Control': 'no-store' } });
}
