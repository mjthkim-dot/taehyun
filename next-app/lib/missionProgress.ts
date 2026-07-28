'use client';

/**
 * 미션 완주 루프 진행 상태 — "보면 끝"을 "해야 끝"으로 바꾸는 심장.
 * 표현마다 3단계(듣기 → 말하기 → 리콜)를 기록하고, 일정 개수의 표현을
 * 완주해야 "오늘 미션 완료"가 활성화된다. 날짜+미션 단위로 저장돼
 * 자정이 지나면 자연히 리셋된다.
 */
import { load, store } from './state';

export type Stage = 'listen' | 'speak' | 'recall';

/** 완료 버튼이 열리는 최소 완주 표현 수. */
export const REQUIRED_MASTERED = 3;
/** 말하기 단계 통과 점수. */
export const SPEAK_PASS_SCORE = 60;

interface ProgressData {
  date: string;
  missionKey: string;
  /** phrase en → 완료한 단계들 */
  phrases: Record<string, Partial<Record<Stage, boolean>>>;
}

const KEY = 'va_mission_progress';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadRaw(missionKey: string): ProgressData {
  const v = load<ProgressData | null>(KEY, null);
  if (!v || v.date !== todayStr() || v.missionKey !== missionKey) {
    return { date: todayStr(), missionKey, phrases: {} };
  }
  return v;
}

export function getProgress(missionKey: string): Record<string, Partial<Record<Stage, boolean>>> {
  return loadRaw(missionKey).phrases;
}

export function markStage(missionKey: string, phraseEn: string, stage: Stage) {
  const data = loadRaw(missionKey);
  data.phrases[phraseEn] = { ...data.phrases[phraseEn], [stage]: true };
  store(KEY, data);
  return data.phrases;
}

export function isMastered(p: Partial<Record<Stage, boolean>> | undefined): boolean {
  return !!(p?.listen && p?.speak && p?.recall);
}

/** 완주한 표현 수. */
export function masteredCount(missionKey: string, phraseEns: string[]): number {
  const prog = getProgress(missionKey);
  return phraseEns.filter((en) => isMastered(prog[en])).length;
}
