/**
 * 비즈니스 영어 레슨 빌더 — 학습자의 실제 상황(회의록 / 이메일)을 바탕으로
 * "원어민은 이렇게 쓴다"를 가르치는 레슨을 생성한다. 실무 문서 전문(영어) + 용도별
 * 원어민 표현 + 핵심 표현으로 구성되며, 클라이언트에서 전체 내용을 음성으로 낭독한다.
 */

export type ScenarioType = 'meeting' | 'email';

export interface BizExpression {
  purpose_ko: string;
  en: string;
  kr: string;
  tip_ko?: string;
}

export interface BusinessLesson {
  situation_ko: string;
  native_doc: string;
  native_doc_ko: string;
  expressions: BizExpression[];
  key_phrases: { en: string; kr: string }[];
}

export function buildBusinessLessonPrompt(scenario: ScenarioType, situation: string) {
  const kind = scenario === 'meeting' ? '비즈니스 미팅 회의록(meeting minutes)' : '비즈니스 이메일(business email)';
  const docHint =
    scenario === 'meeting'
      ? '제목 · 일시/참석자 · 안건(Agenda) · 논의 내용 · 결정사항(Decisions) · 후속 조치(Action items) 구조로 작성'
      : '제목줄(Subject) · 인사(Greeting) · 본문(용건/배경/요청) · 맺음말(Closing) · 서명 구조로 작성';

  return `당신은 한국인 직장인을 가르치는 비즈니스 영어 코치입니다. 학습자의 상황을 바탕으로 "원어민은 이런 상황에서 이렇게 표현한다"를 가르치는 레슨을 만들어주세요.

시나리오 유형: ${kind}
학습자 상황:
"""
${situation}
"""

오직 JSON만 (마크다운·코드펜스·여는 말 없이) 아래 정확한 형식으로 응답하세요:
{
  "situation_ko": "상황 한 줄 요약(한국어)",
  "native_doc": "이 상황을 원어민이 실제로 작성한 ${kind} 전문. ${docHint}. 실무에서 바로 복사해 쓸 수 있을 만큼 자연스럽고 완성도 높은 영어로. 줄바꿈(\\n)으로 구조를 나눌 것.",
  "native_doc_ko": "위 native_doc의 한국어 번역(같은 줄 구조 유지)",
  "expressions": [
    {"purpose_ko":"이 표현의 용도(예: 회의 시작/안건 제시/의견 요청/동의·반대/마무리, 이메일이면 용건 제시/정중한 요청/일정 조율/사과/맺음말 등)", "en":"원어민이 실제로 쓰는 표현 한 문장", "kr":"한국어 뜻", "tip_ko":"언제·왜 쓰는지 한 줄 팁"}
  ],
  "key_phrases": [{"en":"꼭 외울 핵심 표현/관용구", "kr":"뜻"}]
}

규칙:
- native_doc은 반드시 완성된 실무 문서 형태(머리말~맺음)로, 학습자 상황에 구체적으로 맞출 것.
- expressions는 6~10개, 문서/대화 흐름 순서대로 배치.
- key_phrases는 4~6개.
- 모든 영어는 격식 있는 실무 환경에서 원어민이 실제 쓰는 자연스러운 표현으로. 직역체·교과서체 금지.
- 상황 설명이 한국어든 영어든, 결과의 영어 표현은 원어민 비즈니스 영어로 작성.`;
}
