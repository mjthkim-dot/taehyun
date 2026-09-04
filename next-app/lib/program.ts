/**
 * 12주 트레이닝 프로그램 — "도구 42개"를 "하나의 길"로 바꾸는 층.
 *
 * 이 앱에는 이미 배울 것이 넘친다(패턴 세션·SRS 복습·실전 코스·회화·몰입 스토리·
 * 면접까지 38개 화면). 그런데 정작 "오늘 뭘 얼마나 해야 느는가"는 매일 사용자가
 * 직접 골라야 했다. 도구는 많고 길은 없는 상태 — 학습이 끊기는 가장 흔한 이유다.
 *
 * 그래서 이 모듈은 새 학습 기능을 만들지 않는다. 대신 **훈련 프로그램의 문법**을
 * 얹는다. 근력 운동 프로그램이 그렇듯:
 *   ① 주기화 — 12주를 3단계로 나눠 단계마다 목표가 다르다(자동화 → 전이 → 압박)
 *   ② 고정 루틴 — 매일 같은 4블록. 시작할 때 무엇을 할지 고르지 않는다
 *   ③ 점진적 과부하 — 주차가 오를수록 하루 발화 목표가 오른다(25 → 70문장)
 *   ④ 체크포인트 — 5훈련일마다 말하기 시험으로 실제로 늘었는지 측정한다
 *   ⑤ 서약 — 왜 하는지를 본인 말로 남겨두고, 흔들릴 때 그 문장을 다시 보여준다
 *
 * 설계에서 가장 중요한 두 가지:
 *
 * **진도는 달력이 아니라 훈련일로 센다.** Day 7은 "시작 후 7일째"가 아니라
 * "일곱 번째로 훈련을 마친 날"이다. 출장·야근으로 이틀 빠져도 프로그램이 밀리거나
 * 실패로 바뀌지 않는다. 빠진 날은 그냥 채워지지 않았을 뿐이다. 죄책감이 아니라
 * 진척으로 동기를 만든다.
 *
 * **완료는 관찰한다.** 블록마다 "이걸 했다면 앱에 이런 흔적이 남는다"는 신호를
 * 정의해 두고(발화 수·세션 완료·복습 채점 수 등) 자동으로 체크한다. 사용자가
 * 체크리스트를 관리하게 만들지 않는다. 다만 신호로 잡히지 않는 학습(종이에 쓰기,
 * 원어민과 실제 통화)도 있으므로 수동 체크를 항상 함께 둔다 — 앱이 사용자의
 * 학습을 부정하지 않게.
 */
import { load, store, spokenToday, groqKey } from './state';
import { sessionDoneToday } from './session';
import { isMissionDoneToday } from './dailyMission';
import { getChatLogs } from './state';
import { interviewHistory } from './interview';
import type { Mode } from '../components/NavBar';

const KEY = 'va_program';

/**
 * 프로그램의 시작/초기화는 홈 화면의 구성 자체를 바꾼다(중복 CTA가 사라진다).
 * 카드 안에서 일어난 변화를 홈이 알 방법이 없어, 전역 이벤트로 알린다.
 */
export const PROGRAM_EVENT = 'va:program';

function announce() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROGRAM_EVENT));
}

/** 주 5일 × 12주. 주말·출장을 빼고도 지킬 수 있는 분량으로 잡았다. */
export const DAYS_PER_WEEK = 5;
export const TOTAL_WEEKS = 12;
export const TOTAL_DAYS = DAYS_PER_WEEK * TOTAL_WEEKS; // 60 훈련일

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 두 날짜(YYYY-MM-DD) 사이의 달력일 차이.
 * ms 차이를 반올림하면 오후에 시작한 날이 곧바로 '2일째'가 된다 — 날짜만 비교한다.
 */
function daysBetween(fromDate: string, toDate: string): number {
  const a = Date.parse(`${fromDate}T00:00:00Z`);
  const b = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/* ────────────────────────── 블록 ────────────────────────── */

export type BlockKey = 'warmup' | 'core' | 'output' | 'field';

export interface ProgramBlock {
  key: BlockKey;
  /** 화면에 뜨는 이름 */
  title: string;
  /** 이 블록이 무엇을 훈련하는지 — 한 줄 */
  why: string;
  minutes: number;
  /** 눌렀을 때 이동할 화면 */
  mode: Mode;
  /** 오늘 이 블록의 정량 목표(있으면 카드에 표시) */
  goal?: string;
}

/** 오늘 이 블록이 끝났다고 볼 수 있는 흔적이 있는가(관찰 기반 자동 체크). */
function observedDone(key: BlockKey, spokenTarget: number): boolean {
  switch (key) {
    case 'warmup':
      // 복습 채점이 3개 이상 — 또는 오늘 복습할 카드가 아예 없으면 성립하지 않으므로 통과
      return reviewedToday() >= 3;
    case 'core':
      return sessionDoneToday();
    case 'output':
      return spokenToday() >= spokenTarget;
    case 'field':
      // 실전 블록은 화면이 주차마다 달라 신호를 넓게 본다 — 오늘의 회화/면접/미션 중 하나
      return chattedToday() || interviewedToday() || isMissionDoneToday();
  }
}

/** 오늘 복습으로 채점한 카드 수 — gradeWeakItem이 va_review_today에 쌓는다. */
export function reviewedToday(): number {
  const rv = load<{ date: string; count: number }>('va_review_today', { date: '', count: 0 });
  return rv.date === todayKey() ? rv.count : 0;
}

function chattedToday(): boolean {
  return getChatLogs().some((l) => (l.date || '').slice(0, 10) === todayKey());
}

function interviewedToday(): boolean {
  return interviewHistory().some((r) => (r.date || '').slice(0, 10) === todayKey());
}

/* ────────────────────────── 12주 커리큘럼 ────────────────────────── */

export interface ProgramPhase {
  n: 1 | 2 | 3;
  name: string;
  /** 이 단계가 끝나면 무엇이 달라지는가 — 사용자에게 약속하는 결과 */
  promise: string;
  weeks: string;
}

export const PHASES: ProgramPhase[] = [
  {
    n: 1,
    name: '입이 트인다',
    promise: '생각하고 말하는 게 아니라, 문장이 먼저 튀어나옵니다. 기본 패턴이 몸에 붙는 단계.',
    weeks: '1~4주',
  },
  {
    n: 2,
    name: '일이 된다',
    promise: '내 메일·회의에서 실제로 쓰는 영어로 옮겨갑니다. 업무 상황에서 문장이 나오는 단계.',
    weeks: '5~8주',
  },
  {
    n: 3,
    name: '압박에서도 된다',
    promise: '대본 없이, 예상 못 한 질문에도 버팁니다. 면접·협상처럼 긴장되는 자리를 위한 단계.',
    weeks: '9~12주',
  },
];

export interface ProgramWeek {
  week: number;
  phase: 1 | 2 | 3;
  /** 이번 주 한 줄 목표 */
  focus: string;
  /** 하루 발화 목표(점진적 과부하) */
  spokenTarget: number;
  /** 실전 블록이 이번 주에 가는 곳 */
  field: { title: string; why: string; mode: Mode };
}

const FIELD = {
  shadow: { title: '실전 · 쉐도잉', why: '원어민 속도에 입을 맞춰 발음과 리듬을 붙입니다', mode: 'shadowing' as Mode },
  talk: { title: '실전 · AI 회화', why: '배운 문장을 실제 대화에서 꺼내 씁니다', mode: 'talk' as Mode },
  course: { title: '실전 · 내 메일 코스', why: '실제 업무에서 오간 표현으로 연습합니다', mode: 'course' as Mode },
  meeting: { title: '실전 · 회의 영어', why: '미팅에서 끼어들고 정리하는 문장을 훈련합니다', mode: 'meeting' as Mode },
  pitch: { title: '실전 · 피치', why: '고객 앞에서 한 번에 설명하는 힘을 만듭니다', mode: 'pitch' as Mode },
  immersion: { title: '실전 · 몰입 스토리', why: '이야기로 긴 영어를 끝까지 따라가는 지구력을 키웁니다', mode: 'immersion' as Mode },
  interview: { title: '실전 · 면접 시뮬레이션', why: '압박 상황에서 답이 나오는지 실제로 시험합니다', mode: 'interview' as Mode },
  career: { title: '실전 · 커리어 영어', why: '내 경력을 영어로 설명하는 표현을 굳힙니다', mode: 'career' as Mode },
};

/**
 * 주차별 설계 — 발화 목표는 25에서 70까지 계단식으로 올린다.
 * 4주마다 단계가 바뀌고, 실전 블록이 그 단계의 성격을 따라간다.
 */
export const PROGRAM_WEEKS: ProgramWeek[] = [
  { week: 1, phase: 1, focus: '매일 같은 시간에 앉는 습관부터', spokenTarget: 25, field: FIELD.shadow },
  { week: 2, phase: 1, focus: '기본 패턴 자동화 — 생각 없이 나오게', spokenTarget: 30, field: FIELD.shadow },
  { week: 3, phase: 1, focus: '문장 길이 늘리기 — 한 문장에 정보 두 개', spokenTarget: 35, field: FIELD.talk },
  { week: 4, phase: 1, focus: '발음 축 교정 — 반복해서 놓치는 소리', spokenTarget: 40, field: FIELD.talk },
  { week: 5, phase: 2, focus: '업무 표현으로 갈아타기', spokenTarget: 45, field: FIELD.course },
  { week: 6, phase: 2, focus: '회의에서 끼어들기·되묻기', spokenTarget: 45, field: FIELD.meeting },
  { week: 7, phase: 2, focus: '고객에게 설명하기 — 구조를 갖춘 말', spokenTarget: 50, field: FIELD.pitch },
  { week: 8, phase: 2, focus: '이메일 표현을 말로 옮기기', spokenTarget: 50, field: FIELD.course },
  { week: 9, phase: 3, focus: '긴 이야기 끝까지 따라가기', spokenTarget: 55, field: FIELD.immersion },
  { week: 10, phase: 3, focus: '내 경력을 영어로 — 대본 없이', spokenTarget: 60, field: FIELD.career },
  { week: 11, phase: 3, focus: '돌발 질문 대응 — 침묵 줄이기', spokenTarget: 65, field: FIELD.interview },
  { week: 12, phase: 3, focus: '실전 리허설 — 압박 상황 완주', spokenTarget: 70, field: FIELD.interview },
];

export function weekPlan(week: number): ProgramWeek {
  return PROGRAM_WEEKS[Math.min(PROGRAM_WEEKS.length, Math.max(1, week)) - 1];
}

export function phaseOf(week: number): ProgramPhase {
  return PHASES[weekPlan(week).phase - 1];
}

/* ────────────────────────── 상태 ────────────────────────── */

export interface ProgramState {
  /** 시작한 날(YYYY-MM-DD) */
  startedAt: string;
  /** 서약 — 왜 하는가(본인 말) */
  why: string;
  /** 하루에 내겠다고 약속한 시간(분) */
  minutes: number;
  /** 훈련을 마친 날짜들 — 진도의 유일한 근거 */
  days: string[];
  /** 날짜별로 수동 체크한 블록 */
  manual: Record<string, BlockKey[]>;
}

const EMPTY: ProgramState = { startedAt: '', why: '', minutes: 25, days: [], manual: {} };

export function programState(): ProgramState | null {
  const s = load<ProgramState>(KEY, EMPTY);
  return s && s.startedAt ? { ...EMPTY, ...s } : null;
}

/** 프로그램 시작 — 서약을 남기고 Day 1을 연다. */
export function startProgram(pledge: { why: string; minutes: number }): ProgramState {
  const s: ProgramState = {
    startedAt: todayKey(),
    why: pledge.why.trim(),
    minutes: pledge.minutes,
    days: [],
    manual: {},
  };
  store(KEY, s);
  announce();
  return s;
}

export function resetProgram() {
  store(KEY, EMPTY);
  announce();
}

/** 서약 문구만 고쳐 쓴다(왜 하는지는 중간에 바뀔 수 있다). */
export function updatePledge(pledge: { why?: string; minutes?: number }) {
  const s = programState();
  if (!s) return;
  store(KEY, {
    ...s,
    why: pledge.why !== undefined ? pledge.why.trim() : s.why,
    minutes: pledge.minutes !== undefined ? pledge.minutes : s.minutes,
  });
}

export function checkOffBlock(key: BlockKey) {
  const s = programState();
  if (!s) return;
  const today = todayKey();
  const cur = s.manual[today] || [];
  if (!cur.includes(key)) store(KEY, { ...s, manual: { ...s.manual, [today]: [...cur, key] } });
}

export function uncheckBlock(key: BlockKey) {
  const s = programState();
  if (!s) return;
  const today = todayKey();
  const cur = s.manual[today] || [];
  store(KEY, { ...s, manual: { ...s.manual, [today]: cur.filter((k) => k !== key) } });
}

/* ────────────────────────── 오늘의 계획 ────────────────────────── */

export interface TodayBlock extends ProgramBlock {
  done: boolean;
  /** 자동 관찰로 잡혔는가(아니면 수동 체크) — UI가 다르게 보여준다 */
  auto: boolean;
}

export interface TodayPlan {
  /** 오늘이 몇 번째 훈련일인가(이미 마쳤으면 그날의 번호) */
  day: number;
  week: number;
  dayInWeek: number;
  phase: ProgramPhase;
  plan: ProgramWeek;
  blocks: TodayBlock[];
  /** 오늘 4블록을 모두 마쳤는가 */
  allDone: boolean;
  /** 이미 완료 처리된 날인가 */
  recorded: boolean;
  /** 5훈련일마다 오는 측정일 */
  isCheckpoint: boolean;
  /** 전체 완료 훈련일 */
  completed: number;
  spokenTarget: number;
  spoken: number;
}

/** 오늘 할 4블록 — 순서가 곧 훈련 순서다(복습 → 코어 → 산출 → 실전). */
function blocksFor(plan: ProgramWeek, minutes: number): ProgramBlock[] {
  // 약속한 시간에 맞춰 블록 분량을 비례 배분한다(15/25/40분 모두 같은 구조를 유지)
  const unit = minutes / 25;
  const m = (base: number) => Math.max(2, Math.round(base * unit));
  return [
    { key: 'warmup', title: '워밍업 · 복습', why: '어제까지 틀린 문장을 먼저 지웁니다 — 잊기 직전에 다시 만나는 게 핵심', minutes: m(5), mode: 'review', goal: '카드 3개 이상' },
    { key: 'core', title: '코어 · 오늘의 패턴', why: '오늘의 원어민 패턴 하나를 문장으로 만들어 소리 내어 굳힙니다', minutes: m(10), mode: 'session' },
    { key: 'output', title: '산출 · 소리 내어 말하기', why: '아는 것과 말하는 것은 다릅니다 — 오늘 목표량만큼 실제로 발화합니다', minutes: m(7), mode: 'drill', goal: `${plan.spokenTarget}문장` },
    { key: 'field', title: plan.field.title, why: plan.field.why, minutes: m(3), mode: plan.field.mode },
  ];
}

export function todayPlan(): TodayPlan | null {
  const s = programState();
  if (!s) return null;
  const today = todayKey();
  const recorded = s.days.includes(today);
  // 오늘을 이미 마쳤으면 오늘이 그 번호, 아니면 다음 번호가 오늘 도전할 날이다
  const completed = s.days.length;
  const dayIdx = recorded ? s.days.indexOf(today) : completed; // 0-based
  const day = Math.min(TOTAL_DAYS, dayIdx + 1);
  const week = Math.min(TOTAL_WEEKS, Math.floor(dayIdx / DAYS_PER_WEEK) + 1);
  const dayInWeek = (dayIdx % DAYS_PER_WEEK) + 1;
  const plan = weekPlan(week);
  const manual = s.manual[today] || [];
  const blocks: TodayBlock[] = blocksFor(plan, s.minutes).map((b) => {
    const auto = observedDone(b.key, plan.spokenTarget);
    return { ...b, auto, done: auto || manual.includes(b.key) };
  });
  return {
    day,
    week,
    dayInWeek,
    phase: phaseOf(week),
    plan,
    blocks,
    allDone: blocks.every((b) => b.done),
    recorded,
    isCheckpoint: dayInWeek === DAYS_PER_WEEK,
    completed,
    spokenTarget: plan.spokenTarget,
    spoken: spokenToday(),
  };
}

/**
 * 오늘 4블록을 다 채웠으면 훈련일로 기록한다 — 홈이 열릴 때마다 조용히 호출된다.
 * 하루에 한 번만 쌓이고, 이미 기록된 날은 건드리지 않는다.
 */
export function syncProgramDay(): boolean {
  const s = programState();
  if (!s) return false;
  const today = todayKey();
  if (s.days.includes(today)) return false;
  const t = todayPlan();
  if (!t || !t.allDone) return false;
  store(KEY, { ...s, days: [...s.days, today].slice(-TOTAL_DAYS * 2) });
  return true;
}

/* ────────────────────────── 통계 ────────────────────────── */

export interface ProgramStats {
  completed: number;
  total: number;
  /** 0~100 */
  percent: number;
  /** 시작 후 지난 달력일 */
  elapsedDays: number;
  /** 최근 14일 중 훈련한 날 수 — 실제 밀도 */
  recentDensity: number;
  /** 이번 주(현재 주차)에 채운 훈련일 */
  weekDone: number;
  remaining: number;
  /** 지금 속도면 남은 일수를 며칠 만에 끝내는가(주 5일 기준 추정) */
  projectedWeeks: number;
}

export function programStats(): ProgramStats | null {
  const s = programState();
  if (!s) return null;
  const completed = s.days.length;
  const elapsedDays = Math.max(1, daysBetween(s.startedAt, todayKey()) + 1);
  const today = todayKey();
  const recentDensity = s.days.filter((d) => daysBetween(d, today) < 14).length;
  const weekDone = completed % DAYS_PER_WEEK;
  const remaining = Math.max(0, TOTAL_DAYS - completed);
  // 최근 2주 실측 속도로 남은 기간을 정직하게 추정한다(장밋빛 계획 금지)
  const perWeek = recentDensity > 0 ? recentDensity / 2 : DAYS_PER_WEEK;
  return {
    completed,
    total: TOTAL_DAYS,
    percent: Math.round((completed / TOTAL_DAYS) * 100),
    elapsedDays,
    recentDensity,
    weekDone: completed > 0 && weekDone === 0 ? DAYS_PER_WEEK : weekDone,
    remaining,
    projectedWeeks: Math.ceil(remaining / Math.max(1, perWeek)),
  };
}

/**
 * 지금 이 사람에게 필요한 한마디 — 상태에 따라 다르게 말한다.
 * 잘하고 있으면 짧게, 끊겼으면 서약을 다시 보여준다(잔소리 대신 본인의 말).
 */
export function programNudge(): { tone: 'good' | 'back' | 'start'; text: string } | null {
  const s = programState();
  const st = programStats();
  if (!s || !st) return null;
  const last = s.days[s.days.length - 1];
  const gap = last ? daysBetween(last, todayKey()) : 0;
  if (!last) return { tone: 'start', text: '첫 훈련일을 여는 게 가장 어렵습니다. 오늘 4블록만 채우면 Day 1이 켜집니다.' };
  if (gap >= 3)
    return {
      tone: 'back',
      text: s.why ? `${gap}일 쉬었습니다. 시작할 때 이렇게 적으셨어요 — “${s.why}”` : `${gap}일 쉬었습니다. 오늘 한 블록만 해도 다시 이어집니다.`,
    };
  if (st.recentDensity >= 8) return { tone: 'good', text: `최근 2주에 ${st.recentDensity}일 훈련 — 이 속도면 ${st.projectedWeeks}주 뒤 완주입니다.` };
  return { tone: 'good', text: `Day ${st.completed}/${TOTAL_DAYS} · 남은 ${st.remaining}일, 지금 속도로 약 ${st.projectedWeeks}주.` };
}

/** AI 키 없이도 프로그램은 돌아가지만, 회화·면접 블록은 반쪽이 된다 — 화면이 정직하게 알린다. */
export function needsKeyForField(mode: Mode): boolean {
  return !groqKey() && (mode === 'talk' || mode === 'interview' || mode === 'course' || mode === 'career');
}
