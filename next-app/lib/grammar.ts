/**
 * 문법 시뮬레이션 — "구조만 바뀌고 내용은 같다, 문법적 사고를 학습할 수 없다"에 대한 답.
 *
 * 레벨(A1~C1)마다 문법 포인트를 **그 문법이 꼭 필요한 실제 업무 상황**에 넣었다.
 * 한 유닛은 5단계로 사고를 만든다:
 *   ① 사고 — 한국어는 어떻게 생각하고, 영어는 왜 다르게 생각하는가(형태가 아니라 이유)
 *   ② 판단 — 이 상황엔 어느 형태인가 + 왜(3문항)
 *   ③ 조립 — 단어 조각으로 문장을 직접 세운다(헷갈리는 오답 조각 포함, 2문항)
 *   ④ 시뮬레이션 — 상대 역할과 4턴 대화: 고르기 → 조립 → 고르기 → 자유 작문(AI 채점)
 *   ⑤ 결과 — 점수와 틀린 이유
 * 콘텐츠는 data/grammarSims.json(18유닛). 진행은 va_grammar.
 */
import raw from '../data/grammarSims.json';
import { load, store, groqKey } from './state';
import { todayKey } from './dates';
import { CEFR_ORDER, type Cefr } from './cefr';
import { groqKoJson, hasHangul } from './aiGuard';

export interface GExample {
  0: string;
  1: string;
}
export interface GCheck {
  q: string;
  opts: string[];
  a: number;
  why: string;
}
export interface GBuild {
  kr: string;
  a: string;
  extra?: string[];
}
export type GTurn =
  | { them: string; kr: string; task: 'choose'; opts: string[]; a: number; why: string }
  | { them: string; kr: string; task: 'build'; a: string; extra?: string[]; why: string }
  | { them: string; kr: string; task: 'free'; prompt: string; model: string; focus: string };

export interface GrammarUnit {
  id: string;
  level: Cefr;
  title: string;
  point: string;
  sit: string;
  scene: string;
  think: { q: string; ko: string; en: string; rule: string; ex: [string, string][] };
  checks: GCheck[];
  builds: GBuild[];
  sim: { who: string; turns: GTurn[] };
}

export const GRAMMAR_UNITS: GrammarUnit[] = (raw as unknown as { units: GrammarUnit[] }).units;
export const GRAMMAR_LEVELS: Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export function grammarUnit(id: string): GrammarUnit | undefined {
  return GRAMMAR_UNITS.find((u) => u.id === id);
}

export function unitsAt(level: Cefr): GrammarUnit[] {
  return GRAMMAR_UNITS.filter((u) => u.level === level);
}

/* ── 진행 ── */

const KEY = 'va_grammar';
export const MASTER_SCORE = 80;

export interface GrammarProgress {
  /** 최고 점수 0~100 */
  best: number;
  /** 마지막 완주일 */
  at: string;
  /** 완주 횟수 */
  n: number;
}

export function grammarProgress(): Record<string, GrammarProgress> {
  return load<Record<string, GrammarProgress>>(KEY, {});
}

export function recordGrammar(id: string, score: number): GrammarProgress {
  const all = grammarProgress();
  const cur = all[id];
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const next: GrammarProgress = { best: Math.max(cur?.best ?? 0, s), at: todayKey(), n: (cur?.n ?? 0) + 1 };
  all[id] = next;
  store(KEY, all);
  return next;
}

export function grammarDoneToday(): boolean {
  const t = todayKey();
  return Object.values(grammarProgress()).some((p) => p.at === t);
}

/**
 * 오늘의 문법 — 현재 레벨의 아직 못 끝낸(80점 미만) 유닛부터, 다 끝내면 다음 레벨로.
 * 배치고사로 현재 레벨이 입증됐으니 아래 레벨은 맨 마지막(복습용)에 둔다.
 * 전부 마스터했으면 점수가 가장 낮은 유닛을 복습.
 */
export function pickTodayGrammar(current: Cefr): GrammarUnit {
  const prog = grammarProgress();
  const ci = Math.max(0, GRAMMAR_LEVELS.indexOf(current === 'C2' ? 'C1' : current));
  const order = [...GRAMMAR_LEVELS.slice(ci), ...GRAMMAR_LEVELS.slice(0, ci).reverse()];
  for (const lv of order) {
    const next = unitsAt(lv).find((u) => (prog[u.id]?.best ?? 0) < MASTER_SCORE);
    if (next) return next;
  }
  return GRAMMAR_UNITS.slice().sort((a, b) => (prog[a.id]?.best ?? 0) - (prog[b.id]?.best ?? 0))[0];
}

export interface LevelGrammarStat {
  level: Cefr;
  total: number;
  done: number;
  mastered: number;
}

export function grammarStats(): LevelGrammarStat[] {
  const prog = grammarProgress();
  return GRAMMAR_LEVELS.map((level) => {
    const us = unitsAt(level);
    return {
      level,
      total: us.length,
      done: us.filter((u) => prog[u.id]).length,
      mastered: us.filter((u) => (prog[u.id]?.best ?? 0) >= MASTER_SCORE).length,
    };
  });
}

/* ── 조립 문제 ── */

export function tokensOf(b: { a: string; extra?: string[] }, seed = 7): string[] {
  const toks = [...b.a.split(/\s+/), ...(b.extra || [])];
  // 결정적 셔플 — 정답 순서 그대로 나오지 않게
  let s = seed;
  for (let i = toks.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [toks[i], toks[j]] = [toks[j], toks[i]];
  }
  if (toks.join(' ') === b.a) toks.push(toks.shift() as string);
  return toks;
}

export function normSentence(s: string): string {
  return s.toLowerCase().replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim();
}

export function shuffledOptions(opts: string[], answer: number, seed: number): { opts: string[]; a: number } {
  const idx = opts.map((_, i) => i);
  let s = seed + 3;
  for (let i = idx.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { opts: idx.map((i) => opts[i]), a: idx.indexOf(answer) };
}

/* ── 자유 작문 AI 채점 ── */

export interface FreeGrade {
  ok: boolean;
  corrected: string;
  why: string;
}

export async function gradeFree(unit: GrammarUnit, turn: Extract<GTurn, { task: 'free' }>, answer: string): Promise<FreeGrade | null> {
  if (!groqKey() || !answer.trim()) return null;
  const sys = `너는 한국인 비즈니스 영어 학습자의 문법 코치다. 목표 문법: ${turn.focus} (${unit.point}).
상황: ${unit.scene} 상대의 말: "${turn.them}" 과제: ${turn.prompt}
학습자 답을 평가하라. 목표 문법을 올바르게 썼고 상황에 맞으면 ok=true. 사소한 철자는 봐준다.
JSON만: {"ok": true|false, "corrected": "자연스럽게 고친 영어 문장(맞았으면 다듬은 버전)", "why": "한국어 1~2문장 — 목표 문법 관점에서 무엇이 맞고/틀렸는지"}`;
  return groqKoJson<FreeGrade>(
    [
      { role: 'system', content: sys },
      { role: 'user', content: answer.trim().slice(0, 600) },
    ],
    { temperature: 0.2, maxTokens: 300 },
    (d) => {
      const x = d as Partial<FreeGrade> | null;
      if (!x || typeof x.ok !== 'boolean' || typeof x.corrected !== 'string' || !hasHangul(x.why)) return null;
      return { ok: x.ok, corrected: x.corrected, why: String(x.why) };
    }
  );
}

export function levelIndex(l: Cefr): number {
  return CEFR_ORDER.indexOf(l);
}
