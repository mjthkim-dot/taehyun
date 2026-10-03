/**
 * 엔딩 리텔(M5) — 순수 부분만. 화면·녹음 배선은 components/drama/cards/RetellCard.tsx가 맡는다.
 *
 * 왜 이렇게 나눴나: 시간표·청자·안내·담화 표지·오늘 질문 템플릿·채점은 브라우저 없이
 * 단위 테스트할 수 있어야 하고(키 없이도 지표가 나와야 한다는 원칙 2), 홈 첫 청크가
 * 원고(dramaSeed)를 끌어오지 않도록 이 파일은 drama.ts·dramaSeed를 import하지 않는다.
 *
 * 시간표 근거: de Jong & Perfetti의 4/3/2는 15일 이후부터. 0~14일(또는 A1)은 좌절 없는
 * '3문장 20초' 1회만, A2는 45/30/20(3회차 생략 가능), B1+는 60/45/30(3회차 기본).
 *
 * 키워드 설계: 한국어 키워드는 영어 발화 전사와 직접 비교할 수 없다. 그래서 키워드는
 * {kr, en:string[]} — 화면에는 kr만 보이고(영어 가림), 채점은 en 동의어 후보로 한다.
 */
import { load, store } from './state';
import { todayKey, shiftKey, daySeed, daysBetween } from './dates';
import { FILLER_RE, PAUSE_MS, type FluencyWord } from './fluency';
import type { Cefr } from './cefr';

/* ───────── 시간표 ───────── */

export type RetellPhase = 'first14' | 'A2' | 'B1+';
export type RetellRoundNo = 'short' | 1 | 2 | 3 | 'mix' | '333';

export interface RetellRound {
  sec: number;
  /** 화면 라벨(한국어) */
  label: string;
  /** 기록용 회차 */
  round: RetellRoundNo;
  /** 기본 카드에 보이는 회차인가(false면 '조금 더 ▾' 안) */
  basic: boolean;
}

export interface RetellSchedule {
  phase: RetellPhase;
  rounds: RetellRound[];
  /** 이 단계에서 보여줄 키워드 수 */
  keywordCount: number;
}

/** 레벨·일차별 시간표 3세트 */
export const RETELL_SCHEDULE: Record<RetellPhase, RetellSchedule> = {
  first14: {
    phase: 'first14',
    keywordCount: 3,
    rounds: [{ sec: 20, label: '3문장 20초', round: 'short', basic: true }],
  },
  A2: {
    phase: 'A2',
    keywordCount: 4,
    rounds: [
      { sec: 45, label: '1회차 45초', round: 1, basic: true },
      { sec: 30, label: '2회차 30초', round: 2, basic: false },
      { sec: 20, label: '3회차 20초 (생략 가능)', round: 3, basic: false },
    ],
  },
  'B1+': {
    phase: 'B1+',
    keywordCount: 6,
    rounds: [
      { sec: 60, label: '1회차 60초', round: 1, basic: true },
      { sec: 45, label: '2회차 45초', round: 2, basic: false },
      { sec: 30, label: '3회차 30초', round: 3, basic: false },
    ],
  },
};

/** 토요일 교차 리텔(지난 3화 키워드 섞어 60초) */
export const MIX_ROUND: RetellRound = { sec: 60, label: '이번 주 이야기 60초', round: 'mix', basic: true };
/** 월 1회 3/3/3(30초×3, 정확하게 말하기 날) */
export const ROUND_333: RetellRound[] = [1, 2, 3].map((n) => ({ sec: 30, label: `정확하게 ${n}/3 · 30초`, round: '333' as const, basic: n === 1 }));

/** 첫 2주(0~14일) 또는 A1은 'short', 15일+는 레벨로 */
export const FIRST_PHASE_DAYS = 14;

export function retellPhase(daysSinceStart: number, level: Cefr | string): RetellPhase {
  if (!(daysSinceStart > FIRST_PHASE_DAYS) || level === 'A1') return 'first14';
  return level === 'A2' ? 'A2' : 'B1+';
}

/* ───────── 청자 3명 ───────── */

export interface Listener {
  id: 'maya' | 'jun' | 'diane';
  /** 영어 호칭(칩에 그대로) */
  name: string;
  /** 한국어 안내 — "~에게 설명하듯" */
  kr: string;
  icon: string;
}

export const LISTENERS: Listener[] = [
  { id: 'maya', name: 'Maya', icon: '👩‍💼', kr: '동료 Maya에게 오늘 있었던 일을 설명하듯 말해 보세요.' },
  { id: 'jun', name: 'Jun', icon: '🧑‍💻', kr: '이번엔 Jun에게 — 같은 이야기를 조금 더 짧게, 핵심만.' },
  { id: 'diane', name: 'Diane', icon: '👩‍💻', kr: '마지막은 Diane(CEO)에게 — 한 숨에, 정중하게 요약해 보세요.' },
];

/* ───────── 안내 7개 ───────── */

export const RETELL_GUIDES = {
  short: '3문장이면 충분해요. 누가, 무엇을, 그래서 어떻게 됐는지 — 20초.',
  round1: '준비 없이 바로 시작해요. 틀려도 멈추지 말고 끝까지 말해 보세요.',
  round2: '같은 이야기를 더 짧은 시간에. 방금 한 말을 그대로 써도 좋아요.',
  round3: '마지막 한 번 — 가장 빠르고 매끄럽게. 건너뛰어도 괜찮아요.',
  fix: '딱 한 줄만 고쳐요. 인물 목소리로 듣고 한 번 따라 말한 뒤 2회차로.',
  mix: '토요일은 이번 주 세 편을 하나로 이어서 60초. 순서는 자유예요.',
  m333: '한 달에 한 번 "정확하게 말하기 날" — 30초씩 3번, 속도보다 문장을 끝까지 맞게.',
} as const;
export type RetellGuideKey = keyof typeof RETELL_GUIDES;

/* ───────── 담화 표지 6개 ───────── */

export interface Marker {
  en: string;
  kr: string;
}

/** 로테이션 — 하루 2개씩, 영어 노출(가림 없음) */
export const MARKERS: Marker[] = [
  { en: 'first', kr: '먼저' },
  { en: 'then', kr: '그다음' },
  { en: 'actually', kr: '사실은' },
  { en: 'so', kr: '그래서' },
  { en: 'but', kr: '하지만' },
  { en: 'finally', kr: '결국' },
];

/** 날짜 시드로 2개 고른다(같은 날엔 같은 쌍) */
export function markersFor(dateKey: string = todayKey()): [Marker, Marker] {
  const i = daySeed(dateKey) % MARKERS.length;
  return [MARKERS[i], MARKERS[(i + 1) % MARKERS.length]];
}

/* ───────── 오늘 질문 템플릿 6개 ───────── */

export interface QuestionTemplate {
  id: string;
  /** {who}=영어 이름, {cliff}/{recap}=원고의 한국어 한 줄 */
  en: string;
  kr: string;
}

export const DAILY_QUESTIONS: QuestionTemplate[] = [
  { id: 'say-to', en: 'What would you say to {who}?', kr: '{cliff}\n당신이 태오라면 {who}에게 뭐라고 말할까요?' },
  { id: 'next', en: 'What happens next? Tell me.', kr: '{cliff}\n다음에 무슨 일이 일어날까요? 자유롭게 말해 보세요.' },
  { id: 'tell', en: 'Tell {who} what happened today.', kr: '오늘 있었던 일을 {who}에게 전해 주세요.\n({recap})' },
  { id: 'feel', en: 'How does Taeo feel right now? Why?', kr: '{cliff}\n지금 태오는 어떤 기분일까요? 이유도 함께.' },
  { id: 'you', en: "What would you do in Taeo's place?", kr: '{cliff}\n당신이 태오 자리에 있다면 어떻게 할까요?' },
  { id: 'advice', en: 'Give {who} one piece of advice.', kr: '{recap}\n{who}에게 조언 한 가지를 해 주세요.' },
];

export interface DailyQuestion {
  id: string;
  en: string;
  kr: string;
  /** 20초 1회 */
  sec: number;
}

/** 요일(0=일) — 로컬 타임존에 안 흔들리게 UTC 자정으로 센다 */
function weekdayOf(dateKey: string): number {
  const t = Date.parse(`${dateKey}T00:00:00Z`);
  return Number.isNaN(t) ? -1 : new Date(t).getUTCDay();
}

/** 오늘 질문은 월·수·금만 */
export function dailyQuestionDue(dateKey: string = todayKey()): boolean {
  const w = weekdayOf(dateKey);
  return w === 1 || w === 3 || w === 5;
}

/** 토요일 교차 리텔 */
export function weeklyMixDue(dateKey: string = todayKey()): boolean {
  return weekdayOf(dateKey) === 6;
}

function fill(t: string, v: Record<string, string>): string {
  return t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '').replace(/\n\s*\n/g, '\n').trim();
}

/** 규칙 생성 질문 1개(AI 0) — 월·수·금이 아니면 null */
export function dailyQuestionFor(ep: { no: number; cliff: string; recap: string }, dateKey: string = todayKey(), who: Listener = LISTENERS[ep.no % LISTENERS.length]): DailyQuestion | null {
  if (!dailyQuestionDue(dateKey)) return null;
  const t = DAILY_QUESTIONS[(daySeed(dateKey) + ep.no) % DAILY_QUESTIONS.length];
  const v = { who: who.name, cliff: ep.cliff || '', recap: ep.recap || '' };
  return { id: t.id, en: fill(t.en, v), kr: fill(t.kr, v), sec: 20 };
}

/* ───────── 키워드 ───────── */

/** 화면엔 kr만(영어 가림), 채점은 en 동의어 후보로 */
export interface RetellKeyword {
  kr: string;
  en: string[];
}

export interface RetellEpisodeLite {
  no: number;
  level: Cefr | string;
  cliff: string;
  recap: string;
  /** 시드 7화는 M2 dramaSeedMine 수작업, AI 화는 소프트 필드 */
  keywords?: RetellKeyword[];
  learn?: { en: string; kr: string }[];
}

/** 폴백용 인물명 — 원고 import 없이 상수로 */
const CAST_KEYWORDS: RetellKeyword[] = [
  { kr: '마야', en: ['maya'] },
  { kr: '준', en: ['jun'] },
  { kr: '다이앤', en: ['diane'] },
];

/** ep.keywords → 없으면 learn 2 + 인물명 폴백 */
export function keywordsOf(ep: RetellEpisodeLite, count: number): RetellKeyword[] {
  const own = (ep.keywords || []).filter((k) => k && k.kr && Array.isArray(k.en) && k.en.length);
  if (own.length) return own.slice(0, count);
  const fromLearn: RetellKeyword[] = (ep.learn || []).slice(0, 2).map((l) => ({ kr: l.kr, en: [l.en] }));
  const cast = CAST_KEYWORDS.slice(ep.no % CAST_KEYWORDS.length).concat(CAST_KEYWORDS.slice(0, ep.no % CAST_KEYWORDS.length));
  return [...fromLearn, ...cast].slice(0, count);
}

/* ───────── 오늘의 리텔 계획 ───────── */

export interface RetellPlan {
  phase: RetellPhase;
  rounds: (RetellRound & { listener: Listener })[];
  keywords: RetellKeyword[];
  markers: [Marker, Marker];
  question: DailyQuestion | null;
  /** 1회차 청자 */
  listener: Listener;
  guide: string;
}

export function retellPlanFor(ep: RetellEpisodeLite, daysSinceStart: number, dateKey: string = todayKey()): RetellPlan {
  const phase = retellPhase(daysSinceStart, ep.level);
  const sch = RETELL_SCHEDULE[phase];
  const rounds = sch.rounds.map((r, i) => ({ ...r, listener: LISTENERS[i % LISTENERS.length] }));
  return {
    phase,
    rounds,
    keywords: keywordsOf(ep, sch.keywordCount),
    markers: markersFor(dateKey),
    question: dailyQuestionFor(ep, dateKey),
    listener: rounds[0].listener,
    guide: phase === 'first14' ? RETELL_GUIDES.short : RETELL_GUIDES.round1,
  };
}

/* ───────── 채점(순수) ───────── */

export interface ScoreInput {
  /** 전사(또는 브라우저 STT 결과) */
  said: string;
  keywords: RetellKeyword[];
  markers: Marker[];
  /** 오늘 표현 영어 문장 */
  learn: string[];
  durationMs: number;
  wpm: number;
  /** 회차 시간(초). 없으면 60 */
  targetSec?: number;
}

export interface RetellScore {
  keywordHits: number;
  markerHits: number;
  learnHits: number;
  /** 0~100: 키워드 40 · 표현 30 · 담화 표지 10 · 시간 내 20(항목이 없는 축은 제외하고 100으로 환산) */
  score: number;
  chips: string[];
}

/** 소문자·구두점 제거·공백 정규화(어포스트로피는 남긴다 — don't/it's) */
export function normalizeSaid(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** 연속 토큰 일치. 4글자 이상은 어두 일치 허용(nervous→nervously, meet→meeting) */
function containsPhrase(said: string[], phrase: string): boolean {
  const p = normalizeSaid(phrase);
  if (!p.length || said.length < p.length) return false;
  const tokOk = (w: string, t: string) => w === t || (t.length >= 4 && w.startsWith(t));
  for (let i = 0; i + p.length <= said.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (!tokOk(said[i + j], p[j])) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

/** 전사에서 쓴 오늘 표현 — n-gram 연속 일치(RetellCard가 '표현 ✓' 칩에 쓴다) */
export function usedLearn(said: string, learn: string[]): string[] {
  const toks = normalizeSaid(said);
  return learn.filter((l) => containsPhrase(toks, l));
}

export function scoreRetell(input: ScoreInput): RetellScore {
  const toks = normalizeSaid(input.said);
  const keywordHits = input.keywords.filter((k) => k.en.some((en) => containsPhrase(toks, en))).length;
  const markerHits = input.markers.filter((m) => containsPhrase(toks, m.en)).length;
  const learnHits = usedLearn(input.said, input.learn).length;

  // 항목이 0개인 축은 분모에서 뺀다 — AI 화에 learn이 없다고 30점을 잃으면 안 된다.
  let earned = 0;
  let possible = 0;
  if (input.keywords.length) { earned += 40 * (keywordHits / input.keywords.length); possible += 40; }
  if (input.learn.length) { earned += 30 * (learnHits / input.learn.length); possible += 30; }
  if (input.markers.length) { earned += 10 * (markerHits / input.markers.length); possible += 10; }

  // 시간 내 20: 너무 짧으면(목표의 1/4 미만, 최소 3초) 0, 넘기면 10, 안이면 20
  const maxMs = (input.targetSec ?? 60) * 1000;
  const minMs = Math.max(3000, maxMs / 4);
  const dur = input.durationMs;
  const timePts = dur < minMs ? 0 : dur <= maxMs + 1500 ? 20 : 10;
  earned += timePts;
  possible += 20;

  const score = possible ? Math.round((earned / possible) * 100) : 0;
  const chips: string[] = [`WPM ${Math.round(input.wpm || 0)}`];
  if (input.keywords.length) chips.push(`키워드 ${keywordHits}/${input.keywords.length}`);
  if (input.learn.length) chips.push(`표현 ${learnHits}/${input.learn.length}`);
  if (input.markers.length) chips.push(markerHits ? '표지 ✓' : '표지 –');
  chips.push(timePts === 20 ? `${Math.round(maxMs / 1000)}초 안 ✓` : timePts === 10 ? '시간 초과' : '너무 짧아요');
  return { keywordHits, markerHits, learnHits, score, chips };
}

/* ───────── 기록 va_retell ───────── */

export interface RetellRecord {
  /** YYYY-MM-DD */
  date: string;
  epNo: number;
  round: RetellRoundNo;
  wpm: number;
  score: number;
  durationMs: number;
  /* ── 이하 선택(M5 RetellCard가 채운다 — 예전 기록·홈 점 읽기와 호환) ── */
  /** 300ms 이상 멈춤 수 */
  pauses?: number;
  /** 절 내부 멈춤 수 */
  clausePauses?: number;
  /** 채움말 수(담화 표지로 쓴 actually 등은 뺀다) */
  fillers?: number;
  usedLearn?: string[];
  usedMarkers?: string[];
  /** 발화 개시 지연(ms) */
  latencyMs?: number;
  /** 키 없음(전사 없이 녹음만) — wpm·score는 0 */
  keyless?: boolean;
}

const KEY = 'va_retell';
const MAX = 60;

export function saveRetell(rec: RetellRecord) {
  const all = load<RetellRecord[]>(KEY, []);
  all.push(rec);
  store(KEY, all.slice(-MAX));
}

/** 최근 n일 기록(오늘 포함) */
export function retellHistory(days = 14, today: string = todayKey()): RetellRecord[] {
  const from = shiftKey(today, -(days - 1));
  return load<RetellRecord[]>(KEY, []).filter((r) => r && typeof r.date === 'string' && r.date >= from && r.date <= today);
}

/** 오늘 이 화를 이미 리텔했나(회차 무관) */
export function retelledToday(epNo: number, today: string = todayKey()): boolean {
  return load<RetellRecord[]>(KEY, []).some((r) => r && r.date === today && r.epNo === epNo);
}

/* ───────── 월 1회 3/3/3 ───────── */

/** 그 달의 첫째 일요일(YYYY-MM-DD) */
export function firstSundayOf(dateKey: string): string {
  const [y, m] = dateKey.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const add = (7 - first.getUTCDay()) % 7;
  return `${dateKey.slice(0, 7)}-${String(1 + add).padStart(2, '0')}`;
}

/**
 * 이번 달 '정확하게 말하기 날'(3/3/3)을 할 때인가 — 첫째 일요일 이후 첫 리텔부터, 그 달에 아직 '333' 기록이 없으면.
 * 첫 2주('short' 단계)에는 부르지 않는다(호출부가 단계로 거른다).
 */
export function monthly333Due(dateKey: string = todayKey(), records: RetellRecord[] = load<RetellRecord[]>(KEY, [])): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey < firstSundayOf(dateKey)) return false;
  const month = dateKey.slice(0, 7);
  return !records.some((r) => r && r.round === '333' && typeof r.date === 'string' && r.date.slice(0, 7) === month);
}

/* ───────── 시작일 ───────── */

/**
 * 학습 시작 후 며칠째인가(시작일 = 0) — 발화 목표(speakGoal)가 잰 since, 없으면 va_days의 가장 이른 날, 그것도 없으면 오늘.
 * 리텔 시간표의 '첫 14일' 판정에 쓴다(발화 목표의 첫 14일과 같은 기준).
 */
export function daysSinceStart(today: string = todayKey()): number {
  const g = load<{ since?: unknown } | null>('va_speak_goal', null);
  const days = load<unknown[]>('va_days', []);
  const first = (Array.isArray(days) ? days.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) : []).sort()[0];
  const since = g && typeof g.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.since) ? g.since : first && first < today ? first : today;
  return Math.max(0, daysBetween(since, today));
}

/* ───────── 결과 표시용(순수) ───────── */

export interface PauseToken {
  w: string;
  /** 이 단어 뒤에서 멈췄나(결과 전사에 '|'로) */
  pauseAfter: boolean;
}

/** 단어 타임스탬프 → 전사 토큰 + 멈춤 위치(기본 300ms, fluency.pauses300과 같은 기준) */
export function pauseMarks(words: FluencyWord[], minMs = PAUSE_MS): PauseToken[] {
  const ws = words.filter((w) => w && Number.isFinite(w.start) && Number.isFinite(w.end)).sort((a, b) => a.start - b.start);
  return ws.map((w, i) => ({ w: String(w.word).trim(), pauseAfter: i + 1 < ws.length && (ws[i + 1].start - w.end) * 1000 >= minMs }));
}

/** 채움말 수 — 담화 표지로 고른 말(actually 등)은 채움말로 세지 않는다 */
export function countFillers(text: string, markers: string[] = []): number {
  const skip = new Set(markers.map((m) => m.toLowerCase()));
  return (text.match(new RegExp(FILLER_RE.source, 'gi')) || []).filter((m) => !skip.has(m.toLowerCase())).length;
}

/** 오늘 질문(20초) 점수 — 정답이 없는 즉흥 발화라 '얼마나 말했나'만: 단어 20개(분당 60)면 100 */
export function dailyQScore(wordCount: number): number {
  return Math.max(0, Math.min(100, Math.round(wordCount * 5)));
}
