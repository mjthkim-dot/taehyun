/**
 * 비즈니스 영어 레슨 빌더 (2단계 생성) — 품질을 위해 한 번에 다 시키지 않고 나눈다.
 *  1단계(buildNativeDocPrompt): 원어민 작가가 자연스러운 실무 문서(회의록/이메일)를 섹션 구조로 작성.
 *  2단계(buildLessonExtractPrompt): 그 문서에서 학습용 표현·핵심 표현을 추출.
 * 직역체·교과서체를 배제하고 원어민이 실제 쓰는 연어/관용구로만 쓰도록 강하게 지시한다.
 */

export type ScenarioType = 'meeting' | 'email';

export interface DocLine {
  en: string;
  ko: string;
}

export interface DocSection {
  heading_en?: string;
  heading_ko?: string;
  lines: DocLine[];
}

export interface NativeDoc {
  title_en: string;
  title_ko: string;
  sections: DocSection[];
}

export interface BizExpression {
  purpose_ko: string;
  en: string;
  kr: string;
  tip_ko?: string;
}

export interface BusinessLesson {
  situation_ko: string;
  doc: NativeDoc;
  expressions: BizExpression[];
  key_phrases: { en: string; kr: string }[];
}

function kindLabel(scenario: ScenarioType) {
  return scenario === 'meeting' ? '비즈니스 미팅 회의록(meeting minutes)' : '비즈니스 이메일(business email)';
}

/** 1단계 — 원어민 수준의 실무 문서를 섹션 구조(제목+줄별 en/ko)로 작성. */
export function buildNativeDocPrompt(scenario: ScenarioType, situation: string) {
  const kind = kindLabel(scenario);
  const structure =
    scenario === 'meeting'
      ? `섹션을 회의록 표준 구조로 나누세요: Attendees & Date / Agenda / Discussion / Decisions / Action Items. 각 줄은 한 항목 또는 한 문장.`
      : `섹션을 이메일 흐름으로 나누세요: (1) 인사·도입 (2) 본문 — 용건/배경/요청 (3) 맺음말·서명. 첫 줄은 제목줄(Subject)을 별도 섹션으로. heading은 이메일에선 비워도 됩니다.`;

  return `You are a native English-speaking business communication expert and professional editor. 당신은 영어가 모국어인 비즈니스 커뮤니케이션 전문가이자 전문 에디터입니다.

학습자가 준 상황을 바탕으로, 실제 영미권 직장에서 원어민이 작성한 것과 구별되지 않을 만큼 자연스러운 ${kind} 한 편을 작성하세요.

학습자 상황:
"""
${situation}
"""

작성 원칙(엄격히 준수):
- 한국어를 그대로 옮긴 듯한 직역체·교과서체를 절대 쓰지 마세요. 원어민이 실제로 쓰는 자연스러운 연어(collocation), 관용 표현, 비즈니스 디스코스 마커를 사용하세요.
- 비즈니스 레지스터에 맞게 간결·명확·정중하게. 장황하거나 과하게 격식적이지 않게.
- ${structure}
- 각 줄(line)은 완결된 의미 단위(한 문장 또는 목록 한 항목)여야 합니다. 한 줄에 여러 문장을 욱여넣지 마세요.
- 작성 후 스스로 한 줄씩 검토해, 원어민이 어색하다고 느낄 표현은 전부 자연스럽게 고친 최종본만 출력하세요.
- ko 필드는 각 영어 줄의 자연스러운 한국어 번역입니다(직역 아님).

오직 JSON만 (마크다운·코드펜스·설명 없이):
{
  "title_en": "문서 제목(영문). 회의록이면 회의명, 이메일이면 제목줄(Subject) 내용",
  "title_ko": "제목 한국어",
  "sections": [
    {
      "heading_en": "섹션 제목(영문). 이메일 본문 등 제목이 불필요하면 빈 문자열",
      "heading_ko": "섹션 제목 한국어(없으면 빈 문자열)",
      "lines": [ { "en": "영어 한 줄", "ko": "한국어 번역" } ]
    }
  ]
}`;
}

/** 2단계 — 작성된 문서를 바탕으로 학습용 표현/핵심 표현을 추출. */
export function buildLessonExtractPrompt(scenario: ScenarioType, docText: string) {
  const kind = kindLabel(scenario);
  return `당신은 한국인 직장인을 가르치는 비즈니스 영어 코치입니다. 아래는 원어민이 작성한 ${kind} 전문입니다. 이 문서를 바탕으로 학습자가 바로 익혀 쓸 수 있는 표현을 정리하세요.

문서:
"""
${docText}
"""

오직 JSON만:
{
  "situation_ko": "이 문서가 다루는 상황 한 줄 요약(한국어)",
  "expressions": [
    {"purpose_ko":"용도(예: 안건 제시/의견 요청/정중한 요청/일정 조율/사과/맺음말 등)", "en":"문서에서 실제 쓰인 원어민 표현 한 문장", "kr":"한국어 뜻", "tip_ko":"언제·왜 쓰는지 한 줄 팁"}
  ],
  "key_phrases": [{"en":"꼭 외울 핵심 표현/연어", "kr":"뜻"}]
}

규칙:
- expressions는 6~9개, 문서 흐름 순서대로. 반드시 위 문서에 실제로 등장한 표현에 근거할 것(지어내지 말 것).
- key_phrases는 4~6개.
- 직역체·교과서체 금지. 원어민 실무 표현 위주.`;
}

/** NativeDoc을 2단계 프롬프트에 넣을 평문으로 직렬화. */
export function docToText(doc: NativeDoc): string {
  const parts: string[] = [doc.title_en];
  doc.sections.forEach((s) => {
    if (s.heading_en) parts.push(`\n[${s.heading_en}]`);
    s.lines.forEach((l) => parts.push(l.en));
  });
  return parts.join('\n');
}
