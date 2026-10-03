/**
 * 퀴즈 생성기 — 커리큘럼 데이터에서 문제를 만든다.
 *
 * 네 유형:
 *  ① meaning:   표현을 보여 주고 한국어 뜻 4지선다
 *  ② usage:     한국어 상황을 주고 알맞은 영어 표현 4지선다
 *  ③ listening: 문장을 소리로만 듣고 뜻 고르기 (audioText를 TTS로 재생)
 *  ④ cloze:     예문에서 표현 부분을 가린 빈칸 채우기
 * 오답 보기는 다른 표현에서 뽑되, 같은 에피소드 것을 우선해 난이도를 높인다.
 */
import { ALL_EXPRESSIONS, type ExpressionRef } from '../data/curriculum';

export type QuizType = 'meaning' | 'usage' | 'listening' | 'cloze';

export interface QuizQuestion {
  expressionId: string;
  type: QuizType;
  /** 문제 지문. */
  prompt: string;
  /** listening 유형: TTS로 재생할 문장 (지문에는 노출하지 않는다). */
  audioText?: string;
  /** 보기 4개 (이미 섞여 있음). */
  choices: string[];
  /** 정답 보기의 인덱스. */
  answerIndex: number;
  /** 해설 — 정답 후 표시. */
  explanation: string;
}

/** 예문 속 표현을 ____로 가린다. 정확히 포함되지 않으면 null(다른 유형으로 폴백). */
function makeCloze(ref: ExpressionRef): string | null {
  const { phrase, exampleEn } = ref.expression;
  // 문장부호 차이를 흡수하기 위해 끝의 부호를 뗀 소문자 기준으로 위치를 찾는다.
  const core = phrase.replace(/[.!?]+$/, '');
  const idx = exampleEn.toLowerCase().indexOf(core.toLowerCase());
  if (idx < 0) return null;
  return `${exampleEn.slice(0, idx)}______${exampleEn.slice(idx + core.length)}`;
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

function buildQuestion(ref: ExpressionRef, type: QuizType, rand: () => number): QuizQuestion {
  const distractors = pickDistractors(ref, 3, rand);
  const explanation = `${ref.expression.phrase} — ${ref.expression.meaningKr} (${ref.episode.code} ${ref.scene.titleKr})`;
  const options = shuffle([ref, ...distractors], rand);
  const answerIndex = options.findIndex((o) => o.expression.id === ref.expression.id);
  const base = { expressionId: ref.expression.id, answerIndex, explanation };

  if (type === 'listening') {
    return {
      ...base,
      type,
      prompt: '문장을 듣고 알맞은 뜻을 고르세요.',
      audioText: ref.expression.phrase,
      choices: options.map((o) => o.expression.meaningKr),
    };
  }

  if (type === 'cloze') {
    const cloze = makeCloze(ref);
    if (cloze) {
      return {
        ...base,
        type,
        prompt: `빈칸에 들어갈 표현은?\n${cloze}\n(${ref.expression.exampleKr})`,
        choices: options.map((o) => o.expression.phrase),
      };
    }
    // 예문에 표현이 그대로 없으면 usage로 폴백.
    type = 'usage';
  }

  if (type === 'meaning') {
    return {
      ...base,
      type,
      prompt: ref.expression.phrase,
      choices: options.map((o) => o.expression.meaningKr),
    };
  }

  return {
    ...base,
    type: 'usage',
    prompt: `"${ref.expression.exampleKr}" — 이 상황에서 쓰는 표현은?`,
    choices: options.map((o) => o.expression.phrase),
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
  // 4유형을 순환시켜 한 세트 안에서 읽기·듣기·빈칸이 골고루 섞이게 한다.
  const cycle: QuizType[] = ['meaning', 'usage', 'listening', 'cloze'];
  return picked.map((ref, i) => buildQuestion(ref, cycle[i % cycle.length], rand));
}
