import { describe, expect, test } from 'vitest';
import { dateKey, daysBetween, shiftKey, daySeed, todayKey } from '../../lib/dates';

describe('dates — 단일 날짜 키(리뷰 F1)', () => {
  test('로컬 날짜로 센다(UTC 아님)', () => {
    // 로컬 자정 직후 — toISOString이었다면 타임존에 따라 전날이 된다
    const d = new Date(2026, 8, 5, 0, 30); // 2026-09-05 00:30 local
    expect(dateKey(d)).toBe('2026-09-05');
  });
  test('todayKey는 dateKey(now)와 같다', () => {
    const now = new Date();
    expect(todayKey(now)).toBe(dateKey(now));
  });
  test('daysBetween은 달력일 차이', () => {
    expect(daysBetween('2026-09-01', '2026-09-04')).toBe(3);
    expect(daysBetween('2026-09-04', '2026-09-01')).toBe(-3);
    expect(daysBetween('bad', '2026-09-01')).toBe(0);
  });
  test('shiftKey는 월을 넘긴다', () => {
    expect(shiftKey('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftKey('2026-01-01', -1)).toBe('2025-12-31');
  });
  test('daySeed는 같은 날 같은 값', () => {
    expect(daySeed('2026-09-24')).toBe(20260924);
  });
});
