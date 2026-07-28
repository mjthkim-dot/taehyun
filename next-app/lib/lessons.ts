/**
 * 레슨 커리큘럼 데이터 + 헬퍼 — voice-assistant/index.html 의
 * LESSONS / MASTER_LESSONS / SCENARIO_LIBRARY 와 관련 헬퍼 함수를 그대로 포팅한다.
 * 원본 콘텐츠는 data/lessons.json 에 1:1로 추출되어 있다(수동 재입력 없음).
 */
import raw from '../data/lessons.json';

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

/** 레슨 목록/탭에 쓰이는 짧은 라벨 (원본 lessonLabel 포팅) */
export function lessonLabel(l: Lesson): string {
  if (l.library) return `📚 ${l.category || '시나리오'}`;
  if (l.master) return `🗺 ${l.master}`;
  if (l.preview) return `🔮 선행 ${l.id - 100}`;
  return `${l.id}회차`;
}

export const CEFR_GSE: Record<string, { min: number; max: number }> = {
  A1: { min: 10, max: 22 },
  A2: { min: 22, max: 36 },
  B1: { min: 36, max: 52 },
  B2: { min: 52, max: 64 },
  C1: { min: 64, max: 76 },
  C2: { min: 76, max: 90 },
};

export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Cefr = (typeof CEFR_ORDER)[number];

export const CEFR_NEXT: Record<Cefr, Cefr> = {
  A1: 'A2', A2: 'B1', B1: 'B2', B2: 'C1', C1: 'C2', C2: 'C2',
};

export const SCAFFOLD_BY_CEFR: Record<Cefr, number> = {
  A1: 1.0, A2: 1.0, B1: 0.65, B2: 0.4, C1: 0.2, C2: 0.08,
};

/** 레슨의 CEFR 추정: 마스터 유닛은 master 레벨, 그 외(개인 수업 회차/선행)는 A2 */
export function cefrOf(lesson: Lesson | null | undefined): Cefr {
  return ((lesson && (lesson.master as Cefr)) || 'A2');
}

/** CEFR → GSE 중앙값 */
export function gseMid(cefr: Cefr): number {
  const g = CEFR_GSE[cefr] || CEFR_GSE.A2;
  return Math.round((g.min + g.max) / 2);
}

export function gseToCefr(gse: number): Cefr {
  for (const c of CEFR_ORDER) if (gse <= CEFR_GSE[c].max) return c;
  return 'C2';
}

export function scaffoldFor(cefr: Cefr): number {
  return SCAFFOLD_BY_CEFR[cefr] ?? 1.0;
}

/** 최신 정규 회차(선행/예고 제외) — 기존 앱의 초기 선택 로직과 동일 */
export function latestRegularLesson(): Lesson | undefined {
  return LESSONS.filter((l) => !l.preview).slice(-1)[0];
}
