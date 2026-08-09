/**
 * 학습 진도 저장소 — localStorage 단일 키에 스냅샷을 통째로 저장한다.
 *
 * 서버가 없는 앱이므로 이 파일이 곧 "백엔드"다. 구조 변경 시 v를 올리고
 * migrate에서 이전 스냅샷을 변환한다. 모든 화면은 useProgress 훅으로
 * 같은 스토어를 구독하므로 화면 간 진도가 즉시 동기화된다.
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'friends-english.progress.v1';

/** Leitner 3-box: 박스가 오를수록 복습 간격이 길어진다(일 단위). */
const BOX_INTERVAL_DAYS: Record<number, number> = { 1: 1, 2: 3, 3: 7 };

export interface SrsEntry {
  box: 1 | 2 | 3;
  /** 다음 복습 예정일 'YYYY-MM-DD'. */
  due: string;
}

export interface ProgressState {
  v: 1;
  /** 완료한 장면 id → 완료 날짜. */
  completedScenes: Record<string, string>;
  /** 표현별 복습 상태 — 장면 완료/퀴즈 응시 시점에 등록된다. */
  srs: Record<string, SrsEntry>;
  /** 퀴즈 누적 성적. */
  quiz: Record<string, { right: number; wrong: number }>;
  /** 북마크한 표현 id. */
  saved: string[];
  /** 학습한 날짜 집합 'YYYY-MM-DD' — 스트릭 계산의 원천. */
  studyDays: string[];
}

const EMPTY: ProgressState = {
  v: 1,
  completedScenes: {},
  srs: {},
  quiz: {},
  saved: [],
  studyDays: [],
};

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function load(): ProgressState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as ProgressState;
    if (parsed?.v !== 1) return EMPTY;
    // 누락 필드 방어 — 과거 스냅샷이 부분적으로만 있어도 앱이 죽지 않게.
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

/** 모듈 레벨 미니 스토어 — 모든 화면이 같은 상태를 구독한다. */
let state: ProgressState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated() {
  if (!hydrated && typeof window !== 'undefined') {
    state = load();
    hydrated = true;
  }
}

function persist(next: ProgressState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장 공간 초과 등 — 진도 저장 실패가 학습 자체를 막으면 안 된다.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ProgressState {
  ensureHydrated();
  return state;
}

function getServerSnapshot(): ProgressState {
  return EMPTY;
}

/** 진도 스냅샷 구독 훅 — 어떤 화면에서 진도를 바꿔도 모두 다시 그려진다. */
export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 오늘을 학습일로 기록 — 학습 활동이 있는 모든 mutator가 내부에서 부른다. */
function withStudyToday(s: ProgressState): ProgressState {
  const today = todayKey();
  if (s.studyDays.includes(today)) return s;
  return { ...s, studyDays: [...s.studyDays, today] };
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

/** 장면 완료 + 그 장면의 표현들을 SRS에 등록(내일부터 복습). */
export function completeScene(sceneId: string, expressionIds: string[]): void {
  ensureHydrated();
  if (state.completedScenes[sceneId]) return;
  const today = todayKey();
  const srs = { ...state.srs };
  for (const id of expressionIds) {
    if (!srs[id]) srs[id] = { box: 1, due: addDays(today, 1) };
  }
  persist(
    withStudyToday({
      ...state,
      completedScenes: { ...state.completedScenes, [sceneId]: today },
      srs,
    }),
  );
}

/** 퀴즈 1문항 결과 반영 — 성적 누적 + SRS 등록/이동. */
export function recordQuizAnswer(expressionId: string, correct: boolean): void {
  ensureHydrated();
  const prev = state.quiz[expressionId] ?? { right: 0, wrong: 0 };
  const quiz = {
    ...state.quiz,
    [expressionId]: {
      right: prev.right + (correct ? 1 : 0),
      wrong: prev.wrong + (correct ? 0 : 1),
    },
  };
  persist(withStudyToday({ ...state, quiz, srs: moveSrs(state.srs, expressionId, correct) }));
}

/** 플래시카드 복습 결과 반영. */
export function recordReview(expressionId: string, remembered: boolean): void {
  ensureHydrated();
  persist(withStudyToday({ ...state, srs: moveSrs(state.srs, expressionId, remembered) }));
}

/** Leitner 이동 — 맞으면 다음 박스(간격↑), 틀리면 박스 1로 리셋. */
function moveSrs(
  srs: Record<string, SrsEntry>,
  id: string,
  correct: boolean,
): Record<string, SrsEntry> {
  const today = todayKey();
  const cur = srs[id] ?? { box: 1 as const, due: today };
  const box = correct ? ((Math.min(cur.box + 1, 3) as 1 | 2 | 3)) : 1;
  return { ...srs, [id]: { box, due: addDays(today, BOX_INTERVAL_DAYS[box]) } };
}

export function toggleSaved(expressionId: string): void {
  ensureHydrated();
  const saved = state.saved.includes(expressionId)
    ? state.saved.filter((id) => id !== expressionId)
    : [...state.saved, expressionId];
  persist({ ...state, saved });
}

/** 전체 진도 초기화 (설정 화면에서 확인 후 호출). */
export function resetProgress(): void {
  ensureHydrated();
  persist(EMPTY);
}

/** 연속 학습일 — 오늘(또는 어제)부터 거꾸로 이어진 날 수. */
export function calcStreak(studyDays: string[]): number {
  if (studyDays.length === 0) return 0;
  const days = new Set(studyDays);
  // 오늘 아직 학습 전이면 어제부터 세기 시작한다(스트릭이 0으로 보이지 않게).
  let cursor = todayKey();
  if (!days.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** 오늘 복습할 표현 id 목록 (due가 오늘 이전인 것). */
export function dueExpressionIds(s: ProgressState): string[] {
  const today = todayKey();
  return Object.entries(s.srs)
    .filter(([, e]) => e.due <= today)
    .map(([id]) => id);
}
