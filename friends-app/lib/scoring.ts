/**
 * 발화 채점 — 목표 문장과 인식된 문장을 단어 단위로 비교한다.
 *
 * 정확도보다 "학습에 도움이 되는 피드백"이 목적이라, 대소문자·문장부호·
 * 축약형 차이는 관대하게 정규화하고, 어떤 단어를 놓쳤는지를 돌려준다.
 */

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "that's": 'that is',
  "what's": 'what is',
  "there's": 'there is',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'can not',
  "couldn't": 'could not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "haven't": 'have not',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "i'll": 'i will',
  "you'll": 'you will',
  "we'll": 'we will',
  "i'd": 'i would',
  "you'd": 'you would',
  "let's": 'let us',
  gonna: 'going to',
  wanna: 'want to',
  gotta: 'got to',
  kinda: 'kind of',
};

/** 소문자화 → 부호 제거 → 축약형 풀기 → 공백 정리 후 토큰 배열로. */
export function normalizeWords(text: string): string[] {
  let t = text.toLowerCase().replace(/[’‘]/g, "'");
  for (const [short, full] of Object.entries(CONTRACTIONS)) {
    t = t.replace(new RegExp(`\\b${short.replace("'", "\\'")}\\b`, 'g'), full);
  }
  return t
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/'/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

export interface ScoreResult {
  /** 0~100. 목표 단어 중 맞춘 비율. */
  score: number;
  /** 목표 문장의 단어별 적중 여부 (UI 하이라이트용, 원문 순서 유지). */
  hits: { word: string; matched: boolean }[];
  /** 놓친 단어들 (중복 제거). */
  missed: string[];
}

/**
 * 멀티셋 매칭 — 순서는 보지 않고 "목표 단어를 몇 개나 소리 냈는가"를 센다.
 * 순서까지 따지면 STT의 사소한 어순 오인식에 점수가 크게 출렁여서,
 * 초급 학습자에게는 이 방식이 체감상 더 공정하다.
 */
export function scoreAttempt(target: string, attempt: string): ScoreResult {
  const targetWords = normalizeWords(target);
  const attemptPool = new Map<string, number>();
  for (const w of normalizeWords(attempt)) {
    attemptPool.set(w, (attemptPool.get(w) ?? 0) + 1);
  }

  const hits = targetWords.map((word) => {
    const left = attemptPool.get(word) ?? 0;
    if (left > 0) {
      attemptPool.set(word, left - 1);
      return { word, matched: true };
    }
    return { word, matched: false };
  });

  const matchedCount = hits.filter((h) => h.matched).length;
  const score = targetWords.length === 0 ? 0 : Math.round((matchedCount / targetWords.length) * 100);
  const missed = [...new Set(hits.filter((h) => !h.matched).map((h) => h.word))];
  return { score, hits, missed };
}

/** 점수대별 한 줄 코멘트 — 채점 UI가 함께 보여 준다. */
export function scoreComment(score: number): string {
  if (score >= 90) return '완벽해요! 프렌즈에 출연해도 되겠는데요? ☕';
  if (score >= 70) return '좋아요! 몇 단어만 더 또렷하게 발음해 보세요.';
  if (score >= 40) return '괜찮아요. 놓친 단어를 확인하고 한 번 더!';
  return '천천히 다시 들어 보고 따라 해 보세요. 할 수 있어요!';
}
