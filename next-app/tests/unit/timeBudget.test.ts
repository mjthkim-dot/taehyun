import { beforeEach, describe, expect, test } from 'vitest';
import { addMinutes, budget, totalHours, hoursBetween, hoursToNext, etaWeeks, etaLine } from '../../lib/timeBudget';

describe('timeBudget — va_growth.time 필드 단위 갱신', () => {
  beforeEach(() => localStorage.clear());
  test('addMinutes는 종류별로 쌓이고 다른 필드는 보존', () => {
    localStorage.setItem('va_growth', JSON.stringify({ weeklyGoalH: 10, monthly: [{ date: '2026-09-06' }] }));
    addMinutes('output', 5, '2026-10-01');
    addMinutes('output', 2.5, '2026-10-01');
    addMinutes('fluency', 3, '2026-10-01');
    addMinutes('input', 4, '2026-09-30');
    addMinutes('form', -3, '2026-10-01'); // 무시
    const g = JSON.parse(localStorage.getItem('va_growth')!);
    expect(g.weeklyGoalH).toBe(10);
    expect(g.monthly).toHaveLength(1);
    expect(g.time['2026-10-01']).toEqual({ input: 0, output: 7.5, fluency: 3, form: 0 });
    expect(g.time['2026-09-30'].input).toBe(4);
  });
  test('budget(days)는 빈 날을 0으로 채우고 합계를 낸다', () => {
    addMinutes('output', 10, '2026-10-01');
    addMinutes('input', 20, '2026-09-29');
    addMinutes('form', 99, '2026-09-20'); // 창 밖
    const b = budget(3, '2026-10-01');
    expect(b.days.map((d) => d.date)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
    expect(b.days[1]).toEqual({ date: '2026-09-30', input: 0, output: 0, fluency: 0, form: 0 });
    expect(b.totals).toEqual({ input: 20, output: 10, fluency: 0, form: 0 });
    expect(b.totalMin).toBe(30);
    expect(totalHours()).toBeCloseTo(10 / 60);
    expect(totalHours(['form'])).toBeCloseTo(99 / 60);
  });
});

describe('timeBudget — STAGES·ETA', () => {
  test('누적 단계 시간(가이드 × 1.5)', () => {
    expect(hoursBetween('A1', 'A2')).toBe(150);
    expect(hoursBetween('A1', 'B1')).toBe(450);
    expect(hoursBetween('A2', 'B1')).toBe(300);
    expect(hoursBetween('B1', 'A2')).toBe(0);
    expect(hoursToNext('A2', 240)).toBe(60);
    expect(hoursToNext('A2', 1000)).toBe(0);
    expect(hoursToNext('A2', 240, 'A1')).toBe(450 - 240);
    expect(etaWeeks(60, 7)).toBe(9);
    expect(etaWeeks(0, 7)).toBe(0);
  });
  test('etaLine 문구', () => {
    expect(etaLine('A2', 240)).toBe('누적 말하기 240h · B1까지 약 60h');
    expect(etaLine('A2', 14)).toBe('누적 말하기 14h · B1까지 약 286h');
    expect(etaLine('A1', 0.25)).toBe('누적 말하기 0.3h · A2까지 약 150h');
    expect(etaLine('A2', 300)).toBe('누적 말하기 300h · B1 입증만 남았어요');
    expect(etaLine('C1', 2000)).toBe('누적 말하기 2000h · 최고 단계');
    expect(etaLine('C2', 10)).toBe('누적 말하기 10h · 최고 단계');
  });
});
