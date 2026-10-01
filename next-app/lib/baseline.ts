/**
 * 말하기 기준선(M10) — 순수 부분만. 녹음·재전사·화면은 BaselineStep/MonthlyVoiceCard가 맡는다.
 *
 * 왜 필요한가: 배치고사가 문법 객관식뿐이라 speaking 레벨이 과대·과소 추정된다.
 * 첫날 자유 발화(A1은 '오늘 하루 3문장' 15초, A2+는 30초)를 저장해 ±1단계만 보정하고,
 * 같은 질문을 매달·D+7에 반복 녹음해 "말이 늘고 있다"는 증거를 귀로 듣게 한다.
 * 키 없으면 Blob·길이·발성 비율만 저장(adj 생략)했다가 키 등록 시 1회 재전사한다.
 *
 * 이 파일은 원고(dramaSeed)를 import하지 않는다 — D+7 문장은 EP1 태오 대사를 문자열
 * 상수로 고정하고, 원고에 실제로 있는지는 tests/unit/baseline.test.ts가 지킨다.
 */
import { load, store } from './state';
import { todayKey, daysBetween } from './dates';
import { CEFR_ORDER, type Cefr } from './cefr';

/* ───────── 배치 질문 2개 ───────── */

export interface BaselineQuestion {
  level: 'A1' | 'A2+';
  en: string;
  kr: string;
  sec: number;
}

export const PLACEMENT_QUESTIONS: BaselineQuestion[] = [
  { level: 'A1', en: 'How was your day today? Tell me in three sentences.', kr: '오늘 하루 어땠나요? (3문장, 15초)', sec: 15 },
  { level: 'A2+', en: 'Tell me about your work and your customers these days.', kr: '요즘 일과 고객 이야기를 해 주세요 (30초)', sec: 30 },
];

/** 문법 배치 레벨로 질문 고르기 — A1은 3문장 15초, 그 외 30초 */
export function placementQuestionFor(level: Cefr | string): BaselineQuestion {
  return level === 'A1' ? PLACEMENT_QUESTIONS[0] : PLACEMENT_QUESTIONS[1];
}

/* ───────── 월간 고정 질문 3개(매달 같은 질문을 반복해야 비교가 된다) ───────── */

export interface MonthlyQuestion {
  id: 'intro' | 'lastweek' | 'customer';
  en: string;
  kr: string;
  sec: number;
}

export const MONTHLY_QUESTIONS: MonthlyQuestion[] = [
  { id: 'intro', en: 'Please introduce yourself — your job, your team, and what you do all day.', kr: '자기소개 — 하는 일, 팀, 하루 일과를 1분간 말해 보세요.', sec: 60 },
  { id: 'lastweek', en: 'What did you do at work last week? What went well, and what was hard?', kr: '지난주 일 — 무엇을 했고, 잘된 것과 어려웠던 것은?', sec: 60 },
  { id: 'customer', en: 'Tell me about one of your customers and what they need from you.', kr: '내 고객 — 고객 한 곳을 골라 어떤 회사이고 무엇을 원하는지.', sec: 60 },
];

/* ───────── D+7 고정 문장(EP1 태오 대사, ≤9단어, 혼동축 포함) ───────── */

/** EP1 태오 대사 — r-l(sorry·elevator)·th(the)·v-b(elevator)·final-consonant(got·stuck)를 한 문장에 */
export const D7_SENTENCE = 'Sorry! The elevator got stuck.';
export const D7_SENTENCE_KR = '죄송해요! 엘리베이터가 멈췄어요.';
export const D7_AXES = ['r-l', 'th', 'v-b', 'final-consonant'] as const;
/** D+1·D+4·D+7에 같은 문장을 다시 녹음한다 */
export const D7_DAYS = [1, 4, 7] as const;

/* ───────── 단계 4 + 주간 목표 3종 ───────── */

export interface Stage {
  stage: 1 | 2 | 3 | 4;
  /** 이 단계를 끝내면 도달하는 레벨 */
  cefr: Cefr;
  /** 이 단계에 드는 말하기 시간(가이드 × 한국어 L1 보정 1.5) */
  hours: number;
  milestone: string;
  kr: string;
}

/** 가이드 시간(A1→A2 100h, A2→B1 200h, B1→B2 300h, B2→C1 400h) × 한국어 모어 보정 1.5 */
export const L1_FACTOR = 1.5;
export const STAGES: Stage[] = [
  { stage: 1, cefr: 'A2', hours: 100 * L1_FACTOR, milestone: '3문장으로 하루를 말한다', kr: '첫 150시간 — 짧게라도 멈추지 않고' },
  { stage: 2, cefr: 'B1', hours: 200 * L1_FACTOR, milestone: '고객 미팅을 1분간 요약한다', kr: '다음 300시간 — 이야기를 이어서' },
  { stage: 3, cefr: 'B2', hours: 300 * L1_FACTOR, milestone: '준비 없이 제안을 설명한다', kr: '다음 450시간 — 정확하게, 길게' },
  { stage: 4, cefr: 'C1', hours: 400 * L1_FACTOR, milestone: '협상에서 뉘앙스를 고른다', kr: '마지막 600시간 — 원어민처럼' },
];

export interface WeeklyGoal {
  hours: 7 | 10 | 14;
  /** 하루 분(분) */
  perDayMin: number;
  kr: string;
}

export const WEEKLY_GOALS: WeeklyGoal[] = [
  { hours: 7, perDayMin: 60, kr: '하루 1시간 — 출퇴근 + 저녁 한 편' },
  { hours: 10, perDayMin: 86, kr: '하루 1시간 반 — 점심 리텔까지' },
  { hours: 14, perDayMin: 120, kr: '하루 2시간 — 1년 안에 B1' },
];

/* ───────── 안내 문구 10개 ───────── */

export const BASELINE_GUIDES = {
  intro: '마지막으로 오늘 하루를 3문장만 말해 볼까요? (건너뛰기 가능)',
  introA2: '마지막으로 요즘 일과 고객 이야기를 30초만 들려주세요. (건너뛰기 가능)',
  saved: '기준선 저장 — 30일 뒤 같은 질문으로 비교해요.',
  skipped: '건너뛰었어요. 홈에서 언제든 "이달의 1분"으로 기준선을 만들 수 있어요.',
  noKey: '지금은 녹음만 저장해요. 키를 등록하면 단어별 채점·혼동축 칩이 열려요.',
  retranscribed: '키가 등록돼 첫 녹음을 다시 들었어요 — 말하기 레벨을 보정했어요.',
  monthly: '🎙 이달의 1분 — 같은 질문, 지난달의 나와 비교해요.',
  d7: 'D+1 vs D+7 들어보기 — 같은 문장, 일주일 뒤의 내 목소리.',
  d30: '30일이 지났어요. 첫날 질문을 다시 말해 보고 차이를 들어 보세요.',
  d90: '90일 — 석 달 전 나와 비교할 시간이에요.',
} as const;
export type BaselineGuideKey = keyof typeof BASELINE_GUIDES;

/* ───────── va_baseline ───────── */

export interface Baseline {
  /** YYYY-MM-DD */
  date: string;
  /** 문법 배치 레벨(보정 전) */
  level: Cefr;
  durationMs: number;
  wpm?: number;
  /** 발성 비율 0~1(무음 아닌 구간 ÷ 길이) — 키 없을 때 유일한 지표 */
  voiced?: number;
  transcript?: string;
  /** -1|0|1 — speakingAdj 결과(키 없으면 생략) */
  adj?: -1 | 0 | 1;
  /** 녹음 id(M1 storage) */
  recordingId?: string;
  /** 키 없이 저장돼 키 등록 시 1회 재전사가 남아 있는가 */
  pendingRetranscribe?: boolean;
}

const KEY = 'va_baseline';

export function saveBaseline(b: Baseline) {
  store(KEY, b);
}

export function baseline(): Baseline | null {
  const b = load<Baseline | null>(KEY, null);
  return b && typeof b.date === 'string' && typeof b.durationMs === 'number' ? b : null;
}

/* ───────── 말하기 보정 ───────── */

/** 명세 임계: wpm<40 → 한 단계 아래, 40~70 그대로, 70+ → 한 단계 위(B1 상한) */
export const ADJ_WPM_LOW = 40;
export const ADJ_WPM_HIGH = 70;
/** 발성 비율 — 이 아래면 말을 거의 못 이어간 것(키 없어도 판정 가능) */
export const ADJ_VOICED_LOW = 0.35;
export const ADJ_VOICED_HIGH = 0.6;
/** 문법 배치값 +1단계는 B1까지만 — 첫날 30초로 B2를 줄 근거는 없다 */
export const ADJ_CAP: Cefr = 'B1';

export function speakingAdj(b: Pick<Baseline, 'level' | 'wpm' | 'voiced'>): -1 | 0 | 1 {
  const li = CEFR_ORDER.indexOf(b.level);
  const voiced = typeof b.voiced === 'number' ? b.voiced : null;
  const wpm = typeof b.wpm === 'number' ? b.wpm : null;
  // 아래로: wpm이 낮거나(키 있음) 발성 비율이 낮으면(키 없음도 가능). A1은 더 못 내려간다.
  const down = (wpm != null && wpm < ADJ_WPM_LOW) || (wpm == null && voiced != null && voiced < ADJ_VOICED_LOW);
  if (down) return li > 0 ? -1 : 0;
  // 위로: 전사가 있어야(wpm) 한다. 발성 비율까지 있으면 둘 다 넘겨야 한다. 상한 B1.
  const up = wpm != null && wpm >= ADJ_WPM_HIGH && (voiced == null || voiced >= ADJ_VOICED_HIGH);
  if (up) return li < CEFR_ORDER.indexOf(ADJ_CAP) ? 1 : 0;
  return 0;
}

/* ───────── 주기 판정 ───────── */

function weekdayOf(dateKey: string): number {
  const t = Date.parse(`${dateKey}T00:00:00Z`);
  return Number.isNaN(t) ? -1 : new Date(t).getUTCDay();
}

/** 그 달의 첫째 일요일 키 */
export function firstSundayOf(dateKey: string): string {
  const ym = dateKey.slice(0, 7);
  const first = `${ym}-01`;
  const w = weekdayOf(first);
  if (w < 0) return first;
  const d = 1 + ((7 - w) % 7);
  return `${ym}-${String(d).padStart(2, '0')}`;
}

/**
 * 월간 1분 녹음이 때가 됐나 — 첫째 일요일부터 그달 안에 아직 안 했으면 true.
 * 지난 녹음에서 30일이 지났으면 요일과 무관하게 true(한 달을 통째로 건너뛰지 않게).
 */
export function monthlyDue(dateKey: string = todayKey(), lastMonthly: string | null | undefined = null): boolean {
  if (lastMonthly && lastMonthly.slice(0, 7) === dateKey.slice(0, 7)) return false;
  if (dateKey >= firstSundayOf(dateKey)) return true;
  return !!lastMonthly && daysBetween(lastMonthly, dateKey) >= 30;
}

/** D+7 카드(엔딩 1회) — 시작일에서 정확히 7일째 */
export function d7Due(startDate: string, dateKey: string = todayKey()): boolean {
  return d7Stage(startDate, dateKey) === 7;
}

/** D+1·D+4·D+7 고정 문장 재녹음 날이면 그 일차, 아니면 null */
export function d7Stage(startDate: string, dateKey: string = todayKey()): 1 | 4 | 7 | null {
  if (!startDate) return null;
  const d = daysBetween(startDate, dateKey);
  return d === 1 || d === 4 || d === 7 ? d : null;
}

/** D+30·D+90 재녹음 배너 */
export function baselineRecheckDue(b: Baseline | null, dateKey: string = todayKey()): 30 | 90 | null {
  if (!b) return null;
  const d = daysBetween(b.date, dateKey);
  if (d >= 90 && d < 97) return 90;
  if (d >= 30 && d < 37) return 30;
  return null;
}
