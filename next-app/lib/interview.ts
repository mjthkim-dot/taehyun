'use client';

/**
 * 면접 시뮬레이션 — AI 면접관과의 풀 사이클 모의 면접.
 *
 * 흐름: 역할 선택 → 질문 5개 생성(키 없으면 내장 기본 세트) →
 *       답변(음성/텍스트) → 면접관의 짧은 반응 + 필요시 즉석 후속 질문 →
 *       전체 종료 후 평가 리포트(점수·강점·교정·모범 답변).
 *
 * 피드백 루프 연결: 리포트의 교정(wrong→right)은 va_mistakes로 들어간다 —
 * 회화 돌발 모드·실전 콘텐츠 생성이 이 약점을 다시 읽는다. 모범 답변은
 * 드릴로 핸드오프해 입에 붙인다. 시도 이력(va_interview_history)으로
 * 점수 추이를 본다.
 */
import { load, store } from './state';
import { groqKoJson, hasHangul } from './aiGuard';
import { recordMistake, sanitizeMistakeType } from './transfer';

export interface InterviewStep {
  q: string;
  /** 질문의 한국어 힌트(내장 세트만 제공, AI 생성은 빈 문자열 가능) */
  qKr?: string;
  answer?: string;
  reaction?: string;
  followUp?: string;
  followUpAnswer?: string;
}

export interface InterviewReport {
  score: number;
  summary: string;
  strengths: string[];
  improvements: { wrong: string; right: string; note: string; type: string }[];
  modelAnswers: { q: string; en: string; kr: string }[];
}

export interface InterviewRecord {
  date: string;
  role: string;
  score: number;
}

const HISTORY_KEY = 'va_interview_history';
const HISTORY_MAX = 10;

export const ROLE_PRESETS = [
  '글로벌 클라우드사 Customer Success Manager',
  '글로벌 테크기업 Account Executive (테크 세일즈)',
];

/** 키 없이도 면접이 시작되는 바닥 — 글로벌 CS/AM 단골 5문항. */
export const DEFAULT_QUESTIONS: { q: string; qKr: string }[] = [
  { q: 'To start, could you tell me a little about yourself?', qKr: '먼저 자기소개를 부탁드립니다.' },
  { q: 'Why are you interested in this role, and why now?', qKr: '왜 이 역할에, 왜 지금 지원하셨나요?' },
  { q: 'Tell me about a time you handled a difficult customer situation.', qKr: '어려운 고객 상황을 다뤘던 경험을 말해 주세요.' },
  { q: 'What professional achievement are you most proud of, and what was your role in it?', qKr: '가장 자랑스러운 성과와 그 안에서의 역할은요?' },
  { q: 'Where do you see yourself in five years?', qKr: '5년 뒤 본인의 모습은 어떨 것 같나요?' },
];

export function interviewHistory(): InterviewRecord[] {
  return load<InterviewRecord[]>(HISTORY_KEY, []);
}

/* ── 1) 질문 생성 ── */

/** 역할 맞춤 질문 5개 — AI 실패 시 내장 세트로 폴백(면접은 항상 시작된다). */
export async function generateQuestions(role: string): Promise<{ questions: { q: string; qKr: string }[]; fallback: boolean }> {
  try {
    const picked = await groqKoJson<{ questions: { q: string; qKr: string }[] }>(
      [
        {
          role: 'system',
          content: [
            '너는 영어 면접관이다. 지원 직무에 맞는 면접 질문 5개를 아래 JSON으로만 출력한다:',
            '{"questions":[{"q":"영어 질문","qKr":"질문의 한국어 번역"} — 정확히 5개]}',
            '구성: 자기소개 1 + 행동 질문(STAR) 2 + 직무 역량 1 + 동기/비전 1. q는 영어로만, qKr은 반드시 한국어.',
          ].join('\n'),
        },
        { role: 'user', content: `지원 직무: ${role}` },
      ],
      { temperature: 0.5, maxTokens: 700 },
      (data) => {
        const o = (data ?? {}) as { questions?: { q?: string; qKr?: string }[] };
        const qs = (Array.isArray(o.questions) ? o.questions : [])
          .filter((x) => typeof x.q === 'string' && x.q.trim() && !hasHangul(x.q) && hasHangul(x.qKr))
          .map((x) => ({ q: String(x.q).trim(), qKr: String(x.qKr).trim() }))
          .slice(0, 5);
        return qs.length === 5 ? { questions: qs } : null;
      }
    );
    if (picked) return { questions: picked.questions, fallback: false };
  } catch {
    /* 폴백으로 */
  }
  return { questions: DEFAULT_QUESTIONS, fallback: true };
}

/* ── 2) 답변 반응 + 즉석 후속 질문 ── */

/**
 * 면접관의 반응 — 실제 면접처럼 답변을 듣고 짧게 반응하고, 얕거나 짧은
 * 답에는 후속 질문을 판다. 실패하면 조용히 다음 질문으로(면접 흐름 우선).
 */
export async function reactToAnswer(
  role: string,
  q: string,
  answer: string,
  /** 포지션 JD 요약 — 주면 후속 질문이 그 문맥으로 파고든다 */
  context?: string
): Promise<{ reaction: string; followUp: string | null }> {
  try {
    const picked = await groqKoJson<{ reaction: string; followUp: string | null }>(
      [
        {
          role: 'system',
          content: [
            `너는 "${role}" 면접의 면접관이다. 지원자의 답변에 대해 아래 JSON만 출력한다:`,
            ...(context ? [context] : []),
            '{"reaction":"면접관의 짧은 자연스러운 반응 한 문장(영어)",',
            ' "followUp":"후속 질문 한 문장(영어) 또는 null"}',
            '후속 질문 규칙: 답변이 구체적 사례·숫자 없이 짧거나 모호하면 반드시 파고드는 후속 질문을 던져라.',
            '충분히 구체적이면 null. reaction과 followUp은 영어로만 쓴다.',
          ].join('\n'),
        },
        { role: 'user', content: `질문: ${q}\n\n지원자 답변: ${answer.slice(0, 800)}` },
      ],
      { temperature: 0.4, maxTokens: 240 },
      (data) => {
        const o = (data ?? {}) as { reaction?: unknown; followUp?: unknown };
        if (typeof o.reaction !== 'string' || !o.reaction.trim() || hasHangul(o.reaction)) return null;
        const fu = typeof o.followUp === 'string' && o.followUp.trim() && !hasHangul(o.followUp) ? o.followUp.trim() : null;
        return { reaction: o.reaction.trim(), followUp: fu };
      }
    );
    if (picked) return picked;
  } catch {
    /* 흐름 우선 — 반응 없이 다음으로 */
  }
  return { reaction: 'I see, thank you.', followUp: null };
}

/* ── 3) 종합 평가 ── */

function transcript(steps: InterviewStep[]): string {
  return steps
    .map((s, i) => {
      const parts = [`Q${i + 1}: ${s.q}`, `A: ${s.answer || '(무응답)'}`];
      if (s.followUp) parts.push(`후속 질문: ${s.followUp}`, `A: ${s.followUpAnswer || '(무응답)'}`);
      return parts.join('\n');
    })
    .join('\n\n');
}

/**
 * 리포트 생성 + 피드백 루프 기록. 교정은 va_mistakes로(회화·콘텐츠 생성이
 * 다시 읽는다), 시도는 이력에 남아 점수 추이가 된다.
 */
export async function evaluateInterview(role: string, steps: InterviewStep[], context?: string): Promise<InterviewReport | null> {
  const picked = await groqKoJson<InterviewReport>(
    [
      {
        role: 'system',
        content: [
          `너는 "${role}" 면접의 시니어 면접관이자 영어 코치다. 면접 전체를 평가해 아래 JSON만 출력한다:`,
          ...(context ? [context] : []),
          '{"score":0~100 정수(내용 50%+영어 50%),"summary":"총평 두 문장(한국어)",',
          ' "strengths":["잘한 점(한국어)" — 2개],',
          ' "improvements":[{"wrong":"지원자가 실제로 쓴 어색한 영어 표현","right":"자연스러운 교정","note":"왜(한국어)","type":"tense|article|preposition|word-order|word-choice|other"} — 2~3개, 반드시 답변에 실제로 있던 표현만],',
          ' "modelAnswers":[{"q":"질문(영어)","en":"이 지원자의 경험을 살린 모범 답변 2~3문장(영어)","kr":"한국어 번역"} — 질문마다 1개],',
          '}',
          '규칙: wrong/right/en/q는 영어, summary/strengths/note/kr은 반드시 한국어. 답변이 대부분 비었으면 score를 낮게 주고 솔직하게 말하라.',
        ].join('\n'),
      },
      { role: 'user', content: `면접 기록:\n${transcript(steps).slice(0, 3500)}` },
    ],
    { temperature: 0.3, maxTokens: 1300 },
    (data) => {
      const o = (data ?? {}) as Partial<InterviewReport>;
      if (typeof o.score !== 'number' || o.score < 0 || o.score > 100 || !hasHangul(o.summary)) return null;
      const strengths = (Array.isArray(o.strengths) ? o.strengths : []).map(String).filter((s) => hasHangul(s)).slice(0, 3);
      const improvements = (Array.isArray(o.improvements) ? o.improvements : [])
        .filter((m) => m && typeof m.wrong === 'string' && m.wrong.trim() && typeof m.right === 'string' && m.right.trim() && hasHangul(m.note))
        .map((m) => ({ wrong: m.wrong.trim(), right: m.right.trim(), note: String(m.note).trim(), type: String(m.type || 'other') }))
        .slice(0, 4);
      const modelAnswers = (Array.isArray(o.modelAnswers) ? o.modelAnswers : [])
        .filter((m) => m && typeof m.en === 'string' && m.en.trim() && !hasHangul(m.en) && hasHangul(m.kr))
        .map((m) => ({ q: String(m.q || '').trim(), en: m.en.trim(), kr: String(m.kr).trim() }))
        .slice(0, 6);
      if (!modelAnswers.length) return null;
      return { score: Math.round(o.score), summary: String(o.summary).trim(), strengths, improvements, modelAnswers };
    }
  );
  if (!picked) return null;

  // 피드백 루프: 교정 → va_mistakes (돌발 모드·실전 생성이 다시 읽는다)
  for (const m of picked.improvements) {
    recordMistake({ wrong: m.wrong, right: m.right, note: `면접: ${m.note}`, t: Date.now(), type: sanitizeMistakeType(m.type) });
  }
  // 점수 이력
  const hist = [...interviewHistory(), { date: new Date().toISOString(), role, score: picked.score }].slice(-HISTORY_MAX);
  store(HISTORY_KEY, hist);
  return picked;
}
