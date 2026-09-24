/**
 * 상황별 단어 엔진 — "단어를 최대한 많이, 여러 상황을 고려해서".
 *
 * 콘텐츠: data/wordBank.json(13개 상황 팩 449개, 단어마다 예문·뜻·레벨) +
 * domainVocab(직무 연어 61개)을 하나의 뱅크로 합치고, 모든 단어에 온톨로지의
 * 상황 id를 붙인다(학습 지도가 상황별 단어 숙련도를 읽는다). 뱅크가 바닥나면
 * 팩마다 AI가 이미 아는 단어를 빼고 20개씩 더 만든다 — 사실상 무제한.
 *
 * 학습 방식(많이 외우기 위한 설계):
 *   ① 간격 반복(Leitner 7상자: 당일·1·3·7·16·35·90일) — 잊기 직전에만 다시 본다
 *   ② 하루 신규 할당량(10/20/30/50) — 많이 외우되 복습이 폭발하지 않게
 *   ③ 상자가 오를수록 문제가 어려워진다 — 뜻 고르기 → 영어 고르기 → 예문 빈칸 → 듣고 뜻
 *   ④ 상황 인터리빙 — 고른 팩들을 번갈아 꺼내 같은 상황만 반복하지 않는다
 *   ⑤ 오답은 세션 안에서 3문제 뒤에 다시 — 틀린 채로 끝나지 않는다
 */
import bank from '../data/wordBank.json';
import { load, store } from './state';
import { todayKey } from './dates';
import { VOCAB_DOMAINS } from './domainVocab';
import { groqKoJson, hasHangul } from './aiGuard';
import { WORD_LOG_KEY, WORD_PROGRESS_KEY, wordLog, type WordDayLog } from './wordProgress';
import { overall } from './cefrGrowth';

export type WordLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface Word {
  id: string;
  w: string;
  pos: string;
  kr: string;
  lv: WordLevel;
  ex: string;
  exKr: string;
  pack: string;
  /** 온톨로지 상황 id */
  sit: string;
  /** AI가 추가한 단어 */
  ai?: boolean;
}

export interface WordPack {
  id: string;
  sit: string;
  name: string;
  icon: string;
  desc: string;
  words: Word[];
}

export interface WordState {
  /** Leitner 상자 0~6 */
  b: number;
  /** 다음 복습 시각(ms) */
  d: number;
  /** 누적 채점 수 */
  n: number;
  /** 누적 오답 */
  l: number;
  /** 처음 만난 날 */
  t: string;
}

export interface WordConfig {
  daily: number;
  /** 고른 팩(비면 전체) */
  packs: string[];
}

export const DAILY_CHOICES = [10, 20, 30, 50];
export const INTERVAL_DAYS = [0, 1, 3, 7, 16, 35, 90];
export const MASTER_BOX = 5;
const CFG_KEY = 'va_words_cfg';
const EXTRA_KEY = 'va_words_extra';
const LEVEL_ORDER: WordLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

type RawWord = [string, string, string, string, string, string];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function toWord(r: RawWord, pack: string, sit: string, ai = false): Word {
  const lv = (LEVEL_ORDER.includes(r[3] as WordLevel) ? r[3] : 'B1') as WordLevel;
  return { id: `${pack}:${slug(r[0])}`, w: r[0], pos: r[1], kr: r[2], lv, ex: r[4], exKr: r[5], pack, sit, ...(ai ? { ai } : {}) };
}

/** 직무 연어(domainVocab) → 상황 */
const DOMAIN_SIT: Record<string, string> = {
  finance: 'finops', legal: 'deal', hr: 'career', tech: 'support', 'ai-data': 'proposal/pitch', negotiation: 'deal/negotiation',
};

let cache: WordPack[] | null = null;
let cacheExtraSig = '';

function extraRaw(): Record<string, RawWord[]> {
  return load<Record<string, RawWord[]>>(EXTRA_KEY, {});
}

export function getPacks(): WordPack[] {
  const extra = extraRaw();
  const sig = Object.entries(extra).map(([k, v]) => `${k}${v.length}`).join('|');
  if (cache && sig === cacheExtraSig) return cache;
  // JSON 튜플은 string[][]로 추론된다 — 6칸 형식은 빌드 스크립트와 단위 테스트가 보증한다
  const packs: WordPack[] = (bank as unknown as { packs: { id: string; sit: string; name: string; icon: string; desc: string; words: RawWord[] }[] }).packs.map((p) => ({
    id: p.id, sit: p.sit, name: p.name, icon: p.icon, desc: p.desc,
    words: p.words.map((r) => toWord(r, p.id, p.sit)),
  }));
  for (const d of VOCAB_DOMAINS) {
    const id = `dv-${d.key}`;
    packs.push({
      id, sit: DOMAIN_SIT[d.key] || 'meeting', name: `직무 연어 · ${d.label}`, icon: '🗂', desc: d.desc,
      words: d.entries.map((e) => toWord([e.term, 'phr', e.kr, e.level, e.example.en, e.example.kr], id, DOMAIN_SIT[d.key] || 'meeting')),
    });
  }
  for (const p of packs) {
    const add = extra[p.id] || [];
    const have = new Set(p.words.map((w) => w.w.toLowerCase()));
    for (const r of add) if (!have.has(r[0].toLowerCase())) { p.words.push(toWord(r, p.id, p.sit, true)); have.add(r[0].toLowerCase()); }
  }
  cache = packs;
  cacheExtraSig = sig;
  return packs;
}

export function allWords(): Word[] {
  return getPacks().flatMap((p) => p.words);
}

export function wordById(id: string): Word | undefined {
  return allWords().find((w) => w.id === id);
}

export function totalWords(): number {
  return allWords().length;
}

/* ── 설정·상태 ── */

export function wordConfig(): WordConfig {
  const c = load<WordConfig>(CFG_KEY, { daily: 20, packs: [] });
  return { daily: DAILY_CHOICES.includes(c.daily) ? c.daily : 20, packs: Array.isArray(c.packs) ? c.packs : [] };
}

export function setWordConfig(c: Partial<WordConfig>) {
  store(CFG_KEY, { ...wordConfig(), ...c });
}

export function progress(): Record<string, WordState> {
  return load<Record<string, WordState>>(WORD_PROGRESS_KEY, {});
}

function logDay(delta: Partial<WordDayLog>) {
  const log = wordLog();
  const k = todayKey();
  const cur = log[k] || { new: 0, rev: 0, ok: 0 };
  log[k] = { new: cur.new + (delta.new || 0), rev: cur.rev + (delta.rev || 0), ok: cur.ok + (delta.ok || 0) };
  const keys = Object.keys(log).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - 90))) delete log[old];
  store(WORD_LOG_KEY, log);
}

export function dueAt(box: number, now = Date.now()): number {
  return now + (INTERVAL_DAYS[Math.min(box, INTERVAL_DAYS.length - 1)] || 0) * 86400000;
}

/**
 * 채점 — 맞으면 상자 +1, 틀리면 1로(내일 다시). 처음 만난 단어는 신규로 기록.
 * 같은 세션 안에서 같은 단어를 두 번째로 채점하면(오답 재출제) 상자는 움직이지
 * 않는다 — 한 세션에서 두 칸 올라가는 부풀리기를 막는다.
 */
export function gradeWord(id: string, correct: boolean, opts: { retry?: boolean } = {}): WordState {
  const all = progress();
  const cur = all[id];
  const isNew = !cur;
  const s: WordState = cur ? { ...cur } : { b: 0, d: 0, n: 0, l: 0, t: todayKey() };
  s.n += 1;
  if (!opts.retry) {
    if (correct) s.b = Math.min(s.b + 1, INTERVAL_DAYS.length - 1);
    else {
      s.b = 1;
      s.l += 1;
    }
    s.d = dueAt(s.b);
  }
  all[id] = s;
  store(WORD_PROGRESS_KEY, all);
  if (!opts.retry) logDay({ new: isNew ? 1 : 0, rev: isNew ? 0 : 1, ok: correct ? 1 : 0 });
  return s;
}

/* ── 오늘의 큐 ── */

export interface QueueItem {
  word: Word;
  kind: 'learn' | 'review';
}

function selectedPacks(): WordPack[] {
  const { packs } = wordConfig();
  const all = getPacks();
  const sel = packs.length ? all.filter((p) => packs.includes(p.id)) : all;
  return sel.length ? sel : all;
}

/** CEFR 목표 레벨(종합 다음 레벨) — 단어도 i+1로 고른다 */
function targetWordLevel(): WordLevel {
  try {
    const t = overall().next as string;
    return (LEVEL_ORDER.includes(t as WordLevel) ? t : 'C1') as WordLevel;
  } catch {
    return 'B1';
  }
}

/** 목표 레벨에서의 거리 — 목표 → 한 단계 아래 → 더 아래 → 위 순서 */
export function levelRank(lv: WordLevel, target: WordLevel): number {
  const d = LEVEL_ORDER.indexOf(lv) - LEVEL_ORDER.indexOf(target);
  if (d === 0) return 0;
  if (d === -1) return 1;
  if (d < -1) return 1 - d;
  return 5 + d;
}

/**
 * 오늘 새로 배울 단어 — 고른 팩을 번갈아(상황 인터리빙), 팩 안에선 **CEFR 목표 레벨
 * 단어부터**(i+1). 너무 어려운 단어로 할당량을 채우지도, 이미 쉬운 단어만 돌지도 않게.
 */
export function nextNewWords(n: number, target: WordLevel = targetWordLevel()): Word[] {
  if (n <= 0) return [];
  const prog = progress();
  const lanes = selectedPacks().map((p) =>
    p.words.filter((w) => !prog[w.id]).sort((a, b) => levelRank(a.lv, target) - levelRank(b.lv, target))
  );
  const out: Word[] = [];
  let i = 0;
  while (out.length < n && lanes.some((l) => l.length)) {
    const lane = lanes[i % lanes.length];
    const w = lane.shift();
    if (w) out.push(w);
    i++;
  }
  return out;
}

export function dueWords(now = Date.now(), max = 200): Word[] {
  const prog = progress();
  const byId = new Map(allWords().map((w) => [w.id, w]));
  return Object.entries(prog)
    .filter(([, s]) => s.d <= now)
    .sort((a, b) => a[1].d - b[1].d)
    .map(([id]) => byId.get(id))
    .filter((w): w is Word => !!w)
    .slice(0, max);
}

/** 오늘 남은 신규 할당량 */
export function newQuotaLeft(): number {
  return Math.max(0, wordConfig().daily - (wordLog()[todayKey()]?.new || 0));
}

/** 오늘의 세션 — 복습 먼저(잊기 직전인 것부터), 그다음 신규 */
export function todayQueue(maxReview = 60): QueueItem[] {
  const due = dueWords(Date.now(), maxReview).map((word) => ({ word, kind: 'review' as const }));
  const fresh = nextNewWords(newQuotaLeft()).map((word) => ({ word, kind: 'learn' as const }));
  return [...due, ...fresh];
}

/* ── 문제 ── */

export type QuizKind = 'meaning' | 'reverse' | 'cloze' | 'listen';

export interface Quiz {
  kind: QuizKind;
  word: Word;
  /** 화면에 보일 질문 */
  prompt: string;
  /** 보조(예문 번역 등) */
  sub?: string;
  options: string[];
  answer: number;
}

/** 상자가 오를수록 어렵게 */
export function quizKindFor(box: number, seed = 0): QuizKind {
  if (box <= 1) return 'meaning';
  if (box === 2) return seed % 2 ? 'reverse' : 'meaning';
  if (box === 3) return seed % 2 ? 'cloze' : 'reverse';
  return (['cloze', 'listen', 'reverse'] as QuizKind[])[seed % 3];
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 오답 보기 — 같은 팩·같은 품사 우선(헷갈릴 만한 것끼리), 모자라면 전체에서 */
function distractors(word: Word, field: 'kr' | 'w', seed: number): string[] {
  const pool = allWords().filter((w) => w.id !== word.id && w[field] !== word[field]);
  const same = pool.filter((w) => w.pack === word.pack && w.pos === word.pos);
  const pack = pool.filter((w) => w.pack === word.pack);
  const picks: string[] = [];
  for (const src of [same, pack, pool]) {
    for (const w of shuffle(src, seed + picks.length * 7)) {
      if (picks.length >= 3) break;
      if (!picks.includes(w[field])) picks.push(w[field]);
    }
    if (picks.length >= 3) break;
  }
  return picks;
}

/** 예문에서 표제어를 빈칸으로 — 활용형(-s, -ed, -ing)까지 잡는다 */
export function clozeOf(word: Word): string | null {
  const head = word.w.split(/\s+/)[0].replace(/[^A-Za-z-]/g, '');
  if (!head) return null;
  const full = new RegExp(`\\b${word.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'i');
  if (full.test(word.ex)) return word.ex.replace(full, '_____');
  const stem = head.length > 4 ? head.slice(0, head.length - 1) : head;
  const re = new RegExp(`\\b${stem}\\w*`, 'i');
  return re.test(word.ex) ? word.ex.replace(re, '_____') : null;
}

export function makeQuiz(word: Word, kind: QuizKind, seed = Date.now() % 1000): Quiz {
  let k = kind;
  const cloze = k === 'cloze' ? clozeOf(word) : null;
  if (k === 'cloze' && !cloze) k = 'reverse';
  const field: 'kr' | 'w' = k === 'meaning' || k === 'listen' ? 'kr' : 'w';
  const correct = word[field];
  const opts = shuffle([correct, ...distractors(word, field, seed)], seed);
  const prompt = k === 'meaning' ? word.w : k === 'reverse' ? word.kr : k === 'cloze' ? (cloze as string) : '🔊 듣고 뜻을 고르세요';
  const sub = k === 'cloze' ? word.exKr : k === 'meaning' ? word.pos : undefined;
  return { kind: k, word, prompt, sub, options: opts, answer: opts.indexOf(correct) };
}

/* ── 통계 ── */

export interface WordStats {
  total: number;
  seen: number;
  mastered: number;
  learning: number;
  due: number;
  today: WordDayLog;
  /** 단어를 공부한 연속 일수 */
  streak: number;
  /** 최근 7일 정답률(%) */
  accuracy7: number | null;
  /** 내일 복습 예정 */
  dueTomorrow: number;
}

export function wordStats(): WordStats {
  const prog = progress();
  const ids = new Set(allWords().map((w) => w.id));
  const entries = Object.entries(prog).filter(([id]) => ids.has(id));
  const now = Date.now();
  const log = wordLog();
  let streak = 0;
  const d = new Date();
  if (!log[todayKey(d)]) d.setDate(d.getDate() - 1);
  while (log[todayKey(d)]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  let tot = 0;
  let ok = 0;
  for (let i = 0; i < 7; i++) {
    const x = new Date();
    x.setDate(x.getDate() - i);
    const l = log[todayKey(x)];
    if (l) {
      tot += l.new + l.rev;
      ok += l.ok;
    }
  }
  const endTomorrow = new Date();
  endTomorrow.setHours(23, 59, 59, 999);
  endTomorrow.setDate(endTomorrow.getDate() + 1);
  return {
    total: ids.size,
    seen: entries.length,
    mastered: entries.filter(([, s]) => s.b >= MASTER_BOX).length,
    learning: entries.filter(([, s]) => s.b < MASTER_BOX).length,
    due: entries.filter(([, s]) => s.d <= now).length,
    today: log[todayKey()] || { new: 0, rev: 0, ok: 0 },
    streak,
    accuracy7: tot ? Math.round((ok / tot) * 100) : null,
    dueTomorrow: entries.filter(([, s]) => s.d > now && s.d <= endTomorrow.getTime()).length,
  };
}

export interface PackStat {
  seen: number;
  mastered: number;
  total: number;
}

export function packStats(p: WordPack): PackStat {
  const prog = progress();
  const seen = p.words.filter((w) => prog[w.id]);
  return { seen: seen.length, mastered: seen.filter((w) => prog[w.id].b >= MASTER_BOX).length, total: p.words.length };
}

/** 상황(온톨로지 id, 최상위 포함)별 단어 숙련 — 학습 지도가 쓴다 */
export function wordStatsBySituation(rootOf: (id: string) => string): Record<string, PackStat> {
  const prog = progress();
  const out: Record<string, PackStat> = {};
  for (const w of allWords()) {
    for (const key of new Set([w.sit, rootOf(w.sit)])) {
      const s = (out[key] ||= { seen: 0, mastered: 0, total: 0 });
      s.total++;
      if (prog[w.id]) {
        s.seen++;
        if (prog[w.id].b >= MASTER_BOX) s.mastered++;
      }
    }
  }
  return out;
}

/* ── AI로 팩 늘리기 ── */

export async function generateMoreWords(packId: string, n = 20): Promise<number> {
  const p = getPacks().find((x) => x.id === packId);
  if (!p) return 0;
  const known = p.words.map((w) => w.w).slice(-120).join(', ');
  const sys = `너는 한국인 IT 클라우드 영업 담당자(메가존클라우드 AM)를 위한 영어 단어장 편집자다.
상황: "${p.name}" — ${p.desc}
이 상황에서 실제로 자주 쓰는 영어 단어·연어·구동사 ${n}개를 골라라. 이미 있는 단어는 제외: ${known}
규칙: 원어민이 실제 업무에서 쓰는 것, 너무 쉬운 기초어(the, good 등) 제외, B1~C1 위주.
JSON만 출력: {"words":[{"w":"영어 표제어","pos":"v|n|adj|adv|phr","kr":"한국어 뜻(짧게)","lv":"B1|B2|C1","ex":"이 상황의 자연스러운 영어 예문","exKr":"예문의 한국어 번역"}]}`;
  const list = await groqKoJson<RawWord[]>(
    [
      { role: 'system', content: sys },
      { role: 'user', content: `${n}개 만들어줘.` },
    ],
    { temperature: 0.7, maxTokens: 1200 },
    (data) => {
      const arr = (data as { words?: unknown })?.words;
      if (!Array.isArray(arr)) return null;
      const rows = arr
        .map((x) => x as Record<string, unknown>)
        .filter((x) => typeof x.w === 'string' && typeof x.ex === 'string' && hasHangul(x.kr) && hasHangul(x.exKr) && /[a-z]/i.test(String(x.w)))
        .map((x) => [String(x.w).trim(), String(x.pos || 'phr'), String(x.kr).trim(), String(x.lv || 'B2'), String(x.ex).trim(), String(x.exKr).trim()] as RawWord);
      return rows.length ? rows : null;
    }
  );
  if (!list) return 0;
  const have = new Set(p.words.map((w) => w.w.toLowerCase()));
  const fresh = list.filter((r) => !have.has(r[0].toLowerCase()));
  const extra = extraRaw();
  extra[packId] = [...(extra[packId] || []), ...fresh].slice(-400);
  store(EXTRA_KEY, extra);
  cache = null;
  return fresh.length;
}
