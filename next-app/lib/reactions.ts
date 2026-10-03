/**
 * 리액션 뱅크 — 회화 리액션 턴(인물 두 문장 사이 2초 창)에서 던지는 "짧은 한마디".
 *
 * 한국인 학습자는 상대가 말하는 동안 mhm / uh 같은 소리만 내고 영어 리액션을 거의
 * 쓰지 않는다. 원어민은 Okay / Really? / Oh no / Sorry? 같은 2~3단어로 듣고 있음을
 * 알리고 대화를 굴린다. 이 모듈은 그 한마디를 ① 뱅크(data/reactions.json 66개)로
 * 들고, ② 학습자 발화가 뱅크의 어느 항목인지 판정하며(matchReaction), ③ 상대 대사의
 * 성격(질문·나쁜 소식·좋은 소식·의견·긴 설명)에 맞는 기능(fn)을 규칙으로 고른다
 * (expectedFns). 전부 순수 함수 — AI 키 없이, 오프라인에서 돈다.
 *
 * 화면 배선은 M6 DramaTalkScreen/ReactionTurn에서 한다(여기엔 상태 저장 없음).
 */
import raw from '../data/reactions.json';

export type ReactionFn = 'ack' | 'surprise' | 'sympathy' | 'agree' | 'followup' | 'hedge' | 'close' | 'clarify';
export type ReactionLevel = 'A1' | 'A2';

export interface Reaction {
  id: string;
  fn: ReactionFn;
  /** 6단어 이하의 영어 한마디 */
  en: string;
  kr: string;
  /** 어떤 말 뒤에 쓰는지 한 줄(한국어) */
  when: string;
  level: ReactionLevel;
}

export const REACTION_FNS: ReactionFn[] = ['ack', 'surprise', 'sympathy', 'agree', 'followup', 'hedge', 'close', 'clarify'];

/** fn별 한국어 라벨 — 칩·결과 화면용 */
export const REACTION_FN_LABEL: Record<ReactionFn, string> = {
  ack: '알았어요',
  surprise: '놀람',
  sympathy: '공감',
  agree: '동의',
  followup: '되묻기',
  hedge: '시간 벌기',
  close: '마무리',
  clarify: '못 들었어요',
};

const FN_SET = new Set<string>(REACTION_FNS);

/** JSON을 타입 검사해 싣는다 — fn/level이 어긋난 항목은 조용히 버리지 않고 테스트에서 66개로 잡힌다 */
export const REACTIONS: Reaction[] = (raw as { items: Reaction[] }).items.filter(
  (r) => FN_SET.has(r.fn) && (r.level === 'A1' || r.level === 'A2') && typeof r.en === 'string' && r.en.length > 0,
);

export function reactionsFor(fn: ReactionFn, level?: ReactionLevel): Reaction[] {
  return REACTIONS.filter((r) => r.fn === fn && (!level || level === 'A2' || r.level === 'A1'));
}

/* ── 발화 정규화·매칭 ── */

/** 소문자·구두점 제거·공백 정리. 아포스트로피는 축약형 구분을 위해 유지한다(you're ≠ your) */
export function normalizeSaid(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** STT가 받아 적는 소리 — 이것만 있으면 리액션이 아니라 추임새 */
const BACKCHANNEL = new Set(['um', 'uh', 'mhm', 'mm', 'hmm', 'hm', 'er', 'erm', 'ah', 'eh', 'mmm', 'uh huh', 'uhhuh']);

/** 발화가 um/uh/mhm 같은 소리뿐인가(비어 있으면 false — "아무 말 안 함"은 따로 다룬다) */
export function isBackchannelOnly(said: string): boolean {
  const n = normalizeSaid(said);
  if (!n) return false;
  return n.split(' ').every((w) => BACKCHANNEL.has(w));
}

interface Phrase {
  r: Reaction;
  key: string;
  words: number;
}
/** 정규화한 뱅크 — 긴 구절부터 보게 정렬(“oh no way”에서 “no way”가 “oh no”보다 먼저) */
const PHRASES: Phrase[] = REACTIONS.map((r) => ({ r, key: normalizeSaid(r.en), words: normalizeSaid(r.en).split(' ').length })).sort(
  (a, b) => b.words - a.words || b.key.length - a.key.length,
);

/**
 * 발화가 뱅크의 어떤 항목인가. 정확히 같으면 그것, 아니면 발화 안에 통째로 들어 있는
 * 가장 긴 항목("um, really?" → Really? / "yeah right" → Right.). 없으면 null.
 * 한 단어짜리 항목(Okay/Sure/Right…)도 단어 경계로만 본다 — "surely"는 Sure가 아니다.
 */
export function matchReaction(said: string): { id: string; fn: ReactionFn } | null {
  const n = normalizeSaid(said);
  if (!n) return null;
  const exact = PHRASES.find((p) => p.key === n);
  if (exact) return { id: exact.r.id, fn: exact.r.fn };
  const padded = ` ${n} `;
  let best: Phrase | null = null;
  let bestPos = Infinity;
  for (const p of PHRASES) {
    const pos = padded.indexOf(` ${p.key} `);
    if (pos < 0) continue;
    // 정렬이 길이 우선이라 처음 걸린 길이보다 짧은 건 보지 않는다. 같은 길이면 앞에 나온 쪽.
    if (best && (p.words < best.words || p.key.length < best.key.length)) break;
    if (!best || pos < bestPos) {
      best = p;
      bestPos = pos;
    }
  }
  return best ? { id: best.r.id, fn: best.r.fn } : null;
}

/* ── 상대 대사 성격 → 어울리는 fn ── */

/** "good to see you"(인사)는 작별이 아니다 — to 뒤의 see you는 뺀다 */
const RE_FAREWELL = /\b(bye|goodbye|(?<!\bto\s)see you|talk to you later|take care|gotta go|have to go|have a (good|nice|great) (one|day|weekend|night))\b/;
const RE_BAD = /\b(sorry|problem|problems|trouble|delay|delayed|can't|cannot|couldn't|won't be able|missed|broke|broken|sick|cancel|canceled|cancelled|lost|failed|stuck|bad news|unfortunately|exhausted|tired|stressed|terrible|awful|hurt|crashed|down again)\b/;
const RE_GOOD = /\b(great news|good news|finally|done|finished|passed|won|promoted|promotion|awesome|amazing|excited|signed|closed the deal|got the job|birthday|celebrate|wonderful|fantastic|went well)\b/;
const RE_OPINION = /\b(i think|i guess|i feel|i believe|in my opinion|personally|should|we'd better|i'd say|honestly|to be honest|if you ask me)\b/;
const RE_QUESTION_START = /^(what|where|when|why|how|who|which|do|does|did|are|is|was|were|can|could|would|will|have|has|should|shall|any)\b/;

/**
 * 상대 대사에 어울리는 리액션 기능 2~3개. 규칙 우선순위: 작별 > 나쁜 소식 > 좋은 소식 >
 * 의견 > 질문 > 긴 설명 > 기본(ack·surprise·followup). 중복 없이 최대 3개, 항상 2개 이상.
 */
export function expectedFns(partnerLine: string): ReactionFn[] {
  const t = normalizeSaid(partnerLine);
  const raw = partnerLine.trim();
  const sentences = raw.split(/[.!?]+\s*/).filter((s) => s.trim().length > 0);
  const lastSentence = sentences[sentences.length - 1] ?? '';
  const isQuestion = /\?\s*$/.test(raw) || RE_QUESTION_START.test(normalizeSaid(lastSentence));
  const words = t ? t.split(' ').length : 0;
  const isLong = words >= 18 || sentences.length >= 3;

  const out: ReactionFn[] = [];
  const push = (...fns: ReactionFn[]) => {
    for (const f of fns) if (!out.includes(f)) out.push(f);
  };
  if (RE_FAREWELL.test(t)) push('close', 'ack');
  if (RE_BAD.test(t)) push('sympathy', 'clarify');
  if (RE_GOOD.test(t)) push('surprise', 'agree');
  if (RE_OPINION.test(t)) push('agree', 'ack');
  if (isQuestion) push('followup', 'ack');
  if (isLong) push('ack', 'clarify');
  if (out.length === 0) push('ack', 'surprise', 'followup');
  if (out.length < 2) push('ack', 'followup');
  return out.slice(0, 3);
}

/* ── 힌트 고르기 ── */

/** 문자열 → 작은 해시(결정적 variety용). 같은 대사면 같은 힌트 — 테스트·재생이 재현된다 */
function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** fn 하나에서 레벨에 맞는 항목 하나(seed로 돌려 뽑기). 없으면 null */
export function pickFor(fn: ReactionFn, level: ReactionLevel = 'A1', seed = 0): Reaction | null {
  const pool = reactionsFor(fn, level);
  if (pool.length === 0) return null;
  return pool[seed % pool.length];
}

/**
 * 상대 대사에 맞춰 보여 줄 리액션 힌트 n개(기본 3). expectedFns 순서대로 fn마다 하나씩,
 * 모자라면 같은 fn에서 다음 항목으로 채운다. A1이면 A1 항목만, A2면 전부.
 */
export function pickReactionHints(partnerLine: string, n = 3, level: ReactionLevel = 'A1'): Reaction[] {
  const fns = expectedFns(partnerLine);
  const seed = hashOf(partnerLine);
  const out: Reaction[] = [];
  const used = new Set<string>();
  for (let round = 0; out.length < n && round < 4; round++) {
    for (const fn of fns) {
      if (out.length >= n) break;
      const pool = reactionsFor(fn, level).filter((r) => !used.has(r.id));
      if (pool.length === 0) continue;
      const r = pool[(seed + round) % pool.length];
      used.add(r.id);
      out.push(r);
    }
  }
  return out;
}
