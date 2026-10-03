/**
 * 기능어 리듬 — 영어가 '한 단어씩 또박또박'이 아니라 강세 박자로 흐르는 이유를 수치로.
 *
 * 한국어는 음절 하나하나가 비슷한 길이로 나오는 언어라, 영어를 말할 때도 the·to·a·of
 * 같은 기능어를 내용어만큼 길게 끈다. 원어민은 반대다 — 내용어(명사·동사·형용사)는
 * 길고 또렷하게, 기능어는 짧고 약하게 흘려서 둘 사이에 1.3배 이상의 길이 차가 난다.
 * 그 차이가 없으면 단어가 다 맞아도 '외국인 억양'으로 들린다.
 *
 * Whisper가 돌려주는 단어 타임스탬프(M0)로 내용어 평균 길이 ÷ 기능어 평균 길이를
 * 재서, 1.3에 못 미치면 칩 한 줄로 알린다. 타임스탬프가 없으면 아무 말도 하지 않는다
 * (추정으로 틀린 조언을 하는 것보다 조용한 편이 낫다). 화면 배선은 하지 않는다 —
 * 역할극 결과(RoleStep chipSlot)가 이 함수를 부른다.
 */
import { words as tokenize } from './pronunciation';

/** 약하게 발음되는 기능어 — 관사·전치사·조동사·대명사·접속사(~40개). */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  // 관사
  'a', 'an', 'the',
  // 전치사
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'about', 'into', 'as',
  // 조동사·be·have
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'have', 'has', 'had',
  'can', 'could', 'will', 'would', 'should', 'shall', 'may', 'might', 'must',
  // 대명사
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'our', 'their', 'its', 'that', 'this',
  // 접속사
  'and', 'or', 'but', 'so', 'if', 'than', 'because',
]);

export interface StressWord {
  w: string;
  /** 내용어(강세를 받는 단어)인가 */
  content: boolean;
}

/** 문장을 단어별로 내용어/기능어로 나눈다. 축약형(I'm·don't)은 앞부분으로 판단한다. */
export function stressProfile(en: string): StressWord[] {
  return tokenize(en).map((w) => ({ w, content: !isFunctionWord(w) }));
}

export function isFunctionWord(w: string): boolean {
  const base = (w || '').toLowerCase().replace(/[^a-z']/g, '').split("'")[0];
  return FUNCTION_WORDS.has(base);
}

export interface TimedWord {
  word: string;
  /** 초 또는 ms — 단위는 섞이지만 않으면 된다(비율만 쓴다) */
  start: number;
  end: number;
}

export const RHYTHM_TARGET = 1.3;

/** 세 가지 칩 문구 — 비율 구간별 하나. */
export const RHYTHM_CHIPS = {
  /** 기능어가 내용어만큼 길다(비율 < 1.0) */
  lighten: '기능어를 더 가볍게 — the·to·a는 짧게',
  /** 차이는 있지만 약하다(1.0 ≤ 비율 < 1.3) */
  stress: '내용어를 더 길게 — 뜻이 실린 단어를 눌러 주세요',
  /** 원어민 범위(비율 ≥ 1.3) */
  good: '리듬 좋아요 — 기능어가 가볍게 흘렀어요',
} as const;

export type RhythmChipText = (typeof RHYTHM_CHIPS)[keyof typeof RHYTHM_CHIPS];

export interface RhythmChip {
  /** 내용어 평균 길이 ÷ 기능어 평균 길이 */
  ratio: number;
  chip: RhythmChipText;
  /** 원어민 범위(≥1.3)면 true — 호출부는 false일 때만 칩을 띄우면 된다 */
  ok: boolean;
}

/**
 * 단어 타임스탬프로 리듬 비율을 계산한다.
 * - words가 없거나, 내용어·기능어 중 한쪽이라도 길이를 잴 수 없으면 null(조언 안 함).
 * - targetEn이 있고 단어 수가 같으면 목표 문장의 품사 구분을 쓴다(Whisper가 기능어를
 *   잘못 들어도 자리로 판단) — 아니면 들린 단어 자체로 판단한다.
 */
export function rhythmChip(words: TimedWord[] | null | undefined, targetEn?: string): RhythmChip | null {
  if (!words || !words.length) return null;
  const target = targetEn ? stressProfile(targetEn) : [];
  const useTarget = target.length > 0 && target.length === words.length;

  const content: number[] = [];
  const fn: number[] = [];
  words.forEach((w, i) => {
    const dur = Number(w.end) - Number(w.start);
    if (!Number.isFinite(dur) || dur <= 0) return;
    const isContent = useTarget ? target[i].content : !isFunctionWord(w.word);
    (isContent ? content : fn).push(dur);
  });
  if (!content.length || !fn.length) return null;

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const ratio = avg(content) / avg(fn);
  if (!Number.isFinite(ratio)) return null;
  const rounded = Math.round(ratio * 100) / 100;
  if (rounded < 1) return { ratio: rounded, chip: RHYTHM_CHIPS.lighten, ok: false };
  if (rounded < RHYTHM_TARGET) return { ratio: rounded, chip: RHYTHM_CHIPS.stress, ok: false };
  return { ratio: rounded, chip: RHYTHM_CHIPS.good, ok: true };
}
