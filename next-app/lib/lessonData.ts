'use client';

/**
 * 레슨 데이터 비동기 로더 — lessons.json(371KB 원본, 번들 ~199KB)을 화면
 * 청크에서 떼어내는 계층 (기술 부채 상환의 핵심).
 *
 * 규칙:
 *  - 어떤 컴포넌트도 lib/lessons를 **정적 import하지 않는다**(타입은 `import
 *    type`으로만 — 컴파일 시 지워진다). 데이터가 필요한 화면은 page.tsx의
 *    <LessonsGate> 아래에서 렌더되고, 그 안에서는 lessonsNow()가 동기로 안전하다.
 *  - 게이트 밖(이벤트 핸들러 등)에서는 await loadLessons()를 쓴다.
 *  - 홈 마운트 후 유휴 시간에 프리로드되므로, 실사용에서 게이트가 보이는 일은
 *    첫 방문 직후 몇 초뿐이다.
 */
import { useEffect, useState } from 'react';
import type { Lesson } from './lessons';

export interface LessonData {
  LESSONS: Lesson[];
  MASTER_LESSONS: Lesson[];
  SCENARIO_LIBRARY: Lesson[];
  ALL_LESSONS: Lesson[];
}

let data: LessonData | null = null;
let promise: Promise<LessonData> | null = null;
const subs = new Set<() => void>();

/** 데이터 로드(멱등) — webpack이 lessons.ts+json을 별도 비동기 청크로 쪼갠다. */
export function loadLessons(): Promise<LessonData> {
  if (data) return Promise.resolve(data);
  promise ??= import('./lessons').then((m) => {
    data = {
      LESSONS: m.LESSONS,
      MASTER_LESSONS: m.MASTER_LESSONS,
      SCENARIO_LIBRARY: m.SCENARIO_LIBRARY,
      ALL_LESSONS: m.ALL_LESSONS,
    };
    subs.forEach((f) => f());
    return data;
  });
  return promise;
}

/**
 * 동기 접근 — LessonsGate 아래(데이터 보장 구간)에서만 호출한다.
 * 게이트 밖에서 부르면 조용히 빈 화면이 되는 대신 즉시 던져서 개발 중에 잡는다.
 */
export function lessonsNow(): LessonData {
  if (!data) throw new Error('lessons not loaded — <LessonsGate> 아래에서만 lessonsNow()를 호출해야 합니다');
  return data;
}

/** 로드 여부와 함께 데이터를 주는 훅 — 게이트 컴포넌트가 쓴다. */
export function useLessons(): LessonData | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (data) return;
    const cb = () => force((n) => n + 1);
    subs.add(cb);
    void loadLessons();
    return () => {
      subs.delete(cb);
    };
  }, []);
  return data;
}
