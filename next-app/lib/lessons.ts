/**
 * 레슨 커리큘럼 데이터 + 헬퍼 — voice-assistant/index.html 의
 * LESSONS / MASTER_LESSONS / SCENARIO_LIBRARY 와 관련 헬퍼 함수를 그대로 포팅한다.
 * 원본 콘텐츠는 data/lessons.json 에 1:1로 추출되어 있다(수동 재입력 없음).
 */
import raw from '../data/lessons.json';
import type { Cefr } from './cefr';

export interface LessonPoint {
  en: string;
  kr: string;
  note?: string;
}

export interface LessonSection {
  title: string;
  intro?: string;
  points: LessonPoint[];
}

export interface LessonExample {
  en: string;
  kr: string;
}

export interface FreeTalkTopic {
  topic: string;
  kr: string;
  en: string;
  tip?: string;
}

export interface FreeTalk {
  intro?: string;
  topics: FreeTalkTopic[];
}

export interface Scenario {
  title: string;
  desc: string;
}

export interface DialogueLine {
  sp: string;
  en: string;
  kr: string;
}

export interface Dialogue {
  title: string;
  lines: DialogueLine[];
}

/** 회차 레슨(LESSONS) · 마스터 유닛(MASTER_LESSONS) · 시나리오 라이브러리(SCENARIO_LIBRARY) 공통 형태 */
export interface Lesson {
  id: number;
  title?: string;
  date?: string;
  sections?: LessonSection[];
  examples?: LessonExample[];
  homework?: string;
  freeTalk?: FreeTalk;
  scenario?: Scenario;
  /** 마스터 유닛(CEFR 레벨, 예: 'A1') */
  master?: string;
  /** 선행 학습(예고) 회차 여부 */
  preview?: boolean;
  /** 시나리오 라이브러리 항목 여부 */
  library?: boolean;
  category?: string;
  dialogue?: Dialogue;
}

interface LessonsData {
  LESSONS: Lesson[];
  MASTER_LESSONS: Lesson[];
  SCENARIO_LIBRARY: Lesson[];
}

const data = raw as unknown as LessonsData;

export const LESSONS: Lesson[] = data.LESSONS;
export const MASTER_LESSONS: Lesson[] = data.MASTER_LESSONS;
export const SCENARIO_LIBRARY: Lesson[] = data.SCENARIO_LIBRARY;
export const ALL_LESSONS: Lesson[] = LESSONS.concat(MASTER_LESSONS).concat(SCENARIO_LIBRARY);

/* CEFR·GSE 표와 순수 헬퍼(cefrOf·lessonLabel 포함)는 lib/cefr.ts에 있다 —
 * 이 파일은 371KB짜리 lessons.json을 정적 import하므로, 헬퍼 하나를 쓰려던
 * 소비처가 데이터 전체를 끌고 오면 안 된다(탭 전환이 느렸던 가장 큰 이유).
 * ⚠ 이 모듈을 정적 import하지 말 것 — lib/lessonData.ts의 loadLessons()/
 * useLessons()/lessonsNow()를 통해 비동기로 쓴다. 기존 경로 호환을 위한
 * 재수출만 남긴다. */
export {
  CEFR_GSE,
  CEFR_ORDER,
  CEFR_NEXT,
  SCAFFOLD_BY_CEFR,
  gseMid,
  gseToCefr,
  scaffoldFor,
  cefrOf,
  lessonLabel,
  type Cefr,
} from './cefr';

/** 최신 정규 회차(선행/예고 제외) — 기존 앱의 초기 선택 로직과 동일 */
export function latestRegularLesson(): Lesson | undefined {
  return LESSONS.filter((l) => !l.preview).slice(-1)[0];
}
