import { beforeEach, describe, expect, test } from 'vitest';
import seed from '../../data/dramaSeed.json';
import {
  PLACEMENT_QUESTIONS, MONTHLY_QUESTIONS, D7_SENTENCE, D7_AXES, STAGES, WEEKLY_GOALS, BASELINE_GUIDES,
  placementQuestionFor, speakingAdj, monthlyDue, firstSundayOf, d7Due, d7Stage, baselineRecheckDue,
  saveBaseline, baseline,
} from '../../lib/baseline';

describe('baseline — 정적 콘텐츠', () => {
  test('배치 질문 2개(A1 15초·A2+ 30초), 월간 3개, 단계 4, 주간 목표 3, 안내 10', () => {
    expect(PLACEMENT_QUESTIONS.map((q) => [q.level, q.sec])).toEqual([['A1', 15], ['A2+', 30]]);
    expect(placementQuestionFor('A1').sec).toBe(15);
    expect(placementQuestionFor('B1').sec).toBe(30);
    expect(MONTHLY_QUESTIONS.map((q) => q.id)).toEqual(['intro', 'lastweek', 'customer']);
    expect(STAGES.map((s) => [s.cefr, s.hours])).toEqual([['A2', 150], ['B1', 300], ['B2', 450], ['C1', 600]]);
    expect(WEEKLY_GOALS.map((g) => g.hours)).toEqual([7, 10, 14]);
    for (const g of WEEKLY_GOALS) expect(g.perDayMin).toBe(Math.round((g.hours * 60) / 7));
    expect(Object.keys(BASELINE_GUIDES)).toHaveLength(10);
    for (const s of Object.values(BASELINE_GUIDES)) expect(s).toMatch(/[가-힣]/);
  });
  test('D+7 문장은 EP1 태오 대사이고 9단어 이하·혼동축 포함', () => {
    const ep1 = (seed as { episodes: { no: number; scenes: { type: string; who?: string; en?: string }[] }[] }).episodes.find((e) => e.no === 1)!;
    const taeo = ep1.scenes.filter((s) => (s.type === 'line' || s.type === 'speak') && s.who === 'taeo').map((s) => s.en);
    expect(taeo).toContain(D7_SENTENCE);
    expect(D7_SENTENCE.split(/\s+/).length).toBeLessThanOrEqual(9);
    expect(D7_AXES.length).toBeGreaterThan(0);
    // r-l: sorry/elevator, th: the, final-consonant: stuck
    expect(D7_SENTENCE.toLowerCase()).toMatch(/r/);
    expect(D7_SENTENCE.toLowerCase()).toMatch(/\bthe\b/);
  });
});

describe('baseline — speakingAdj 경계(명세 임계 40/70)', () => {
  test('wpm<40 → -1, 40~69 → 0, 70+ → +1', () => {
    expect(speakingAdj({ level: 'A2', wpm: 39 })).toBe(-1);
    expect(speakingAdj({ level: 'A2', wpm: 40 })).toBe(0);
    expect(speakingAdj({ level: 'A2', wpm: 69 })).toBe(0);
    expect(speakingAdj({ level: 'A2', wpm: 70 })).toBe(1);
  });
  test('A1은 더 못 내려가고, +1은 B1 상한', () => {
    expect(speakingAdj({ level: 'A1', wpm: 10 })).toBe(0);
    expect(speakingAdj({ level: 'A1', wpm: 90 })).toBe(1);
    expect(speakingAdj({ level: 'B1', wpm: 120 })).toBe(0);
    expect(speakingAdj({ level: 'B2', wpm: 120 })).toBe(0);
  });
  test('발성 비율: 키 없으면 내려가기만, 키 있으면 올리기 조건에도 든다', () => {
    expect(speakingAdj({ level: 'A2', voiced: 0.2 })).toBe(-1);
    expect(speakingAdj({ level: 'A2', voiced: 0.35 })).toBe(0);
    expect(speakingAdj({ level: 'A2', voiced: 0.9 })).toBe(0); // wpm 없이는 +1 없음
    expect(speakingAdj({ level: 'A2', wpm: 80, voiced: 0.5 })).toBe(0);
    expect(speakingAdj({ level: 'A2', wpm: 80, voiced: 0.6 })).toBe(1);
    expect(speakingAdj({ level: 'A2' })).toBe(0);
  });
});

describe('baseline — 주기', () => {
  test('firstSundayOf', () => {
    expect(firstSundayOf('2026-10-20')).toBe('2026-10-04');
    expect(firstSundayOf('2026-11-15')).toBe('2026-11-01');
    expect(firstSundayOf('2026-09-01')).toBe('2026-09-06');
  });
  test('monthlyDue: 첫째 일요일부터, 같은 달에 했으면 false, 30일 경과면 true', () => {
    expect(monthlyDue('2026-10-03', null)).toBe(false);
    expect(monthlyDue('2026-10-04', null)).toBe(true);
    expect(monthlyDue('2026-10-20', null)).toBe(true);
    expect(monthlyDue('2026-10-20', '2026-10-04')).toBe(false);
    expect(monthlyDue('2026-10-20', '2026-09-06')).toBe(true);
    expect(monthlyDue('2026-10-02', '2026-09-01')).toBe(true); // 31일 경과
    expect(monthlyDue('2026-10-02', '2026-09-20')).toBe(false);
  });
  test('d7Due·d7Stage', () => {
    expect(d7Due('2026-09-24', '2026-10-01')).toBe(true);
    expect(d7Due('2026-09-24', '2026-09-30')).toBe(false);
    expect(d7Due('', '2026-09-30')).toBe(false);
    expect(d7Stage('2026-09-24', '2026-09-25')).toBe(1);
    expect(d7Stage('2026-09-24', '2026-09-28')).toBe(4);
    expect(d7Stage('2026-09-24', '2026-09-26')).toBeNull();
  });
  test('baselineRecheckDue D+30·D+90 창', () => {
    const b = { date: '2026-07-01', level: 'A2' as const, durationMs: 15000 };
    expect(baselineRecheckDue(b, '2026-07-31')).toBe(30);
    expect(baselineRecheckDue(b, '2026-08-10')).toBeNull();
    expect(baselineRecheckDue(b, '2026-09-29')).toBe(90);
    expect(baselineRecheckDue(null, '2026-09-29')).toBeNull();
  });
});

describe('baseline — va_baseline', () => {
  beforeEach(() => localStorage.clear());
  test('저장·읽기, 손상값은 null', () => {
    expect(baseline()).toBeNull();
    saveBaseline({ date: '2026-10-01', level: 'A1', durationMs: 14000, voiced: 0.5, pendingRetranscribe: true });
    expect(baseline()?.pendingRetranscribe).toBe(true);
    localStorage.setItem('va_baseline', JSON.stringify({ foo: 1 }));
    expect(baseline()).toBeNull();
  });
});
