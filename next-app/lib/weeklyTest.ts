/**
 * 주간 말하기 시험 — 일주일에 한 번, 이번 주 패턴들을 넣어 1분간 멈추지 않고
 * 말한다. 채점은 "얼마나 말했나(단어·WPM)"와 "배운 패턴을 몇 개 꺼냈나"(stem
 * 감지)만 — 시험이 아니라 측정 리추얼이다. 기록이 쌓여 지난주의 나와 비교된다.
 */
import { load, store } from './state';
import { donePatterns, STAGE_PATTERNS, type NativePattern } from './maturity';

export interface WeeklyTestResult {
  /** YYYY-MM-DD */
  date: string;
  seconds: number;
  words: number;
  wpm: number;
  /** 감지된 패턴 키 */
  used: string[];
}

const KEY = 'va_weekly_tests';
const MAX = 26; // 반년치

export function getWeeklyTests(): WeeklyTestResult[] {
  return load<WeeklyTestResult[]>(KEY, []);
}

export function lastWeeklyTest(): WeeklyTestResult | null {
  const all = getWeeklyTests();
  return all.length ? all[all.length - 1] : null;
}

export function recordWeeklyTest(r: WeeklyTestResult) {
  store(KEY, [...getWeeklyTests(), r].slice(-MAX));
}

/** 시험을 볼 때가 됐는가 — 정착 패턴 3개 이상 + 지난 시험에서 7일 경과(또는 처음). */
export function weeklyTestDue(): boolean {
  if (donePatterns().length < 3) return false;
  const last = lastWeeklyTest();
  if (!last) return true;
  return Date.now() - new Date(last.date).getTime() >= 7 * 86400000;
}

/** 이번 시험에서 쓰라고 제시할 패턴 — 최근 정착한 것 3개. */
export function patternsForTest(max = 3): NativePattern[] {
  const done = donePatterns();
  const byKey = new Map<string, NativePattern>();
  for (const list of Object.values(STAGE_PATTERNS)) for (const p of list) byKey.set(p.key, p);
  return done
    .slice(-max)
    .map((k) => byKey.get(k))
    .filter((p): p is NativePattern => !!p);
}
