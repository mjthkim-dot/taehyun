import { describe, expect, test } from 'vitest';
import { computeMetrics3, dirOf, arrow, RECALL_SRCS } from '../../lib/metrics3';
import type { Attempt } from '../../lib/reviewEngine';
import type { RetellRecord } from '../../lib/retell';
import type { MonthlyEntry } from '../../lib/growthArchive';

/** 로컬 날짜 키 → 그날 정오 epoch(dayOf가 로컬 시간대로 자르므로 정오면 안전) */
const at = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};
const TODAY = '2026-10-02';
const att = (date: string, score: number, extra: Partial<Attempt> = {}): Attempt => ({ t: at(date), en: 'x', score, src: 'drama', ...extra });
const ret = (date: string, wpm: number, extra: Partial<RetellRecord> = {}): RetellRecord => ({ date, epNo: 1, round: 1, wpm, score: 60, durationMs: 30000, ...extra });
const empty = { attempts: [], retells: [], daily: [], monthly: [], today: TODAY };

describe('metrics3 — 방향 판정', () => {
  test('문턱 안은 flat, 하나라도 없으면 null', () => {
    expect(dirOf(60, 58, 3)).toBe('flat');
    expect(dirOf(65, 58, 3)).toBe('up');
    expect(dirOf(50, 58, 3)).toBe('down');
    expect(dirOf(null, 58, 3)).toBeNull();
    expect(dirOf(105, 100, 0.05, true)).toBe('flat');
    expect(dirOf(110, 100, 0.05, true)).toBe('up');
    expect(arrow('up') + arrow('down') + arrow('flat') + arrow(null)).toBe('↑↓→·');
  });
});

describe('metrics3 — 회수율(시도 로그)과 이해가능성(월간 재전사) 분리', () => {
  test('회수율: 목표 문장 채점 출처·ok만, 7일 vs 8~28일 전', () => {
    const attempts = [
      att('2026-10-01', 80),
      att('2026-09-30', 90),
      att('2026-09-20', 60),
      att('2026-09-15', 60),
      att('2026-10-01', 0, { quality: 'silent' }), // 게이트된 시도는 빠진다
      att('2026-10-01', 10, { src: 'monthly' }), // 자유 발화(월간)는 회수율이 아니다
      att('2026-10-01', 10, { src: 'retell' }),
      att('2026-08-01', 10), // 28일 밖
    ];
    const m = computeMetrics3({ ...empty, attempts });
    expect(m.recall.v7).toBe(85);
    expect(m.recall.v28).toBe(73);
    expect(m.recall.dir).toBe('up');
    expect(m.recall.n7).toBe(2);
    expect(RECALL_SRCS).toContain('drama');
    // 월간 기록이 없으면 이해가능성은 null — 회수율이 있어도 섞지 않는다
    expect(m.intelligibility).toBeNull();
  });
  test('이해가능성: 월간 intelligibility 값만, 마지막 두 기록의 방향', () => {
    const monthly: MonthlyEntry[] = [
      { date: '2026-08-02', qid: 'intro', durationMs: 60000, intelligibility: 60 },
      { date: '2026-09-06', qid: 'lastweek', durationMs: 60000, keyless: true },
      { date: '2026-10-04', qid: 'customer', durationMs: 60000, intelligibility: 72 },
    ];
    const m = computeMetrics3({ ...empty, monthly, attempts: [att('2026-10-01', 99)] });
    expect(m.intelligibility).toEqual({ last: 72, prev: 60, dir: 'up' });
    expect(m.recall.v7).toBe(99);
  });
});

describe('metrics3 — 유창성(리텔 WPM·반응 지연)', () => {
  test('WPM 오르고 지연 줄면 up, 키 없는 리텔은 빠진다', () => {
    const retells = [ret('2026-10-01', 80, { clausePauses: 2 }), ret('2026-09-29', 90, { clausePauses: 4 }), ret('2026-09-20', 60), ret('2026-10-01', 0, { keyless: true })];
    const attempts = [att('2026-10-01', 70, { latencyMs: 1500 }), att('2026-09-30', 70, { latencyMs: 1700 }), att('2026-09-18', 70, { latencyMs: 3000 })];
    const m = computeMetrics3({ ...empty, retells, attempts });
    expect(m.fluency.wpm).toBe(85);
    expect(m.fluency.latency).toBe(1600);
    expect(m.fluency.clausePauses).toBe(3);
    expect(m.fluency.dir).toBe('up');
  });
  test('기록이 없으면 dir null', () => {
    expect(computeMetrics3(empty).fluency).toEqual({ wpm: null, latency: null, clausePauses: null, dir: null });
  });
});

describe('metrics3 — 청크 사용률 = 사용 ÷ 노출(va_attempt_daily.exposed)', () => {
  test('분모는 노출, 0이면 null', () => {
    const retells = [ret('2026-10-01', 80, { usedLearn: ['get stuck', 'first day'] }), ret('2026-09-15', 70, { usedLearn: ['x'] })];
    const daily = [
      { date: '2026-10-01', agg: { exposed: 10 } },
      { date: '2026-09-30', agg: { exposed: 10 } },
      { date: '2026-09-15', agg: { exposed: 20 } },
    ];
    const m = computeMetrics3({ ...empty, retells, daily });
    expect(m.chunkUse.used7).toBe(2);
    expect(m.chunkUse.exposed7).toBe(20);
    expect(m.chunkUse.rate7).toBe(10);
    expect(m.chunkUse.rate28).toBe(8); // 3/40
    expect(m.chunkUse.dir).toBe('up'); // 10% vs 5%
    expect(computeMetrics3({ ...empty, retells }).chunkUse.rate7).toBeNull();
  });
});
