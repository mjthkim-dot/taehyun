import { beforeEach, describe, expect, test } from 'vitest';
import { anchors, setAnchor, directionAgreement, appByMonth, ANCHOR_WINDOW } from '../../lib/anchor';

beforeEach(() => localStorage.clear());

describe('anchor — 튜터 점수 버튼(1~9)', () => {
  test('버튼 값만 저장, 같은 값을 다시 누르면 지운다, 범위 밖은 무시', () => {
    setAnchor('2026-09', 'fluency', 5);
    setAnchor('2026-09', 'intelligibility', 6);
    expect(anchors()).toEqual({ '2026-09': { fluency: 5, intelligibility: 6 } });
    setAnchor('2026-09', 'fluency', 5);
    expect(anchors()).toEqual({ '2026-09': { intelligibility: 6 } });
    setAnchor('2026-09', 'fluency', 10);
    setAnchor('2026-09', 'fluency', 0);
    setAnchor('bad', 'fluency', 3);
    expect(anchors()).toEqual({ '2026-09': { intelligibility: 6 } });
    localStorage.setItem('va_anchor', JSON.stringify({ '2026-10': { fluency: 'x', intelligibility: 3.5 }, junk: 1 }));
    expect(anchors()).toEqual({});
  });
});

describe('anchor — 방향 일치 n/6', () => {
  test('이웃한 달의 변화 부호가 같으면 일치(둘 다 그대로도 일치)', () => {
    const tutor = { '2026-07': { fluency: 4 }, '2026-08': { fluency: 5 }, '2026-09': { fluency: 5 }, '2026-10': { fluency: 4 } };
    const app = { '2026-07': { fluency: 60 }, '2026-08': { fluency: 70 }, '2026-09': { fluency: 70 }, '2026-10': { fluency: 75 } };
    expect(directionAgreement(tutor, app)).toEqual({ agree: 2, total: 3 });
  });
  test('최근 6번 비교만 본다 + 월간 기록 → 앱 값', () => {
    const tutor: Record<string, { fluency: number; intelligibility: number }> = {};
    const monthly = [];
    for (let i = 1; i <= 9; i++) {
      const m = `2026-${String(i).padStart(2, '0')}`;
      tutor[m] = { fluency: i, intelligibility: i };
      monthly.push({ date: `${m}-05`, qid: 'intro' as const, durationMs: 60000, wpm: 50 + i, intelligibility: 50 + i });
    }
    const r = directionAgreement(tutor, appByMonth(monthly));
    expect(r.total).toBe(ANCHOR_WINDOW);
    expect(r.agree).toBe(6);
  });
  test('튜터 점수가 없으면 0/0', () => {
    expect(directionAgreement({}, appByMonth([]))).toEqual({ agree: 0, total: 0 });
  });
});
