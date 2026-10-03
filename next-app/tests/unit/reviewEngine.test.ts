import { beforeEach, describe, expect, test } from 'vitest';
import { aggregateAttempts, attemptDaily, attemptStats, dailyStats, foldOverflow, getAttempts, logAttempt, LOG_MAX, mergeAgg, type Attempt } from '../../lib/reviewEngine';
import { EVICTABLE, NEVER_EVICT, load, store } from '../../lib/state';

/**
 * 시도 로그(M1) — 상한 3000, 넘치면 오래된 날부터 일별 집계(va_attempt_daily)로 접은 뒤 지운다.
 * 집계는 게이트 사유·청크 노출·출처별 수를 담고, 통계는 집계와 남은 로그를 합쳐 계산한다.
 */
beforeEach(() => localStorage.clear());

const DAY = 86400000;
const at = (t: number, extra: Partial<Attempt> = {}): Attempt => ({ t, en: 'Hang in there.', score: 80, ...extra });

describe('일별 집계(순수)', () => {
  test('게이트 사유·통과·노출·출처별·중앙값', () => {
    const agg = aggregateAttempts([
      at(1, { score: 90, latencyMs: 800, wpm: 100, src: 'drama' }),
      at(2, { score: 60, latencyMs: 1200, wpm: 120, src: 'drama', en: 'See you.' }),
      at(3, { score: 75, latencyMs: 1000, wpm: 80, src: 'retell', en: 'hang in there.' }), // 대소문자 달라도 같은 문장
      at(4, { score: 0, quality: 'silent', src: 'drama' }),
      at(5, { score: 0, quality: 'echo', src: 'dtalk' }),
      at(6, { score: 0, quality: 'busy' }),
    ]);
    expect(agg.n).toBe(6);
    expect(agg.passed).toBe(2);
    expect(agg.exposed).toBe(2);
    expect(agg.bySrc).toEqual({ drama: 3, retell: 1, dtalk: 1, other: 1 });
    expect(agg.gate).toEqual({ silent: 1, unclear: 0, echo: 1, busy: 1 });
    expect(agg.latencyMed).toBe(1000);
    expect(agg.wpmMed).toBe(100);
    expect(agg.scoreAvg).toBe(75);
  });
  test('빈 집계와 합치기 — 중앙값은 n 가중 근사', () => {
    const a = aggregateAttempts([at(1, { latencyMs: 1000 }), at(2, { latencyMs: 1000 })]);
    const b = aggregateAttempts([at(3, { latencyMs: 400, quality: 'ok' })]);
    const m = mergeAgg(a, b);
    expect(m.n).toBe(3);
    expect(m.latencyMed).toBe(800);
    expect(mergeAgg(undefined, b)).toEqual(b);
    expect(aggregateAttempts([]).latencyMed).toBeNull();
  });
});

describe('상한 3000 — 오래된 날부터 접기', () => {
  test('LOG_MAX는 3000', () => expect(LOG_MAX).toBe(3000));
  test('넘치면 가장 오래된 날 전체가 집계로 접히고 로그에서 사라진다', () => {
    const base = new Date('2026-09-01T10:00:00').getTime();
    const log: Attempt[] = [];
    for (let d = 0; d < 4; d++) for (let i = 0; i < 1000; i++) log.push(at(base + d * DAY + i * 1000, { score: i % 2 ? 90 : 50 }));
    const r = foldOverflow(log, {});
    expect(r.folded).toBe(1000);
    expect(r.log.length).toBe(3000);
    expect(Object.keys(r.daily)).toEqual(['2026-09-01']);
    expect(r.daily['2026-09-01'].n).toBe(1000);
    expect(r.daily['2026-09-01'].passed).toBe(500);
    expect(r.log[0].t).toBe(base + DAY);
  });
  test('logAttempt가 저장까지 — 로그 ≤ 3000, va_attempt_daily에 접힌 날', () => {
    const base = new Date('2026-09-01T10:00:00').getTime();
    const seed: Attempt[] = [];
    for (let i = 0; i < 2999; i++) seed.push(at(base + (i < 100 ? 0 : DAY) + i * 100));
    store('va_attempt_log', seed);
    logAttempt(at(base + 2 * DAY));
    expect(getAttempts().length).toBe(3000);
    logAttempt(at(base + 2 * DAY + 1));
    expect(getAttempts().length).toBe(2901); // 첫날(100건) 접힘
    expect(attemptDaily()['2026-09-01'].n).toBe(100);
    // 같은 날이 다시 접히면 합쳐진다(두 번 세지 않는다)
    expect(Object.keys(attemptDaily()).length).toBe(1);
  });
  test('일별 집계는 180일만 남는다', () => {
    const daily: Record<string, unknown> = {};
    for (let i = 0; i < 200; i++) {
      const d = new Date(2026, 0, 1 + i);
      daily[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] = aggregateAttempts([at(1)]);
    }
    store('va_attempt_daily', daily);
    const log: Attempt[] = [];
    const base = new Date('2026-09-01T10:00:00').getTime();
    for (let i = 0; i < 3000; i++) log.push(at(base + (i < 10 ? 0 : DAY) + i * 10));
    store('va_attempt_log', log);
    logAttempt(at(base + 3 * DAY));
    expect(Object.keys(attemptDaily()).length).toBe(180);
  });
});

describe('통계 = 집계 + 로그', () => {
  test('접힌 날과 남은 로그가 한 추이로 합쳐진다', () => {
    const now = Date.now();
    const yday = new Date(now - DAY);
    const ydayKey = `${yday.getFullYear()}-${String(yday.getMonth() + 1).padStart(2, '0')}-${String(yday.getDate()).padStart(2, '0')}`;
    store('va_attempt_daily', { [ydayKey]: aggregateAttempts([at(1, { score: 100, latencyMs: 500 }), at(2, { score: 100, latencyMs: 500 })]) });
    logAttempt(at(now, { score: 60, latencyMs: 900, src: 'drama' }));
    logAttempt(at(now - DAY, { score: 50, latencyMs: 700, src: 'retell' })); // 어제 치 로그도 남아 있다면 집계와 합산
    const stats = attemptStats(7);
    expect(stats.length).toBe(2);
    expect(stats[0].date).toBe(ydayKey);
    expect(stats[0].count).toBe(3);
    expect(stats[0].avgScore).toBe(83); // (100*2 + 50)/3 가중
    expect(stats[1].count).toBe(1);
    expect(stats[1].avgScore).toBe(60);
    expect(stats[1].medianLatency).toBe(900);
    const ds = dailyStats(7);
    expect(ds[0].agg.bySrc).toEqual({ other: 2, retell: 1 });
    expect(ds[1].agg.bySrc).toEqual({ drama: 1 });
  });
  test('손상된 로그 항목은 건너뛴다', () => {
    localStorage.setItem('va_attempt_log', JSON.stringify([null, 'x', { t: 'no' }, at(Date.now())]));
    expect(getAttempts().length).toBe(1);
    expect(attemptStats(1).length).toBe(1);
  });
});

describe('용량 부족 축출 — 집계·설정·기준선은 지키고 로그·캐시만', () => {
  test('EVICTABLE 순서: 캐시(va_ladder_cache·va_tts_meta…)가 앞, 기록(va_spoken_log·va_attempt_log)이 뒤', () => {
    const i = (k: string) => EVICTABLE.indexOf(k);
    expect(i('va_ladder_cache')).toBeGreaterThanOrEqual(0);
    expect(i('va_tts_meta')).toBeLessThan(i('va_drama_resume'));
    expect(i('va_drama_resume')).toBeLessThan(i('va_dispute_log'));
    expect(i('va_dispute_log')).toBeLessThan(i('va_retell'));
    expect(i('va_retell')).toBeLessThan(i('va_recall_speak'));
    expect(i('va_recall_speak')).toBeLessThan(i('va_spoken_log'));
    expect(i('va_spoken_log')).toBeLessThan(i('va_attempt_log'));
    expect(EVICTABLE[EVICTABLE.length - 1]).toBe('va_attempt_log');
  });
  test('va_attempt_daily·va_growth·va_flags·va_day_gov·va_diag·va_sound_track·va_speak_goal·va_baseline는 EVICTABLE 밖', () => {
    for (const k of NEVER_EVICT) expect(EVICTABLE, k).not.toContain(k);
  });
  test('STORAGE_FULL 상황에서 va_attempt_daily는 남고 va_ladder_cache부터 빠진다', () => {
    store('va_attempt_daily', { '2026-09-01': aggregateAttempts([at(1)]) });
    store('va_ladder_cache', { big: 'x' });
    store('va_attempt_log', [at(1)]);
    const orig = localStorage.setItem.bind(localStorage);
    let fails = 1; // 첫 저장만 용량 초과
    localStorage.setItem = (k: string, v: string) => {
      if (fails > 0 && k === 'va_new') {
        fails--;
        throw new Error('QuotaExceededError');
      }
      orig(k, v);
    };
    try {
      store('va_new', { ok: true });
    } finally {
      localStorage.setItem = orig;
    }
    expect(load<{ ok: boolean } | null>('va_new', null)).toEqual({ ok: true });
    expect(localStorage.getItem('va_ladder_cache')).toBeNull();
    expect(localStorage.getItem('va_attempt_log')).not.toBeNull(); // 맨 뒤라 아직 안 지워짐
    expect(attemptDaily()['2026-09-01'].n).toBe(1);
  });
});
