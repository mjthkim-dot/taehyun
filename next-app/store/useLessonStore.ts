'use client';

/**
 * 프롬프트 3 — 회화 연습 전역 상태 (Zustand)
 *
 * 가볍게 회화 화면의 상태를 관리한다:
 *  - currentSentence : 지금 연습 중인 목표 영어 문장
 *  - userSpeech      : 음성 인식(STT)으로 변환된 사용자 발화 텍스트
 *  - accuracyScore   : 목표 문장과 발화의 일치 정확도(0~100)
 *
 *   npm i zustand
 */
import { create } from 'zustand';

export interface LessonState {
  currentSentence: string;
  userSpeech: string;
  accuracyScore: number;
  isListening: boolean;

  // actions
  setCurrentSentence: (sentence: string) => void;
  setUserSpeech: (text: string) => void;
  setAccuracyScore: (score: number) => void;
  setListening: (v: boolean) => void;
  /** 발화 텍스트로 정확도를 계산해 함께 반영한다. */
  evaluateSpeech: (text: string) => void;
  reset: () => void;
}

/**
 * 목표 문장 대비 발화 정확도(0~100).
 * 단어 토큰 단위로 정규화(소문자·문장부호 제거) 후
 * 순서를 고려한 LCS(최장 공통 부분 수열) 비율로 측정한다.
 */
export function computeAccuracy(target: string, spoken: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

  const a = norm(target);
  const b = norm(spoken);
  if (!a.length || !b.length) return 0;

  // LCS 길이 (DP)
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const lcs = dp[a.length][b.length];
  // 목표 문장 기준 재현율과 발화 기준 정밀도의 조화평균(F1) → 100점 환산
  const recall = lcs / a.length;
  const precision = lcs / b.length;
  const f1 = (2 * recall * precision) / (recall + precision || 1);
  return Math.round(f1 * 100);
}

export const useLessonStore = create<LessonState>((set) => ({
  currentSentence: '',
  userSpeech: '',
  accuracyScore: 0,
  isListening: false,

  setCurrentSentence: (sentence) =>
    set({ currentSentence: sentence, userSpeech: '', accuracyScore: 0 }),
  setUserSpeech: (text) => set({ userSpeech: text }),
  setAccuracyScore: (score) => set({ accuracyScore: score }),
  setListening: (v) => set({ isListening: v }),

  evaluateSpeech: (text) =>
    set((state) => ({
      userSpeech: text,
      accuracyScore: computeAccuracy(state.currentSentence, text),
    })),

  reset: () => set({ userSpeech: '', accuracyScore: 0, isListening: false }),
}));
