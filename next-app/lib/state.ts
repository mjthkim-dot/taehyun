/**
 * voice-assistant/index.html 의 localStorage 기반 진도 상태 포팅.
 * 동일한 va_* 키를 사용해 기존 vanilla 앱과 데이터를 공유한다.
 */
import { CEFR_GSE, CEFR_ORDER, gseMid, gseToCefr, scaffoldFor, type Cefr } from './lessons';

/** 저장 실패(용량 초과)를 앱에 알리는 신호 — 조용히 데이터를 잃지 않기 위해. */
export const STORAGE_FULL_EVENT = 'va:storage-full';

/** 용량이 부족할 때 먼저 버려도 되는 것들(오래된 기록 순). 학습 진도는 건드리지 않는다. */
const EVICTABLE = ['va_chat_logs', 'va_ask_history', 'va_sessions', 'va_spoken_log', 'va_depth_cache'];

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
  if (s) return s;
  const init = {} as SkillStats;
  SKILLS.forEach((sk) => {
    init[sk.key] = { gse: 10, sessions: 0 };
  });
  store('va_skill_stats', init);
  return init;
}

export function bumpSkill(skill: SkillKey, sessionGse: number) {
  const stats = getSkillStats();
  const cur = stats[skill] || { gse: 10, sessions: 0 };
  const alpha = 0.3;
  cur.gse = Math.round(cur.gse * (1 - alpha) + sessionGse * alpha);
  cur.sessions += 1;
  stats[skill] = cur;
  store('va_skill_stats', stats);

  const prof = getProfile();
  const avg = Math.round(SKILLS.reduce((a, sk) => a + (stats[sk.key]?.gse || 10), 0) / SKILLS.length);
  if (avg > prof.gse) {
    prof.gse = avg;
    prof.cefr = gseToCefr(avg);
    prof.scaffolding = scaffoldFor(prof.cefr);
    saveProfile(prof);
  }
  return cur;
}

export const DAILY_GOAL = 20;

/** 사용자가 온보딩에서 고른 하루 목표(문장 수). 없으면 기본값. */
export function dailyGoal(): number {
  const v = load<number>('va_daily_goal', DAILY_GOAL);
  return typeof v === 'number' && v > 0 ? v : DAILY_GOAL;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function markPracticedToday() {
  const days = load<string[]>('va_days', []);
  const today = todayKey();
  if (!days.includes(today)) {
    days.push(today);
    store('va_days', days);
  }
  const counts = load<Record<string, number>>('va_daycount', {});
  counts[today] = (counts[today] || 0) + 1;
  store('va_daycount', counts);
}

/* ── 발화 카운터(스픽 벤치마크) — '공부한 횟수'가 아니라 '소리 내어 말한 문장 수'를
 * 1급 지표로 센다. 미션 빌드업·드릴·쉐도잉·역할연습·회화 마이크 발화에서 집계. ── */
export function spokenToday(): number {
  const rv = load<{ date: string; count: number }>('va_spoken', { date: '', count: 0 });
  return rv.date === todayKey() ? rv.count : 0;
}

export function bumpSpoken() {
  const today = todayKey();
  const rv = load<{ date: string; count: number }>('va_spoken', { date: today, count: 0 });
  store('va_spoken', { date: today, count: rv.date === today ? rv.count + 1 : 1 });
  // 주간 리포트를 위해 날짜별로도 남긴다(오늘 값만으로는 추세를 볼 수 없다).
  // 60일치만 유지해 용량이 무한히 늘지 않게 한다.
  const log = load<Record<string, number>>('va_spoken_log', {});
  log[today] = (log[today] || 0) + 1;
  const keys = Object.keys(log).sort();
  if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete log[k];
  store('va_spoken_log', log);
}

/** 최근 n일의 날짜별 발화 수(오래된 날짜 → 오늘 순). */
export function spokenHistory(days = 14): { date: string; count: number }[] {
  const log = load<Record<string, number>>('va_spoken_log', {});
  const out: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    const key = d.toISOString().slice(0, 10);
    out.push({ label: days[d.getDay()], count: counts[key] || 0, today: i === 0 });
  }
  return out;
}

export function calcStreak() {
  const days = new Set(load<string[]>('va_days', []));
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/* ── 간격 반복(SM-2 근사) — 틀린 문장 자동 복습 ── */
export const SRS_INTERVAL_DAYS: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 };
export const SRS_MAX_BOX = 5;
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
  return (w.box || 0) >= SRS_MAX_BOX;
}

export function dueWeak() {
  const now = Date.now();
  return load<WeakItem[]>('va_weak', []).filter((w) => w.due == null || w.due <= now);
}

export function pendingWeakCount() {
  const now = Date.now();
  return load<WeakItem[]>('va_weak', []).filter((w) => w.due != null && w.due > now).length;
}

export type FlashGrade = 'again' | 'hard' | 'good' | 'easy';

/** 4단계 자가채점(다시/어려움/알맞음/쉬움) → SRS 박스/복습일 갱신 (Anki 근사). */
export function gradeWeakItem(en: string, grade: FlashGrade) {
  const weak = load<WeakItem[]>('va_weak', []);
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
export function addWeakItem(item: { en: string; kr?: string; lesson?: number | string; cat?: string }) {
  const weak = load<WeakItem[]>('va_weak', []);
  if (weak.some((w) => w.en === item.en)) return weak;
  weak.push({ kr: item.kr || '', en: item.en, lesson: item.lesson, cat: item.cat, box: 0, lapses: 0, due: srsDue(0) });
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
  const today = new Date().toISOString().slice(0, 10);
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
  const from = since.toISOString().slice(0, 10);
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

export { CEFR_GSE, CEFR_ORDER, gseMid, gseToCefr, scaffoldFor };
