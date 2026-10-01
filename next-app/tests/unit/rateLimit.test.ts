import { describe, expect, test } from 'vitest';
import { rateLimit, tooManyRequests } from '../../lib/rateLimit';

/** 앱 자체 한도의 429에도 Retry-After가 붙는다 — 클라이언트(lib/stt.ts)가 이 값만큼 기다렸다 재시도한다 */
describe('tooManyRequests', () => {
  test('기본 Retry-After 5초, 상태 429', async () => {
    const r = tooManyRequests();
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('5');
    expect((await r.json()).error.message).toMatch(/잠시 후/);
  });

  test('초를 지정할 수 있고 정수로 내려간다(최소 1)', () => {
    expect(tooManyRequests(8).headers.get('Retry-After')).toBe('8');
    expect(tooManyRequests(2.6).headers.get('Retry-After')).toBe('3');
    expect(tooManyRequests(0).headers.get('Retry-After')).toBe('1');
  });
});

describe('rateLimit', () => {
  test('창 안에서 limit 회까지 허용, 그다음은 차단', () => {
    const key = `t:${Math.random()}`;
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
  });
});
