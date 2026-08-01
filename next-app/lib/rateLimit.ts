/**
 * API 라우트용 간단한 슬라이딩 윈도우 rate limiter — 상용화 Phase 0.
 *
 * /api/groq·/api/tts는 인증 없이 호출 가능해, 서버 키가 설정된 배포에서는
 * 외부 봇이 무제한으로 AI 호출 비용을 태울 수 있었다. IP당 분당 호출 수를
 * 제한해 최소한의 방어선을 만든다.
 *
 * ⚠️ 한계(의도된 트레이드오프): 인스턴스 메모리 기반이라 서버리스 다중
 * 인스턴스에서는 인스턴스별로 따로 계산된다. 본격 상용 단계(Phase 1)에서는
 * Upstash Redis 등 공유 저장소 기반으로 교체하고, 로그인 사용자 단위
 * 메터링과 결합할 것.
 */

const buckets = new Map<string, number[]>();
/** 메모리 보호 — 추적하는 키가 이 수를 넘으면 오래된 것부터 버린다. */
const MAX_TRACKED_KEYS = 5000;

/**
 * key(예: "groq:1.2.3.4")가 windowMs 안에서 limit 회를 넘지 않았으면 true(허용)를
 * 반환하고 이번 호출을 기록한다. 넘었으면 false(차단).
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const k of buckets.keys()) {
      if (buckets.size <= MAX_TRACKED_KEYS / 2) break;
      buckets.delete(k);
    }
  }
  return true;
}

/** 프록시 뒤에서도 동작하는 클라이언트 IP 추출(없으면 'unknown'으로 묶어서 제한). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip') || 'unknown';
}

/** 429 응답 본문 — 두 라우트에서 같은 형태를 쓴다. */
export function tooManyRequests() {
  return Response.json(
    { error: { message: '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' } },
    { status: 429 }
  );
}
