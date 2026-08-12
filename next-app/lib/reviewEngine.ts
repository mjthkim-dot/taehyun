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
import { PATTERN_STORIES, type PatternStory } from './patternStories';

/* ── ① 시도 로그 ── */

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
  /** 어느 훈련에서 나왔나 — session·drill·ladder·recall 등 */
  src?: string;
  /** 커리큘럼 패턴 연습이면 그 키 */
  patternKey?: string;
}

const LOG_KEY = 'va_attempt_log';
const LOG_MAX = 1000;

export function logAttempt(a: Attempt) {
  const log = load<Attempt[]>(LOG_KEY, []);
  log.push(a);
  // 상한 초과 시 오래된 것부터 절삭 — localStorage 용량을 지킨다
  store(LOG_KEY, log.length > LOG_MAX ? log.slice(log.length - LOG_MAX) : log);
}

export function getAttempts(): Attempt[] {
  return load<Attempt[]>(LOG_KEY, []);
}

export interface DayStat {
  /** YYYY-MM-DD */
  date: string;
  count: number;
  avgScore: number;
  /** 개시 지연 중앙값(ms) — 측정된 시도가 없으면 null */
  medianLatency: number | null;
}

function dayOf(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 최근 N일 일별 집계 — 시도가 있었던 날만 반환(오래된 날부터). */
export function attemptStats(days = 14): DayStat[] {
  const since = Date.now() - days * 86400000;
  const byDay = new Map<string, Attempt[]>();
  for (const a of getAttempts()) {
    if (a.t < since) continue;
    const d = dayOf(a.t);
    const arr = byDay.get(d);
    if (arr) arr.push(a);
    else byDay.set(d, [a]);
  }
  return [...byDay.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([date, arr]) => {
      const lats = arr.map((a) => a.latencyMs).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
      return {
        date,
        count: arr.length,
        avgScore: Math.round(arr.reduce((s, a) => s + a.score, 0) / arr.length),
        medianLatency: lats.length ? lats[Math.floor(lats.length / 2)] : null,
      };
    });
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
      const story = PATTERN_STORIES[p.key];
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
  const sentences = dueWeak()
    .filter((w) => w.en && w.en.trim())
    .sort((a, b) => (a.box || 0) - (b.box || 0))
    .slice(0, maxSentences)
    .map((w) => ({ en: w.en, kr: w.kr || '' }));
  return { sentences, recalls: duePatternRecalls(maxRecalls) };
}
