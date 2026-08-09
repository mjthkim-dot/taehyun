/**
 * 퀴즈 생성기 — 커리큘럼 데이터에서 문제를 만든다.
 *
 * 두 유형:
 *  ① meaning: 표현을 보여 주고 한국어 뜻 4지선다
 *  ② usage:  한국어 상황을 주고 알맞은 영어 표현 4지선다
 * 오답 보기는 다른 표현에서 뽑되, 같은 에피소드 것을 우선해 난이도를 높인다.
 */
import { ALL_EXPRESSIONS, type ExpressionRef } from '../data/curriculum';

export interface QuizQuestion {
  expressionId: string;
  type: 'meaning' | 'usage';
  /** 문제 지문. */
  prompt: string;
  /** 보기 4개 (이미 섞여 있음). */
  choices: string[];
  /** 정답 보기의 인덱스. */
  answerIndex: number;
  /** 해설 — 정답 후 표시. */
  explanation: string;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 오답 후보 — 같은 에피소드 표현을 먼저, 모자라면 전체에서 채운다. */
function pickDistractors(target: ExpressionRef, count: number, rand: () => number): ExpressionRef[] {
  const sameEpisode = ALL_EXPRESSIONS.filter(
    (r) => r.episode.id === target.episode.id && r.expression.id !== target.expression.id,
  );
  const others = ALL_EXPRESSIONS.filter(
    (r) => r.episode.id !== target.episode.id && r.expression.id !== target.expression.id,
  );
  const pool = [...shuffle(sameEpisode, rand), ...shuffle(others, rand)];
  // 뜻이 겹치는 보기가 나오지 않게 meaningKr 기준으로 중복 제거.
  const seen = new Set([target.expression.meaningKr]);
  const picked: ExpressionRef[] = [];
  for (const r of pool) {
    if (picked.length >= count) break;
    if (seen.has(r.expression.meaningKr)) continue;
    seen.add(r.expression.meaningKr);
    picked.push(r);
  }
  return picked;
}

function buildQuestion(ref: ExpressionRef, type: 'meaning' | 'usage', rand: () => number): QuizQuestion {
  const distractors = pickDistractors(ref, 3, rand);
  const explanation = `${ref.expression.phrase} — ${ref.expression.meaningKr} (${ref.episode.code} ${ref.scene.titleKr})`;

  if (type === 'meaning') {
    const options = shuffle([ref, ...distractors], rand);
    return {
      expressionId: ref.expression.id,
      type,
      prompt: ref.expression.phrase,
      choices: options.map((o) => o.expression.meaningKr),
      answerIndex: options.findIndex((o) => o.expression.id === ref.expression.id),
      explanation,
    };
  }

  const options = shuffle([ref, ...distractors], rand);
  return {
    expressionId: ref.expression.id,
    type,
    prompt: `"${ref.expression.exampleKr}" — 이 상황에서 쓰는 표현은?`,
    choices: options.map((o) => o.expression.phrase),
    answerIndex: options.findIndex((o) => o.expression.id === ref.expression.id),
    explanation,
  };
}

/**
 * 퀴즈 세트 생성. episodeId를 주면 그 회차 표현만, 없으면 전체에서 뽑는다.
 * seed로 셔플을 고정할 수 있다(테스트용). 기본은 호출 시각 기반.
 */
export function buildQuiz(options: {
  episodeId?: string;
  count?: number;
  seed?: number;
}): QuizQuestion[] {
  const { episodeId, count = 8, seed } = options;
  // xorshift32 — Math.random 대신 시드 고정이 가능한 간단한 PRNG.
  let s = (seed ?? Date.now()) >>> 0 || 1;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };

  const pool = episodeId
    ? ALL_EXPRESSIONS.filter((r) => r.episode.id === episodeId)
    : ALL_EXPRESSIONS;
  const picked = shuffle(pool, rand).slice(0, Math.min(count, pool.length));
  return picked.map((ref, i) => buildQuestion(ref, i % 2 === 0 ? 'meaning' : 'usage', rand));
}
