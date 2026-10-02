/**
 * 튜터 앵커(M10) — 외부 튜터(예: Preply 수업)가 매긴 점수를 월 1회 버튼(1~9)으로 기록하고,
 * 앱 지표가 같은 방향으로 움직였는지 '방향 일치 n/6'으로 보여 준다.
 *
 * 왜 상관계수가 아니라 방향 일치인가: 학습자는 한 명(n=1)이고 기록은 한 달에 하나라, 1년을 모아도 점 12개다.
 * 상관은 의미가 없고, '튜터가 올랐다고 본 달에 앱 지표도 올랐나'를 세는 것이 정직하다(최근 6번 비교 중 4번 이상이면 믿을 만).
 * 텍스트 입력 없음 — 1~9 버튼만(원칙 1).
 */
import { load, store } from './state';
import type { MonthlyEntry } from './growthArchive';

export type AnchorAxis = 'intelligibility' | 'fluency';
export const ANCHOR_AXES: { key: AnchorAxis; kr: string }[] = [
  { key: 'intelligibility', kr: '알아듣기 쉬움' },
  { key: 'fluency', kr: '막힘 없이 말함' },
];
export const ANCHOR_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
/** 최근 몇 번의 비교로 판정하나 */
export const ANCHOR_WINDOW = 6;

/** va_anchor { 'YYYY-MM': { intelligibility?: 1..9, fluency?: 1..9 } } */
export type AnchorMap = Record<string, Partial<Record<AnchorAxis, number>>>;

const KEY = 'va_anchor';
const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 9;

export function anchors(): AnchorMap {
  const raw = load<Record<string, unknown>>(KEY, {});
  const out: AnchorMap = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [m, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}$/.test(m) || !v || typeof v !== 'object') continue;
    const row: Partial<Record<AnchorAxis, number>> = {};
    for (const a of ANCHOR_AXES) {
      const s = (v as Record<string, unknown>)[a.key];
      if (isScore(s)) row[a.key] = s;
    }
    if (Object.keys(row).length) out[m] = row;
  }
  return out;
}

/** 버튼 한 번 = 그달 그 축의 점수(같은 값을 다시 누르면 지운다 — 잘못 누른 걸 되돌리게) */
export function setAnchor(month: string, axis: AnchorAxis, score: number): AnchorMap {
  if (!/^\d{4}-\d{2}$/.test(month) || !isScore(score)) return anchors();
  const all = anchors();
  const row = { ...(all[month] || {}) };
  if (row[axis] === score) delete row[axis];
  else row[axis] = score;
  if (Object.keys(row).length) all[month] = row;
  else delete all[month];
  store(KEY, all);
  return all;
}

const sign = (d: number) => (d > 0 ? 1 : d < 0 ? -1 : 0);

/** 앱 쪽 월별 값 — 이해가능성은 월간 재전사, 유창성은 월간 WPM */
export function appByMonth(monthly: MonthlyEntry[]): Record<string, Partial<Record<AnchorAxis, number>>> {
  const out: Record<string, Partial<Record<AnchorAxis, number>>> = {};
  for (const e of monthly) {
    const m = e.date.slice(0, 7);
    const row: Partial<Record<AnchorAxis, number>> = {};
    if (typeof e.intelligibility === 'number') row.intelligibility = e.intelligibility;
    if (typeof e.wpm === 'number' && e.wpm > 0) row.fluency = e.wpm;
    out[m] = row;
  }
  return out;
}

/**
 * 방향 일치 — 축마다 '튜터 점수와 앱 지표가 둘 다 있는 달'을 시간순으로 이어, 이웃한 두 달의 변화 부호가 같은지 센다
 * (둘 다 그대로(0)도 일치). 모든 축의 비교를 시간순으로 모아 최근 ANCHOR_WINDOW번만 본다.
 */
export function directionAgreement(tutor: AnchorMap, app: Record<string, Partial<Record<AnchorAxis, number>>>): { agree: number; total: number } {
  const cmp: { month: string; ok: boolean }[] = [];
  for (const { key } of ANCHOR_AXES) {
    const months = Object.keys(tutor)
      .filter((m) => typeof tutor[m]?.[key] === 'number' && typeof app[m]?.[key] === 'number')
      .sort();
    for (let i = 1; i < months.length; i++) {
      const a = months[i - 1];
      const b = months[i];
      const dt = sign((tutor[b][key] as number) - (tutor[a][key] as number));
      const da = sign((app[b][key] as number) - (app[a][key] as number));
      cmp.push({ month: b, ok: dt === da });
    }
  }
  const recent = cmp.sort((x, y) => (x.month < y.month ? -1 : x.month > y.month ? 1 : 0)).slice(-ANCHOR_WINDOW);
  return { agree: recent.filter((c) => c.ok).length, total: recent.length };
}
