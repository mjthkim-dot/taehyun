/**
 * voice-assistant/index.html 의 localStorage 기반 진도 상태 포팅.
 * 동일한 va_* 키를 사용해 기존 vanilla 앱과 데이터를 공유한다.
 */
// lessons.ts가 아니라 cefr.ts에서 가져온다 — lessons.ts는 371KB짜리 JSON을 정적
// import하므로, 여기서 부르면 상태를 읽는 모든 화면이 전 레슨 본문을 안고 시작한다.
import { todayKey as localToday, dateKey } from './dates';
import { CEFR_GSE, CEFR_ORDER, gseMid, gseToCefr, scaffoldFor, type Cefr } from './cefr';

/** 셸 밖(배너·오류 화면)에서 화면을 바꾸고 싶을 때 — detail에 모드 이름 */
export const NAVIGATE_EVENT = 'va:navigate';

/** 저장 실패(용량 초과)를 앱에 알리는 신호 — 조용히 데이터를 잃지 않기 위해. */
export const STORAGE_FULL_EVENT = 'va:storage-full';

/**
 * 용량이 부족할 때 먼저 버려도 되는 것들(앞에서부터 순서대로). 학습 진도는 건드리지 않는다.
 * 순서는 M1에서 확정 — 이후 모듈은 키를 등록만 한다(순서 변경 금지).
 * 밖(절대 지우지 않음): va_attempt_daily(일별 집계 — 로그가 지워져도 추이는 남는다), va_growth,
 * va_flags, va_day_gov, va_diag, va_sound_track, va_speak_goal, va_baseline — NEVER_EVICT 참조.
 */
export const EVICTABLE = [
  // ① AI·합성이 다시 만들 수 있는 캐시부터(지워도 학습 기록은 그대로)
  'va_depth_cache',
  'va_gloss_cache',
  'va_ladder_cache',
  'va_tts_meta', // TTS 캐시 적중률 카운터(지표일 뿐)
  'va_grammar_variants',
  'va_dlg_variants',
  'va_drama_resume', // 이어 보기(없으면 처음부터 보면 된다)
  'va_dispute_log', // 채점 이의 제기 기록
  // ② 그다음 오래된 기록(최근 것은 집계에 이미 반영돼 있다)
  'va_chat_logs',
  'va_ask_history',
  'va_sessions',
  'va_retell', // 리텔 원문 기록
  'va_recall_speak', // 말로 떠올리기 기록
  'va_spoken_log',
  'va_attempt_log', // 시도 로그 — 접힌 집계(va_attempt_daily)는 남는다
];

/** 용량 부족에도 지우지 않는 키(문서화 + 테스트 고정) — 지표·설정·기준선 */
export const NEVER_EVICT = ['va_attempt_daily', 'va_growth', 'va_flags', 'va_day_gov', 'va_diag', 'va_sound_track', 'va_speak_goal', 'va_baseline'] as const;

export function store(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // 용량 초과 — 조용히 무시하면 그 순간부터 학습 기록이 사라진다(사용자는 모른다).
    // 버려도 되는 캐시·기록부터 정리하고 한 번 더 시도한 뒤, 그래도 안 되면 알린다.
    for (const k of EVICTABLE) {
      if (k === key) continue;
      try {
        if (localStorage.getItem(k) == null) continue;
        localStorage.removeItem(k);
        localStorage.setItem(key, JSON.stringify(val));
        return;
      } catch {
        /* 다음 후보로 */
      }
    }
    try {
      window.dispatchEvent(new CustomEvent(STORAGE_FULL_EVENT, { detail: { key } }));
    } catch {
      /* 브라우저 밖(SSR) */
    }
  }
}

export function load<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return def;
    const parsed = JSON.parse(raw) ?? def;
    // 저장값이 기대한 모양이 아니면(다른 버전·수동 편집·복원 실패로 손상) 기본값을 쓴다.
    // 이걸 걸러내지 않으면 배열에 .filter를 부르다 렌더 도중 터져 화면이 백지가 된다.
    if (Array.isArray(def) !== Array.isArray(parsed)) return def;
    if (def !== null && typeof def === 'object' && !Array.isArray(def) && (typeof parsed !== 'object' || parsed === null)) return def;
    return parsed as T;
  } catch {
    return def;
  }
}

export interface Profile {
  cefr: Cefr;
  gse: number;
  scaffolding: number;
}

export function getProfile(): Profile {
  const p = load<Profile | null>('va_profile', null);
  if (p && p.cefr) return p;
  const init: Profile = { cefr: 'A2', gse: gseMid('A2'), scaffolding: 1.0 };
  store('va_profile', init);
  return init;
}

export function saveProfile(p: Profile) {
  store('va_profile', p);
}

export const SKILLS = [
  { key: 'speaking', label: '구어 상호작용' },
  { key: 'listening', label: '청해' },
  { key: 'reading', label: '독해' },
  { key: 'writing', label: '문어 생산' },
] as const;
export type SkillKey = (typeof SKILLS)[number]['key'];

export type SkillStats = Record<SkillKey, { gse: number; sessions: number }>;

export function getSkillStats(): SkillStats {
  const s = load<SkillStats | null>('va_skill_stats', null);
  // 모양까지 확인(문자열·빈 칸이면 새로 만든다 — 예전엔 "x" 한 글자로 홈이 깨졌다)
  if (s && typeof s === 'object' && SKILLS.every((sk) => s[sk.key] && typeof s[sk.key].gse === 'number')) return s;
  const init = {} as SkillStats;
  SKILLS.forEach((sk) => {
    init[sk.key] = { gse: 10, sessions: 0 };
  });
  store('va_skill_stats', init);
  return init;
}

/* bumpSkill(레벨 구간 환산 + 오르기만 하는 래칫)은 lib/cefrGrowth.ts의
 * 증거 기반 recordSkillResult로 대체됐다(2026-09 진단 참조). */

export const DAILY_GOAL = 20;

/** 사용자가 온보딩에서 고른 하루 목표(문장 수). 없으면 기본값. */
export function dailyGoal(): number {
  const v = load<number>('va_daily_goal', DAILY_GOAL);
  return typeof v === 'number' && v > 0 ? v : DAILY_GOAL;
}

// 날짜 키는 lib/dates.ts 단일 정의를 쓴다(리뷰 F1: UTC/로컬 분열 해소)
const todayKey = () => localToday();

/** 휴대폰 '뒤로' — 셸(page)이 기록 항목을 처리한 뒤 화면 안의 단계(재생 → 목록)에 알린다 */
export const BACK_EVENT = 'va:back';

/** 학습일이 기록됐음을 알린다 — 헤더 🔥 연속일이 화면 전환 없이 바로 갱신되게 */
export const PRACTICED_EVENT = 'va:practiced';

export function markPracticedToday() {
  const days = load<string[]>('va_days', []);
  const today = todayKey();
  if (!days.includes(today)) {
    days.push(today);
    // 날짜가 무한히 쌓이지 않게 최근 3년치만(연속일 계산에는 충분)
    store('va_days', days.slice(-1100));
  }
  const counts = load<Record<string, number>>('va_daycount', {});
  counts[today] = (counts[today] || 0) + 1;
  const ck = Object.keys(counts).sort();
  if (ck.length > 400) for (const k of ck.slice(0, ck.length - 400)) delete counts[k];
  store('va_daycount', counts);
  try {
    window.dispatchEvent(new Event(PRACTICED_EVENT));
  } catch {
    /* SSR */
  }
}

/* ── 발화 카운터(스픽 벤치마크) — '공부한 횟수'가 아니라 '소리 내어 말한 문장 수'를
 * 1급 지표로 센다. 미션 빌드업·드릴·쉐도잉·역할연습·회화 마이크 발화에서 집계. ── */
export function spokenToday(): number {
  const rv = load<{ date: string; count: number }>('va_spoken', { date: '', count: 0 });
  return rv.date === todayKey() ? rv.count : 0;
}

/**
 * 발화 한 문장 집계. M3: 가중치·종류를 선택 인자로 받는다(기존 호출 bumpSpoken()은 그대로 1.0·'scored').
 *  · kind 'scored' — 전사·채점이 된 발화(Whisper·브라우저 인식). 기본 1.0
 *  · kind 'self'   — 채점 없이 자기확인한 발화(키 없음 iOS·마이크 거부·입모양). 0.5,
 *                    단 키 없는 구간(groqKey 없음)은 1.0 — 그 구간엔 자기확인이 유일한 경로라 목표가 멀어지지 않게
 *  · weight를 직접 주면 그 값(조용히 모드 0.5 등)
 * va_spoken(오늘 합)·va_spoken_log(날짜별, 60일)는 가중 합, va_speak_goal의 scoredToday/selfToday는 종류별 가중 합.
 */
export function bumpSpoken(weight?: number, kind: 'scored' | 'self' = 'scored') {
  const today = todayKey();
  const keyless = !groqKey();
  const w = typeof weight === 'number' && Number.isFinite(weight) && weight >= 0 ? weight : kind === 'self' && !keyless ? 0.5 : 1;
  // 소수 누적 오차(0.1+0.2) 없이 0.5 단위가 정확히 쌓이게 반올림
  const add = (a: number) => Math.round((a + w) * 100) / 100;
  const rv = load<{ date: string; count: number }>('va_spoken', { date: today, count: 0 });
  store('va_spoken', { date: today, count: add(rv.date === today ? rv.count : 0) });
  // 주간 리포트를 위해 날짜별로도 남긴다(오늘 값만으로는 추세를 볼 수 없다).
  // 60일치만 유지해 용량이 무한히 늘지 않게 한다.
  const log = load<Record<string, number>>('va_spoken_log', {});
  log[today] = add(log[today] || 0);
  const keys = Object.keys(log).sort();
  if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete log[k];
  store('va_spoken_log', log);
  // 발화 목표(va_speak_goal) — '채점 가능'과 '자기확인'을 따로 센다. 목표값 계산(goal·streakDays)은 lib/habits.speakGoal의 몫
  const g = load<Record<string, unknown> | null>(SPEAK_GOAL_KEY, null);
  const cur = g && typeof g === 'object' && !Array.isArray(g) ? g : {};
  const same = cur.date === today;
  const num = (v: unknown) => (same && typeof v === 'number' && Number.isFinite(v) ? v : 0);
  store(SPEAK_GOAL_KEY, {
    kind: cur.kind === 'self' ? 'self' : 'scored',
    streakDays: typeof cur.streakDays === 'number' ? cur.streakDays : 0,
    ...cur,
    // 날이 바뀌었다 — 어제의 캡(낮춘 목표)·키 유무는 prev로만 남기고(speakGoal 정산이 그날 값으로 판정) 오늘은 새로
    // (base = 캡 전 목표 — 캡한 날에만 있다. 처음 세는 날은 기본 목표)
    ...(same ? null : { prev: { ...cur, prev: 0 }, goal: cur.base || cur.goal || SPEAK_GOAL_DEFAULT, capped: false, base: 0 }),
    keyless,
    // kl = 그날 한 번이라도 키가 없었나(지난 날 정산은 이 값으로 그날 목표 10/20을 정한다)
    kl: (same && cur.kl) || keyless,
    date: today,
    scoredToday: kind === 'scored' ? add(num(cur.scoredToday)) : num(cur.scoredToday),
    selfToday: kind === 'self' ? add(num(cur.selfToday)) : num(cur.selfToday),
  });
}

/** 최근 n일의 날짜별 발화 수(오래된 날짜 → 오늘 순). */
export function spokenHistory(days = 14): { date: string; count: number }[] {
  const log = load<Record<string, number>>('va_spoken_log', {});
  const out: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    out.push({ date: key, count: log[key] || 0 });
  }
  return out;
}

export function todayCount() {
  const counts = load<Record<string, number>>('va_daycount', {});
  return counts[todayKey()] || 0;
}

export function weeklyCounts() {
  const counts = load<Record<string, number>>('va_daycount', {});
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const out: { label: string; count: number; today: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    out.push({ label: days[d.getDay()], count: counts[key] || 0, today: i === 0 });
  }
  return out;
}

export function calcStreak() {
  const days = new Set(load<string[]>('va_days', []));
  let streak = 0;
  const d = new Date();
  if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/* ── 간격 반복(SM-2 근사) — 틀린 문장 자동 복습 ──
 * M1: 상자를 5→8로 늘렸다(35일 상한이면 석 달 뒤엔 모든 카드가 35일마다 돌아와 복습 큐가 넘친다).
 * 6:70·7:120·8:180일. '외웠다' 판정(isMastered)은 그대로 box≥5 — 화면·상한 규칙이 그 기준을 쓴다. */
export const SRS_INTERVAL_DAYS: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 7, 4: 16, 5: 35, 6: 70, 7: 120, 8: 180 };
export const SRS_MAX_BOX = 8;
/** 숙달 판정 기준 상자(이 이상이면 '외운 카드') */
export const SRS_MASTER_BOX = 5;
export const SRS_LEECH_THRESHOLD = 4;

export interface WeakItem {
  kr: string;
  en: string;
  lesson?: number | string;
  cat?: string;
  box: number;
  lapses: number;
  due: number;
}

export function srsDue(box: number) {
  return Date.now() + (SRS_INTERVAL_DAYS[Math.min(box, SRS_MAX_BOX)] || 0) * 86400000;
}

export function isLeech(w: WeakItem) {
  return (w.lapses || 0) >= SRS_LEECH_THRESHOLD;
}

export function isMastered(w: WeakItem) {
  return (w.box || 0) >= SRS_MASTER_BOX;
}

/** 복습 카드 전체 — 빈 칸(null)·영어 없는 항목은 걸러 낸다(손상값 하나로 화면이 깨지지 않게) */
export function weakItems(): WeakItem[] {
  return load<WeakItem[]>('va_weak', []).filter((w): w is WeakItem => !!w && typeof w === 'object' && typeof w.en === 'string');
}

export function dueWeak() {
  const now = Date.now();
  return weakItems().filter((w) => w.due == null || w.due <= now);
}

export function pendingWeakCount() {
  const now = Date.now();
  return weakItems().filter((w) => w.due != null && w.due > now).length;
}

export type FlashGrade = 'again' | 'hard' | 'good' | 'easy';

/** 4단계 자가채점(다시/어려움/알맞음/쉬움) → SRS 박스/복습일 갱신 (Anki 근사). */
export function gradeWeakItem(en: string, grade: FlashGrade) {
  const weak = weakItems();
  const w = weak.find((x) => x.en === en);
  if (!w) return;
  // 데일리 퀘스트(복습 N개 채점)용 — 오늘 채점한 카드 수를 기록한다.
  {
    const t = new Date();
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const rv = load<{ date: string; count: number }>('va_review_today', { date: today, count: 0 });
    store('va_review_today', { date: today, count: rv.date === today ? rv.count + 1 : 1 });
  }
  const box = w.box || 0;
  if (grade === 'again') {
    if (box > 0) w.lapses = (w.lapses || 0) + 1;
    w.box = 0;
    w.due = srsDue(0);
  } else if (grade === 'hard') {
    w.box = Math.max(1, box);
    w.due = srsDue(w.box);
  } else if (grade === 'good') {
    w.box = Math.min(box + 1, SRS_MAX_BOX);
    w.due = srsDue(w.box);
  } else if (grade === 'easy') {
    w.box = Math.min(box + 2, SRS_MAX_BOX);
    w.due = srsDue(w.box);
  }
  store('va_weak', weak);
}

export interface DrillItem {
  en: string;
  kr: string;
  /** 간격 반복 복습 항목에서 가져온 문장이면 true — 채점 시 SRS 박스를 갱신한다. */
  fromWeak: boolean;
}

/**
 * 홈 화면의 "⚡ 오늘의 훈련" 큐 — 오늘 복습할 간격 반복 문장(최대 5개, 박스가 낮은
 * 것 우선)을 앞에 넣고, 남는 자리를 현재 레슨 예문으로 채운다. 복습 문장은 이미
 * 같은 영어 문장이 레슨 예문에도 있으면 중복으로 넣지 않는다.
 */
export function buildTodayQueue(lessonExamples: { en: string; kr: string }[], max = 10): DrillItem[] {
  const due = [...dueWeak()].sort((a, b) => (a.box || 0) - (b.box || 0)).slice(0, Math.min(5, max));
  const dueEn = new Set(due.map((w) => w.en));
  const review: DrillItem[] = due.map((w) => ({ en: w.en, kr: w.kr, fromWeak: true }));
  const rest = lessonExamples
    .filter((it) => !dueEn.has(it.en))
    .slice(0, Math.max(0, max - review.length))
    .map((it) => ({ en: it.en, kr: it.kr, fromWeak: false }));
  return [...review, ...rest];
}

/* ── 외부 화면 → 드릴 핸드오프 ────────────────────────────────
 * 어휘·미팅 스크립트에서 익힌 표현을 표현장을 거치지 않고 곧바로 말하기 훈련으로
 * 넘긴다. 회화 탭의 상황 핸드오프(va_mission_talk)와 같은 1회성 소비 방식. */
const DRILL_QUEUE_KEY = 'va_drill_queue';

export interface DrillHandoff {
  /** 화면에 표시할 출처(예: "직무 어휘 — IT 영업 · 딜") */
  label: string;
  items: { en: string; kr: string }[];
}

export function setDrillQueue(h: DrillHandoff) {
  store(DRILL_QUEUE_KEY, h);
}

/** 큐를 꺼내고 비운다(한 번만 소비). 없으면 null. */
export function takeDrillQueue(): DrillHandoff | null {
  const v = load<DrillHandoff | null>(DRILL_QUEUE_KEY, null);
  if (v) store(DRILL_QUEUE_KEY, null);
  return v && v.items?.length ? v : null;
}

/** 약점 노트(va_weak)에 새 항목을 추가한다 — 이미 있으면 건너뛴다. */
/** 복습 카드 상한 — 넘치면 이미 외운(박스 최고) 카드부터, 그다음 오래된 카드부터 뺀다 */
export const WEAK_MAX = 800;

/**
 * dueDays: 첫 복습까지 며칠 — 드라마 표현은 1(내일). 배운 당일 바로 '떠올릴 표현'으로 잡히면
 * 풀 곳도 없이 오늘 퀘스트가 미완으로 남고, 새 카드가 매번 먼저 뽑혀 옛 카드가 밀렸다.
 */
export function addWeakItem(item: { en: string; kr?: string; lesson?: number | string; cat?: string }, dueDays = 0) {
  let weak = weakItems();
  if (weak.some((w) => w.en === item.en)) return weak;
  weak.push({ kr: item.kr || '', en: item.en, lesson: item.lesson, cat: item.cat, box: 0, lapses: 0, due: Date.now() + dueDays * 86400000 });
  if (weak.length > WEAK_MAX) {
    const over = weak.length - WEAK_MAX;
    const mastered = weak.filter((w) => isMastered(w)).slice(0, over);
    const drop = new Set<WeakItem>(mastered);
    for (const w of weak) {
      if (drop.size >= over) break;
      drop.add(w);
    }
    weak = weak.filter((w) => !drop.has(w));
  }
  store('va_weak', weak);
  return weak;
}

/* ── 레슨별 드릴 정확도 통계 ── */
export interface LessonStat {
  attempts: number;
  correct: number;
}

/* ── 숙제 완료 체크 ── */
export function getDoneHomework(): number[] {
  return load<number[]>('va_hw_done', []);
}

export function markHomeworkDone(lessonId: number) {
  const done = getDoneHomework();
  if (!done.includes(lessonId)) {
    done.push(lessonId);
    store('va_hw_done', done);
  }
  return done;
}

export function isHomeworkDone(lessonId: number) {
  return getDoneHomework().includes(lessonId);
}

export function recordDrillStat(lessonId: number, correct: boolean) {
  const stats = load<Record<number, LessonStat>>('va_stats', {});
  const s = stats[lessonId] || { attempts: 0, correct: 0 };
  s.attempts++;
  if (correct) s.correct++;
  stats[lessonId] = s;
  store('va_stats', stats);
}

export function getLessonStats() {
  return load<Record<number, LessonStat>>('va_stats', {});
}

/* ── Groq API 키 ── */
/** 서버에 GROQ_API_KEY가 설정된 경우 groqKey()가 돌려주는 자리표시자 — 실제 키 값이 아니다. */
export const SERVER_GROQ_SENTINEL = '__server__';

/**
 * 로컬에 저장된 키가 있으면 그걸 쓰고, 없으면 서버가 키를 갖고 있는지(Phase 3 No-key UX)
 * 빌드 시점에 구워진 NEXT_PUBLIC_GROQ_SERVER 플래그로 판단한다.
 * 기존 컴포넌트들의 `!groqKey()` 게이팅 로직을 그대로 재사용할 수 있도록
 * "키가 있다/없다"라는 동일한 boolean 의미를 유지한다.
 */
export function groqKey(): string {
  const local = load('va_groq_key', '').trim();
  if (local) return local;
  return process.env.NEXT_PUBLIC_GROQ_SERVER === '1' ? SERVER_GROQ_SENTINEL : '';
}

export function saveGroqKey(key: string) {
  store('va_groq_key', key.trim());
}

/** 서버(배포 환경변수)에 키가 있는지 — 빌드 시점에 구워진 플래그. */
export function hasServerGroqKey(): boolean {
  return process.env.NEXT_PUBLIC_GROQ_SERVER === '1';
}

/**
 * 기기에 저장된 키를 지운다. 서버 키가 있는 배포에서 기기의 옛 키가 만료되면
 * 그 키가 서버 키를 가리는(client 우선순위) 탓에 '유효하지 않다'는 오경보가 뜬다.
 * 이때 조용히 정리해 서버 키 경로로 되돌리는 자가 치유에 쓴다.
 */
export function clearGroqKey() {
  store('va_groq_key', '');
}

/* ── 표현장(저장한 문장) ── */
export interface SavedPhrase {
  en: string;
  kr: string;
  /** 출처 — 회차 레슨은 숫자 id, 그 외 화면은 'vocab:tech'처럼 문자열 태그.
   *  약점 노트(WeakItem.lesson)와 동일한 규칙으로 맞춘다. */
  lesson?: number | string;
}

export function getPhrases() {
  return load<SavedPhrase[]>('va_phrases', []);
}

/** 표현장 상한 — 무한정 쌓이면 용량을 먹고, 실제로 다시 보는 것은 최근 것들이다. */
const PHRASE_MAX = 500;

export function addPhrase(p: SavedPhrase) {
  const phrases = getPhrases();
  if (phrases.some((x) => x.en === p.en)) return phrases;
  phrases.push(p);
  const trimmed = phrases.slice(-PHRASE_MAX);
  store('va_phrases', trimmed);
  return trimmed;
}

export function removePhrase(en: string) {
  const phrases = getPhrases().filter((p) => p.en !== en);
  store('va_phrases', phrases);
  return phrases;
}

/* ── 배치고사 결과 ── */
export function isPlaced() {
  return !!load('va_placed', null);
}

/* ── 회화 챗 로그(비즈니스 회의록 학습용) ── */
export interface ChatLogEntry {
  id: string;
  date: string;
  lessonId: number;
  lessonTitle: string;
  transcript: { role: string; content: string }[];
}

const CHAT_LOG_MAX = 30;

export function getChatLogs(): ChatLogEntry[] {
  return load<ChatLogEntry[]>('va_chat_logs', []);
}

/** 진행 중인 대화 1세션을 id 기준으로 갱신 저장한다(매 턴마다 덮어써서 최신 상태 유지). */
export function saveChatLog(entry: ChatLogEntry) {
  const logs = getChatLogs();
  const idx = logs.findIndex((l) => l.id === entry.id);
  if (idx >= 0) logs[idx] = entry;
  else logs.push(entry);
  store('va_chat_logs', logs.slice(-CHAT_LOG_MAX));
}

/* ── 발음 진단 누적 ──
 * 한 번의 오답보다 **반복되는 축**이 중요하다. R/L을 이번 주에 여섯 번 놓쳤다는
 * 사실은 문장 하나의 점수보다 훨씬 실행 가능한 정보라, 축별 횟수를 날짜와 함께
 * 쌓아 주간 리포트가 읽게 한다. */
export interface PronLapse {
  key: string;
  date: string;
  count: number;
}

const PRON_MAX = 90;

export function getPronLapses(): PronLapse[] {
  return load<PronLapse[]>('va_pron', []);
}

/** 오늘 날짜에 축별로 1씩 누적. 같은 날 같은 축은 한 줄로 합친다. */
export function addPronLapses(keys: string[]) {
  if (!keys.length) return;
  const today = todayKey();
  const rows = getPronLapses();
  for (const key of keys) {
    const hit = rows.find((r) => r.key === key && r.date === today);
    if (hit) hit.count += 1;
    else rows.push({ key, date: today, count: 1 });
  }
  store('va_pron', rows.slice(-PRON_MAX));
}

/** 최근 n일 동안 자주 어긋난 축을 많은 순으로. */
export function topPronLapses(days = 7, max = 3): { key: string; count: number }[] {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const from = dateKey(since);
  const tally: Record<string, number> = {};
  for (const r of getPronLapses()) {
    if (r.date < from) continue;
    tally[r.key] = (tally[r.key] || 0) + (r.count || 0);
  }
  return Object.entries(tally)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
}

/* ── 말하기 속도(기본) ──
 * 지금까지 모든 영어 음성이 0.84배속으로 **항상** 느리게 재생되고 있었다.
 * "느리게 듣기"를 누르지 않아도 이미 느렸던 셈이라, 원어민 리듬을 들을 기회가
 * 아예 없었다. 기본을 1.0(자연 속도)으로 되돌리고, 취향에 따라 고르게 한다. */
export const SPEECH_RATES = [0.85, 1, 1.15, 1.3] as const;
export const DEFAULT_SPEECH_RATE = 1;

export function speechRate(): number {
  const v = load<number>('va_speech_rate', DEFAULT_SPEECH_RATE);
  return typeof v === 'number' && v >= 0.5 && v <= 2 ? v : DEFAULT_SPEECH_RATE;
}

export function setSpeechRate(r: number) {
  store('va_speech_rate', r);
  try {
    window.dispatchEvent(new CustomEvent(SLOW_RATE_EVENT, { detail: r }));
  } catch {
    /* SSR·구형 브라우저 */
  }
}

/* ── 느리게 듣기 속도 ──
 * 0.6배속으로 고정돼 있었는데, 적당한 속도는 사람마다 다르다 — 초급에겐 0.6도
 * 빠르고, 익숙해지면 0.6이 오히려 부자연스러워 원어민 리듬을 못 익힌다.
 * 한 번 고르면 앱 전체(레슨·드릴·발음 훈련·듣기)가 같은 값을 쓴다. */
export const SLOW_RATES = [0.5, 0.6, 0.75, 0.9] as const;
export const DEFAULT_SLOW_RATE = 0.6;

export function slowRate(): number {
  const v = load<number>('va_slow_rate', DEFAULT_SLOW_RATE);
  return typeof v === 'number' && v >= 0.4 && v <= 1 ? v : DEFAULT_SLOW_RATE;
}

export function setSlowRate(r: number) {
  store('va_slow_rate', r);
  try {
    window.dispatchEvent(new CustomEvent(SLOW_RATE_EVENT, { detail: r }));
  } catch {
    /* SSR·구형 브라우저 */
  }
}

/** 값이 바뀌면 화면들이 즉시 따라오도록 알린다(같은 탭 안에서는 storage 이벤트가 안 온다) */
export const SLOW_RATE_EVENT = 'va:slow-rate';

/* ── 발화 목표(경량 읽기, M1) ──
 * va_speak_goal은 M3(회상 말하기·하루 목표 적응)가 쓴다. 홈(lib/homeLite)은 habits를 import할 수
 * 없어(habits→homeLite 순환) 목표값만 여기서 읽는다. 쓰기는 M3의 몫 — 여기선 모양만 정한다:
 *   { goal: 1~35(정수), kind: 'scored'(채점 가능 발화만 셈) | 'self'(자기확인 포함) } */
export const SPEAK_GOAL_KEY = 'va_speak_goal';
export const SPEAK_GOAL_DEFAULT = 10;
export const SPEAK_GOAL_MAX = 35;

export interface SpeakGoalLite {
  goal: number;
  kind: 'scored' | 'self';
}

/** 저장값의 goal·kind만 읽는다(다른 필드는 무시). 없거나 어긋나면 기본 {goal:10, kind:'scored'}. */
export function speakGoalLite(): SpeakGoalLite {
  const v = load<Partial<SpeakGoalLite> | null>(SPEAK_GOAL_KEY, null);
  const goal = v && typeof v.goal === 'number' && Number.isFinite(v.goal) ? Math.min(SPEAK_GOAL_MAX, Math.max(1, Math.round(v.goal))) : SPEAK_GOAL_DEFAULT;
  const kind = v && v.kind === 'self' ? 'self' : 'scored';
  return { goal, kind };
}

export { CEFR_GSE, CEFR_ORDER, gseMid, gseToCefr, scaffoldFor };
