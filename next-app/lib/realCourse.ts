'use client';

/**
 * 실전 코스 — 지난 90일 Gmail 발신 245개 스레드를 분석해 만든 상황별 커리큘럼.
 *
 * 만든 방법(2026-08-15 실사):
 *  ① 발신 스레드 245개를 상대·주제별로 클러스터링(여기어때 33·부스터스 32·
 *     포시에스 20·센트비 19·파스토 19·씨피랩스 17 / 계약 34·미팅 20·SP 16·빌링 15)
 *  ② 클러스터별 대표 스레드를 정독해 실제 쟁점·숫자·어조를 확보
 *  ③ 6개 트랙 × 3개 시나리오 = 18편의 롤플레이 대화 + 수확 표현 72개로 재구성
 *
 * 각 시나리오의 grounding 필드가 근거 스레드를 밝힌다 — 교재가 아니라
 * "지난 분기의 내 업무"가 커리큘럼이다.
 *
 * 데이터는 코스 화면 청크에만 실린다(홈 번들 영향 없음). 수확 표현은
 * 시나리오를 열 때 SRS(cat '실전')로 들어간다 — 한꺼번에 쏟아부어 복습 큐를
 * 오염시키지 않고, 연습한 것부터 쌓인다(문서 단위 멱등, lib/minutes.ts와 같은 통로).
 */
import course from '../data/realCourse.json';
import type { Dialogue } from './lessons';
import { load, store } from './state';
import { importExpressions } from './minutes';

export interface CourseScenario {
  id: string;
  title: string;
  situation: string;
  /** 이 대화의 근거가 된 실제 스레드 */
  grounding: string;
  dialogue: Dialogue;
  expressions: { en: string; kr: string }[];
}

export interface CourseTrack {
  id: string;
  icon: string;
  title: string;
  /** 왜 이 트랙인가 — 메일 데이터 근거 */
  why: string;
  scenarios: CourseScenario[];
}

export interface CourseMeta {
  generatedAt: string;
  periodDays: number;
  sentThreads: number;
  method: string;
  topCustomers: { name: string; threads: number }[];
}

const SEEN_KEY = 'va_course_seen';

export function getCourseMeta(): CourseMeta {
  return (course as { meta: CourseMeta }).meta;
}

export function getCourseTracks(): CourseTrack[] {
  return (course as unknown as { tracks: CourseTrack[] }).tracks;
}

export function totalScenarios(): number {
  return getCourseTracks().reduce((n, t) => n + t.scenarios.length, 0);
}

/** 연습을 시작한(열어본) 시나리오 id들 — 진행률의 근거 */
export function seenScenarios(): string[] {
  return load<string[]>(SEEN_KEY, []);
}

/**
 * 시나리오 열람 처리 — 진행 표시 + 그 시나리오의 수확 표현을 SRS로.
 * 둘 다 멱등이라 재방문에 안전하다. 반환값은 이번에 새로 등록된 표현 수.
 */
export function openScenario(s: CourseScenario): number {
  const seen = seenScenarios();
  if (!seen.includes(s.id)) store(SEEN_KEY, [...seen, s.id]);
  return importExpressions({ noteId: `course-${s.id}`, title: s.title, expressions: s.expressions });
}
