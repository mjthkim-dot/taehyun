/**
 * 커리큘럼 데이터 모델 — "회차(에피소드) → 장면(상황) → 표현/대화" 3단 구조.
 *
 * 저작권 원칙: 원작 대본을 그대로 싣지 않는다. 장면 설명(contextKr)은 우리말
 * 요약이고, 연습 대화(dialogue)는 그 상황에서 해당 표현을 쓰는 법을 보여주는
 * 오리지널 창작 대화다. 원작에서 유래한 것은 짧은 관용 표현(phrase) 자체와
 * 등장인물 이름뿐이다.
 */

/** 6인방 + 게스트(점원·행인 등 단역). */
export type CharacterId =
  | 'Ross'
  | 'Rachel'
  | 'Monica'
  | 'Chandler'
  | 'Joey'
  | 'Phoebe'
  | 'Guest';

export interface Expression {
  /** 전역 유일 — `s01e01-1` 형식. SRS/퀴즈/진도가 이 id로 저장된다. */
  id: string;
  /** 학습할 실생활 표현 (영어). */
  phrase: string;
  /** 한 줄 뜻. */
  meaningKr: string;
  /** 뉘앙스·언제 쓰는지·원작에서 어떻게 쓰였는지 해설. */
  nuanceKr: string;
  /** 오리지널 예문 (대화문과 별개로 한 문장 더). */
  exampleEn: string;
  exampleKr: string;
  /** 난이도 1(기초)~3(원어민 감각). */
  level: 1 | 2 | 3;
}

export interface DialogueLine {
  speaker: CharacterId;
  /** 게스트 표시 이름(점원, 질 등). speaker가 Guest일 때만 사용. */
  speakerLabel?: string;
  en: string;
  kr: string;
  /** 이 라인이 연습시키는 핵심 표현의 id (강조 표시 + 롤플레이 채점 가중치). */
  expressionId?: string;
}

export interface Scene {
  /** `s01e01-1` 형식 (에피소드 id + 장면 번호). */
  id: string;
  /** 상황 제목 — "웨딩드레스 차림의 불청객" 같은 한 줄. */
  titleKr: string;
  /** 장소 — Central Perk, Monica's Apartment 등. */
  location: string;
  /** 원작 장면 소개 + 이 상황에서 무엇을 배우는지 브리핑. */
  contextKr: string;
  expressions: Expression[];
  /** 오리지널 연습 대화 (6~8라인). 롤플레이 모드의 대본이 된다. */
  dialogue: DialogueLine[];
}

export interface Episode {
  /** `s01e01` 형식. */
  id: string;
  /** 표시용 코드 — `S01E01`. */
  code: string;
  season: number;
  titleEn: string;
  titleKr: string;
  /** 회차 줄거리 요약(스포일러 최소화, 학습 맥락 위주). */
  synopsisKr: string;
  /** 상황 테마 태그 — "첫 만남 · 위로 · 새 출발". */
  theme: string;
  scenes: Scene[];
}
