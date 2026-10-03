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
import { logAttempt } from '../lib/reviewEngine';
import { alignedScore } from '../lib/align';

/** 시도 로그에 함께 남길 메타 — 측정 가능한 호출부(Whisper 경로)만 채운다 */
export interface AttemptMeta {
  latencyMs?: number;
  durationMs?: number;
  src?: string;
  patternKey?: string;
}

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
  /** 연속 통과(80점 이상) 수 — 스픽식 콤보. 실패하면 0으로, 문장이 바뀌어도 유지된다. */
  combo: number;
  attempts: number;
  isListening: boolean;

  // actions
  setCurrentSentence: (sentence: string) => void;
  setUserSpeech: (text: string) => void;
  setAccuracyScore: (score: number) => void;
  setListening: (v: boolean) => void;
  /** 발화 텍스트로 정확도를 계산해 함께 반영한다. meta는 학습 이력 로그에 남는다. */
  evaluateSpeech: (text: string, meta?: AttemptMeta) => void;
  /** 같은 문장을 다시 시도할 때 — 시도 횟수는 유지하고 결과만 지운다. */
  clearAttempt: () => void;
  reset: () => void;
}

/**
 * 목표 문장 대비 발화 정확도(0~100)와 단어별 일치 여부.
 * 계산은 lib/align.ts(alignedScore)에 있다 — 원고·스토어를 끌고 오지 않는 순수 모듈이라
 * 단어 탭·드라마도 같은 함수를 쓴다. 여기는 기존 호출부를 위한 얇은 래퍼(같은 결과·타입).
 */
export function computeAccuracy(
  target: string,
  spoken: string
): { score: number; diff: WordDiff[]; missed: string[] } {
  return alignedScore(target, spoken);
}

export const useLessonStore = create<LessonState>((set) => ({
  currentSentence: '',
  userSpeech: '',
  accuracyScore: 0,
  wordDiff: [],
  missedWords: [],
  pronIssues: [],
  combo: 0,
  attempts: 0,
  isListening: false,

  setCurrentSentence: (sentence) =>
    set({ currentSentence: sentence, userSpeech: '', accuracyScore: 0, wordDiff: [], missedWords: [], pronIssues: [], attempts: 0 }),
  setUserSpeech: (text) => set({ userSpeech: text }),
  setAccuracyScore: (score) => set({ accuracyScore: score }),
  setListening: (v) => set({ isListening: v }),

  evaluateSpeech: (text, meta) =>
    set((state) => {
      bumpSpoken(); // 발화 1문장 집계(스픽식 지표)
      const { score, diff, missed } = computeAccuracy(state.currentSentence, text);
      // 학습 이력 — 모든 말하기 채점이 문장 단위로 남는다(추이·자동화 분석의 원천).
      logAttempt({ t: Date.now(), en: state.currentSentence, score, ...meta });
      // 완벽하게 맞힌 발화는 진단할 것이 없다 — 틀린 자리가 있을 때만 해석한다.
      const pronIssues = missed.length ? diagnose(state.currentSentence, text) : [];
      // 반복되는 축을 주간 리포트가 읽을 수 있게 누적한다(한 번의 오답보다 경향이 중요).
      if (pronIssues.length) addPronLapses(pronIssues.map((p) => p.key));
      // 콤보: 80점 이상이면 잇고, 아니면 끊는다. 문장이 바뀌어도(setCurrentSentence)
      // 유지된다 — 드릴 세션 전체에 걸친 "연속 통과"가 콤보의 의미다.
      const combo = score >= 80 ? state.combo + 1 : 0;
      return { userSpeech: text, accuracyScore: score, wordDiff: diff, missedWords: missed, pronIssues, combo, attempts: state.attempts + 1 };
    }),

  clearAttempt: () => set({ userSpeech: '', accuracyScore: 0, wordDiff: [], missedWords: [], pronIssues: [] }),

  reset: () => set({ userSpeech: '', accuracyScore: 0, wordDiff: [], missedWords: [], pronIssues: [], attempts: 0, isListening: false }),
}));
