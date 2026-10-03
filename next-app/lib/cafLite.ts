/**
 * CAF-lite(M5) — 리텔 전사 한 덩어리를 짧게 평가한다: '한 줄 교정' 1개 + 말하기 레벨 추정.
 *
 *   cafLite(transcript, { level, learn }) → { fix: {wrong, better, kr} | null, level: 'A1'|'A2'|'B1'|'B2' } | null
 *
 * 왜 한 번에: 리텔 1회차가 끝나면 ① 2회차 전 '한 줄 교정'과 ② 말하기 CEFR 증거(src 'retell')가 둘 다 필요하다.
 * gpt-oss 호출은 하루 예산이 빠듯해서(통합 원칙 ⑪ — 리텔 교정 1 + cafLite 1) 프롬프트 하나로 묶고 토큰을 작게 잡는다.
 * talkPrompts.ts(회화 CAF)는 건드리지 않는다 — 회화용 긴 프롬프트와 목적이 다르다.
 *
 * 방어(aiGuard): JSON만 받고, fix.kr은 한국어여야 하며(아니면 한 번 다시 묻는다), wrong은 실제 전사에 있던 말이어야 한다
 * (지어낸 교정은 fix만 버리고 레벨은 쓴다). 키 없음·네트워크 오류·형태 불량은 전부 null — 호출부는 그냥 넘어간다(실패 무해).
 */
import { groqKoJson, hasHangul } from './aiGuard';
import { groqKey } from './state';
import { NEAR_SCORE } from './cefrGrowth';
import { CEFR_ORDER, type Cefr } from './cefr';

export const CAF_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export type CafLevel = (typeof CAF_LEVELS)[number];

export interface CafFix {
  /** 학습자가 실제로 한 말(전사 일부) */
  wrong: string;
  /** 고친 문장(영어, 짧게) */
  better: string;
  /** 무엇을 왜 고쳤는지 한국어 한 줄 */
  kr: string;
}

export interface CafLiteResult {
  fix: CafFix | null;
  level: CafLevel;
}

/** 전사가 이보다 짧으면 부르지 않는다(평가할 게 없다 — 호출 아끼기) */
export const CAF_MIN_WORDS = 3;
/** 고친 문장 단어 수 상한 — 레벨이 낮을수록 짧게(따라 말하기 1회로 끝나야 한다) */
export const BETTER_MAX_WORDS: Record<string, number> = { A1: 8, A2: 12, B1: 16, B2: 20 };

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export function buildCafLiteMessages(transcript: string, opts: { level: string; learn?: string[]; recap?: string }): { role: string; content: string }[] {
  const max = BETTER_MAX_WORDS[opts.level] ?? 12;
  const sys = [
    '너는 한국인 영어 학습자의 말하기 코치다. 드라마 한 화를 영어로 다시 말한 전사(Whisper)를 받는다.',
    `1) 뜻이 통하지 않거나 오늘 표현을 잘못 쓴 오류 딱 1개만 고른다: wrong=전사에 실제로 있는 구절 그대로, better=고친 영어(${max}단어 이하), kr=무엇을 왜 고쳤는지 한국어 한 줄. 고칠 게 없으면 fix는 null.`,
    '2) 이 발화의 말하기 수준을 A1/A2/B1/B2 중 하나로 level에 쓴다(길이·문장 연결·문법 정확성 기준, 후하게 주지 말 것).',
    'JSON만: {"fix":{"wrong":"","better":"","kr":""}|null,"level":"A2"}',
  ].join('\n');
  const user = [`전사: ${transcript.trim().slice(0, 900)}`, opts.learn?.length ? `오늘 표현: ${opts.learn.join(' / ')}` : '', opts.recap ? `줄거리: ${opts.recap.slice(0, 200)}` : '']
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

/**
 * 응답 검증(순수) — 레벨이 없거나 이상하면 null(재시도 대상), fix.kr이 한국어가 아니면 null(한국어로 다시 묻기),
 * fix가 전사와 무관하거나 너무 길면 fix만 null로 두고 레벨은 살린다.
 */
export function pickCafLite(data: unknown, transcript: string, level = 'A2'): CafLiteResult | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const lv = typeof d.level === 'string' ? d.level.trim().toUpperCase() : '';
  if (!(CAF_LEVELS as readonly string[]).includes(lv)) return null;
  const f = d.fix;
  if (f == null || f === false) return { fix: null, level: lv as CafLevel };
  if (typeof f !== 'object' || Array.isArray(f)) return { fix: null, level: lv as CafLevel };
  const r = f as Record<string, unknown>;
  const wrong = typeof r.wrong === 'string' ? r.wrong.trim() : '';
  const better = typeof r.better === 'string' ? r.better.trim() : '';
  const kr = typeof r.kr === 'string' ? r.kr.trim() : '';
  if (!wrong || !better) return { fix: null, level: lv as CafLevel };
  // 설명이 영어면 한국어로 다시 묻는다(aiGuard 재시도)
  if (!hasHangul(kr)) return null;
  // 영어 칸에 한국어가 섞이면 못 쓴다
  if (hasHangul(wrong) || hasHangul(better)) return { fix: null, level: lv as CafLevel };
  const said = new Set(words(transcript));
  const w = words(wrong);
  const inSaid = w.filter((t) => said.has(t)).length;
  const bw = words(better);
  const same = w.join(' ') === bw.join(' ');
  const max = BETTER_MAX_WORDS[level] ?? 12;
  // wrong은 실제 전사여야 한다(절반 이상 일치) — 지어낸 교정은 버린다
  if (!w.length || inSaid / w.length < 0.5 || same || !bw.length || bw.length > max + 4 || kr.length > 120) return { fix: null, level: lv as CafLevel };
  return { fix: { wrong, better, kr }, level: lv as CafLevel };
}

/** AI 한 번(+한국어 재시도 1). 키 없음·짧은 전사·오류는 null — 절대 던지지 않는다 */
export async function cafLite(transcript: string, opts: { level: string; learn?: string[]; recap?: string }): Promise<CafLiteResult | null> {
  try {
    if (!groqKey()) return null;
    if (words(transcript).length < CAF_MIN_WORDS) return null;
    return await groqKoJson<CafLiteResult>(buildCafLiteMessages(transcript, opts), { temperature: 0.2, maxTokens: 300 }, (d) => pickCafLite(d, transcript, opts.level));
  } catch {
    return null;
  }
}

/**
 * 말하기 증거 점수(cefrGrowth 규칙: 과제 레벨 L에서 70↑ = 통과, 60~69 = 반) —
 * 과제 레벨은 이 화의 레벨. AI가 본 발화 수준이 과제 레벨보다 낮으면 리텔 점수가 높아도 통과로 치지 않는다
 * (NEAR_SCORE 미만으로 깎는다). 키워드만 나열해도 점수가 나는 리텔 채점을 레벨 증거로 그대로 쓰지 않기 위해.
 */
export function retellEvidenceScore(retellScore: number, taskLevel: string, aiLevel: CafLevel): number {
  const s = Math.max(0, Math.min(100, Math.round(Number.isFinite(retellScore) ? retellScore : 0)));
  const ti = CEFR_ORDER.indexOf(taskLevel as Cefr);
  const ai = CEFR_ORDER.indexOf(aiLevel);
  if (ti >= 0 && ai < ti) return Math.min(s, NEAR_SCORE - 1);
  return s;
}

/** 과제 레벨(화 레벨)을 Cefr로 — 이상하면 A2 */
export function taskCefr(level: string): Cefr {
  return (CEFR_ORDER as readonly string[]).includes(level) ? (level as Cefr) : 'A2';
}
