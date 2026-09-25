/**
 * 단어 학습 기록의 가벼운 읽기 창구 — 단어 뱅크(50KB)를 끌어오지 않고도
 * 홈·프로그램이 "오늘 단어를 얼마나 했나"를 알 수 있게 분리했다.
 */
import { load } from './state';
import { todayKey } from './dates';

export const WORD_PROGRESS_KEY = 'va_words';
export const WORD_LOG_KEY = 'va_words_log';

export interface WordDayLog {
  /** 오늘 처음 만난 단어 */
  new: number;
  /** 오늘 채점한 복습 */
  rev: number;
  /** 맞힌 수 */
  ok: number;
}

export function wordLog(): Record<string, WordDayLog> {
  return load<Record<string, WordDayLog>>(WORD_LOG_KEY, {});
}

export function wordsToday(): WordDayLog {
  return wordLog()[todayKey()] || { new: 0, rev: 0, ok: 0 };
}

/** 오늘 채점한 단어 수(신규+복습) — 프로그램 워밍업 블록의 관찰 신호 */
export function wordsGradedToday(): number {
  const t = wordsToday();
  return t.new + t.rev;
}
