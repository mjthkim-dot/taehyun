'use client';

/**
 * 커리어 영어 — 사용자가 고른 관심 주제(커리어·자기소개)의 콘텐츠 팩.
 * 자기소개·이직 인터뷰·네트워킹 3트랙 × 3편. 인터뷰 답변의 사례(STAR)는
 * 실제 커리어 데이터(씨피랩스 $253K 약정 전환, 월 $430K 계정 FinOps 운영,
 * 서북 이탈 면담과 윈백)에서 왔다 — 지어낸 자기소개가 아니라 내 이야기.
 *
 * 구조는 실전 코스(lib/realCourse.ts)와 동일한 계약: 열람 시 진행 표시 +
 * 그 시나리오의 수확 표현만 SRS(cat '실전')로(문서 단위 멱등, 같은 통로).
 */
import pack from '../data/careerPack.json';
import type { CourseScenario, CourseTrack } from './realCourse';
import { load, store } from './state';
import { importExpressions } from './minutes';

const SEEN_KEY = 'va_career_seen';

export function getCareerTracks(): CourseTrack[] {
  return (pack as unknown as { tracks: CourseTrack[] }).tracks;
}

export function totalCareerScenarios(): number {
  return getCareerTracks().reduce((n, t) => n + t.scenarios.length, 0);
}

export function seenCareer(): string[] {
  return load<string[]>(SEEN_KEY, []);
}

/** 열람 처리 — 진행 표시 + 표현 SRS 등록(멱등). 반환은 새로 등록된 표현 수. */
export function openCareerScenario(s: CourseScenario): number {
  const seen = seenCareer();
  if (!seen.includes(s.id)) store(SEEN_KEY, [...seen, s.id]);
  return importExpressions({ noteId: `career-${s.id}`, title: s.title, expressions: s.expressions });
}
