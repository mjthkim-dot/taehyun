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

/** 질문별 답변 가이드 — 일반론이 아니라 내 커리어 재료가 매핑된 "뭐라고 말하지"의 답 */
export interface AnswerGuide {
  /** 답변 뼈대(순서) */
  structure: string[];
  /** 내 상황 재료 — 실제 커리어 데이터 기반 불릿 */
  materials: string[];
  /** 입 떼는 첫 문장 */
  opener: string;
  /** 그대로 소리 내어 읽을 수 있는 영어 예시 답변 — 가이드의 본체 */
  sample?: { en: string; kr: string };
}

/** AI 즉석 답변 생성에 쓰는 지원자 프로필 — 실제 커리어 사실만 */
export const MY_PROFILE_BRIEF = [
  '지원자: Taehyun. 메가존클라우드(한국 최대 클라우드 파트너) Account Manager 4년+.',
  '엔터프라이즈·디지털 네이티브 50+ 계정 포트폴리오 담당.',
  '대표 실적: 만료되던 EDP 계약을 3년 $253K 약정으로 전환(분납·보증보험을 재무팀과 협상, 모든 조건 서면 확정 후 실행).',
  '월 $430K 규모 계정의 FinOps 월례 리뷰 운영(RI 커버리지 90%+, 비용 급증 근본원인 분석).',
  '신규 로고 직접 발굴·클로징 경험(발굴 → 파트너 협업 → 빠른 클로징), 이탈 고객 윈백 진행 중.',
  '사내 AM 100+ 신뢰 네트워크(합산 1,700+ 고객 계정 접점) — 반복 가능한 신규 로고 소싱 채널.',
  '스타일: 헌터형이지만 큰 딜은 팀을 모아 클로징. 미팅 기록·주간 서면 공유로 파이프라인을 투명하게 관리.',
].join('\n');

/**
 * 즉석 영어 답변 생성 — "어떻게 답해야 할지 모르겠어"의 탈출구.
 * 예상 못 한 후속 질문·AI 생성 질문에도, 내 커리어 사실로만 쓴 3~5문장의
 * 소리 내어 읽을 수 있는 답을 만들어준다.
 */
export async function draftAnswer(
  role: string,
  question: string,
  opts?: { context?: string; previousAnswer?: string }
): Promise<{ en: string; kr: string } | null> {
  return groqKoJson<{ en: string; kr: string }>(
    [
      {
        role: 'system',
        content: [
          '너는 영어 면접 답변 코치다. 지원자가 그대로 소리 내어 말할 수 있는 답변 예시를 만든다. 아래 JSON만 출력한다:',
          '{"en":"3~5문장의 영어 답변(1인칭, 자연스러운 구어체, 지원자 프로필의 사실만 사용 — 지어내기 금지)","kr":"그 답변의 한국어 번역"}',
          `지원 포지션: ${role}`,
          ...(opts?.context ? [opts.context] : []),
          '지원자 프로필:',
          MY_PROFILE_BRIEF,
        ].join('\n'),
      },
      {
        role: 'user',
        content: `면접관 질문: ${question}${opts?.previousAnswer ? `\n\n(직전 내 답변: ${opts.previousAnswer.slice(0, 400)})` : ''}\n\n이 질문에 대한 영어 답변 예시를 만들어라.`,
      },
    ],
    { temperature: 0.4, maxTokens: 500 },
    (data) => {
      const o = (data ?? {}) as { en?: unknown; kr?: unknown };
      if (typeof o.en !== 'string' || !o.en.trim() || hasHangul(o.en) || !hasHangul(o.kr)) return null;
      return { en: o.en.trim(), kr: String(o.kr).trim() };
    }
  ).catch(() => null);
}

/** AI 생성 질문 등 맞춤 가이드가 없을 때의 뼈대 — 최소한 구조는 준다 */
export const GENERIC_GUIDE: AnswerGuide = {
  structure: ['상황 한 줄(언제·어디서)', '내 역할과 행동(구체적 숫자 하나)', '결과와 배운 점'],
  materials: [
    '메가존클라우드 AM 4년+ — 클라우드·DevOps·AI 솔루션 영업',
    '엔터프라이즈·디지털 네이티브 50+ 계정 담당',
    '만료 계약을 3년 25만 달러 약정으로 전환한 클로징 경험',
  ],
  opener: 'Let me give you a concrete example from my current role.',
};

/* ── 전달력 분석 (벤치마크: Yoodli·Big Interview의 딜리버리 코칭,
 *    Google Interview Warmup의 talking-points 감지) ──
 * 실전 면접은 "무엇을"만큼 "어떻게"로 평가된다. STT 전사에서 결정적으로
 * 계산한다(AI 불필요·비용 0·테스트 가능). */

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'kind of', 'sort of', 'i mean', 'so yeah'];

export interface DeliveryMetrics {
  words: number;
  /** 분당 단어 수 — 녹음 답변만(텍스트 입력은 null). 원어민 면접 적정 110~150 */
  wpm: number | null;
  /** 감지된 필러 단어(중복 포함 총수) */
  fillerCount: number;
  fillers: string[];
  /** 좋은 답의 3요소 감지 — 숫자, 내 역할(주도), 결과 */
  hasNumber: boolean;
  hasOwnership: boolean;
  hasResult: boolean;
}

export function deliveryMetrics(text: string, durationMs?: number | null): DeliveryMetrics {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9$%' ]+/g, ' ')} `;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const fillers: string[] = [];
  for (const f of FILLER_WORDS) {
    const m = t.split(` ${f} `).length - 1;
    for (let i = 0; i < m; i++) fillers.push(f);
  }
  return {
    words,
    wpm: durationMs && durationMs > 3000 ? Math.round(words / (durationMs / 60000)) : null,
    fillerCount: fillers.length,
    fillers: [...new Set(fillers)],
    hasNumber: /\d|\$|%|percent|million|thousand|hundred|dozen/.test(t),
    hasOwnership: /\bi (led|built|drove|owned|managed|closed|negotiated|created|ran|designed|hunted|converted|rebuilt)\b/.test(t),
    hasResult: /\b(closed|achieved|increased|reduced|resulted|delivered|won|grew|saved|hit|exceeded)\b/.test(t),
  };
}

export interface InterviewStep {
  q: string;
  /** 질문의 한국어 힌트(내장 세트만 제공, AI 생성은 빈 문자열 가능) */
  qKr?: string;
  /** 답변 가이드 — 큐레이션 세트는 맞춤, 그 외엔 GENERIC_GUIDE */
  guide?: AnswerGuide;
  answer?: string;
  reaction?: string;
  followUp?: string;
  followUpAnswer?: string;
  /** 본답변의 전달력 지표 — 리포트의 전달력 종합에 쓴다 */
  metrics?: DeliveryMetrics;
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

/* ── 아이스브레이킹 — 실제 면접은 본론 전에 인사·스몰토크로 시작한다 ──
 * Zoom 면접의 첫 1~2분을 그대로: 연결 확인 → 가벼운 근황 → 전환 멘트.
 * 채점·평가 대상이 아니다(실제처럼 편하게 워밍업하는 구간). */

export interface Icebreaker {
  en: string;
  kr: string;
  /** 이렇게 답하면 되는 예시 — 짧게 */
  sample: { en: string; kr: string };
}

export const ICEBREAKERS: Icebreaker[] = [
  {
    en: 'Hi Taehyun, thanks so much for hopping on today! Can you hear me okay?',
    kr: '태현님 안녕하세요, 시간 내주셔서 감사해요! 제 소리 잘 들리시나요?',
    sample: { en: "Yes, I can hear you perfectly. Thanks for having me — I've been looking forward to this!", kr: '네, 아주 잘 들립니다. 초대해 주셔서 감사해요 — 기대하고 있었습니다!' },
  },
  {
    en: "Great! How's your day going so far?",
    kr: '좋아요! 오늘 하루는 어떻게 보내고 계세요?',
    sample: { en: "It's going well, thank you! I had a couple of customer meetings this morning, so it's been a productive day. How about you?", kr: '잘 보내고 있습니다, 감사해요! 오전에 고객 미팅이 두어 개 있어서 알찬 하루네요. 그쪽은 어떠세요?' },
  },
];

/** 스몰토크 → 본론 전환 멘트 */
export const OPENING_TRANSITION = "That's great to hear. Well, let's dive in.";

/** 마지막 질문 후 실제 면접처럼 따뜻하게 마무리 */
export const CLOSING_LINE =
  "That's everything from my side. Thank you so much for your time today — we'll be in touch about next steps soon. Have a great rest of your day!";

/* ── 다가오는 실제 면접 D-day — 준비의 마감을 눈에 보이게 ── */

const DATE_KEY = 'va_interview_date';

export interface UpcomingInterview {
  /** YYYY-MM-DD */
  date: string;
  label: string;
}

export function upcomingInterview(): UpcomingInterview | null {
  const v = load<UpcomingInterview | null>(DATE_KEY, null);
  if (!v?.date || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return null;
  return v;
}

export function setUpcomingInterview(v: UpcomingInterview | null) {
  store(DATE_KEY, v);
}

/** 오늘 기준 남은 일수 — 오늘이면 0, 지났으면 음수 */
export function daysUntilInterview(v: UpcomingInterview): number {
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const [y, m, d] = v.date.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - t0) / 86400000);
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
