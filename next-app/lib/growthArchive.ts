/**
 * 성장 아카이브(M10) — 기준선·월간 1분·D+7 녹음을 "비교할 수 있게" 묶는 계층.
 *
 * 녹음 저장 규칙(상한·종류별 보존)은 M1 lib/storage.ts에 있고, 여기는 그 위에서
 *   ① 기준선 확정(전사 → WPM → speakingAdj → 말하기 배치 사전값 ±1단계) — 키 없으면 Blob만 두고 pending,
 *      키 등록 시점(ApiKeyScreen 저장 성공 후)에 저장 Blob을 1회 재전사해 사후 보정
 *   ② 월간 1분 기록(va_growth.monthly)과 '이해가능성'(프롬프트 없이·temperature 0 재전사가 채점 전사를 얼마나 회수했나)
 *   ③ '2주 전 나 vs 오늘'(같은 문장 드라마 녹음 중 가장 오래된 것 vs 최신) 고르기
 *   ④ D+1·D+4·D+7 쌍(va_growth.d7Pair)·주간 목표(va_growth.weeklyGoalH)
 * 만 한다. va_growth의 time 필드는 lib/timeBudget.ts 소유 — 여기서는 다른 필드만 필드 단위로 갱신한다.
 *
 * 원고(dramaSeed)·drama.ts를 import하지 않는다(배치 화면·키 등록 화면 청크에 원고가 딸려 오지 않게).
 */
import { load, store, groqKey } from './state';
import { todayKey, daysBetween } from './dates';
import { CEFR_ORDER, type Cefr } from './cefr';
import { registerFlag, isOn } from './flags';
import { syncCefr } from './cefrGrowth';
import type { SkillKey } from './state';
import { logAttempt } from './reviewEngine';
import { wordsToMetrics, countWords, type FluencyWord } from './fluency';
import { transcribe, STT_PROPER_NOUNS, whisperAvailable, micAvailable } from './stt';
import { listRecordings, type Recording, type RecordingMeta } from './storage';
import { baseline, saveBaseline, speakingAdj, monthlyDue, MONTHLY_QUESTIONS, PLACEMENT_QUESTIONS, type Baseline, type MonthlyQuestion } from './baseline';

// 되돌리기 플래그 — 진도 '말하기' 섹션의 월간 카드·엔딩 D+7 카드를 끌 수 있다(기준선 녹음은 배치 단계라 늘 켠다)
registerFlag('growth', '말하기 성장 아카이브(월간 1분·D+7 비교)', true);

/* ───────── va_growth(필드 단위 갱신) ───────── */

export interface MonthlyEntry {
  /** YYYY-MM-DD */
  date: string;
  /** 녹음 id(M1 storage) — 저장 실패면 없음 */
  id?: string;
  /** MONTHLY_QUESTIONS id */
  qid: MonthlyQuestion['id'];
  durationMs: number;
  wpm?: number;
  /** 300ms 이상 멈춤 수 */
  longPauses?: number;
  fillers?: number;
  words?: number;
  /** 0~100 — 프롬프트 없이 재전사한 단어가 채점 전사를 얼마나 회수했나 */
  intelligibility?: number;
  /** 키 없이 녹음만 */
  keyless?: boolean;
}

export interface D7Pair {
  en: string;
  d1Id?: string;
  d4Id?: string;
  d7Id?: string;
}

export const WEEKLY_GOAL_HOURS = [7, 10, 14] as const;
export type WeeklyGoalH = (typeof WEEKLY_GOAL_HOURS)[number];

interface GrowthRaw {
  monthly?: unknown;
  weeklyGoalH?: unknown;
  d7Pair?: unknown;
  [k: string]: unknown;
}

const KEY = 'va_growth';

function raw(): GrowthRaw {
  const g = load<GrowthRaw>(KEY, {});
  return g && typeof g === 'object' && !Array.isArray(g) ? g : {};
}

/** 한 필드만 바꾸고 나머지(time 등 다른 모듈 필드)는 그대로 둔다 */
function patch(fields: GrowthRaw) {
  store(KEY, { ...raw(), ...fields });
}

const isEntry = (e: unknown): e is MonthlyEntry =>
  !!e && typeof e === 'object' && typeof (e as MonthlyEntry).date === 'string' && typeof (e as MonthlyEntry).durationMs === 'number';

/** 월간 기록(오래된 것 → 최신) */
export function monthlyEntries(): MonthlyEntry[] {
  const m = raw().monthly;
  return (Array.isArray(m) ? m.filter(isEntry) : []).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** 월간 기록 추가 — 같은 달 기록이 있으면 갈아 끼운다(한 달에 하나) */
export function addMonthly(e: MonthlyEntry) {
  const month = e.date.slice(0, 7);
  const list = monthlyEntries().filter((x) => x.date.slice(0, 7) !== month);
  list.push(e);
  // 5년치면 충분하다 — 녹음 Blob은 storage가 따로 지킨다
  patch({ monthly: list.slice(-60) });
}

export function lastMonthly(): MonthlyEntry | null {
  const l = monthlyEntries();
  return l.length ? l[l.length - 1] : null;
}

/** 진도 말하기 섹션 맨 위 월간 카드를 띄울 때인가(플래그 growth) */
export function monthlyCardDue(dateKey: string = todayKey()): boolean {
  if (!isOn('growth')) return false;
  return monthlyDue(dateKey, lastMonthly()?.date ?? null);
}

/** 이달의 질문 — 3개를 달마다 돌린다(같은 질문은 석 달마다 다시 온다) */
export function monthlyQuestionFor(dateKey: string = todayKey()): MonthlyQuestion {
  const [y, m] = dateKey.split('-').map(Number);
  const i = ((y * 12 + (m - 1)) % MONTHLY_QUESTIONS.length + MONTHLY_QUESTIONS.length) % MONTHLY_QUESTIONS.length;
  return MONTHLY_QUESTIONS[Number.isFinite(i) ? i : 0];
}

/**
 * 이번 기록과 비교할 이전 기록 — 같은 질문을 했던 가장 최근 달이 있으면 그것(같은 질문이어야 진짜 비교),
 * 없으면 바로 지난 기록. 둘 다 없으면 null.
 */
export function compareTarget(cur: Pick<MonthlyEntry, 'date' | 'qid'>, list: MonthlyEntry[] = monthlyEntries()): { prev: MonthlyEntry; sameQuestion: boolean } | null {
  const before = list.filter((e) => e.date < cur.date);
  if (!before.length) return null;
  const same = [...before].reverse().find((e) => e.qid === cur.qid);
  return same ? { prev: same, sameQuestion: true } : { prev: before[before.length - 1], sameQuestion: false };
}

export function weeklyGoalH(): WeeklyGoalH {
  const v = raw().weeklyGoalH;
  return (WEEKLY_GOAL_HOURS as readonly number[]).includes(v as number) ? (v as WeeklyGoalH) : 7;
}

export function setWeeklyGoalH(h: WeeklyGoalH) {
  if ((WEEKLY_GOAL_HOURS as readonly number[]).includes(h)) patch({ weeklyGoalH: h });
}

export function d7Pair(): D7Pair | null {
  const p = raw().d7Pair as D7Pair | undefined;
  return p && typeof p === 'object' && typeof p.en === 'string' ? p : null;
}

/** D+1·D+4·D+7 중 한 칸을 채운다 */
export function setD7Recording(stage: 1 | 4 | 7, en: string, id: string) {
  const cur = d7Pair();
  const base: D7Pair = cur && cur.en === en ? cur : { en };
  patch({ d7Pair: { ...base, [`d${stage}Id`]: id } });
}

/** 녹음 경로 — 키 있음(전사) / 녹음만(키 없음) / 마이크 없음 */
export function recPath(): 'whisper' | 'record' | 'none' {
  try {
    if (whisperAvailable()) return 'whisper';
    return micAvailable() ? 'record' : 'none';
  } catch {
    return 'none';
  }
}

/* ───────── 순수 지표 ───────── */

/** 영어 토큰(소문자, 아포스트로피 유지) */
export function tokens(text: string): string[] {
  return (String(text || '').toLowerCase().match(/[a-z']+/g) || []).map((t) => t.replace(/^'+|'+$/g, '')).filter(Boolean);
}

/**
 * 이해가능성 0~100 — 프롬프트 없이 받아 적은 전사(plain)가 채점 전사(scored)의 단어를 몇 % 회수했나(중복 수 반영).
 * 프롬프트·문맥 도움 없이도 같은 말로 들리면 '누가 들어도 알아듣는 말'에 가깝다. 채점 전사가 비면 null.
 */
export function intelligibilityOf(scored: string, plain: string): number | null {
  const a = tokens(scored);
  if (!a.length) return null;
  const bag = new Map<string, number>();
  for (const t of tokens(plain)) bag.set(t, (bag.get(t) || 0) + 1);
  let hit = 0;
  for (const t of a) {
    const n = bag.get(t) || 0;
    if (n > 0) {
      hit++;
      bag.set(t, n - 1);
    }
  }
  return Math.round((hit / a.length) * 100);
}

/** 문장 수 — A1 기준선 '15초 안 3문장'이 됐는지 */
export function sentenceCount(text: string): number {
  return String(text || '')
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => countWords(s) >= 2).length;
}

/**
 * 발성 비율 0~1 — 키 없을 때 유일한 말하기 지표(레벨 감지 기반).
 * (길이 − 첫 소리까지 − 1초 이상 멈춤 합) ÷ 길이. 레벨 감지가 안 된 기기(onset 없음)는 null.
 */
export function voicedRatio(durationMs: number, onsetMs: number | undefined, pauses: number[] = []): number | null {
  if (!(durationMs > 0) || typeof onsetMs !== 'number') return null;
  const silent = Math.max(0, onsetMs) + pauses.reduce((s, p) => s + (p > 0 ? p : 0), 0);
  return Math.round(Math.max(0, Math.min(1, (durationMs - silent) / durationMs)) * 100) / 100;
}

/** 기준선 점수 — 시도 로그(src 'baseline'·'monthly')용. WPM을 0~100으로(100 WPM이면 만점) */
export function wpmScore(wpm: number): number {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(wpm) ? wpm : 0)));
}

/**
 * '2주 전 나 vs 오늘' — 같은 문장(en)을 2번 이상 녹음한 드라마 녹음 중, 가장 오래된 것과 최신 것의 간격이 가장 큰 쌍.
 * 간격이 같으면 최신 녹음이 더 최근인 쪽. 없으면 null.
 */
export function compareSameSentence<T extends RecordingMeta>(recs: T[]): { en: string; old: T; cur: T; days: number } | null {
  const byEn = new Map<string, T[]>();
  for (const r of recs) {
    if (r.kind !== 'drama' || !r.en) continue;
    const k = r.en.trim();
    const arr = byEn.get(k);
    if (arr) arr.push(r);
    else byEn.set(k, [r]);
  }
  let best: { en: string; old: T; cur: T; days: number } | null = null;
  for (const [en, arr] of byEn) {
    if (arr.length < 2) continue;
    const s = [...arr].sort((a, b) => a.at - b.at);
    const old = s[0];
    const cur = s[s.length - 1];
    const days = Math.max(0, daysBetween(old.date, cur.date));
    if (!best || days > best.days || (days === best.days && cur.at > best.cur.at)) best = { en, old, cur, days };
  }
  return best;
}

/* ───────── 기준선 확정·사후 보정 ───────── */

/**
 * 한 기능의 배치 사전값만 바꾼다(va_placed.skills[skill]) — cefrGrowth.placementPrior(skill)가 읽는다.
 * 홈 첫 청크(CefrHero → cefrGrowth) 예산 때문에 쓰기 쪽은 이 파일에 둔다. 배치 기록이 없으면 아무것도 하지 않는다.
 */
export function setSkillPrior(skill: SkillKey, level: Cefr): boolean {
  const p = load<Record<string, unknown> | null>('va_placed', null);
  if (!p || typeof p !== 'object' || !CEFR_ORDER.includes(level)) return false;
  const skills = p.skills && typeof p.skills === 'object' ? (p.skills as Record<string, Cefr>) : {};
  store('va_placed', { ...p, skills: { ...skills, [skill]: level } });
  syncCefr();
  return true;
}

export interface BaselineMetrics {
  wpm: number;
  transcript: string;
  words?: number;
}

/**
 * 기준선 확정(순수) — 전사 지표를 담고 speakingAdj로 보정값을 정한다. pendingRetranscribe는 내린다.
 * 반환의 speaking = 보정 뒤 말하기 레벨(CEFR_ORDER 범위 안).
 */
export function finalizeBaselineData(b: Baseline, m: BaselineMetrics): { b: Baseline; speaking: Cefr } {
  const next: Baseline = { ...b, wpm: Math.round(m.wpm), transcript: m.transcript, pendingRetranscribe: false };
  const adj = speakingAdj(next);
  next.adj = adj;
  const i = Math.max(0, Math.min(CEFR_ORDER.length - 1, CEFR_ORDER.indexOf(b.level) + adj));
  return { b: next, speaking: CEFR_ORDER[i] };
}

/** 기준선 확정 + 저장 + 말하기 배치 사전값 보정 + 시도 로그(src 'baseline') */
export function finalizeBaseline(b: Baseline, m: BaselineMetrics): { b: Baseline; speaking: Cefr } {
  const r = finalizeBaselineData(b, m);
  saveBaseline(r.b);
  if (r.b.adj) setSkillPrior('speaking', r.speaking);
  const q = PLACEMENT_QUESTIONS.find((x) => (b.level === 'A1' ? x.level === 'A1' : x.level === 'A2+')) || PLACEMENT_QUESTIONS[0];
  logAttempt({ t: Date.now(), en: q.en, score: wpmScore(m.wpm), src: 'baseline', durationMs: b.durationMs, wpm: Math.round(m.wpm), quality: 'ok' });
  return r;
}

/** 단어 타임스탬프 → 지표(전사 없는 단어 배열이면 WPM 0) */
export function metricsFromWords(words: FluencyWord[] | undefined, text: string, durationMs: number): BaselineMetrics {
  const n = words?.length || countWords(text);
  const wpm = words?.length ? wordsToMetrics(words, undefined, durationMs).wpm : durationMs > 0 ? (n / durationMs) * 60000 : 0;
  return { wpm, transcript: text, words: n };
}

export interface RetranscribeDeps {
  hasKey?: () => boolean;
  find?: (id: string) => Promise<Recording | null>;
  stt?: typeof transcribe;
}

async function findRecording(id: string): Promise<Recording | null> {
  const all = await listRecordings('baseline');
  return all.find((r) => r.id === id) || all[0] || null;
}

/**
 * 키 등록 시점 1회 재전사 — 키 없이 저장된 기준선(pendingRetranscribe)의 Blob을 다시 받아써 사후 보정한다.
 * 할 일이 없거나(기준선 없음·이미 함·키 없음·녹음 없음) 실패하면 null. 실패하면 pending을 남겨 다음 키 저장 때 다시 해 본다.
 */
export async function retranscribePendingBaseline(deps: RetranscribeDeps = {}): Promise<{ b: Baseline; speaking: Cefr } | null> {
  const b = baseline();
  if (!b || !b.pendingRetranscribe) return null;
  const hasKey = deps.hasKey ?? (() => !!groqKey());
  if (!hasKey()) return null;
  try {
    const rec = b.recordingId ? await (deps.find ?? findRecording)(b.recordingId) : null;
    if (!rec || !rec.blob) return null;
    const out = await (deps.stt ?? transcribe)(rec.blob, { prompt: STT_PROPER_NOUNS, language: 'en', detail: 'words', temperature: 0 });
    if (out.reason === 'busy' || !out.text) return null;
    const durationMs = b.durationMs || rec.durationMs || 0;
    return finalizeBaseline(b, metricsFromWords(out.words, out.text, durationMs));
  } catch {
    return null;
  }
}

/**
 * 월간 '이해가능성' 재전사 — 프롬프트 없이(문맥 힌트 0), temperature 0(같은 소리에 같은 전사)으로 한 번 더 받아 적는다.
 * 실패하면 null(숫자 비교만 남는다).
 */
export async function retranscribePlain(blob: Blob, stt: typeof transcribe = transcribe): Promise<string | null> {
  try {
    const out = await stt(blob, { language: 'en', temperature: 0 });
    return out.reason === 'busy' ? null : out.text || '';
  } catch {
    return null;
  }
}
