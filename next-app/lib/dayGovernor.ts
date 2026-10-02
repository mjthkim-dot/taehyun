/**
 * 하루 조절기(M4) — 이탈 방지 장치. 합치면 20~25분으로 늘어나는 루프에 상한과 자동 축소를 두고,
 * 바쁜 날·소리 낼 수 없는 날·며칠 쉬고 돌아온 날·통과율이 무너진 날을 '다른 모드'로 받는다.
 *
 *   normal — 예산 15분, 하드 캡 20분(캡에 닿으면 '조금 더 ▾' 카드를 숨기고 발화 목표를 지금 수로 확정)
 *   short  — '오늘은 5분만'(역할극 3줄 + 회상 3 + 리텔 1회, 목표 ×0.5). 주 2회까지(넘으면 안내만)
 *   quiet  — '조용히 모드'(역할극은 입모양 lip, 회상은 고르기, 리텔·회화 숨김, 10분). 저녁 6시 뒤엔 소리 내어 보충 → 불꽃
 *   return — 마지막 학습일로부터 3일 이상이면 저절로(8분, 표현 복습 상한 6, 회상 3, 넘어가기 무제한, 프리즈 1개 자동 소비 —
 *            소비는 lib/habits.consumeFreezesForGaps가 앱을 열 때 한다). 다음 날은 어제가 학습일이라 normal.
 *   세션 적응(adapt) — 오늘 1차 통과율 < 40%(시도 ≥ 6)면 그날 내내: 속도 한 단계↓(0.75× 아래로는 안 내림), 빌드업 7단어↑,
 *            회상 3 고정, 목표 ×0.6, 엔딩 '오늘은 여기까지' 강조.
 *
 * 시간 측정(elapsedMs)은 이 파일 한 곳: 'drama-playing' 이벤트(homeLite.setDramaPlaying) + 엔딩 화면(setDaySession) 동안,
 * visibilitychange로 백그라운드는 빼고, 60초 동안 입력(탭·키)이 없으면 그 뒤는 세지 않는다.
 * Four Strands(timeBudget.addMinutes 재사용): input은 상호작용이 있던 재생만(퀴즈 답·말풍선 다시 듣기·섀도잉 길게 누르기·
 * 속도 사다리 완주 — 없으면 그 재생 시간은 버린다), shadow는 input/output 반반, 리텔·오늘 질문은 fluency(setStrand),
 * 디코더·HVPT는 form.
 *
 * 저장(va_day_gov, EVICTABLE 밖): 오늘 값은 최상위(homeLite.dayGoalFactor·dayLite가 {date, mode, adapt}를 읽는다),
 * 지난 날은 hist[date]에 30일 — { date, mode, chosen, elapsedMs, strandMs, tries, passed, startedAt, adapt, capped,
 * quietDone, eveningDone, hist }.
 * 홈 첫 청크에는 싣지 않는다(speakGoal·timeBudget을 끌어온다) — 홈은 homeLite.dayLite로 저장값만 읽는다.
 */
import { load, spokenToday, speakGoalLite, store } from './state';
import { shiftKey, todayKey } from './dates';
import { isOn } from './flags';
import { addMinutes, budget, type BudgetKind } from './timeBudget';
import { capSpeakGoalToday } from './speakGoal';
import { autoDayMode, DAY_GOV_KEY, dayGoalFactor, DRAMA_PLAYING_EVENT, EVENING_HOUR, isDramaPlaying, RETURN_GAP_DAYS, type DayMode } from './homeLite';

export { DAY_GOV_KEY, RETURN_GAP_DAYS, EVENING_HOUR, type DayMode };

const MIN = 60_000;
/** 모드별 예산 — normal 15분(하드 캡 20분) */
export const BUDGET_MS = { normal: 15 * MIN, cap: 20 * MIN, short: 5 * MIN, quiet: 10 * MIN, return: 8 * MIN } as const;
export const ADAPT_PASS_RATE = 0.4;
export const ADAPT_MIN_TRIES = 6;
export const SHORT_WEEKLY_MAX = 2;
/** 이만큼 입력이 없으면 그 뒤 시간은 세지 않는다 */
export const IDLE_CUT_MS = 60_000;
export const HIST_DAYS = 30;
/** 복귀 첫날 표현 복습 상한 · 회상 고정 수 · 보통날 복습 상한 */
export const RETURN_DUE_MAX = 6;
export const RECALL_FIXED = 3;
export const REVIEW_MAX = 8;
/** 세션 적응: 빌드업(끝부터 쌓기)을 이 단어 수부터 · 속도는 이 아래로 내리지 않는다 */
export const ADAPT_BUILDUP_MIN_WORDS = 7;
export const ADAPT_SPEED_FLOOR = 0.75;
/** 짧은 날 역할극 줄 수 */
export const SHORT_ROLE_LINES = 3;
/** Four Strands 권장 비율(%) — Nation */
export const STRAND_TARGET: Record<BudgetKind, number> = { input: 40, output: 35, fluency: 15, form: 10 };
/** 값이 바뀌면(시간 누적·적응·캡·모드) 알린다 — detail: { capped?: boolean, adapt?: boolean, budget?: boolean } */
export const DAY_GOV_EVENT = 'va:day-gov';

/** 지금 시간이 어느 갈래로 쌓이나 — shadow는 input/output 반반 */
export type StrandKey = BudgetKind | 'shadow';
type StrandMs = Record<BudgetKind, number>;
const zeroStrand = (): StrandMs => ({ input: 0, output: 0, fluency: 0, form: 0 });

export interface DayRec {
  date: string;
  mode: DayMode;
  /** 사용자가 시트에서 고른 모드인가(아니면 저절로) */
  chosen?: boolean;
  elapsedMs: number;
  strandMs: StrandMs;
  /** 1차 시도 수·1차 통과 수(역할극 태오 대사·말로 떠올리기) */
  tries: number;
  passed: number;
  startedAt: number;
  adapt?: boolean;
  capped?: boolean;
  quietDone?: boolean;
  eveningDone?: boolean;
  /** 예산(모드별)에 닿았다고 이미 알렸나 */
  budgetNoted?: boolean;
}
type HistRec = Omit<DayRec, 'date' | 'startedAt' | 'budgetNoted'>;
interface GovRaw extends DayRec {
  hist?: Record<string, HistRec>;
}

export interface DayState {
  /** 플래그 dayGovernor가 켜져 있나(꺼져 있으면 아래는 전부 normal) */
  enabled: boolean;
  mode: DayMode;
  budgetMs: number;
  capMs: number;
  elapsedMs: number;
  strand: StrandMs;
  /** 1차 통과율(시도 없으면 null) */
  passRate1st: number | null;
  tries: number;
  adapt: boolean;
  goalFactor: 1 | 0.6 | 0.5;
  capped: boolean;
  /** 지금 입모양 모드인가(조용히 모드 낮 세션 — 저녁 보충엔 false) */
  quiet: boolean;
  /** 조용히 모드 저녁 보충 시간 */
  evening: boolean;
  quietDone: boolean;
  returning: boolean;
  short: boolean;
  /** 표현 복습 세션 문항 상한 */
  dueMax: number;
  /** 회상 문항 수(첫머리·엔딩 기본) */
  recallMax: number;
  /** 역할극 빌드업 기준(없으면 RoleStep 기본 10) */
  buildupMinWords?: number;
  /** 역할극 태오 대사 상한(짧은 날 3) */
  roleLinesMax: number;
  /** 엔딩 '조금 더 ▾'를 숨기나(캡·짧은 날·복귀·조용히·적응) */
  hideMore: boolean;
  /** 이번 주 짧은 날 수(오늘 포함)·남은 횟수 */
  shortThisWeek: number;
  shortLeft: number;
}

/* ── 저장 ── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const isMode = (v: unknown): v is DayMode => v === 'normal' || v === 'short' || v === 'quiet' || v === 'return';

function strandOf(v: unknown): StrandMs {
  const s = isObj(v) ? v : {};
  return { input: num(s.input), output: num(s.output), fluency: num(s.fluency), form: num(s.form) };
}

function fresh(today: string, now: number): DayRec {
  return { date: today, mode: autoDayMode(today), elapsedMs: 0, strandMs: zeroStrand(), tries: 0, passed: 0, startedAt: now };
}

/** 오늘 기록 + 지난 기록(날이 바뀌었으면 어제 것을 hist로 넘기고 새로 시작 — 저장까지 한다) */
function loadGov(now: Date = new Date()): { rec: DayRec; hist: Record<string, HistRec> } {
  const today = todayKey(now);
  const raw = load<Record<string, unknown> | null>(DAY_GOV_KEY, null);
  const r = isObj(raw) ? raw : {};
  const hist: Record<string, HistRec> = {};
  if (isObj(r.hist)) for (const [d, v] of Object.entries(r.hist)) if (isObj(v) && isMode(v.mode)) hist[d] = { ...(v as unknown as HistRec), strandMs: strandOf(v.strandMs) };
  if (r.date === today && isMode(r.mode)) {
    const rec: DayRec = {
      date: today,
      mode: r.mode,
      chosen: r.chosen === true,
      elapsedMs: num(r.elapsedMs),
      strandMs: strandOf(r.strandMs),
      tries: num(r.tries),
      passed: num(r.passed),
      startedAt: num(r.startedAt) || now.getTime(),
      adapt: r.adapt === true,
      capped: r.capped === true,
      quietDone: r.quietDone === true,
      eveningDone: r.eveningDone === true,
      budgetNoted: r.budgetNoted === true,
    };
    return { rec, hist };
  }
  // 날이 바뀌었다 — 지난 날 요약을 hist로(30일)
  if (typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && isMode(r.mode)) {
    const { date, startedAt, budgetNoted, hist: _h, ...rest } = r as unknown as GovRaw;
    void startedAt;
    void budgetNoted;
    void _h;
    hist[date] = { ...rest, strandMs: strandOf(rest.strandMs) };
  }
  const keep = shiftKey(today, -HIST_DAYS);
  for (const d of Object.keys(hist)) if (d < keep || d >= today) delete hist[d];
  const rec = fresh(today, now.getTime());
  saveGov(rec, hist);
  return { rec, hist };
}

function saveGov(rec: DayRec, hist: Record<string, HistRec>) {
  store(DAY_GOV_KEY, { ...rec, hist });
}

function emit(detail: Record<string, unknown> = {}) {
  try {
    window.dispatchEvent(new CustomEvent(DAY_GOV_EVENT, { detail }));
  } catch {
    /* SSR */
  }
}

const govOn = () => {
  try {
    return isOn('dayGovernor');
  } catch {
    return true;
  }
};

/** 그 주(월요일 시작)의 짧은 날 수 — hist + 오늘 */
function shortDaysThisWeek(rec: DayRec, hist: Record<string, HistRec>, now: Date): number {
  const dow = (now.getDay() + 6) % 7;
  const monday = shiftKey(rec.date, -dow);
  let n = rec.mode === 'short' ? 1 : 0;
  for (const [d, h] of Object.entries(hist)) if (d >= monday && d < rec.date && h.mode === 'short') n++;
  return n;
}

/* ── 읽기 ── */

export function dayState(now: Date = new Date()): DayState {
  const { rec, hist } = loadGov(now);
  const shortThisWeek = shortDaysThisWeek(rec, hist, now);
  const shortLeft = Math.max(0, SHORT_WEEKLY_MAX - shortThisWeek);
  if (!govOn()) {
    return {
      enabled: false,
      mode: 'normal',
      budgetMs: BUDGET_MS.normal,
      capMs: BUDGET_MS.cap,
      elapsedMs: rec.elapsedMs,
      strand: rec.strandMs,
      passRate1st: rec.tries ? rec.passed / rec.tries : null,
      tries: rec.tries,
      adapt: false,
      goalFactor: 1,
      capped: false,
      quiet: false,
      evening: false,
      quietDone: false,
      returning: false,
      short: false,
      dueMax: REVIEW_MAX,
      recallMax: RECALL_FIXED,
      roleLinesMax: Infinity,
      hideMore: false,
      shortThisWeek,
      shortLeft,
    };
  }
  const mode = rec.mode;
  const adapt = !!rec.adapt;
  const capped = !!rec.capped;
  const evening = mode === 'quiet' && !!rec.quietDone && now.getHours() >= EVENING_HOUR;
  const short = mode === 'short';
  return {
    enabled: true,
    mode,
    budgetMs: BUDGET_MS[mode],
    capMs: BUDGET_MS.cap,
    elapsedMs: rec.elapsedMs,
    strand: rec.strandMs,
    passRate1st: rec.tries ? rec.passed / rec.tries : null,
    tries: rec.tries,
    adapt,
    goalFactor: short ? 0.5 : adapt ? 0.6 : 1,
    capped,
    quiet: mode === 'quiet' && !evening,
    evening,
    quietDone: !!rec.quietDone,
    returning: mode === 'return',
    short,
    dueMax: mode === 'return' ? RETURN_DUE_MAX : short || adapt ? RECALL_FIXED : REVIEW_MAX,
    recallMax: RECALL_FIXED,
    buildupMinWords: adapt ? ADAPT_BUILDUP_MIN_WORDS : undefined,
    roleLinesMax: short ? SHORT_ROLE_LINES : Infinity,
    hideMore: capped || adapt || mode !== 'normal',
    shortThisWeek,
    shortLeft,
  };
}

/** Player에 넘길 하루 상태(DramaScreen Player의 dayState prop 모양) */
export function playerDay(d: DayState): { quiet: boolean; returning: boolean; adapt: boolean; short: boolean; roleLinesMax: number; buildupMinWords?: number } {
  return { quiet: d.quiet, returning: d.returning, adapt: d.adapt, short: d.short, roleLinesMax: d.roleLinesMax, ...(d.buildupMinWords ? { buildupMinWords: d.buildupMinWords } : {}) };
}

/* ── 쓰기 ── */

export type SetModeResult = { ok: true; mode: DayMode } | { ok: false; reason: 'weekly' | 'off' };

/**
 * 시트에서 오늘 모드를 고른다. 'normal'은 '원래대로'(저절로 정해지는 모드 — 복귀일이면 복귀로).
 * 짧은 날은 주 2회까지 — 넘으면 바꾸지 않고 사유만 돌려준다(시트가 안내).
 */
export function setDayMode(mode: 'short' | 'quiet' | 'normal', now: Date = new Date()): SetModeResult {
  if (!govOn()) return { ok: false, reason: 'off' };
  const { rec, hist } = loadGov(now);
  if (mode === 'short' && rec.mode !== 'short' && shortDaysThisWeek(rec, hist, now) >= SHORT_WEEKLY_MAX) return { ok: false, reason: 'weekly' };
  const next: DayRec = mode === 'normal' ? { ...rec, mode: autoDayMode(rec.date), chosen: false } : { ...rec, mode, chosen: true };
  saveGov(next, hist);
  emit({ mode: next.mode });
  return { ok: true, mode: next.mode };
}

/**
 * 1차 시도 하나를 센다(역할극 태오 대사·말로 떠올리기 — 자기확인·넘어가기는 세지 않는다).
 * 통과율 < 40%(시도 ≥ 6)가 되는 순간 그날 내내 적응(adapt). newly는 이번에 막 켜졌나.
 */
export function recordTry(firstPassed: boolean, now: Date = new Date()): { adapt: boolean; newly: boolean } {
  if (!govOn()) return { adapt: false, newly: false };
  const { rec, hist } = loadGov(now);
  const tries = rec.tries + 1;
  const passed = rec.passed + (firstPassed ? 1 : 0);
  const newly = !rec.adapt && tries >= ADAPT_MIN_TRIES && passed / tries < ADAPT_PASS_RATE;
  saveGov({ ...rec, tries, passed, adapt: !!rec.adapt || newly }, hist);
  if (newly) emit({ adapt: true });
  return { adapt: !!rec.adapt || newly, newly };
}

/** 조용히 모드 낮 세션을 마쳤다(에피소드·복습 끝) — 저녁 보충 안내가 열린다 */
export function markQuietDone(now: Date = new Date()): void {
  if (!govOn()) return;
  const { rec, hist } = loadGov(now);
  if (rec.mode !== 'quiet' || rec.quietDone) return;
  saveGov({ ...rec, quietDone: true }, hist);
  emit({ quietDone: true });
}

/** 조용히 모드 저녁 보충으로 오늘 목표를 채웠나 확인·기록(채웠으면 true). 불꽃은 발화 ≥ 목표로 저절로 켜진다 */
export function checkEveningSupplement(now: Date = new Date()): boolean {
  if (!govOn()) return false;
  const { rec, hist } = loadGov(now);
  if (rec.mode !== 'quiet' || !rec.quietDone || now.getHours() < EVENING_HOUR) return false;
  if (rec.eveningDone) return true;
  const goal = Math.max(1, Math.round(speakGoalLite().goal * dayGoalFactor()));
  if (spokenToday() < goal) return false;
  saveGov({ ...rec, eveningDone: true }, hist);
  emit({ eveningDone: true });
  return true;
}

/**
 * 측정한 시간을 더한다(트래커가 부른다). 캡(20분)에 처음 닿으면 capped + 발화 목표 확정(capSpeakGoalToday),
 * 모드 예산에 처음 닿으면 budgetNoted. 둘 다 이벤트 detail로 알린다.
 */
export function addElapsed(ms: number, strand: Partial<StrandMs> = {}, now: Date = new Date()): { capped: boolean; budget: boolean } {
  const out = { capped: false, budget: false };
  if (!govOn() || !(ms > 0 || Object.values(strand).some((v) => (v || 0) > 0))) return out;
  const { rec, hist } = loadGov(now);
  const s = { ...rec.strandMs };
  for (const k of Object.keys(s) as BudgetKind[]) s[k] += Math.max(0, strand[k] || 0);
  const next: DayRec = { ...rec, elapsedMs: rec.elapsedMs + Math.max(0, ms), strandMs: s };
  if (!rec.capped && next.elapsedMs >= BUDGET_MS.cap) {
    next.capped = true;
    out.capped = true;
  }
  if (!rec.budgetNoted && next.elapsedMs >= BUDGET_MS[rec.mode]) {
    next.budgetNoted = true;
    out.budget = true;
  }
  saveGov(next, hist);
  if (out.capped) {
    try {
      capSpeakGoalToday();
    } catch {
      /* 목표 확정 실패는 측정을 막지 않는다 */
    }
  }
  emit(out);
  return out;
}

/* ── 세션 적응 보조(순수) ── */

/** 속도 한 단계 아래(0.75× 아래로는 안 내림 — 이미 그 아래면 그대로) */
export function adaptSpeed(speed: number, speeds: readonly number[]): number {
  if (speed <= ADAPT_SPEED_FLOOR) return speed;
  const lower = [...speeds].filter((v) => v < speed).sort((a, b) => b - a)[0];
  return Math.max(ADAPT_SPEED_FLOOR, lower ?? speed);
}

/**
 * 짧은 날 역할극 대상 줄이기 — 태오 대사를 앞에서 max줄까지, 지정 상대 대사는 뺀다.
 * speak 장면(원래 말하기 문항)은 역할극이 아니면 멈춰 버리므로 늘 남기고 줄 수에도 센다(넘친 line만 보통 대사로 흐른다).
 */
export function limitRoleTargets<T extends { kind: 'role' | 'mine'; idx: number }>(targets: T[], isSpeakScene: (idx: number) => boolean, max: number): T[] {
  if (!Number.isFinite(max)) return targets;
  let n = 0;
  return targets.filter((t) => {
    if (t.kind !== 'role') return false;
    if (isSpeakScene(t.idx)) {
      n++;
      return true;
    }
    if (n >= max) return false;
    n++;
    return true;
  });
}

/** 엔딩 첫 안내(하루 상태에 따라 하나) — null이면 안 그린다 */
export function endingNote(d: DayState, spoken: number = spokenToday()): { kind: 'cap' | 'adapt' | 'return' | 'short' | 'quiet' | 'evening'; text: string } | null {
  if (!d.enabled) return null;
  const n = Math.floor(spoken);
  if (d.capped) return { kind: 'cap', text: `오늘은 여기까지 — 20분 꽉 채웠어요. 발화 ${n}문장으로 오늘 목표를 확정했어요.` };
  if (d.adapt) return { kind: 'adapt', text: '오늘은 여기까지 — 어려운 날엔 멈추는 게 실력을 지키는 길이에요. 오늘은 0.75×로 천천히, 목표도 가볍게 줄였어요.' };
  if (d.returning) return { kind: 'return', text: '돌아온 것만으로 충분해요 — 오늘은 이 정도면 완벽해요. 내일부터 원래 분량으로 가요.' };
  if (d.short) return { kind: 'short', text: '오늘은 5분 완료 — 짧아도 매일이 이겨요.' };
  if (d.evening) return { kind: 'evening', text: '저녁 보충 — 소리 내어 말한 문장이 오늘 불꽃을 켜요.' };
  if (d.mode === 'quiet') return { kind: 'quiet', text: '조용히 모드 완료 — 저녁 6시 뒤 소리 내어 몇 문장 보충하면 불꽃이 활활 켜져요.' };
  return null;
}

/* ── Four Strands 한 줄(진도 화면) ── */

/** '이번 주 입력 42 · 산출 38 · 유창성 12 · 형식 8%' — 기록이 없으면 null */
export function strandLine(days = 7): { text: string; pct: Record<BudgetKind, number>; totalMin: number } | null {
  const b = budget(days);
  if (!(b.totalMin > 0)) return null;
  const pct = { input: 0, output: 0, fluency: 0, form: 0 } as Record<BudgetKind, number>;
  for (const k of Object.keys(pct) as BudgetKind[]) pct[k] = Math.round((b.totals[k] / b.totalMin) * 100);
  return { text: `이번 주 입력 ${pct.input} · 산출 ${pct.output} · 유창성 ${pct.fluency} · 형식 ${pct.form}%`, pct, totalMin: b.totalMin };
}

/* ── 시간 측정 ── */

export interface Credit {
  /** 세션 시간에 더할 ms */
  elapsed: number;
  /** 갈래별 ms */
  strand: Partial<StrandMs>;
}
const NONE: Credit = { elapsed: 0, strand: {} };

/**
 * 경과 시간 트래커(순수 — 시각을 인자로 받는다). 활성 = 재생(또는 엔딩) 중 && 화면이 보임.
 * 마지막 입력 뒤 IDLE_CUT_MS가 지나면 그 뒤 시간은 세지 않는다(입력이 다시 오면 그때부터).
 * input 갈래는 '이번 재생에 상호작용이 있었나'에 달려 있다 — 상호작용 전까지는 pending에 모았다가 상호작용이 오면 확정,
 * 상호작용 없이 재생이 끝나면 버린다.
 */
export class ElapsedTracker {
  playing = false;
  visible = true;
  strand: StrandKey = 'input';
  private last: number | null = null;
  private lastInput = 0;
  private pendingInput = 0;
  private interacted = false;
  constructor(readonly idleCut: number = IDLE_CUT_MS) {}

  get active(): boolean {
    return this.playing && this.visible;
  }

  /** 지금까지를 정산한다 */
  tick(now: number): Credit {
    if (!this.active) {
      this.last = null;
      return NONE;
    }
    if (this.last == null) {
      this.last = now;
      return NONE;
    }
    const end = Math.min(now, this.lastInput + this.idleCut);
    const ms = Math.max(0, end - this.last);
    this.last = now;
    if (!ms) return NONE;
    return { elapsed: ms, strand: this.attribute(ms) };
  }

  private attribute(ms: number): Partial<StrandMs> {
    if (this.strand === 'shadow') return { input: ms / 2, output: ms / 2 };
    if (this.strand === 'input') {
      if (this.interacted) return { input: ms };
      this.pendingInput += ms;
      return {};
    }
    return { [this.strand]: ms };
  }

  /** 탭·키 입력 */
  input(now: number): Credit {
    const c = this.tick(now);
    this.lastInput = now;
    return c;
  }

  setPlaying(on: boolean, now: number): Credit {
    const c = this.tick(now);
    if (on && !this.playing) {
      this.lastInput = now;
      this.last = this.visible ? now : null;
      this.pendingInput = 0;
      this.interacted = false;
    }
    if (!on && this.playing) {
      // 상호작용 없이 끝난 재생의 input 시간은 버린다
      this.pendingInput = 0;
      this.interacted = false;
      this.last = null;
    }
    this.playing = on;
    return c;
  }

  setVisible(v: boolean, now: number): Credit {
    const c = this.tick(now);
    if (v && !this.visible) {
      // 돌아온 순간부터 다시 센다(돌아온 것 자체를 입력으로 본다)
      this.lastInput = now;
      this.last = this.playing ? now : null;
    }
    if (!v) this.last = null;
    this.visible = v;
    return c;
  }

  setStrand(s: StrandKey, now: number): Credit {
    const c = this.tick(now);
    this.strand = s;
    return c;
  }

  /** 이번 재생에 상호작용이 있었다 — 모아 둔 input을 확정한다 */
  markInteraction(now: number): Credit {
    const c = this.input(now);
    this.interacted = true;
    if (!this.pendingInput) return c;
    const add = this.pendingInput;
    this.pendingInput = 0;
    return { elapsed: c.elapsed, strand: { ...c.strand, input: (c.strand.input || 0) + add } };
  }
}

/* ── 브라우저 배선(싱글턴) ── */

let tracker: ElapsedTracker | null = null;
let session = false;
/** addMinutes는 0.1분 단위로 반올림한다 — 6초 단위로 모아서 넘긴다 */
const STEP_MS = 6000;
const carry: StrandMs = zeroStrand();

function apply(c: Credit) {
  if (!c.elapsed && !Object.keys(c.strand).length) return;
  try {
    addElapsed(c.elapsed, c.strand);
    if (!govOn()) return;
    for (const k of Object.keys(carry) as BudgetKind[]) {
      carry[k] += c.strand[k] || 0;
      if (carry[k] >= STEP_MS) {
        const steps = Math.floor(carry[k] / STEP_MS);
        carry[k] -= steps * STEP_MS;
        addMinutes(k, (steps * STEP_MS) / MIN);
      }
    }
  } catch {
    /* 저장 실패는 학습을 막지 않는다 */
  }
}

const playingNow = () => {
  try {
    return isDramaPlaying() || session;
  } catch {
    return session;
  }
};

/** 드라마 화면이 열릴 때 한 번 — 재생 이벤트·화면 보임·입력을 듣기 시작한다(여러 번 불러도 한 번만) */
export function startDayTracking(): void {
  if (tracker || typeof window === 'undefined' || typeof document === 'undefined' || typeof window.addEventListener !== 'function') return;
  const t = new ElapsedTracker();
  tracker = t;
  const now = () => Date.now();
  apply(t.setVisible(document.visibilityState !== 'hidden', now()));
  apply(t.setPlaying(playingNow(), now()));
  window.addEventListener(DRAMA_PLAYING_EVENT, () => apply(t.setPlaying(playingNow(), now())));
  document.addEventListener('visibilitychange', () => apply(t.setVisible(document.visibilityState !== 'hidden', now())));
  const onInput = () => apply(t.input(now()));
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, onInput, { passive: true, capture: true });
  setInterval(() => apply(t.tick(now())), 5000);
}

/** 엔딩 화면도 세션 시간이다(드라마 '재생 중' 표시는 새 버전 배너 때문에 재생에만 켜진다) */
export function setDaySession(on: boolean): void {
  session = on;
  if (tracker) apply(tracker.setPlaying(playingNow(), Date.now()));
}

/** 지금 쌓이는 갈래 — 역할극 output, 섀도잉 shadow, 듣기 input, 리텔·오늘 질문 fluency(M5), 디코더·HVPT form(M7·M9) */
export function setStrand(s: StrandKey): void {
  if (tracker) apply(tracker.setStrand(s, Date.now()));
}

/** 이번 재생에 상호작용이 있었다(퀴즈 답·다시 듣기·섀도잉·사다리 완주) — 입력 시간이 확정된다 */
export function markInteraction(): void {
  if (tracker) apply(tracker.markInteraction(Date.now()));
}

/** 말하기 결과처럼 손 입력이 없어도 '사람이 있다'는 신호 */
export function noteActivity(): void {
  if (tracker) apply(tracker.input(Date.now()));
}

/** 지금까지를 바로 정산(예산 바가 1초마다 부른다) */
export function tickDayNow(): void {
  if (tracker) apply(tracker.tick(Date.now()));
}

/** mm:ss */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
