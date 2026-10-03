/**
 * M4 하루 조절기 — 복귀 첫날(3일 공백 → return, 프리즈 1개 자동 소비, 둘째 날 normal) · 세션 적응(5/13 → adapt, 목표 ×0.6) ·
 * 20분 캡(조금 더 숨김 + 발화 목표 확정) · 짧은 날 주 2회 · 조용히 모드 저녁 보충 → 불꽃 · 경과 시간(재생 이벤트 누적,
 * 60초 무입력 제외, 백그라운드 제외) · Four Strands(상호작용 있던 재생만 input, 섀도잉 반반) · 플래그 off면 전부 normal.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { bumpSpoken, load, spokenToday } from '../../lib/state';
import { shiftKey, todayKey } from '../../lib/dates';
import {
  adaptSpeed,
  addElapsed,
  BUDGET_MS,
  checkEveningSupplement,
  dayState,
  ElapsedTracker,
  endingNote,
  fmtClock,
  IDLE_CUT_MS,
  limitRoleTargets,
  markQuietDone,
  playerDay,
  recordTry,
  setDayMode,
  strandLine,
} from '../../lib/dayGovernor';
import { bannerFor, dayGoalFactor, dayLite, speakLine } from '../../lib/homeLite';
import { consumeFreezesForGaps, getFreezeCount } from '../../lib/habits';
import { flameState } from '../../lib/streak';
import { speakGoal } from '../../lib/speakGoal';
import { addMinutes } from '../../lib/timeBudget';

const KEY = () => localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
const setDate = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
};
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('va_mode', JSON.stringify('focus'));
});
afterEach(() => vi.useRealTimers());

describe('복귀 첫날(return)', () => {
  test('마지막 학습일로부터 3일 → return(예산 8분·복습 상한 6·회상 3·조금 더 숨김), 배너 최우선', () => {
    setDate('2026-10-05T09:00:00');
    localStorage.setItem('va_days', JSON.stringify(['2026-09-30', '2026-10-01', '2026-10-02']));
    const d = dayState();
    expect(d.mode).toBe('return');
    expect(d.returning).toBe(true);
    expect(d.budgetMs).toBe(BUDGET_MS.return);
    expect(d.dueMax).toBe(6);
    expect(d.recallMax).toBe(3);
    expect(d.hideMore).toBe(true);
    expect(playerDay(d).returning).toBe(true);
    expect(dayLite().mode).toBe('return');
    expect(bannerFor(dayLite())?.text).toContain('돌아온 것만으로 충분해요');
  });
  test('마지막 학습일로부터 2일(하루 쉼)은 normal', () => {
    setDate('2026-10-05T09:00:00');
    localStorage.setItem('va_days', JSON.stringify(['2026-10-03']));
    expect(dayState().mode).toBe('normal');
  });
  test('프리즈 1개 자동 소비로 공백 전체를 메우고(연속 유지), 둘째 날은 normal', () => {
    setDate('2026-10-05T09:00:00');
    localStorage.setItem('va_days', JSON.stringify(['2026-09-29', '2026-09-30', '2026-10-01']));
    localStorage.setItem('va_freeze', JSON.stringify({ count: 2, earnedFor: 0 }));
    const filled = consumeFreezesForGaps();
    expect(filled.sort()).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
    expect(getFreezeCount()).toBe(1);
    // 같은 날 다시 열어도 또 쓰지 않는다
    expect(consumeFreezesForGaps()).toEqual([]);
    expect(getFreezeCount()).toBe(1);
    // 메운 날은 학습일이 아니다 — 여전히 복귀 첫날
    expect(dayState().mode).toBe('return');
    expect(load<string[]>('va_frozen_days', [])).toEqual(expect.arrayContaining(['2026-10-02', '2026-10-04']));
    // 복귀일에 공부했다 → 다음 날 normal
    localStorage.setItem('va_days', JSON.stringify([...load<string[]>('va_days', []), '2026-10-05']));
    setDate('2026-10-06T09:00:00');
    expect(dayState().mode).toBe('normal');
    expect(dayLite().mode).toBe('normal');
  });
  test('하루 조절기가 꺼져 있으면 예전 규칙(하루 1개씩) 그대로', () => {
    setDate('2026-10-05T09:00:00');
    localStorage.setItem('va_flags', JSON.stringify({ dayGovernor: false }));
    localStorage.setItem('va_days', JSON.stringify(['2026-10-01']));
    localStorage.setItem('va_freeze', JSON.stringify({ count: 2, earnedFor: 0 }));
    expect(consumeFreezesForGaps()).toHaveLength(2);
    expect(getFreezeCount()).toBe(0);
  });
});

describe('세션 적응(adapt)', () => {
  test('1차 통과 5/13(<40%, 시도 ≥6) → adapt · goalFactor 0.6 · 빌드업 7 · 회상 3 · 홈 목표 ×0.6', () => {
    KEY();
    setDate('2026-10-05T09:00:00');
    speakGoal(); // 목표 10(첫 14일)
    let newlyAt = -1;
    for (let k = 0; k < 13; k++) {
      const r = recordTry(k < 5);
      if (r.newly) newlyAt = k + 1;
    }
    expect(newlyAt).toBe(13);
    const d = dayState();
    expect(d.adapt).toBe(true);
    expect(d.passRate1st).toBeCloseTo(5 / 13);
    expect(d.goalFactor).toBe(0.6);
    expect(d.buildupMinWords).toBe(7);
    expect(d.dueMax).toBe(3);
    expect(d.hideMore).toBe(true);
    expect(dayGoalFactor()).toBe(0.6);
    expect(speakLine().goal).toBe(6);
    expect(endingNote(d, 4)?.kind).toBe('adapt');
  });
  test('시도 5번까지는 다 틀려도 적응하지 않는다 · 한 번 켜지면 그날 내내', () => {
    setDate('2026-10-05T09:00:00');
    for (let k = 0; k < 5; k++) recordTry(false);
    expect(dayState().adapt).toBe(false);
    recordTry(false);
    expect(dayState().adapt).toBe(true);
    for (let k = 0; k < 20; k++) recordTry(true);
    expect(dayState().adapt).toBe(true);
    setDate('2026-10-06T09:00:00');
    expect(dayState().adapt).toBe(false);
  });
  test('속도 한 단계↓ — 0.75× 아래로는 안 내린다', () => {
    const S = [0.6, 0.75, 0.9, 1, 1.2];
    expect(adaptSpeed(1, S)).toBe(0.9);
    expect(adaptSpeed(0.9, S)).toBe(0.75);
    expect(adaptSpeed(0.75, S)).toBe(0.75);
    expect(adaptSpeed(0.6, S)).toBe(0.6);
  });
});

describe('20분 캡', () => {
  test('경과 20분 → capped · 조금 더 숨김 · 발화 목표를 지금 수로 확정(불꽃 lit)', () => {
    KEY();
    setDate('2026-10-05T09:00:00');
    speakGoal();
    for (let k = 0; k < 7; k++) bumpSpoken();
    const a = addElapsed(BUDGET_MS.normal);
    expect(a).toEqual({ capped: false, budget: true });
    expect(dayState().hideMore).toBe(false);
    const b = addElapsed(BUDGET_MS.cap - BUDGET_MS.normal);
    expect(b.capped).toBe(true);
    const d = dayState();
    expect(d.capped).toBe(true);
    expect(d.hideMore).toBe(true);
    expect(load<{ goal: number; capped: boolean }>('va_speak_goal', { goal: 0, capped: false })).toMatchObject({ goal: 7, capped: true });
    expect(flameState().level).toBe('lit');
    expect(endingNote(d, spokenToday())?.text).toContain('발화 7문장');
    // 두 번째로 넘어가도 다시 확정하지 않는다
    expect(addElapsed(60_000).capped).toBe(false);
  });
});

describe('짧은 날(short)', () => {
  test('목표 ×0.5 · 역할극 3줄 · 주 2회 상한(넘으면 안내만)', () => {
    KEY();
    setDate('2026-09-28T09:00:00'); // 월
    speakGoal();
    expect(setDayMode('short')).toEqual({ ok: true, mode: 'short' });
    let d = dayState();
    expect(d.goalFactor).toBe(0.5);
    expect(d.roleLinesMax).toBe(3);
    expect(d.budgetMs).toBe(BUDGET_MS.short);
    expect(dayGoalFactor()).toBe(0.5);
    expect(speakLine().goal).toBe(5);
    for (let k = 0; k < 5; k++) bumpSpoken();
    expect(flameState().level).toBe('lit');
    setDate('2026-09-29T09:00:00'); // 화
    expect(setDayMode('short').ok).toBe(true);
    expect(dayState().shortLeft).toBe(0);
    setDate('2026-09-30T09:00:00'); // 수 — 이번 주 2회 다 씀
    expect(setDayMode('short')).toEqual({ ok: false, reason: 'weekly' });
    d = dayState();
    expect(d.mode).toBe('normal');
    expect(setDayMode('quiet').ok).toBe(true);
    setDate('2026-10-05T09:00:00'); // 다음 주 월 — 다시 가능
    expect(setDayMode('short').ok).toBe(true);
  });
  test('짧은 날 역할극 대상: 태오 대사 앞 3줄(speak 문항 포함·늘 남김), 지정 상대 대사는 쉼', () => {
    const ts = [
      { idx: 1, kind: 'role' as const },
      { idx: 2, kind: 'mine' as const },
      { idx: 3, kind: 'role' as const },
      { idx: 4, kind: 'role' as const },
      { idx: 5, kind: 'role' as const },
      { idx: 6, kind: 'role' as const },
    ];
    // EP1 모양: line 2·5, speak 10, line 14 → 2·5·10(speak도 한 줄로 센다), 14는 보통 대사로
    expect(limitRoleTargets(ts, (k) => k === 4, 3).map((t) => t.idx)).toEqual([1, 3, 4]);
    // speak가 넘쳐도 남긴다(역할극이 아니면 멈춘다)
    expect(limitRoleTargets(ts, (k) => k === 6, 3).map((t) => t.idx)).toEqual([1, 3, 4, 6]);
    expect(limitRoleTargets(ts, () => false, Infinity)).toHaveLength(6);
  });
  test("'원래 분량으로' — 복귀일이면 복귀로 돌아간다", () => {
    setDate('2026-10-05T09:00:00');
    localStorage.setItem('va_days', JSON.stringify(['2026-10-01']));
    setDayMode('quiet');
    expect(dayState().mode).toBe('quiet');
    setDayMode('normal');
    expect(dayState().mode).toBe('return');
  });
});

describe('조용히 모드(quiet)', () => {
  test('낮: 입모양·고르기·리텔/회화 점 숨김 → 저녁 6시 뒤 소리 내어 보충하면 lit', () => {
    KEY();
    setDate('2026-10-05T10:00:00');
    speakGoal();
    setDayMode('quiet');
    let d = dayState();
    expect(d.quiet).toBe(true);
    expect(d.budgetMs).toBe(BUDGET_MS.quiet);
    expect(playerDay(d).quiet).toBe(true);
    expect(speakLine().dots.map((x) => x.id)).toEqual(['episode', 'recall']);
    // 입모양 4줄(0.5씩)
    for (let k = 0; k < 4; k++) bumpSpoken(0.5, 'self');
    markQuietDone();
    expect(flameState().level).toBe('ember');
    expect(bannerFor(dayLite(), speakLine())?.id).toBe('quiet');
    expect(endingNote(dayState())?.kind).toBe('quiet');
    // 저녁 — 입모양이 풀리고(소리 내어 말하기) 보충 배너
    setDate('2026-10-05T19:30:00');
    d = dayState();
    expect(d.evening).toBe(true);
    expect(d.quiet).toBe(false);
    expect(bannerFor(dayLite(), speakLine())).toMatchObject({ id: 'evening' });
    expect(checkEveningSupplement()).toBe(false);
    for (let k = 0; k < 8; k++) bumpSpoken();
    expect(checkEveningSupplement()).toBe(true);
    expect(load<{ eveningDone?: boolean }>('va_day_gov', {}).eveningDone).toBe(true);
    expect(flameState().level).toBe('lit');
  });
});

describe('경과 시간 측정(ElapsedTracker)', () => {
  test('재생 중 + 보임일 때만 누적 · 60초 무입력 뒤는 제외 · 백그라운드 제외', () => {
    const t = new ElapsedTracker();
    let total = 0;
    const add = (c: { elapsed: number }) => (total += c.elapsed);
    add(t.setPlaying(true, 0));
    add(t.tick(30_000));
    expect(total).toBe(30_000);
    // 입력 없이 3분 — 마지막 입력(시작) + 60초까지만
    add(t.tick(180_000));
    expect(total).toBe(IDLE_CUT_MS);
    // 탭 → 다시 센다
    add(t.input(200_000));
    add(t.tick(230_000));
    expect(total).toBe(IDLE_CUT_MS + 30_000);
    // 백그라운드 2분은 0
    add(t.setVisible(false, 240_000));
    expect(total).toBe(IDLE_CUT_MS + 40_000);
    add(t.tick(360_000));
    add(t.setVisible(true, 360_000));
    add(t.tick(370_000));
    expect(total).toBe(IDLE_CUT_MS + 50_000);
    // 재생이 끝나면 멈춘다
    add(t.setPlaying(false, 380_000));
    add(t.tick(500_000));
    expect(total).toBe(IDLE_CUT_MS + 60_000);
  });
  test('Four Strands — input은 상호작용 있던 재생만, 섀도잉은 반반, 역할극은 output', () => {
    const t = new ElapsedTracker();
    const s = { input: 0, output: 0, fluency: 0, form: 0 } as Record<string, number>;
    const add = (c: { strand: Record<string, number | undefined> }) => {
      for (const [k, v] of Object.entries(c.strand)) s[k] += v || 0;
    };
    // 재생 1: 듣기만 40초 — 상호작용 없음 → 버림
    add(t.setPlaying(true, 0));
    add(t.tick(40_000));
    add(t.setPlaying(false, 40_000));
    expect(s.input).toBe(0);
    // 재생 2: 듣기 20초 → 퀴즈 답(상호작용) → 그 전 20초까지 확정, 이후 10초도 input
    add(t.setPlaying(true, 100_000));
    add(t.tick(120_000));
    add(t.markInteraction(120_000));
    add(t.tick(130_000));
    expect(s.input).toBe(30_000);
    // 역할극 10초 → output, 섀도잉 10초 → 반반
    add(t.setStrand('output', 130_000));
    add(t.tick(140_000));
    add(t.setStrand('shadow', 140_000));
    add(t.tick(150_000));
    add(t.setStrand('fluency', 150_000));
    add(t.tick(155_000));
    expect(s).toEqual({ input: 35_000, output: 15_000, fluency: 5_000, form: 0 });
  });
  test('addElapsed는 오늘 기록(va_day_gov 최상위 date·elapsedMs·strandMs)에 쌓이고 날이 바뀌면 hist로', () => {
    setDate('2026-10-05T09:00:00');
    addElapsed(90_000, { output: 60_000, input: 30_000 });
    const g = load<{ date: string; elapsedMs: number; strandMs: Record<string, number> }>('va_day_gov', { date: '', elapsedMs: 0, strandMs: {} });
    expect(g.date).toBe(todayKey());
    expect(g.elapsedMs).toBe(90_000);
    expect(g.strandMs.output).toBe(60_000);
    expect(fmtClock(dayState().elapsedMs)).toBe('1:30');
    setDate('2026-10-06T09:00:00');
    expect(dayState().elapsedMs).toBe(0);
    const h = load<{ hist: Record<string, { elapsedMs: number }> }>('va_day_gov', { hist: {} });
    expect(h.hist[shiftKey(todayKey(), -1)].elapsedMs).toBe(90_000);
  });
  test("진도 한 줄 '이번 주 입력 · 산출 · 유창성 · 형식 %'", () => {
    expect(strandLine()).toBeNull();
    addMinutes('input', 4.2);
    addMinutes('output', 3.8);
    addMinutes('fluency', 1.2);
    addMinutes('form', 0.8);
    expect(strandLine()?.text).toBe('이번 주 입력 42 · 산출 38 · 유창성 12 · 형식 8%');
  });
});

describe('플래그 off → 전부 normal', () => {
  test('dayGovernor false면 모드·적응·캡·배율이 전부 꺼진다', () => {
    setDate('2026-10-05T09:00:00');
    localStorage.setItem('va_days', JSON.stringify(['2026-09-20']));
    localStorage.setItem('va_flags', JSON.stringify({ dayGovernor: false }));
    expect(setDayMode('short')).toEqual({ ok: false, reason: 'off' });
    for (let k = 0; k < 10; k++) recordTry(false);
    addElapsed(BUDGET_MS.cap + 1);
    const d = dayState();
    expect(d).toMatchObject({ enabled: false, mode: 'normal', adapt: false, capped: false, goalFactor: 1, hideMore: false, quiet: false, returning: false });
    expect(dayLite().mode).toBe('normal');
    expect(dayGoalFactor()).toBe(1);
    expect(endingNote(d)).toBeNull();
  });
});

describe('홈 청크 경계', () => {
  test('homeLite·DramaCard·streak은 dayGovernor를 정적으로 import하지 않는다(시트는 dynamic)', () => {
    const root = path.resolve(__dirname, '../..');
    for (const f of ['lib/homeLite.ts', 'components/DramaCard.tsx', 'lib/streak.ts', 'lib/habits.ts']) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      const imports = [...src.matchAll(/^import[^;]*from '([^']+)'/gm)].map((m) => m[1]);
      expect(imports.some((i) => /dayGovernor|DayModeSheet|timeBudget/.test(i)), f).toBe(false);
    }
    const card = fs.readFileSync(path.join(root, 'components/DramaCard.tsx'), 'utf8');
    expect(card).toMatch(/dynamic\(\(\) => import\('\.\/DayModeSheet'\)/);
  });
});
