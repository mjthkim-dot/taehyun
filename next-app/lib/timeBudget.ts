/**
 * 시간 예산(M10) — 하루에 어떤 종류의 연습을 몇 분 했는지 쌓고, 누적 말하기 시간으로
 * 다음 레벨까지 남은 시간을 한 줄로 보여준다(CefrHero "누적 말하기 14h · B1까지 약 60h").
 *
 * 기록은 va_growth(EVICTABLE 밖) 안의 time 필드 하나만 쓴다 — 월간 녹음(monthly)·D+7 쌍 등
 * 다른 모듈의 필드는 읽어서 그대로 두고 time만 갱신한다(필드 단위 갱신).
 * 종류: input(상호작용 있는 재생만) · output(발화) · fluency(리텔·회화) · form(문법·단어).
 */
import { load, store } from './state';
import { todayKey, shiftKey } from './dates';
import { CEFR_NEXT, CEFR_ORDER, type Cefr } from './cefr';
import { STAGES } from './baseline';

export type BudgetKind = 'input' | 'output' | 'fluency' | 'form';
export const BUDGET_KINDS: BudgetKind[] = ['input', 'output', 'fluency', 'form'];

export type DayBudget = Record<BudgetKind, number>;

/** va_growth — 이 파일은 time만 소유한다. 나머지 필드는 M10 growthArchive가 쓴다. */
export interface GrowthState {
  monthly?: unknown[];
  weeklyGoalH?: 7 | 10 | 14;
  d7Pair?: unknown;
  /** YYYY-MM-DD → 분 */
  time?: Record<string, Partial<DayBudget>>;
}

const KEY = 'va_growth';
/** 하루 기록 보존 일수 — 1년치면 충분하고, 그 이상은 누적값만 있으면 된다 */
const KEEP_DAYS = 400;

function growth(): GrowthState {
  const g = load<GrowthState>(KEY, {});
  return g && typeof g === 'object' ? g : {};
}

function emptyDay(): DayBudget {
  return { input: 0, output: 0, fluency: 0, form: 0 };
}

/** 분 단위로 더한다(소수 허용, 0 이하는 무시). 다른 필드는 건드리지 않는다. */
export function addMinutes(kind: BudgetKind, min: number, date: string = todayKey()) {
  if (!(min > 0) || !BUDGET_KINDS.includes(kind)) return;
  const g = growth();
  const time = { ...(g.time || {}) };
  const day = { ...emptyDay(), ...(time[date] || {}) };
  day[kind] = Math.round((day[kind] + min) * 10) / 10;
  time[date] = day;
  // 오래된 날은 지운다 — 누적 시간은 totalHours가 아니라 budget()이 매번 더하므로 상한이 있어야 한다
  const keys = Object.keys(time).sort();
  if (keys.length > KEEP_DAYS) for (const k of keys.slice(0, keys.length - KEEP_DAYS)) delete time[k];
  store(KEY, { ...g, time });
}

export interface Budget {
  /** 오래된 날 → 오늘, 비어 있는 날은 0 */
  days: ({ date: string } & DayBudget)[];
  totals: DayBudget;
  totalMin: number;
}

/** 최근 n일(오늘 포함) */
export function budget(days = 7, today: string = todayKey()): Budget {
  const time = growth().time || {};
  const out: Budget['days'] = [];
  const totals = emptyDay();
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftKey(today, -i);
    const d = { ...emptyDay(), ...(time[date] || {}) };
    out.push({ date, ...d });
    for (const k of BUDGET_KINDS) totals[k] += d[k];
  }
  const totalMin = BUDGET_KINDS.reduce((s, k) => s + totals[k], 0);
  return { days: out, totals, totalMin };
}

/** 지금까지 쌓인 전부(시간). 말하기만 세려면 kinds를 좁힌다 */
export function totalHours(kinds: BudgetKind[] = ['output', 'fluency']): number {
  const time = growth().time || {};
  let min = 0;
  for (const d of Object.values(time)) for (const k of kinds) min += Number(d?.[k]) || 0;
  return min / 60;
}

/** 누적 단계 시간: sinceCefr에서 출발해 toCefr에 닿기까지(STAGES 합) */
export function hoursBetween(sinceCefr: Cefr, toCefr: Cefr): number {
  const a = CEFR_ORDER.indexOf(sinceCefr);
  const b = CEFR_ORDER.indexOf(toCefr);
  if (a < 0 || b <= a) return 0;
  let h = 0;
  for (const s of STAGES) {
    const t = CEFR_ORDER.indexOf(s.cefr);
    if (t > a && t <= b) h += s.hours;
  }
  return h;
}

/** 다음 레벨까지 남은 시간. totalHours는 sinceCefr에서 시작한 뒤 쌓인 말하기 시간 */
export function hoursToNext(cefr: Cefr, totalHours: number, sinceCefr: Cefr = cefr): number {
  const next = CEFR_NEXT[cefr];
  if (next === cefr) return 0;
  return Math.max(0, hoursBetween(sinceCefr, next) - Math.max(0, totalHours));
}

/** 주간 목표(시간)로 몇 주 남았나 */
export function etaWeeks(remainingHours: number, weeklyGoalH: number): number {
  if (!(weeklyGoalH > 0)) return 0;
  return Math.ceil(Math.max(0, remainingHours) / weeklyGoalH);
}

function fmtH(h: number): string {
  if (h < 10) return `${Math.round(h * 10) / 10}h`;
  return `${Math.round(h)}h`;
}

/** "누적 말하기 14h · B1까지 약 60h" — C1 이상(STAGES 밖)은 남은 시간 대신 '최고 단계' */
export function etaLine(cefr: Cefr, total: number, sinceCefr: Cefr = cefr): string {
  const next = CEFR_NEXT[cefr];
  const head = `누적 말하기 ${fmtH(Math.max(0, total))}`;
  if (next === cefr || !STAGES.some((s) => s.cefr === next)) return `${head} · 최고 단계`;
  const left = hoursToNext(cefr, total, sinceCefr);
  if (left <= 0) return `${head} · ${next} 입증만 남았어요`;
  return `${head} · ${next}까지 약 ${Math.round(left)}h`;
}
