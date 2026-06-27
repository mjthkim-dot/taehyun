/**
 * "꾹 눌러 물어보기" — 학습 중 모르는 영어 표현을 그 자리에서 선택해 묻고, AI 튜터가
 * 한국어 설명 + 영어 예문으로 답해주는 기능의 프롬프트/저장 로직.
 *
 * 답변은 항상 JSON으로 강제해(groqComplete json 모드) 예문마다 🔊 재생·한국어 뜻을
 * 안정적으로 붙일 수 있게 한다. 설명은 한국어, 예문은 영어(+한국어 뜻)가 기본.
 */
import { getProfile, load, store } from './state';

export type AskMode = 'meaning' | 'examples' | 'grammar' | 'pronunciation';

export interface AskModeDef {
  mode: AskMode;
  emoji: string;
  label: string;
  /** 질문 타입별 추가 지시 — 시스템 프롬프트 뒤에 붙는다. */
  instruction: string;
}

export const ASK_MODES: AskModeDef[] = [
  {
    mode: 'meaning',
    emoji: '📖',
    label: '뜻',
    instruction:
      '이 표현의 뜻과 뉘앙스, 언제/어떤 상황에서 쓰는지 쉽게 설명해줘. 직역과 자연스러운 의역 차이가 있으면 짚어줘.',
  },
  {
    mode: 'examples',
    emoji: '💬',
    label: '예문',
    instruction:
      '이 표현을 실제로 쓰는 자연스러운 예문을 다양한 상황으로 만들어줘. answer_ko에는 어떤 상황에서 쓰면 좋은지 간단히 적고, examples를 풍부하게(3개) 채워줘.',
  },
  {
    mode: 'grammar',
    emoji: '🧩',
    label: '문법',
    instruction:
      '이 표현/문장의 문법 구조를 설명해줘. 어떤 시제·구문·어순 규칙이 쓰였는지, 한국인이 자주 틀리는 포인트가 있으면 함께 짚어줘.',
  },
  {
    mode: 'pronunciation',
    emoji: '🔊',
    label: '발음',
    instruction:
      '이 표현을 자연스럽게 발음하는 법을 설명해줘. 강세 위치, 연음, 한국인이 흘리기 쉬운 소리를 한국어로 짚고, examples에는 따라 말하기 좋은 짧은 문장을 넣어줘.',
  },
];

export function askModeDef(mode: AskMode): AskModeDef {
  return ASK_MODES.find((m) => m.mode === mode) || ASK_MODES[0];
}

/** AI 답변 구조 — groqComplete json 모드로 받아 JSON.parse 한다. */
export interface AskAnswer {
  answer_ko: string;
  examples: { en: string; ko: string }[];
}

function askSystemPrompt(cefr: string): string {
  return [
    `너는 한국인 영어 학습자(현재 레벨 CEFR ${cefr})를 돕는 친절한 1:1 영어 튜터다.`,
    '학습자가 모르는 영어 표현을 골라 물어보면, 레벨에 맞춰 쉽고 정확하게 답한다.',
    '',
    '반드시 아래 JSON 형식만 출력한다(코드블록·설명 없이 JSON 객체 하나만):',
    '{',
    '  "answer_ko": "한국어로 된 핵심 설명 (2~4문장, 너무 길지 않게)",',
    '  "examples": [ { "en": "영어 예문", "ko": "한국어 뜻" } ]',
    '}',
    '',
    '규칙:',
    '- answer_ko는 반드시 한국어로 쓴다.',
    '- examples는 1~3개. en은 영어, ko는 그 한국어 뜻. 표현이 단어면 그 단어가 들어간 짧은 문장을 만든다.',
    `- 학습자 레벨(${cefr})에 맞는 어휘/난이도로 예문을 만든다.`,
    '- 모르는 내용을 지어내지 말고, 표현이 어색하거나 틀렸으면 자연스러운 대안을 제시한다.',
  ].join('\n');
}

/** 선택한 표현 + 질문 타입(+ 자유 추가 질문)으로 Groq 메시지 배열을 만든다. */
export function buildAskMessages(
  phrase: string,
  mode: AskMode,
  freeText?: string
): { role: string; content: string }[] {
  const cefr = getProfile().cefr;
  const def = askModeDef(mode);
  const userLines = [
    `학습자가 선택한 영어 표현: "${phrase}"`,
    '',
    `요청: ${def.instruction}`,
  ];
  if (freeText && freeText.trim()) {
    userLines.push('', `학습자의 추가 질문: ${freeText.trim()}`);
  }
  return [
    { role: 'system', content: askSystemPrompt(cefr) },
    { role: 'user', content: userLines.join('\n') },
  ];
}

/* ── 질문 기록(나중에 복습할 수 있도록 저장) ── */
export interface AskHistoryEntry {
  phrase: string;
  mode: AskMode;
  answer_ko: string;
  date: string;
}

const ASK_HISTORY_KEY = 'va_ask_history';
const ASK_HISTORY_MAX = 100;

export function getAskHistory(): AskHistoryEntry[] {
  return load<AskHistoryEntry[]>(ASK_HISTORY_KEY, []);
}

export function addAskHistory(entry: AskHistoryEntry) {
  const list = getAskHistory();
  list.push(entry);
  store(ASK_HISTORY_KEY, list.slice(-ASK_HISTORY_MAX));
  return list;
}
