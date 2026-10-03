/**
 * 발화 목표(M3) — 불꽃의 연료는 시청이 아니라 '소리 내어 말한 문장 N개'.
 *
 * 첫 14일 10 → 이후 20 → 목표를 7일 연속 채울 때마다 +5 → 상한 35.
 * 키 없는 구간(전사 0 — 자기확인뿐)은 10으로 고정하고 자기확인 가중도 1.0(state.bumpSpoken).
 * 20분 캡에 닿은 날(M4)은 capSpeakGoalToday()로 그날 목표를 지금 발화 수로 확정 — 시간을 다 쓴 날 불꽃을 뺏지 않는다.
 * 저장(va_speak_goal): state.speakGoalLite()가 읽는 goal·kind는 그대로 두고 필드를 더한다
 *   { goal, kind, streakDays, scoredToday, selfToday, keyless, date, since, evalDate, bonus, capped, metDays, freezeWeek }
 * 홈(DramaCard·homeLite·MasterScreen)은 이 파일을 import하지 않는다(순환·청크 예산) — 저장값을 speakGoalLite로만 읽는다.
 * 명세상 자리는 lib/habits.ts였지만, habits는 홈 첫 청크에 통째로 실려(안 쓰는 export도 남는다) 95KB 예산을 넘겨
 * 드라마 화면 청크에서만 받는 이 파일로 옮겼다. 주간 프리즈 적립은 habits.grantFreeze를 부른다.
 */
import { daysBetween, shiftKey, todayKey } from './dates';
import { load, store, spokenToday, groqKey, SPEAK_GOAL_KEY, SPEAK_GOAL_DEFAULT, SPEAK_GOAL_MAX } from './state';
import { grantFreeze } from './habits';
import { dayGovOn } from './homeLite';

export const SPEAK_GOAL_FIRST_DAYS = 14;
export const SPEAK_GOAL_BASE = 20;
export const SPEAK_GOAL_STEP = 5;
export const SPEAK_GOAL_STREAK_EVERY = 7;
/** 주간 발화 목표 — 최근 7일 중 이만큼 목표를 채우면 프리즈 1개(주 1회) */
export const SPEAK_WEEK_DAYS = 5;

export interface SpeakGoalState {
  goal: number;
  /** 'scored' = 채점 가능 발화가 기본 · 'self' = 키 없는 구간(자기확인이 기본) */
  kind: 'scored' | 'self';
  /** 발화 목표를 연속으로 채운 날 수(어제까지) */
  streakDays: number;
  /** 오늘 채점된 발화(가중 합) */
  scoredToday: number;
  /** 오늘 자기확인 발화(가중 합) */
  selfToday: number;
  keyless: boolean;
  /** scoredToday/selfToday가 가리키는 날 */
  date: string;
  /** 발화 목표를 처음 잰 날(첫 14일 판정) */
  since: string;
  /** 연속일을 어디까지 셌나(이 날까지 판정 완료) */
  evalDate: string;
  /** 연속 7일마다 쌓인 가산(5의 배수) */
  bonus: number;
  /** 오늘 20분 캡으로 목표를 확정했나 */
  capped: boolean;
  /** 목표를 채운 날(최근 14개) — 주간 5/7 판정 */
  metDays: string[];
  /** 주간 발화 목표로 프리즈를 준 마지막 주(그 주 월요일) */
  freezeWeek: string;
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const mondayOf = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return shiftKey(key, -((dt.getDay() + 6) % 7));
};

/** 그날의 기본 목표(키 있음) — 첫 14일 10, 이후 20+가산, 상한 35 */
function goalOn(day: string, since: string, bonus: number, keyless: boolean): number {
  if (keyless) return SPEAK_GOAL_DEFAULT;
  if (daysBetween(since, day) < SPEAK_GOAL_FIRST_DAYS) return SPEAK_GOAL_DEFAULT;
  return Math.min(SPEAK_GOAL_MAX, SPEAK_GOAL_BASE + bonus);
}

const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * 지난 날의 목표 감면(M4) — va_day_gov hist[date](또는 아직 넘기지 않은 최상위 기록)의 mode/adapt.
 * 짧은 날 ×0.5 · 적응일 ×0.6(homeLite.dayGoalFactor가 그날 홈에 보여 준 목표와 같은 계수). 기록이 없으면 1.
 */
export function pastDayFactor(day: string): number {
  if (!dayGovOn()) return 1;
  const g = load<Record<string, unknown> | null>('va_day_gov', null);
  if (!isRec(g)) return 1;
  const h = g.date === day ? g : isRec(g.hist) ? g.hist[day] : null;
  if (!isRec(h)) return 1;
  return h.mode === 'short' ? 0.5 : h.adapt === true ? 0.6 : 1;
}

/**
 * 오늘의 발화 목표를 계산·저장하고 돌려준다(하루가 바뀌었으면 어제까지의 연속일·가산·주간 프리즈를 정산).
 * 드라마 화면·회상이 열릴 때 부른다. 홈은 저장값만 읽는다(speakGoalLite).
 */
export function speakGoal(now: Date = new Date()): SpeakGoalState {
  const today = todayKey(now);
  const raw = load<Record<string, unknown> | null>(SPEAK_GOAL_KEY, null);
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const keyless = !groqKey();
  const days = load<string[]>('va_days', []);
  const firstDay = [...days].sort()[0];
  const since = typeof r.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.since) ? r.since : firstDay && firstDay < today ? firstDay : today;
  let streakDays = Math.max(0, Math.round(num(r.streakDays)));
  let bonus = Math.min(SPEAK_GOAL_MAX - SPEAK_GOAL_BASE, Math.max(0, num(r.bonus)));
  const metDays = Array.isArray(r.metDays) ? (r.metDays as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  let freezeWeek = typeof r.freezeWeek === 'string' ? r.freezeWeek : '';
  const yesterday = shiftKey(today, -1);
  // 처음 재는 날은 어제까지를 판정 완료로 둔다(과거를 소급해 깎지 않는다)
  let evalDate = typeof r.evalDate === 'string' && r.evalDate <= yesterday ? r.evalDate : yesterday;
  if (typeof r.evalDate === 'string' && r.evalDate < yesterday) {
    const log = load<Record<string, number>>('va_spoken_log', {});
    // 최대 60일(로그 보관 기간)만 거슬러 센다 — 그 이전 공백은 어차피 연속이 끊긴 것
    let d = r.evalDate < shiftKey(today, -60) ? shiftKey(today, -60) : shiftKey(r.evalDate, 1);
    for (; d <= yesterday; d = shiftKey(d, 1)) {
      // 그날 기록 — 마지막 기록(r) 또는 bumpSpoken이 날을 넘기며 남긴 prev. 캡·키 유무는 '그날' 값으로(오늘 값 아님)
      const rec = r.date === d ? r : isRec(r.prev) && r.prev.date === d ? r.prev : null;
      const kv = rec ? (typeof rec.kl === 'boolean' ? rec.kl : rec.keyless) : undefined;
      const kl = typeof kv === 'boolean' ? kv : keyless;
      // 그날 캡으로 확정됐으면 그 값이 그날 목표. 짧은 날·적응일 감면도 그날 홈에 보인 목표와 같게
      const g = Math.max(1, Math.round((rec && rec.capped === true && typeof rec.goal === 'number' ? (rec.goal as number) : goalOn(d, since, bonus, kl)) * pastDayFactor(d)));
      const met = num(log[d]) >= g && num(log[d]) > 0;
      if (met) {
        streakDays += 1;
        if (!metDays.includes(d)) metDays.push(d);
        // 첫 14일 동안의 연속은 가산하지 않는다(10→20 전환 직후 바로 30이 되지 않게)
        if (streakDays % SPEAK_GOAL_STREAK_EVERY === 0 && daysBetween(since, d) >= SPEAK_GOAL_FIRST_DAYS) bonus = Math.min(SPEAK_GOAL_MAX - SPEAK_GOAL_BASE, bonus + SPEAK_GOAL_STEP);
      } else streakDays = 0;
    }
    evalDate = yesterday;
  }
  const recentMet = metDays.filter((d) => d >= shiftKey(today, -13)).sort();
  // 주간 발화 목표 5/7일 → 프리즈 1개(주 1회, 상한은 FREEZE_MAX) — 집중 모드엔 미션이 없어 미션 3일 적립이 멈춰 있었다
  const week = mondayOf(today);
  const last7 = recentMet.filter((d) => d >= shiftKey(today, -7) && d <= yesterday).length;
  if (last7 >= SPEAK_WEEK_DAYS && freezeWeek !== week) {
    grantFreeze();
    freezeWeek = week;
  }
  const same = r.date === today;
  const capped = same && r.capped === true;
  const goal = capped && typeof r.goal === 'number' ? Math.max(1, Math.round(r.goal as number)) : goalOn(today, since, bonus, keyless);
  const st: SpeakGoalState = {
    goal,
    kind: keyless ? 'self' : 'scored',
    streakDays,
    scoredToday: same ? num(r.scoredToday) : 0,
    selfToday: same ? num(r.selfToday) : 0,
    keyless,
    date: today,
    since,
    evalDate,
    bonus,
    capped,
    metDays: recentMet,
    freezeWeek,
  };
  // 캡 전 목표(base) — 다음 날 bumpSpoken이 낮춘 목표를 이어받지 않게
  // kl = 그날 한 번이라도 키가 없었나(지난 날 정산이 그날 목표를 이 값으로 정한다 — 오늘 아침 키를 등록해도 어제는 어제 기준)
  store(SPEAK_GOAL_KEY, { ...st, kl: (same && r.kl === true) || keyless, ...(capped && typeof r.base === 'number' ? { base: r.base } : {}) });
  return st;
}

/**
 * 20분 캡에 닿았다(M4 dayGovernor가 부른다) — 오늘 목표를 지금 발화 수로 확정한다(내려가기만, 최소 1).
 * 시간을 다 쓴 날 '목표 미달'로 불꽃이 반쯤 꺼지지 않게.
 */
export function capSpeakGoalToday(): SpeakGoalState {
  const st = speakGoal();
  const spoken = Math.floor(spokenToday());
  if (spoken >= st.goal) return st;
  const next = { ...st, goal: Math.max(1, spoken), capped: true, base: st.goal };
  store(SPEAK_GOAL_KEY, next);
  return next;
}

