import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  addMonthly, monthlyEntries, lastMonthly, monthlyCardDue, monthlyQuestionFor, compareTarget, setWeeklyGoalH, weeklyGoalH,
  setD7Recording, d7Pair, intelligibilityOf, sentenceCount, voicedRatio, compareSameSentence, finalizeBaselineData,
  finalizeBaseline, retranscribePendingBaseline, retranscribePlain, wpmScore,
} from '../../lib/growthArchive';
import { saveBaseline, baseline, type Baseline } from '../../lib/baseline';
import { placementPrior, skillLevel } from '../../lib/cefrGrowth';
import { getAttempts } from '../../lib/reviewEngine';
import { addMinutes } from '../../lib/timeBudget';
import { setFlag } from '../../lib/flags';
import { transcribe } from '../../lib/stt';
import type { Recording } from '../../lib/storage';

beforeEach(() => localStorage.clear());

describe('growthArchive — va_growth 필드 단위 갱신', () => {
  test('월간 기록은 달마다 하나, time(timeBudget) 필드는 보존', () => {
    addMinutes('output', 3, '2026-10-01');
    addMonthly({ date: '2026-09-06', qid: 'intro', durationMs: 60000, wpm: 50 });
    addMonthly({ date: '2026-10-04', qid: 'lastweek', durationMs: 60000, wpm: 55 });
    addMonthly({ date: '2026-10-05', qid: 'lastweek', durationMs: 61000, wpm: 58 }); // 같은 달 → 교체
    expect(monthlyEntries().map((e) => e.date)).toEqual(['2026-09-06', '2026-10-05']);
    expect(lastMonthly()?.wpm).toBe(58);
    const g = JSON.parse(localStorage.getItem('va_growth')!);
    expect(g.time['2026-10-01'].output).toBe(3);
    setWeeklyGoalH(10);
    setD7Recording(1, 'Sorry! The elevator got stuck.', 'r1');
    setD7Recording(7, 'Sorry! The elevator got stuck.', 'r7');
    expect(weeklyGoalH()).toBe(10);
    expect(d7Pair()).toEqual({ en: 'Sorry! The elevator got stuck.', d1Id: 'r1', d7Id: 'r7' });
    expect(JSON.parse(localStorage.getItem('va_growth')!).time['2026-10-01'].output).toBe(3);
    expect(monthlyEntries()).toHaveLength(2);
  });
  test('weeklyGoalH 기본 7, 이상한 값 무시', () => {
    expect(weeklyGoalH()).toBe(7);
    setWeeklyGoalH(9 as never);
    expect(weeklyGoalH()).toBe(7);
  });
});

describe('growthArchive — monthlyDue·질문·비교 대상', () => {
  test('첫째 일요일부터, 이번 달에 했으면 아님, 플래그 growth off면 아님', () => {
    // 2026-10 첫째 일요일 = 10-04
    expect(monthlyCardDue('2026-10-03')).toBe(false);
    expect(monthlyCardDue('2026-10-04')).toBe(true);
    addMonthly({ date: '2026-10-04', qid: 'intro', durationMs: 60000 });
    expect(monthlyCardDue('2026-10-20')).toBe(false);
    expect(monthlyCardDue('2026-11-01')).toBe(true); // 11-01이 일요일
    setFlag('growth', false);
    expect(monthlyCardDue('2026-11-01')).toBe(false);
  });
  test('질문은 3개를 달마다 돌리고, 같은 질문 기록을 우선 비교', () => {
    const ids = ['2026-01-10', '2026-02-10', '2026-03-10', '2026-04-10'].map((d) => monthlyQuestionFor(d).id);
    expect(new Set(ids.slice(0, 3)).size).toBe(3);
    expect(ids[3]).toBe(ids[0]);
    const list = [
      { date: '2026-01-10', qid: 'intro' as const, durationMs: 1 },
      { date: '2026-02-10', qid: 'lastweek' as const, durationMs: 1 },
      { date: '2026-03-10', qid: 'customer' as const, durationMs: 1 },
    ];
    expect(compareTarget({ date: '2026-04-10', qid: 'intro' }, list)).toEqual({ prev: list[0], sameQuestion: true });
    expect(compareTarget({ date: '2026-04-10', qid: 'other' as never }, list)?.prev).toBe(list[2]);
    expect(compareTarget({ date: '2026-01-10', qid: 'intro' }, list)).toBeNull();
  });
});

describe('growthArchive — 순수 지표', () => {
  test('이해가능성 = 프롬프트 없는 전사가 채점 전사 단어를 회수한 %', () => {
    expect(intelligibilityOf('I work at a cloud company', 'I walk at a cloud company')).toBe(83);
    expect(intelligibilityOf('so so good', 'so good')).toBe(67);
    expect(intelligibilityOf('', 'anything')).toBeNull();
    expect(intelligibilityOf('Hello there', '')).toBe(0);
  });
  test('A1 3문장 세기·발성 비율·WPM 점수', () => {
    expect(sentenceCount('I woke up early. I went to work. It was busy!')).toBe(3);
    expect(sentenceCount('Uh. I went. OK')).toBe(1);
    expect(voicedRatio(15000, 1000, [2000, 1500])).toBe(0.7);
    expect(voicedRatio(15000, undefined)).toBeNull();
    expect(wpmScore(130)).toBe(100);
    expect(wpmScore(42.4)).toBe(42);
  });
  test("'2주 전 나 vs 오늘' — 같은 문장 드라마 녹음 중 간격이 가장 큰 쌍", () => {
    const r = (id: string, en: string, date: string, at: number, kind = 'drama') => ({ id, kind, en, date, at }) as Recording;
    const recs = [
      r('a1', 'Sorry! The elevator got stuck.', '2026-09-10', 1),
      r('a2', 'Sorry! The elevator got stuck.', '2026-09-30', 5),
      r('a3', 'Sorry! The elevator got stuck.', '2026-09-20', 3),
      r('b1', 'Nice to meet you.', '2026-09-25', 2),
      r('b2', 'Nice to meet you.', '2026-10-01', 6),
      r('c1', 'Only once.', '2026-09-01', 0),
      r('m1', 'x', '2026-08-01', 0, 'monthly'),
      r('m2', 'x', '2026-10-01', 9, 'monthly'),
    ];
    const p = compareSameSentence(recs)!;
    expect(p.en).toBe('Sorry! The elevator got stuck.');
    expect([p.old.id, p.cur.id, p.days]).toEqual(['a1', 'a2', 20]);
    expect(compareSameSentence([recs[5]])).toBeNull();
  });
});

describe('growthArchive — 기준선 확정·보정', () => {
  const base = (over: Partial<Baseline> = {}): Baseline => ({ date: '2026-10-02', level: 'A2', durationMs: 30000, recordingId: 'rec-1', pendingRetranscribe: true, ...over });
  const placeA2 = () => localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: 1 }));

  test('WPM < 40 → 한 단계 아래, 70+ → 위(B1 상한), 그 사이 그대로', () => {
    expect(finalizeBaselineData(base(), { wpm: 30, transcript: 'a' }).speaking).toBe('A1');
    expect(finalizeBaselineData(base(), { wpm: 55, transcript: 'a' }).speaking).toBe('A2');
    expect(finalizeBaselineData(base(), { wpm: 90, transcript: 'a' }).speaking).toBe('B1');
    expect(finalizeBaselineData(base({ level: 'B1' }), { wpm: 120, transcript: 'a' }).speaking).toBe('B1'); // 상한
    expect(finalizeBaselineData(base({ level: 'A1' }), { wpm: 10, transcript: 'a' }).speaking).toBe('A1');
    expect(finalizeBaselineData(base(), { wpm: 90, transcript: 'a' }).b.pendingRetranscribe).toBe(false);
  });
  test('finalizeBaseline — 말하기 배치 사전값만 바뀌고 시도 로그 src baseline', () => {
    placeA2();
    const r = finalizeBaseline(base(), { wpm: 30, transcript: 'I am fine.' });
    expect(r.b.adj).toBe(-1);
    expect(placementPrior('speaking')).toBe('A1');
    expect(placementPrior()).toBe('A2');
    expect(placementPrior('listening')).toBe('A2');
    expect(skillLevel('speaking').level).toBe('A1');
    expect(baseline()?.transcript).toBe('I am fine.');
    const a = getAttempts().filter((x) => x.src === 'baseline');
    expect(a).toHaveLength(1);
    expect(a[0].wpm).toBe(30);
  });
  test('키 없음 pending → 키 등록 시 저장 Blob을 1회 재전사해 사후 보정', async () => {
    placeA2();
    saveBaseline(base());
    const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
    const find = vi.fn(async () => ({ id: 'rec-1', kind: 'baseline', blob, durationMs: 30000 }) as unknown as Recording);
    const words = Array.from({ length: 45 }, (_, i) => ({ word: 'w', start: i * 0.6, end: i * 0.6 + 0.3 }));
    const stt = vi.fn(async () => ({ text: 'w '.repeat(45).trim(), words, reason: 'ok' as const, quality: { ok: true, reason: null, logprobMean: 0 } }));
    // 키 없으면 아무 일 없음
    expect(await retranscribePendingBaseline({ hasKey: () => false, find, stt: stt as never })).toBeNull();
    expect(stt).not.toHaveBeenCalled();
    const r = await retranscribePendingBaseline({ hasKey: () => true, find, stt: stt as never });
    expect(r?.b.pendingRetranscribe).toBe(false);
    expect(r?.b.wpm).toBe(90);
    expect(r?.speaking).toBe('B1');
    expect(placementPrior('speaking')).toBe('B1');
    expect((stt.mock.calls[0] as unknown[])[1]).toMatchObject({ detail: 'words', temperature: 0, language: 'en' });
    // 한 번 했으면 다시 하지 않는다
    expect(await retranscribePendingBaseline({ hasKey: () => true, find, stt: stt as never })).toBeNull();
    expect(stt).toHaveBeenCalledTimes(1);
  });
  test('재전사 실패(바쁨)면 pending을 남긴다', async () => {
    saveBaseline(base());
    const find = async () => ({ id: 'rec-1', blob: new Blob(['x']) }) as unknown as Recording;
    const stt = async () => ({ text: '', reason: 'busy' as const, quality: { ok: false, reason: null, logprobMean: 0 } });
    expect(await retranscribePendingBaseline({ hasKey: () => true, find, stt: stt as never })).toBeNull();
    expect(baseline()?.pendingRetranscribe).toBe(true);
  });
});

describe('growthArchive — 월간 이해가능성 재전사(프롬프트 없음·temperature 0)', () => {
  test('실제 transcribe가 보내는 폼: temperature 0, prompt 없음', async () => {
    let form: FormData | null = null;
    const orig = globalThis.fetch;
    globalThis.fetch = vi.fn(async (_u: unknown, init?: { body?: FormData }) => {
      form = init?.body ?? null;
      return new Response(JSON.stringify({ text: 'I work in cloud sales.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as never;
    try {
      const text = await retranscribePlain(new Blob([new Uint8Array(2000)], { type: 'audio/webm' }), transcribe);
      expect(text).toBe('I work in cloud sales.');
      expect(form!.get('temperature')).toBe('0');
      expect(form!.get('prompt')).toBeNull();
      expect(form!.get('language')).toBe('en');
    } finally {
      globalThis.fetch = orig;
    }
  });
  test('실패하면 null', async () => {
    const bad = (async () => {
      throw new Error('net');
    }) as never;
    expect(await retranscribePlain(new Blob(['x']), bad)).toBeNull();
  });
});
