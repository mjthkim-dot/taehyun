/**
 * 리텔 키워드의 '영어 후보'(M5) — 화면엔 한국어 키워드만 보이고(영어 가림), 채점은 영어 전사에서 이 후보를 찾는다.
 *
 * 왜 필요한가: lib/dramaSeedMine.KEYWORDS는 한국어 28개('멈춘 엘리베이터'·'긴장돼요' …)라 Whisper 영어 전사와
 * 직접 비교할 수 없다. 그래서 시드 7화 × 4개에 원고 실제 대사에서 뽑은 영어 후보(동의어·파생어 포함, 2개 이상)를
 * 정적으로 붙인다. 후보는 lib/retell.scoreRetell의 연속 토큰 일치(4글자 이상 어두 일치)로 비교된다.
 *   · 'first'·'then'·'so' 같은 담화 표지 단어는 후보로 쓰지 않는다 — 표지 칩과 이중으로 점수가 나지 않게.
 * AI 화(8화+)는 drama.ts가 검증한 한국어 keywords 4개(소프트 필드)만 있다 → 키워드 안의 로마자(Grant·CEO)·인물명·
 * 같은 낱말을 공유하는 오늘의 표현에서 영어 후보를 끌어오고, 후보가 하나도 없는 키워드는 채점에서 뺀 뒤 learn으로 채운다.
 *
 * 이 파일은 원고(dramaSeed.json)·drama.ts를 import하지 않는다(타입만) — 한국어 문자열은 dramaSeedMine.KEYWORDS와
 * 같아야 하고, tests/unit/retellKeywords.test.ts가 일치를 고정한다.
 */
import type { RetellKeyword } from './retell';

/** 시드 7화 리텔 키워드(한국어는 dramaSeedMine.KEYWORDS 그대로, 영어 후보 ≥2) */
export const SEED_RETELL_KEYWORDS: Record<number, RetellKeyword[]> = {
  1: [
    { kr: '첫 출근', en: ['first day', 'day one', 'new job', 'new here'] },
    { kr: '멈춘 엘리베이터', en: ['elevator', 'lift', 'stuck', 'broken'] },
    { kr: '긴장돼요', en: ['nervous', 'scared', 'worried'] },
    { kr: 'CEO가 Diane', en: ['ceo', 'diane', 'boss'] },
  ],
  2: [
    { kr: '커피 심부름', en: ['coffee', 'americano', 'latte'] },
    { kr: '컵에 적힌 TACO', en: ['taco', 'cup', 'wrong name'] },
    { kr: 'Jun의 놀림', en: ['funny', 'joke', 'teased', 'laughed', 'nickname'] },
    { kr: 'Grant의 전화 요청', en: ['grant', 'call', 'phone', 'email'] },
  ],
  3: [
    { kr: 'Grant와 화상 통화', en: ['grant', 'video call', 'call', 'hear me'] },
    { kr: '청구서가 왜 높죠', en: ['bill', 'invoice', 'too high', 'expensive', 'cost'] },
    { kr: '확인하고 연락드릴게요', en: ['check', 'get back', 'call back'] },
    { kr: '계약 해지 검토', en: ['cancel', 'contract', 'leave', 'quit'] },
  ],
  4: [
    { kr: '빨간 폴더', en: ['red folder', 'folder', 'file'] },
    { kr: '밤새 도는 서버 열 대', en: ['servers', 'server', 'all night', 'ten'] },
    { kr: '탐정님 커피', en: ['detective', 'coffee'] },
    { kr: '로그의 jun.park', en: ['log', 'logs', 'jun park', 'his name'] },
  ],
  5: [
    { kr: '옥상 벤치 고백', en: ['rooftop', 'roof', 'bench', 'confess', 'secret', 'told'] },
    { kr: '내 잘못이야', en: ['my fault', 'mistake', 'sorry'] },
    { kr: '같이 고치자', en: ['fix', 'together', 'solve'] },
    { kr: 'Maya가 열이 나서', en: ['fever', 'sick', 'ill'] },
  ],
  6: [
    { kr: '혼자 만난 Grant', en: ['alone', 'grant', 'by myself', 'met'] },
    { kr: '서버를 어제 껐어요', en: ['turned off', 'turn off', 'shut down', 'yesterday'] },
    { kr: '매달 30퍼센트 절약', en: ['save', 'saving', 'percent', 'thirty', '30', 'every month'] },
    { kr: '누가 실수했죠', en: ['who made', 'mistake', 'who'] },
  ],
  7: [
    { kr: '우리는 한 팀', en: ['one team', 'team', 'together'] },
    { kr: 'Grant의 신뢰', en: ['trust', 'stay', 'grant'] },
    { kr: 'Diane의 박수', en: ['brave', 'clap', 'applause', 'proud'] },
    { kr: '점심 제안', en: ['lunch', 'offer'] },
  ],
};

/** 한국어 인물명 → 영어(전사에는 영어로 나온다) */
const CAST_EN: Record<string, string> = { 태오: 'taeo', 마야: 'maya', 준: 'jun', 다이앤: 'diane', 그랜트: 'grant' };

/** 영어 후보에서 뺄 기능어 — 이런 단어가 후보면 아무 말에나 적중한다 */
const STOP = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'so', 'then', 'first',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'our', 'his', 'her', 'its', 'this', 'that', 'with', 'do', 'does',
  'did', 'can', 'could', 'will', 'would', 'please', "it's", "i'm", "don't", "let's", 'let', 'get', 'have', 'has', 'just', 'okay', 'actually', 'finally',
]);

const hangulTokens = (s: string): string[] =>
  (s.match(/[가-힣]+/g) || [])
    // 조사 한 글자를 떼어 낸 어간도 함께 본다(마야가 → 마야)
    .flatMap((t) => (t.length >= 3 && /[이가은는을를의와과도에]$/.test(t) ? [t, t.slice(0, -1)] : [t]))
    .filter((t) => t.length >= 2);

/** 영어 문장의 내용어(4글자 이상, 기능어 제외) */
export function contentWords(en: string): string[] {
  const out: string[] = [];
  for (const w of en.toLowerCase().replace(/[’‘`]/g, "'").split(/[^a-z0-9']+/)) {
    const t = w.replace(/^'+|'+$/g, '');
    if (t.length >= 4 && !STOP.has(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * AI 화 한국어 키워드 하나의 영어 후보 — ① 키워드 안 로마자(Grant·CEO·TACO) ② 한국어 인물명
 * ③ 같은 한국어 낱말(2글자+)을 공유하는 오늘의 표현의 내용어. 아무것도 없으면 빈 배열.
 */
export function aiKeywordCandidates(kr: string, learn: { en: string; kr: string }[] = []): string[] {
  const out: string[] = [];
  const add = (w: string) => {
    const t = w.toLowerCase();
    if (t.length >= 2 && !STOP.has(t) && !out.includes(t)) out.push(t);
  };
  for (const m of kr.match(/[A-Za-z][A-Za-z.'-]*/g) || []) add(m.replace(/[.'-]+$/, ''));
  const toks = hangulTokens(kr);
  for (const t of toks) if (CAST_EN[t]) add(CAST_EN[t]);
  for (const l of learn) {
    const lt = new Set(hangulTokens(l.kr));
    if (toks.some((t) => lt.has(t))) contentWords(l.en).forEach(add);
  }
  return out;
}

export interface KeywordEpisode {
  no: number;
  ai?: boolean;
  keywords?: string[];
  learn?: { en: string; kr: string }[];
}

/**
 * 이 화의 리텔 키워드({kr, en[]}) — 시드 화는 정적 표, AI 화는 keywords + learn에서.
 * lib/retell.keywordsOf(ep)에 `keywords`로 넘기면 그대로 쓰이고, 비면 keywordsOf가 learn 2 + 인물명으로 폴백한다.
 */
export function retellKeywordsFor(ep: KeywordEpisode): RetellKeyword[] {
  if (!ep.ai && SEED_RETELL_KEYWORDS[ep.no]) return SEED_RETELL_KEYWORDS[ep.no];
  const learn = ep.learn || [];
  const out: RetellKeyword[] = [];
  for (const kr of ep.keywords || []) {
    if (typeof kr !== 'string' || !kr.trim()) continue;
    const en = aiKeywordCandidates(kr, learn);
    if (en.length) out.push({ kr: kr.trim(), en });
  }
  // 후보 없는 키워드를 뺀 만큼 오늘의 표현으로 채운다(4개까지)
  for (const l of learn) {
    if (out.length >= 4) break;
    const en = [l.en.toLowerCase().replace(/[.!?]+$/, ''), ...contentWords(l.en)];
    if (!out.some((k) => k.kr === l.kr)) out.push({ kr: l.kr, en });
  }
  return out;
}

/** 토요일 교차 리텔 — 지난 3화에서 화당 per개씩 섞는다(순서는 화 순서 그대로) */
export function mixKeywordsFor(eps: KeywordEpisode[], per = 2): RetellKeyword[] {
  const out: RetellKeyword[] = [];
  for (const ep of eps) for (const k of retellKeywordsFor(ep).slice(0, per)) if (!out.some((x) => x.kr === k.kr)) out.push(k);
  return out;
}
