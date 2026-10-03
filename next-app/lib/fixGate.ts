/**
 * 회화 탭 교정 게이트·리액션 턴의 순수 로직(M6) — 화면(components/dtalk/*)에서 분리해 단위 테스트한다.
 *
 * ① 교정→다시 말하기 게이트(recast & retry): AI(또는 L1 규칙)가 고친 문장(better)을 인물 목소리로 듣고
 *    한 번 따라 말한다. alignedScore ≥ 60이면 통과. **딱 1회** — 실패해도 대화는 넘어가고, better는
 *    회상 큐(addWeakItem cat '드라마', dueDays 1)에 들어가 내일 '말로 떠올리기'로 다시 나온다.
 *    60점·1회는 판정단 합의(비평 (7)-5): 두 번 이상 붙잡으면 5턴 대화가 교정 수업이 된다.
 * ② 리액션 턴: 3번째 턴 전 인물이 근황 두 문장을 말하는 사이 2.0초 창에 짧은 한마디.
 *    뱅크(lib/reactions.ts) 매칭이면 ✓, clarify(Sorry? / Say that again?)면 인물이 0.8×로 첫 문장을 다시 말한다.
 *    um/uh/mhm만이면 팁(강제 아님), 아무 말 없거나 뱅크 밖이면 무벌점.
 * ③ 지표 — 턴 반응 지연(인물 TTS 끝 → 내 첫 유성), WPM, 필러 수, 날짜별 va_dtalk_stats(60일).
 * AI 호출·오디오·DOM 없음. state.ts의 load/store/addWeakItem만 쓴다.
 */
import { alignedScore } from './align';
import { addWeakItem, load, store } from './state';
import { isBackchannelOnly, matchReaction, normalizeSaid, REACTIONS, type ReactionFn } from './reactions';
import { FILLER_RE, countWords } from './fluency';
import { recordMistake, type MistakeType } from './transfer';
import type { L1Hit } from './l1Grammar';

/* ── ① 교정 게이트 ── */

/** 따라 말하기 통과 점수(역할극 ROLE_PASS와 같은 60) */
export const FIX_PASS = 60;
/** 게이트 시도 횟수 — 1회(실패해도 통과) */
export const FIX_TRIES = 1;

export interface TalkFix {
  better: string;
  kr: string;
  why: string;
  /** 학습자가 실제로 한 틀린 구절(선택) */
  wrong?: string;
  /** 오류 유형(transfer.MistakeType 문자열, 선택) */
  type?: string;
  /** AI가 아니라 L1 규칙(lib/l1Grammar)이 만든 교정인가 */
  rule?: boolean;
}

export interface GateResult {
  /** 0~100. 녹음을 못 했으면 null(넘어감) */
  score: number | null;
  passed: boolean;
  /** 마이크 없음 등으로 시도하지 않고 넘겼나 */
  skipped: boolean;
}

/** 따라 말한 결과 판정 — 60점 경계 포함(≥60 통과) */
export function gateVerdict(better: string, said: string): { score: number; passed: boolean } {
  const score = said.trim() ? alignedScore(better, said).score : 0;
  return { score, passed: score >= FIX_PASS };
}

/** 이미 한 번 시도했으면 더는 녹음하지 않는다(게이트 사유 — 무음·에코·바쁨 — 은 시도로 세지 않는다) */
export function canTryGate(tries: number): boolean {
  return tries < FIX_TRIES;
}

/**
 * 게이트 끝 처리 — 통과 못 했으면(실패·건너뜀) better를 회상 큐로. 뜻(kr)이 없으면 '영어로는?' 문제가 안 되므로 넣지 않는다.
 * 돌려주는 값: 'passed' | 'queued'(회상에 넣음) | 'none'(넣을 수 없음)
 */
export function settleGate(fix: Pick<TalkFix, 'better' | 'kr'>, r: Pick<GateResult, 'passed'>, epNo: number): 'passed' | 'queued' | 'none' {
  if (r.passed) return 'passed';
  if (!fix.better.trim() || !/[가-힣]/.test(fix.kr || '')) return 'none';
  addWeakItem({ en: fix.better, kr: fix.kr, cat: '드라마', lesson: `drama:${epNo}` }, 1);
  return 'queued';
}

/** 종료 화면 칩 — '교정 재발화 N/M'(시도한 게이트 중 통과 수 / 게이트 수) */
export function gateTallyLabel(passed: number, total: number): string {
  return `교정 재발화 ${passed}/${total}`;
}

/* ── L1 규칙 교정 → fix 카드 ── */

/** 규칙 id → 오류 유형(transfer). 콩글리시는 단어 선택, 전치사 짝은 전치사, 나머지는 기타 */
export function mistakeTypeForL1(hit: Pick<L1Hit, 'id' | 'kind'>): MistakeType {
  if (hit.kind === 'konglish') return 'word-choice';
  if (hit.id === 'prep-choice') return 'preposition';
  return 'other';
}

/** AI fix가 없을 때 L1 규칙으로 교정을 만든다(뜻 kr은 비어 있다 — 규칙은 문장 뜻을 모른다) */
export function fixFromL1(hit: L1Hit): TalkFix {
  return { better: hit.better, kr: '', why: hit.kr, wrong: hit.wrong, type: mistakeTypeForL1(hit), rule: true };
}

/** L1 간섭을 오류 기록으로(교정 축적 — 약점 카드) */
export function recordL1(said: string, hit: L1Hit, now = Date.now()): void {
  recordMistake({ wrong: said, right: hit.better, note: hit.kr, t: now, type: mistakeTypeForL1(hit) });
}

/* ── ② 리액션 턴 ── */

/** 리액션 창 길이 — 2.0초(비평 (7)-4) */
export const REACTION_WINDOW_MS = 2000;
/**
 * 첫 문장이 끝난 뒤 녹음을 여는 지연. 명세는 '+1.5초'였지만 2초 창 앞에 1.5초를 더 두면 공백이 3.5초가 되어
 * 리액션이 아니라 대답이 된다. 스피커 누출은 echo 게이트(lastTtsText)가 막으므로 짧게 둔다.
 */
export const REACTION_LEAD_MS = 300;
/** clarify 때 인물이 다시 말하는 속도 배율 */
export const CLARIFY_RATE = 0.8;

export type ReactionVerdict =
  | { kind: 'match'; id: string; fn: ReactionFn; en: string; clarify: boolean }
  | { kind: 'backchannel' }
  | { kind: 'miss' }
  | { kind: 'empty' };

/** 리액션 판정 — 뱅크 매칭 > um/uh만 > 그 밖(무벌점) */
export function judgeReaction(said: string): ReactionVerdict {
  const t = (said || '').trim();
  if (!normalizeSaid(t)) return { kind: 'empty' };
  const m = matchReaction(t);
  if (m) {
    const r = REACTIONS.find((x) => x.id === m.id);
    return { kind: 'match', id: m.id, fn: m.fn, en: r?.en || t, clarify: m.fn === 'clarify' };
  }
  if (isBackchannelOnly(t)) return { kind: 'backchannel' };
  return { kind: 'miss' };
}

/** 문장 나누기(마침표·물음표·느낌표 + 공백). 약어(Mr. Grant)는 붙여 둔다 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?]+(?:[.!?]+|$)/g;
  let buf = '';
  for (const m of text.match(re) || []) {
    buf += m;
    if (/\b(Mr|Mrs|Ms|Dr|St)\.\s*$/.test(buf.trim())) continue;
    if (buf.trim()) out.push(buf.trim());
    buf = '';
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** 리액션 턴용으로 대사를 [첫 문장, 나머지]로. 두 문장이 안 되면 null */
export function splitForReaction(reply: string): { first: string; rest: string } | null {
  const ss = splitSentences(reply);
  if (ss.length < 2) return null;
  return { first: ss[0], rest: ss.slice(1).join(' ') };
}

/**
 * 이 인물 대사에서 리액션 턴을 열까 — 3번째 내 턴 직전(내가 2번 말한 뒤)에만, 하루 대화당 1회.
 * AI가 reaction:true를 주면 두 문장이기만 하면 열고, 깜빡했으면 첫 문장이 4단어 이상인 두 문장일 때만 연다
 * ("Great. Tell me more." 같은 짧은 맞장구 + 질문은 리액션 자리가 아니다).
 */
export function shouldReactionTurn(o: { enabled: boolean; myTurns: number; reply: string; reaction?: boolean; done: boolean }): boolean {
  if (!o.enabled || o.done || o.myTurns !== 2) return false;
  const sp = splitForReaction(o.reply);
  if (!sp) return false;
  if (o.reaction) return true;
  return countWords(sp.first) >= 4;
}

/** um/uh만 말했을 때 팁(강제 아님) */
export const BACKCHANNEL_TIP = 'mhm·uh 대신 “Okay.” “Really?”처럼 말로 받아 보세요';

/* ── ③ 지표 ── */

/**
 * 턴 반응 지연(ms) — 인물 말이 끝난 뒤 내가 입을 뗄 때까지.
 * = (녹음 시작 − 인물 TTS 끝) + 녹음 안 첫 유성(voiceOnsetMs). 인물 TTS 끝을 모르면 voiceOnsetMs만.
 */
export function turnLatencyMs(o: { partnerEndAt?: number | null; recStartAt: number; voiceOnsetMs?: number }): number | undefined {
  if (o.voiceOnsetMs == null || !Number.isFinite(o.voiceOnsetMs)) return undefined;
  const lead = o.partnerEndAt && o.recStartAt >= o.partnerEndAt ? o.recStartAt - o.partnerEndAt : 0;
  // 인물 말을 다 듣고 한참 딴짓한 경우(1분+)는 반응 지연이 아니다
  if (lead > 60_000) return Math.round(o.voiceOnsetMs);
  return Math.round(lead + o.voiceOnsetMs);
}

/** '⏱ 1.8초' */
export function latencyLabel(ms: number): string {
  return `⏱ ${(Math.round(ms / 100) / 10).toFixed(1)}초`;
}

export function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

/** 녹음 길이에서 개시 지연을 뺀 말한 시간으로 WPM(1초 미만이면 재지 않는다) */
export function wpmOf(said: string, durationMs?: number, voiceOnsetMs = 0): number | undefined {
  if (!durationMs) return undefined;
  const speak = durationMs - Math.max(0, voiceOnsetMs || 0);
  if (speak < 1000) return undefined;
  const w = countWords(said);
  return w ? Math.round((w / speak) * 60000) : undefined;
}

export function fillerCount(said: string): number {
  return (said.match(new RegExp(FILLER_RE.source, 'gi')) || []).length;
}

/** 사다리 날 — 화·금(그 외 날은 CAF-lite 증거) */
export function isLadderDay(d: Date = new Date()): boolean {
  const w = d.getDay();
  return w === 2 || w === 5;
}

/** 사다리 시드 — 내가 한 영어 문장 중 가장 긴 것(3단어 미만이면 없음) */
export function longestSentence(said: string[]): string | null {
  let best = '';
  for (const s of said) if (countWords(s) > countWords(best)) best = s.trim();
  return countWords(best) >= 3 ? best : null;
}

/** 사다리 단 통과 점수 */
export const LADDER_PASS = 80;

/**
 * CAF-lite 결과를 말하기 증거 점수로(cefrGrowth 규칙: 70↑ 통과, 60~69 반) —
 * AI가 본 수준이 과제(화) 레벨 이상이면 75, 한 단계 아래면 60, 그보다 아래면 40.
 */
export function dtalkEvidenceScore(taskLevel: string, aiLevel: string): number {
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const t = order.indexOf(taskLevel);
  const a = order.indexOf(aiLevel);
  if (t < 0 || a < 0) return 40;
  if (a >= t) return 75;
  if (a === t - 1) return 60;
  return 40;
}

/* ── 날짜별 회화 통계(va_dtalk_stats, 60일) ── */

export interface DtalkDayStat {
  turns: number;
  latencyMed: number | null;
  fixPass: number;
  fixTotal: number;
  reactions: number;
  reactionsUnique: string[];
  clarify: number;
  fillers: number;
  koTurns: number;
}

const STATS_KEY = 'va_dtalk_stats';
export const STATS_DAYS = 60;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dtalkStats(): Record<string, DtalkDayStat> {
  const s = load<Record<string, DtalkDayStat>>(STATS_KEY, {});
  return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
}

/** 대화 한 번을 오늘 통계에 더한다(같은 날 여러 번이면 합산, 지연 중앙값은 이번 값으로 갱신) */
export function saveDtalkStats(add: Omit<DtalkDayStat, 'reactionsUnique'> & { reactionIds: string[] }, now = new Date()): DtalkDayStat {
  const all = dtalkStats();
  const k = dayKey(now);
  const prev = all[k];
  const ids = new Set([...(prev?.reactionsUnique || []), ...add.reactionIds]);
  const next: DtalkDayStat = {
    turns: (prev?.turns || 0) + add.turns,
    latencyMed: add.latencyMed ?? prev?.latencyMed ?? null,
    fixPass: (prev?.fixPass || 0) + add.fixPass,
    fixTotal: (prev?.fixTotal || 0) + add.fixTotal,
    reactions: (prev?.reactions || 0) + add.reactions,
    reactionsUnique: [...ids],
    clarify: (prev?.clarify || 0) + add.clarify,
    fillers: (prev?.fillers || 0) + add.fillers,
    koTurns: (prev?.koTurns || 0) + add.koTurns,
  };
  all[k] = next;
  const cut = dayKey(new Date(now.getTime() - STATS_DAYS * 86400000));
  for (const d of Object.keys(all)) if (d < cut) delete all[d];
  store(STATS_KEY, all);
  return next;
}
