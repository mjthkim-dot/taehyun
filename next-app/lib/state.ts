/**
 * voice-assistant/index.html 의 localStorage 기반 진도 상태 포팅.
 * 동일한 va_* 키를 사용해 기존 vanilla 앱과 데이터를 공유한다.
 */
import { CEFR_GSE, CEFR_ORDER, gseMid, gseToCefr, scaffoldFor, type Cefr } from './lessons';

export function store(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* 저장 공간 부족 — 조용히 무시 (vanilla 앱과 동일하게 toast는 UI 레이어에서 처리) */
  }
}

export function load<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? def : (JSON.parse(raw) ?? def);
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

/* ── 표현장(저장한 문장) ── */
export interface SavedPhrase {
  en: string;
  kr: string;
  lesson?: number;
}

export function getPhrases() {
  return load<SavedPhrase[]>('va_phrases', []);
}

export function addPhrase(p: SavedPhrase) {
  const phrases = getPhrases();
  if (phrases.some((x) => x.en === p.en)) return phrases;
  phrases.push(p);
  store('va_phrases', phrases);
  return phrases;
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

export { CEFR_GSE, CEFR_ORDER, gseMid, gseToCefr, scaffoldFor };
