/**
 * 마스터 커리큘럼(CEFR A1→C2 로드맵) — voice-assistant/index.html 의
 * MASTER_CURRICULUM 을 1:1 추출한 data/curriculum.json 의 타입/헬퍼.
 */
import raw from '../data/curriculum.json';

export interface CurriculumUnit {
  id?: string;
  lessonId: number;
  title: string;
  sub: string;
}

export interface CurriculumLevel {
  level: string;
  name: string;
  cefr: string;
  status: 'done' | 'current' | 'future';
  goal: string;
  units: CurriculumUnit[];
}

export const MASTER_CURRICULUM: CurriculumLevel[] = raw as CurriculumLevel[];
