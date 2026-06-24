/**
 * 비즈니스 회화 전용 화면(BusinessScreen)에서 쓰는 프롬프트 빌더 —
 * 사용자의 기존 회화(talk) 챗 로그를 비즈니스 미팅 회의록 형식으로 요약·학습 자료화한다.
 */

export interface MeetingMinutes {
  title_ko: string;
  summary_ko: string;
  agenda: string[];
  decisions: string[];
  action_items: string[];
  vocab: { en: string; kr: string; note_ko: string }[];
  follow_up_questions: { en: string; kr: string }[];
}

export function buildMeetingMinutesPrompt(transcript: { role: string; content: string }[], lessonTitle: string) {
  const convo = transcript
    .map((m) => `${m.role === 'user' ? '학생' : 'AI'}: ${m.content}`)
    .join('\n');
  return `당신은 비즈니스 영어 코치입니다. 아래는 한국인 학생이 영어 회화 연습 중 AI와 나눈 대화 기록입니다(주제: ${lessonTitle}).
이 대화를 실제 비즈니스 미팅 회의록처럼 정리하고, 학생이 비즈니스 영어를 학습할 수 있는 자료를 만들어주세요.

대화 기록:
"""
${convo}
"""

오직 JSON만 (마크다운, 코드펜스 없이) 아래 정확한 형식으로 응답하세요:
{
  "title_ko": "회의록 제목(한국어, 짧게)",
  "summary_ko": "전체 논의 요약 2~3문장(한국어)",
  "agenda": ["다룬 안건 항목들(한국어, 최대 4개)"],
  "decisions": ["결정되거나 합의된 내용(한국어, 없으면 빈 배열)"],
  "action_items": ["다음에 할 일/follow-up(한국어, 없으면 빈 배열)"],
  "vocab": [{"en":"비즈니스 영어 표현","kr":"한국어 뜻","note_ko":"실무에서 쓰는 법 한 줄 설명"}],
  "follow_up_questions": [{"en":"이 주제를 더 깊이 연습할 영어 질문","kr":"한국어 뜻"}]
}
규칙:
- vocab은 대화에서 실제 쓰였거나 이 주제에서 자주 쓰이는 비즈니스 표현 위주로 최대 5개.
- follow_up_questions는 학생이 다음 회화 연습에서 답해볼 질문 최대 3개.
- 대화가 너무 짧으면 빈 배열을 쓰고 summary_ko에 짧게 안내하세요.`;
}
