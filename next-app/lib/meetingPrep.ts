'use client';

/**
 * 미팅 준비 · 회고 — 공부와 실제 업무를 잇는 고리.
 *
 * 지금까지 이 앱의 상황은 전부 **일반적인 상황**이었다(미팅 열기, 가격 반론…).
 * 잘 만들어져 있지만, 정작 내일 잡힌 그 미팅 — 상대가 누구고, 무엇을 팔아야 하고,
 * 어떤 반론이 나올지 아는 그 자리 — 를 준비하는 곳은 없었다. 그래서 학습이 끝나면
 * 학습으로 끝났다.
 *
 * 여기서 만드는 것은 세 가지다.
 *   ① 준비 — 상대·안건·목표 세 줄로 그 미팅용 표현과 예상 질문·반론을 만든다
 *   ② 리허설 — 만들어진 상황을 회화 탭으로 넘겨 AI가 상대 역할을 한다
 *   ③ 회고 — 끝난 뒤 "못 한 말"을 한국어로 적으면 영어로 만들어 표현장·드릴로 보낸다
 *
 * ③이 이 기능의 핵심이다. 실전에서 막힌 표현만큼 학습 동기가 분명한 재료가 없는데,
 * 지금까지는 그게 기록되지 않고 그냥 사라졌다.
 *
 * 저장은 기기에만 한다 — 고객사·안건은 업무 정보라 서버로 보내지 않는다(AI 호출에
 * 필요한 최소한만 프롬프트로 나간다는 점은 화면에 그대로 밝힌다).
 */
import { groqComplete } from './groq';
import { load, store } from './state';

export interface PrepPhrase {
  en: string;
  kr: string;
}

export interface PrepQuestion {
  /** 상대가 물어볼 법한 질문/반론 */
  en: string;
  kr: string;
  /** 이렇게 받아치면 된다 */
  answer: { en: string; kr: string };
}

export interface MeetingPrep {
  id: string;
  /** 만든 날짜(YYYY-MM-DD) */
  date: string;
  /** 사용자가 적은 세 줄 */
  input: { who: string; agenda: string; goal: string };
  /** 미팅 한 줄 요약(영어 회의에서 스스로 정리할 때 쓰는 문장) */
  headline: string;
  /** 이 미팅에서 실제로 쓸 표현 */
  phrases: PrepPhrase[];
  /** 예상 질문·반론과 대응 */
  questions: PrepQuestion[];
  /** 회화 탭 리허설용 상대 역할 지시 */
  talkPrompt: string;
  /** 실제로 썼다고 체크한 표현(en 기준) */
  used: string[];
  /** 회고 — 못 한 말을 영어로 바꾼 결과 */
  gaps: { kr: string; en: string }[];
  /** 회고를 마쳤는지 */
  done?: boolean;
}

const KEY = 'va_meetings';
/** 기기 저장이므로 무한정 쌓이지 않게 최근 것만 남긴다 */
const MAX = 20;

export function getMeetings(): MeetingPrep[] {
  return load<MeetingPrep[]>(KEY, []);
}

export function saveMeeting(m: MeetingPrep) {
  const all = getMeetings().filter((x) => x.id !== m.id);
  all.push(m);
  store(KEY, all.slice(-MAX));
}

export function removeMeeting(id: string) {
  store(
    KEY,
    getMeetings().filter((m) => m.id !== id)
  );
}

/** 아직 회고하지 않은 미팅 — 홈에서 "회고할 미팅이 있어요"로 끌어오는 데 쓴다 */
export function pendingRetros(): MeetingPrep[] {
  return getMeetings().filter((m) => !m.done);
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PREP_SYSTEM = [
  'You are an English coach for a Korean cloud/IT sales professional preparing for a real customer meeting.',
  'Return JSON only, with this exact shape:',
  '{"headline":"...","phrases":[{"en":"...","kr":"..."}],"questions":[{"en":"...","kr":"...","answer":{"en":"...","kr":"..."}}],"talkPrompt":"..."}',
  'Rules:',
  '- phrases: exactly 8. Sentences the seller will actually say in THIS meeting, not generic textbook lines.',
  '- Keep each phrase under 18 words so it can be spoken from memory.',
  '- questions: exactly 5. What the customer is most likely to ask or push back on, with a concrete answer the seller can say.',
  '- Prefer natural business English over formal written English. Contractions are fine.',
  '- kr: natural Korean translation (존댓말), not literal word-for-word.',
  '- headline: one English sentence the seller can use to frame the meeting ("Today I want to walk you through...").',
  '- talkPrompt: Korean instruction describing the customer persona and how they should behave in a roleplay.',
].join('\n');

/** 세 줄 입력 → 그 미팅용 표현·예상 질문. 실패하면 예외를 던진다. */
export async function generatePrep(input: {
  who: string;
  agenda: string;
  goal: string;
}): Promise<MeetingPrep> {
  const raw = await groqComplete(
    [
      { role: 'system', content: PREP_SYSTEM },
      {
        role: 'user',
        content: [
          `상대: ${input.who}`,
          `안건: ${input.agenda}`,
          `내 목표: ${input.goal}`,
          '',
          '이 미팅에서 실제로 쓸 표현과 예상 질문을 만들어줘.',
        ].join('\n'),
      },
    ],
    { temperature: 0.7, maxTokens: 1600, json: true }
  );

  const p = JSON.parse(raw || '{}') as Partial<MeetingPrep>;
  const phrases = (Array.isArray(p.phrases) ? p.phrases : [])
    .filter((x) => x && x.en)
    .map((x) => ({ en: String(x.en).trim(), kr: String(x.kr || '').trim() }))
    .slice(0, 8);
  const questions = (Array.isArray(p.questions) ? p.questions : [])
    .filter((q) => q && q.en)
    .map((q) => ({
      en: String(q.en).trim(),
      kr: String(q.kr || '').trim(),
      answer: {
        en: String(q.answer?.en || '').trim(),
        kr: String(q.answer?.kr || '').trim(),
      },
    }))
    .filter((q) => q.answer.en)
    .slice(0, 5);

  // 표현이 몇 개뿐이면 준비가 안 된 것이다 — 반쪽짜리를 저장해 두면 신뢰를 잃는다
  if (phrases.length < 4 || questions.length < 2) {
    throw new Error('준비 자료를 만들지 못했어요. 안건을 조금 더 구체적으로 적고 다시 시도해 주세요.');
  }

  return {
    id: `m-${Date.now()}`,
    date: today(),
    input,
    headline: String(p.headline || '').trim(),
    phrases,
    questions,
    talkPrompt:
      String(p.talkPrompt || '').trim() ||
      `${input.who} 역할로 ${input.agenda}에 대해 질문하고 반론하는 고객. 사용자는 영업 담당자다.`,
    used: [],
    gaps: [],
  };
}

const GAP_SYSTEM = [
  'You turn what a Korean salesperson wished they could say in English into natural spoken business English.',
  'Return JSON only: {"items":[{"kr":"...","en":"..."}]}',
  'Rules:',
  '- One English sentence per Korean line. Keep it under 20 words and speakable.',
  '- Natural spoken business English, not written/formal English.',
  '- Keep the original Korean line in kr, unchanged.',
].join('\n');

/**
 * 회고 — "못 한 말"(한국어 줄바꿈 목록)을 영어 문장으로 바꾼다.
 * 실전에서 막힌 표현이라 학습 동기가 가장 분명한 재료다.
 */
export async function translateGaps(lines: string[]): Promise<{ kr: string; en: string }[]> {
  const clean = lines.map((l) => l.trim()).filter(Boolean).slice(0, 8);
  if (!clean.length) return [];
  const raw = await groqComplete(
    [
      { role: 'system', content: GAP_SYSTEM },
      { role: 'user', content: clean.map((l, i) => `${i + 1}. ${l}`).join('\n') },
    ],
    { temperature: 0.5, maxTokens: 900, json: true }
  );
  const parsed = JSON.parse(raw || '{}') as { items?: { kr?: string; en?: string }[] };
  return (Array.isArray(parsed.items) ? parsed.items : [])
    .filter((x) => x && x.en)
    .map((x) => ({ kr: String(x.kr || '').trim(), en: String(x.en).trim() }))
    .slice(0, 8);
}
