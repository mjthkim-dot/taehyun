'use client';

/**
 * 패턴 스토리 비동기 로더 — lessonData와 같은 패턴의 두 번째 적용.
 * 스토리 40편(수백 문장의 정적 콘텐츠)이 세션 CTA를 통해 홈 번들에 정적으로
 * 끌려 들어가던 회귀(+21KB)를 끊는다.
 *
 * 규칙: 스토리가 필요한 화면(세션·리콜 러시·오디오 모드)은 page.tsx의
 * <StoriesGate> 아래에서 렌더되고, 그 안에서는 storiesNow()가 동기로 안전하다.
 * 게이트 밖(홈 CTA의 useEffect 등)에서는 await loadStories().
 */
import { useEffect, useState } from 'react';
import type { PatternStory } from './patternStories';

export type StoryMap = Record<string, PatternStory>;

let data: StoryMap | null = null;
let promise: Promise<StoryMap> | null = null;
const subs = new Set<() => void>();

export function loadStories(): Promise<StoryMap> {
  if (data) return Promise.resolve(data);
  promise ??= import('./patternStories').then((m) => {
    data = m.PATTERN_STORIES;
    subs.forEach((f) => f());
    return data;
  });
  return promise;
}

export function storiesNow(): StoryMap {
  if (!data) throw new Error('stories not loaded — <StoriesGate> 아래에서만 storiesNow()를 호출해야 합니다');
  return data;
}

export function useStories(): StoryMap | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (data) return;
    const cb = () => force((n) => n + 1);
    subs.add(cb);
    void loadStories();
    return () => {
      subs.delete(cb);
    };
  }, []);
  return data;
}
