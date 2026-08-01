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
import { addPronLapses, bumpSpoken } from '../lib/state';
import { diagnose, type PronIssue } from '../lib/pronunciation';

export interface WordDiff {
  w: string;
  ok: boolean;
}

export interface LessonState {
  currentSentence: string;
  userSpeech: string;
  accuracyScore: number;
  wordDiff: WordDiff[];
  missedWords: string[];
  /** 왜 틀렸는지 — 잘못 들린 단어를 한국어 화자의 전형적 발음 축으로 해석한 결과 */
  pronIssues: PronIssue[];
  attempts: number;
  isListening: boolean;

  // actions
  setCurrentSentence: (sentence: string) => void;
  setUserSpeech: (text: string) => void;
  setAccuracyScore: (score: number) => void;
  setListening: (v: boolean) => void;
  /** 발화 텍스트로 정확도를 계산해 함께 반영한다. */
  evaluateSpeech: (text: string) => void;
  /** 같은 문장을 다시 시도할 때 — 시도 횟수는 유지하고 결과만 지운다. */
  clearAttempt: () => void;
  reset: () => void;
}

function normWords(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * 목표 문장 대비 발화 정확도(0~100)와 단어별 일치 여부.
 * 순서를 고려한 LCS(최장 공통 부분 수열)로 측정 — 빠뜨린/잘못 발음한 단어를
 * 목표 문장 순서 그대로 색깔로 보여줄 수 있도록 단어별 매칭 정보도 함께 반환한다.
 */
export function computeAccuracy(
  target: string,
  spoken: string
): { score: number; diff: WordDiff[]; missed: string[] } {
  const a = normWords(target);
  const b = normWords(spoken);
  if (!a.length || !b.length) {
    return { score: 0, diff: a.map((w) => ({ w, ok: false })), missed: a };
  }

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

  // dp 테이블을 거슬러 올라가며 어느 목표 단어가 발화에서 실제로 매칭됐는지 표시
  const matched = new Array(a.length).fill(false);
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matched[i - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const lcs = dp[a.length][b.length];
  const recall = lcs / a.length;
  const precision = lcs / b.length;
  const f1 = (2 * recall * precision) / (recall + precision || 1);
  const diff = a.map((w, idx) => ({ w, ok: matched[idx] }));
  const missed = a.filter((_, idx) => !matched[idx]);
  return { score: Math.round(f1 * 100), diff, missed };
}

export const useLessonStore = create<LessonState>((set) => ({
  currentSentence: '',
  userSpeech: '',
  accuracyScore: 0,
  wordDiff: [],
  missedWords: [],
  pronIssues: [],
  attempts: 0,
  isListening: false,

  setCurrentSentence: (sentence) =>
    set({ currentSentence: sentence, userSpeech: '', accuracyScore: 0, wordDiff: [], missedWords: [], pronIssues: [], attempts: 0 }),
  setUserSpeech: (text) => set({ userSpeech: text }),
  setAccuracyScore: (score) => set({ accuracyScore: score }),
  setListening: (v) => set({ isListening: v }),

  evaluateSpeech: (text) =>
    set((state) => {
      bumpSpoken(); // 발화 1문장 집계(스픽식 지표)
      const { score, diff, missed } = computeAccuracy(state.currentSentence, text);
      // 완벽하게 맞힌 발화는 진단할 것이 없다 — 틀린 자리가 있을 때만 해석한다.
      const pronIssues = missed.length ? diagnose(state.currentSentence, text) : [];
      // 반복되는 축을 주간 리포트가 읽을 수 있게 누적한다(한 번의 오답보다 경향이 중요).
      if (pronIssues.length) addPronLapses(pronIssues.map((p) => p.key));
      return { userSpeech: text, accuracyScore: score, wordDiff: diff, missedWords: missed, pronIssues, attempts: state.attempts + 1 };
    }),

  clearAttempt: () => set({ userSpeech: '', accuracyScore: 0, wordDiff: [], missedWords: [], pronIssues: [] }),

  reset: () => set({ userSpeech: '', accuracyScore: 0, wordDiff: [], missedWords: [], pronIssues: [], attempts: 0, isListening: false }),
}));
