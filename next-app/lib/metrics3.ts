/**
 * 말하기 지표 3축(M10) — 회수율 · 유창성 · 청크 사용률 (+ 따로 떼어 둔 '이해가능성').
 *
 * 왜 이렇게 나눴나(비평 (5)-6):
 *   · 회수율 = 채점 전사가 목표 문장의 단어를 얼마나 회수했나(시도 로그 score 평균). Whisper에 목표 문장 힌트가 있고
 *     문맥으로 고쳐 적기도 해서 '알아듣게 말했다'보다 과대 추정된다 — 그래서 이름을 '회수율'로 두고,
 *   · 이해가능성은 월 1회 아카이브 녹음을 프롬프트 없이 재전사한 값만 쓴다(lib/growthArchive intelligibilityOf).
 *   · 유창성 = 리텔 WPM 추세 + 반응(개시) 지연 중앙값 + 절 내부 멈춤.
 *   · 청크 사용률 = 자유 발화(리텔)에서 실제로 쓴 학습 표현 ÷ 노출(va_attempt_daily.exposed: 그날 말해 본 서로 다른 문장 수).
 * n=1이라 절대값 비교·집단 비율 대신 '최근 7일 vs 그 앞 21일(8~28일 전)' 방향(↑·↓·→)만 보여 준다.
 *
 * 계산은 순수 함수(computeMetrics3)이고, metrics3()은 저장소에서 읽어 넘기는 얇은 래퍼다.
 */
import { todayKey, shiftKey } from './dates';
import { getAttempts, dailyStats, dayOf, type Attempt, type DailyAgg } from './reviewEngine';
import { retellHistory, type RetellRecord } from './retell';
import { monthlyEntries, type MonthlyEntry } from './growthArchive';

export type Dir = 'up' | 'down' | 'flat' | null;

export interface Metrics3 {
  /** 0~100 (%) — v7: 최근 7일, v28: 최근 28일. dir: 7일 vs 8~28일 전 */
  recall: { v7: number | null; v28: number | null; dir: Dir; n7: number };
  /** 월간 재전사만 — 기록이 1개 이하면 last만, 없으면 null */
  intelligibility: { last: number; prev: number | null; dir: Dir } | null;
  /** wpm: 최근 7일 리텔 WPM 중앙값 · latency: 최근 7일 개시 지연 중앙값(ms) · clausePauses: 리텔 1회당 절 내부 멈춤 평균 */
  fluency: { wpm: number | null; latency: number | null; clausePauses: number | null; dir: Dir };
  /** 0~100 (%) — 사용 ÷ 노출 */
  chunkUse: { rate7: number | null; rate28: number | null; dir: Dir; used7: number; exposed7: number };
}

/** 회수율에 넣는 출처 — 목표 문장이 있는 채점(역할극·섀도잉·회상·사다리·단어·드릴) */
export const RECALL_SRCS = ['drama', 'shadow', 'recall', 'ladder', 'words', 'drill', 'session', 'pron'] as const;

/** 방향 판정 문턱 — 이보다 작은 변화는 '→'(n=1 잡음) */
export const RECALL_EPS = 3; // %p
export const WPM_EPS = 0.05; // 5%
export const LATENCY_EPS = 0.1; // 10%
export const CHUNK_EPS = 2; // %p
export const INTEL_EPS = 3; // %p

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

/** 차이 → 방향(높을수록 좋은 값). 둘 중 하나라도 없으면 null */
export function dirOf(cur: number | null, prev: number | null, eps: number, relative = false): Dir {
  if (cur == null || prev == null) return null;
  const d = cur - prev;
  const th = relative ? Math.abs(prev) * eps : eps;
  if (Math.abs(d) <= th) return 'flat';
  return d > 0 ? 'up' : 'down';
}

export interface Metrics3Input {
  attempts: Attempt[];
  retells: RetellRecord[];
  /** 날짜별 집계(노출 분모) */
  daily: { date: string; agg: Pick<DailyAgg, 'exposed'> }[];
  monthly: MonthlyEntry[];
  today: string;
}

const inRange = (date: string, from: string, to: string) => date >= from && date <= to;

export function computeMetrics3(inp: Metrics3Input): Metrics3 {
  const t = inp.today;
  const from7 = shiftKey(t, -6);
  const from28 = shiftKey(t, -27);
  const prevTo = shiftKey(t, -7);

  /* 회수율 */
  const recallAtts = inp.attempts.filter(
    (a) => (!a.quality || a.quality === 'ok') && (RECALL_SRCS as readonly string[]).includes(String(a.src || '')) && typeof a.score === 'number'
  );
  const pick = (from: string, to: string) => recallAtts.filter((a) => inRange(dayOf(a.t), from, to)).map((a) => a.score);
  const r7 = pick(from7, t);
  const r28 = pick(from28, t);
  const rPrev = pick(from28, prevTo);
  const pct = (arr: number[]) => {
    const m = mean(arr);
    return m == null ? null : Math.round(m);
  };
  const recall = { v7: pct(r7), v28: pct(r28), dir: dirOf(pct(r7), pct(rPrev), RECALL_EPS), n7: r7.length };

  /* 이해가능성(월간만) */
  const intel = inp.monthly.filter((m) => typeof m.intelligibility === 'number');
  const intelligibility = intel.length
    ? (() => {
        const last = intel[intel.length - 1].intelligibility as number;
        const prev = intel.length > 1 ? (intel[intel.length - 2].intelligibility as number) : null;
        return { last, prev, dir: dirOf(last, prev, INTEL_EPS) };
      })()
    : null;

  /* 유창성 — 리텔 WPM(키 있는 기록만) + 개시 지연(모든 채점 시도) */
  const scoredRetells = inp.retells.filter((r) => !r.keyless && r.wpm > 0);
  const wpm7 = median(scoredRetells.filter((r) => inRange(r.date, from7, t)).map((r) => r.wpm));
  const wpmPrev = median(scoredRetells.filter((r) => inRange(r.date, from28, prevTo)).map((r) => r.wpm));
  const lat = (from: string, to: string) =>
    median(
      inp.attempts
        .filter((a) => (!a.quality || a.quality === 'ok') && typeof a.latencyMs === 'number' && inRange(dayOf(a.t), from, to))
        .map((a) => a.latencyMs as number)
    );
  const lat7 = lat(from7, t);
  const latPrev = lat(from28, prevTo);
  const cp = scoredRetells.filter((r) => inRange(r.date, from7, t) && typeof r.clausePauses === 'number').map((r) => r.clausePauses as number);
  const clausePauses = cp.length ? Math.round((mean(cp) as number) * 10) / 10 : null;
  // WPM은 오를수록, 지연은 내릴수록 좋다 — 두 방향을 더해 하나로(한쪽만 있으면 그쪽)
  const dW = dirOf(wpm7, wpmPrev, WPM_EPS, true);
  const dL = dirOf(latPrev, lat7, LATENCY_EPS, true); // 순서를 뒤집어 '줄면 up'
  const v = (d: Dir) => (d === 'up' ? 1 : d === 'down' ? -1 : 0);
  const fluencyDir: Dir = dW == null && dL == null ? null : v(dW) + v(dL) > 0 ? 'up' : v(dW) + v(dL) < 0 ? 'down' : 'flat';
  const fluency = { wpm: wpm7, latency: lat7, clausePauses, dir: fluencyDir };

  /* 청크 사용률 = 리텔에서 쓴 학습 표현 ÷ 노출 */
  const used = (from: string, to: string) =>
    inp.retells.filter((r) => inRange(r.date, from, to)).reduce((s, r) => s + (Array.isArray(r.usedLearn) ? r.usedLearn.length : 0), 0);
  const exposed = (from: string, to: string) => inp.daily.filter((d) => inRange(d.date, from, to)).reduce((s, d) => s + (Number(d.agg.exposed) || 0), 0);
  const rate = (u: number, e: number) => (e > 0 ? Math.round(Math.min(1, u / e) * 100) : null);
  const used7 = used(from7, t);
  const exposed7 = exposed(from7, t);
  const rate7 = rate(used7, exposed7);
  const rate28 = rate(used(from28, t), exposed(from28, t));
  const ratePrev = rate(used(from28, prevTo), exposed(from28, prevTo));
  const chunkUse = { rate7, rate28, dir: dirOf(rate7, ratePrev, CHUNK_EPS), used7, exposed7 };

  return { recall, intelligibility, fluency, chunkUse };
}

/** 저장소에서 읽어 계산 */
export function metrics3(today: string = todayKey()): Metrics3 {
  return computeMetrics3({
    attempts: getAttempts(),
    retells: retellHistory(28, today),
    daily: dailyStats(29),
    monthly: monthlyEntries(),
    today,
  });
}

/** 화살표 문자 */
export function arrow(d: Dir): string {
  return d === 'up' ? '↑' : d === 'down' ? '↓' : d === 'flat' ? '→' : '·';
}
