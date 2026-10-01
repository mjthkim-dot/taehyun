/**
 * 복습 엔진 — 앱의 학습 기록을 한 곳에서 다루는 계층 (PLAN.md D1·D2).
 *
 * ① 시도 로그(va_attempt_log): 말하기 채점이 일어날 때마다 append-only로 남는
 *    문장별 학습 이력. 추이 대시보드·자동화(개시 지연) 분석·항목별 난이도가
 *    전부 여기서 파생된다. 기존 키(va_weak 등)는 한 바이트도 건드리지 않는다 —
 *    데이터 유실 위험을 구조적으로 0으로 만드는 설계.
 * ② 패턴 SRS(va_pattern_srs): 커리큘럼 패턴을 한 번 정착시키고 끝내지 않고
 *    D+1/D+3/D+7…에 실전 리콜로 재소환한다. 간격표는 문장 SRS와 동일한 것을
 *    재사용한다(새 파라미터를 발명하지 않는다).
 */
import { load, store, srsDue, SRS_MAX_BOX, dueWeak } from './state';
import { donePatterns, STAGE_PATTERNS, type NativePattern } from './maturity';
import { storiesNow } from './storyData';
import type { PatternStory } from './patternStories';

/* ── ① 시도 로그 ── */

/** 시도의 출처 — 열린 union(모듈이 새 출처를 더해도 타입이 통과한다) */
export type AttemptSrc =
  | 'session' | 'drill' | 'ladder' | 'recall'
  | 'drama' | 'shadow' | 'retell' | 'dtalk' | 'words' | 'sound' | 'pron' | 'baseline' | 'monthly' | 'daily-q'
  | (string & {});

/**
 * 게이트 사유 — 채점까지 가지 못한 시도도 남긴다(n=1 환경에서 '왜 안 됐나'를 세기 위해, 비평 (5)-3).
 *   silent(소리 없음) · unclear(알아듣지 못함) · echo(직전 TTS 누출 ≥80% 일치) · busy(STT 한도·바쁨)
 */
export type AttemptQuality = 'ok' | 'silent' | 'unclear' | 'echo' | 'busy';

export interface Attempt {
  /** epoch ms */
  t: number;
  /** 연습한 문장 */
  en: string;
  /** 0~100 */
  score: number;
  /** 발화 개시 지연(ms) — 측정 가능했던 시도에만 존재 */
  latencyMs?: number;
  /** 녹음 길이(ms) */
  durationMs?: number;
  /** 어느 훈련에서 나왔나 — session·drill·ladder·recall·drama·shadow·retell… */
  src?: AttemptSrc;
  /** 커리큘럼 패턴 연습이면 그 키 */
  patternKey?: string;
  /** 분당 단어 수(유창성) */
  wpm?: number;
  /** 멈춤 횟수(≥0.5초) */
  pauseCount?: number;
  /** 절 경계가 아닌 곳의 멈춤 수(리듬 지표) */
  clausePauses?: number;
  /** 게이트 사유 — 없으면 'ok' */
  quality?: AttemptQuality;
  /** 학습자가 채점에 이의를 제기했나(결과 카드 길게 누르기) */
  disputed?: boolean;
}

const LOG_KEY = 'va_attempt_log';
/** 원문 로그 상한 — 넘치면 오래된 날부터 일별 집계(va_attempt_daily)로 접은 뒤 지운다 */
export const LOG_MAX = 3000;
const DAILY_KEY = 'va_attempt_daily';
/** 일별 집계 보존 일수(EVICTABLE 밖 — 로그가 지워져도 추이는 남는다) */
export const DAILY_DAYS = 180;
/** 통과 기준(채점 PASS와 같은 70) */
const PASS = 70;

export const GATE_KEYS = ['silent', 'unclear', 'echo', 'busy'] as const;
export type GateKey = (typeof GATE_KEYS)[number];

/** 하루치 집계 — 지표(회수율·유창성·청크 노출·게이트 사유)의 원천 */
export interface DailyAgg {
  /** 시도 수(게이트된 것 포함) */
  n: number;
  /** 70점 이상(quality ok만) */
  passed: number;
  /** 개시 지연 중앙값(ms) — 없으면 null */
  latencyMed: number | null;
  /** WPM 중앙값 — 없으면 null */
  wpmMed: number | null;
  /** 출처별 시도 수 */
  bySrc: Record<string, number>;
  /** 청크 노출 = 그날 말해 본 서로 다른 문장 수(비평 (5)-5의 정의) */
  exposed: number;
  gate: Record<GateKey, number>;
  /** 평균 점수(quality ok만) — 추이 대시보드가 쓴다(명세 모양에 더한 보조 필드) */
  scoreAvg: number | null;
}

const isGated = (a: Attempt) => !!a.quality && a.quality !== 'ok';

function medianOf(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** 시도 목록 → 하루치 집계(순수 함수) */
export function aggregateAttempts(atts: Attempt[]): DailyAgg {
  const scored = atts.filter((a) => !isGated(a));
  const bySrc: Record<string, number> = {};
  const gate: Record<GateKey, number> = { silent: 0, unclear: 0, echo: 0, busy: 0 };
  const ens = new Set<string>();
  for (const a of atts) {
    const src = a.src || 'other';
    bySrc[src] = (bySrc[src] || 0) + 1;
    if (isGated(a) && (GATE_KEYS as readonly string[]).includes(a.quality as string)) gate[a.quality as GateKey]++;
    if (!isGated(a) && a.en) ens.add(a.en.trim().toLowerCase());
  }
  return {
    n: atts.length,
    passed: scored.filter((a) => a.score >= PASS).length,
    latencyMed: medianOf(scored.map((a) => a.latencyMs).filter((v): v is number => typeof v === 'number')),
    wpmMed: medianOf(scored.map((a) => a.wpm).filter((v): v is number => typeof v === 'number')),
    bySrc,
    exposed: ens.size,
    gate,
    scoreAvg: scored.length ? Math.round(scored.reduce((s, a) => s + a.score, 0) / scored.length) : null,
  };
}

/** 두 집계를 합친다 — 중앙값은 원문이 없으니 n 가중 평균으로 근사(추이용으로 충분하다) */
export function mergeAgg(a: DailyAgg | undefined, b: DailyAgg): DailyAgg {
  if (!a) return b;
  const wmean = (x: number | null, nx: number, y: number | null, ny: number) =>
    x == null ? y : y == null ? x : Math.round((x * nx + y * ny) / Math.max(1, nx + ny));
  const bySrc = { ...a.bySrc };
  for (const [k, v] of Object.entries(b.bySrc)) bySrc[k] = (bySrc[k] || 0) + v;
  const gate = { ...a.gate };
  for (const k of GATE_KEYS) gate[k] = (gate[k] || 0) + (b.gate[k] || 0);
  return {
    n: a.n + b.n,
    passed: a.passed + b.passed,
    latencyMed: wmean(a.latencyMed, a.n, b.latencyMed, b.n),
    wpmMed: wmean(a.wpmMed, a.n, b.wpmMed, b.n),
    bySrc,
    exposed: a.exposed + b.exposed, // 같은 문장이 양쪽에 있으면 중복 — 접기는 하루 단위라 드물다
    gate,
    scoreAvg: wmean(a.scoreAvg, a.n, b.scoreAvg, b.n),
  };
}

export function dayOf(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 저장된 일별 집계(모양이 어긋난 날은 건너뛴다) */
export function attemptDaily(): Record<string, DailyAgg> {
  const raw = load<Record<string, unknown>>(DAILY_KEY, {});
  const out: Record<string, DailyAgg> = {};
  for (const [d, v] of Object.entries(raw)) {
    if (!isObj(v) || typeof v.n !== 'number') continue;
    const g = isObj(v.gate) ? v.gate : {};
    out[d] = {
      n: v.n,
      passed: typeof v.passed === 'number' ? v.passed : 0,
      latencyMed: typeof v.latencyMed === 'number' ? v.latencyMed : null,
      wpmMed: typeof v.wpmMed === 'number' ? v.wpmMed : null,
      bySrc: isObj(v.bySrc) ? (v.bySrc as Record<string, number>) : {},
      exposed: typeof v.exposed === 'number' ? v.exposed : 0,
      gate: { silent: Number(g.silent) || 0, unclear: Number(g.unclear) || 0, echo: Number(g.echo) || 0, busy: Number(g.busy) || 0 },
      scoreAvg: typeof v.scoreAvg === 'number' ? v.scoreAvg : null,
    };
  }
  return out;
}

function saveDaily(daily: Record<string, DailyAgg>) {
  const keys = Object.keys(daily).sort();
  if (keys.length > DAILY_DAYS) for (const k of keys.slice(0, keys.length - DAILY_DAYS)) delete daily[k];
  store(DAILY_KEY, daily);
}

/**
 * 상한 초과분을 오래된 날부터 집계로 접는다(순수 함수) — 로그는 시간순이라 앞에서부터 한 날씩.
 * 하루를 통째로 접어야 그날 집계가 두 번 만들어지지 않는다(접힌 날의 시도는 로그에 남지 않는다).
 */
export function foldOverflow(log: Attempt[], daily: Record<string, DailyAgg>, max = LOG_MAX): { log: Attempt[]; daily: Record<string, DailyAgg>; folded: number } {
  let folded = 0;
  while (log.length > max) {
    const day = dayOf(log[0].t);
    let k = 0;
    while (k < log.length && dayOf(log[k].t) === day) k++;
    daily[day] = mergeAgg(daily[day], aggregateAttempts(log.slice(0, k)));
    log = log.slice(k);
    folded += k;
  }
  return { log, daily, folded };
}

export function logAttempt(a: Attempt) {
  let log = load<Attempt[]>(LOG_KEY, []);
  log.push(a);
  if (log.length > LOG_MAX) {
    const r = foldOverflow(log, attemptDaily());
    log = r.log;
    saveDaily(r.daily);
  }
  store(LOG_KEY, log);
}

export function getAttempts(): Attempt[] {
  return load<Attempt[]>(LOG_KEY, []).filter((a) => !!a && typeof a === 'object' && typeof a.t === 'number' && typeof a.score === 'number');
}

export interface DayStat {
  /** YYYY-MM-DD */
  date: string;
  count: number;
  avgScore: number;
  /** 개시 지연 중앙값(ms) — 측정된 시도가 없으면 null */
  medianLatency: number | null;
}

/** 최근 N일 일별 집계 — 접힌 집계(va_attempt_daily)와 남은 로그를 합쳐 계산. 시도가 있었던 날만(오래된 날부터). */
export function attemptStats(days = 14): DayStat[] {
  return dailyStats(days).map(({ date, agg }) => ({
    date,
    count: agg.n,
    avgScore: agg.scoreAvg ?? 0,
    medianLatency: agg.latencyMed,
  }));
}

/** 최근 N일의 날짜별 DailyAgg(집계 + 로그 합산) — 회수율·유창성·노출 지표가 쓴다 */
export function dailyStats(days = 14): { date: string; agg: DailyAgg }[] {
  const since = Date.now() - days * 86400000;
  const fromDay = dayOf(since);
  const byDay = new Map<string, Attempt[]>();
  for (const a of getAttempts()) {
    if (a.t < since) continue;
    const d = dayOf(a.t);
    const arr = byDay.get(d);
    if (arr) arr.push(a);
    else byDay.set(d, [a]);
  }
  const merged: Record<string, DailyAgg> = {};
  for (const [d, agg] of Object.entries(attemptDaily())) if (d >= fromDay) merged[d] = agg;
  for (const [d, arr] of byDay) merged[d] = mergeAgg(merged[d], aggregateAttempts(arr));
  return Object.keys(merged)
    .sort()
    .map((date) => ({ date, agg: merged[date] }));
}

/** 중앙값 — 지연 통계의 기본 집계(평균은 이상치에 휘둘린다) */
function median(arr: number[]): number {
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export interface LatencyGoal {
  /** 목표(ms) — 기준 기간 중앙값의 -20% */
  goalMs: number;
  /** 이번 주 중앙값(ms) — 이번 주 시도가 없으면 null */
  currentMs: number | null;
  met: boolean;
}

/**
 * 입 트임 본인 기준 목표 — 지연 데이터가 3주 이상 쌓였을 때만,
 * "지난 기간(7~35일 전) 중앙값의 -20%"를 목표로 제시한다.
 * 절대 기준(남과 비교)은 계속 금지 — 기준은 언제나 과거의 나다.
 */
export function latencyGoal(): LatencyGoal | null {
  const atts = getAttempts().filter((a) => typeof a.latencyMs === 'number');
  if (atts.length < 20) return null;
  const now = Date.now();
  const spanDays = (now - atts[0].t) / 86400000;
  if (spanDays < 21) return null;
  const baseline = atts.filter((a) => a.t < now - 7 * 86400000 && a.t >= now - 35 * 86400000).map((a) => a.latencyMs!);
  if (baseline.length < 10) return null;
  const recent = atts.filter((a) => a.t >= now - 7 * 86400000).map((a) => a.latencyMs!);
  const goalMs = Math.round(median(baseline) * 0.8);
  const currentMs = recent.length ? median(recent) : null;
  return { goalMs, currentMs, met: currentMs != null && currentMs <= goalMs };
}

/* ── ② 패턴 SRS ── */

interface PatternSrsItem {
  key: string;
  box: number;
  due: number;
}

const PSRS_KEY = 'va_pattern_srs';

function loadPsrs(): PatternSrsItem[] {
  return load<PatternSrsItem[]>(PSRS_KEY, []);
}

/**
 * 시드 마이그레이션(멱등) — 이번 업데이트 이전에 정착된 패턴들을 내일 복습으로
 * 등록한다. 원본(va_maturity_patterns)은 그대로 둔다(성숙도 승급이 계속 읽는다).
 * 새로 정착되는 패턴도 같은 경로로 자연히 등록된다.
 */
export function seedPatternSrs() {
  const psrs = loadPsrs();
  const known = new Set(psrs.map((p) => p.key));
  let changed = false;
  for (const key of donePatterns()) {
    if (known.has(key)) continue;
    psrs.push({ key, box: 1, due: srsDue(1) });
    changed = true;
  }
  if (changed) store(PSRS_KEY, psrs);
}

/** 리콜 채점 — 80점↑이면 간격이 늘고, 미만이면 줄어든다. 시도 없이 건너뛰면 호출하지 않는다(내일 다시). */
export function gradePatternRecall(key: string, score: number) {
  const psrs = loadPsrs();
  const p = psrs.find((x) => x.key === key);
  if (!p) return;
  p.box = score >= 80 ? Math.min(p.box + 1, SRS_MAX_BOX) : Math.max(0, p.box - 1);
  p.due = srsDue(p.box);
  store(PSRS_KEY, psrs);
}

function patternByKey(key: string): NativePattern | null {
  for (const list of Object.values(STAGE_PATTERNS)) {
    const hit = list.find((p) => p.key === key);
    if (hit) return hit;
  }
  return null;
}

export interface PatternRecall {
  pattern: NativePattern;
  story: PatternStory;
}

/** 오늘 재소환할 패턴 리콜(최대 max개) — 스토리가 있는 것만(리콜 지문이 필요하다). */
export function duePatternRecalls(max = 1): PatternRecall[] {
  seedPatternSrs();
  const now = Date.now();
  return loadPsrs()
    .filter((p) => p.due <= now)
    .sort((a, b) => a.due - b.due)
    .map((p) => {
      const pattern = patternByKey(p.key);
      const story = storiesNow()[p.key];
      return pattern && story ? { pattern, story } : null;
    })
    .filter((x): x is PatternRecall => x !== null)
    .slice(0, max);
}

/* ── ③ 통합 복습 큐 — 세션 워밍업이 쓴다 ── */

export interface DueReviews {
  /** 문장 SRS(va_weak)에서 오늘 복습할 것 */
  sentences: { en: string; kr: string }[];
  /** 패턴 실전 리콜 */
  recalls: PatternRecall[];
}

export function dueReviews(maxSentences = 2, maxRecalls = 1): DueReviews {
  const all = dueWeak()
    .filter((w) => w.en && w.en.trim())
    .sort((a, b) => (a.box || 0) - (b.box || 0));
  // 밀린 문장이 많을 때 항상 같은 첫 2개만 뜨지 않게 — 날짜 시드로 시작
  // 위치를 돌린다(같은 날엔 안정, 다음 날엔 다른 조합). 우선순위(box 낮은
  // 순)는 정렬로 이미 반영돼 있어, 회전은 "그중 어디부터"만 바꾼다.
  const d = new Date();
  const daySeed = Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`);
  const start = all.length > maxSentences ? daySeed % all.length : 0;
  const rotated = [...all.slice(start), ...all.slice(0, start)];
  const sentences = rotated.slice(0, maxSentences).map((w) => ({ en: w.en, kr: w.kr || '' }));
  return { sentences, recalls: duePatternRecalls(maxRecalls) };
}
