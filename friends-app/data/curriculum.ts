import type { Episode, Expression, Scene } from '../lib/types';
import s01e01 from './episodes/s01e01';
import s01e07 from './episodes/s01e07';
import s02e07 from './episodes/s02e07';
import s02e14 from './episodes/s02e14';
import s03e02 from './episodes/s03e02';
import s03e16 from './episodes/s03e16';
import s04e12 from './episodes/s04e12';
import s05e14 from './episodes/s05e14';
import s05e16 from './episodes/s05e16';
import s06e25 from './episodes/s06e25';
import s10e18 from './episodes/s10e18';

/** 전체 커리큘럼 — 방영 순서대로. 새 에피소드는 여기에만 추가하면 앱 전체에 반영된다. */
export const EPISODES: Episode[] = [
  s01e01,
  s01e07,
  s02e07,
  s02e14,
  s03e02,
  s03e16,
  s04e12,
  s05e14,
  s05e16,
  s06e25,
  s10e18,
];

export interface ExpressionRef {
  expression: Expression;
  episode: Episode;
  scene: Scene;
}

/** 모든 표현을 (에피소드·장면 맥락과 함께) 평탄화 — 퀴즈/복습/검색의 공용 소스. */
export const ALL_EXPRESSIONS: ExpressionRef[] = EPISODES.flatMap((episode) =>
  episode.scenes.flatMap((scene) =>
    scene.expressions.map((expression) => ({ expression, episode, scene })),
  ),
);

const EXPRESSION_INDEX = new Map(ALL_EXPRESSIONS.map((r) => [r.expression.id, r]));

export function findExpression(id: string): ExpressionRef | undefined {
  return EXPRESSION_INDEX.get(id);
}

export function findEpisode(id: string): Episode | undefined {
  return EPISODES.find((e) => e.id === id);
}

/** 시즌 번호 → 해당 시즌 에피소드 목록 (목록 화면의 그룹핑용). */
export function episodesBySeason(): Map<number, Episode[]> {
  const map = new Map<number, Episode[]>();
  for (const ep of EPISODES) {
    const list = map.get(ep.season) ?? [];
    list.push(ep);
    map.set(ep.season, list);
  }
  return map;
}

/** 전체 장면 수 — 진도율 분모. */
export const TOTAL_SCENES = EPISODES.reduce((n, e) => n + e.scenes.length, 0);
export const TOTAL_EXPRESSIONS = ALL_EXPRESSIONS.length;

/**
 * 오늘의 표현 — 날짜를 시드로 결정론적으로 뽑는다(새로고침해도 하루 동안 동일).
 * Math.random()이 아니라 날짜 해시를 쓰는 이유: "오늘의" 표현은 하루 단위로
 * 고정되어야 학습 리듬이 생기기 때문.
 */
export function expressionOfTheDay(date: Date): ExpressionRef {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return ALL_EXPRESSIONS[hash % ALL_EXPRESSIONS.length];
}
