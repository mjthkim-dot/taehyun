/**
 * 플래너 — 그래프와 학습자 상태로 "다음에 할 것"을 고른다.
 *
 * 세 가지 연속성을 순서대로 본다:
 *   ① 회차 연속  이미 시작한 트랙의 다음 유닛(코스 2/3 → 3/3). 시작한 걸 끝내는 게 먼저다
 *   ② 상황 연속  최근 만진 상황에서 아직 안 한 다른 출처의 유닛(미션 → 같은 상황의 코스)
 *   ③ 약점 보강  점수가 낮은 상황의 유닛, 약한 표현이 몰린 유닛
 * 그리고 프로그램 2·3단계에서는 실전형(grounding 있는) 유닛을 앞세운다.
 * 선수 유닛이 안 끝난 것은 뒤로 미룬다(막지는 않는다 — 하고 싶으면 한다).
 */
import type { Graph, Unit } from './schema';
import type { LearnerModel } from './mastery';
import { rootOf } from './schema';
import type { Mode } from '../../components/NavBar';

export interface Recommendation {
  unit: Unit;
  /** 왜 이걸 권하는지 — 한 줄(화면에 그대로) */
  reason: string;
  kind: 'continue' | 'situation' | 'weak' | 'new';
  score: number;
}

export interface PlanOptions {
  /** 실전형 우선(프로그램 2·3단계) */
  preferReal?: boolean;
  /** 이 화면으로 가는 유닛을 앞세운다(프로그램 주차의 실전 블록) */
  preferModes?: Mode[];
  /** 특정 상황(하위/최상위 id)으로 제한 */
  situation?: string;
  /** 이 출처는 제외 */
  excludeSources?: Unit['source'][];
  max?: number;
}

function prereqMet(u: Unit, m: LearnerModel): boolean {
  return !u.requires || u.requires.every((id) => m.unit[id]?.touched);
}

function inSituation(u: Unit, sid: string): boolean {
  return u.situations.some((s) => s === sid || rootOf(s) === sid);
}

/** 트랙별 "이어서 할" 다음 유닛 */
export function continueTrack(g: Graph, m: LearnerModel): Recommendation[] {
  const out: Recommendation[] = [];
  for (const t of g.tracks) {
    const units = t.unitIds.map((id) => g.unitById[id]);
    const done = units.filter((u) => m.unit[u.id]?.touched).length;
    if (done === 0 || done === units.length) continue;
    const next = units.find((u) => !m.unit[u.id]?.touched);
    if (!next) continue;
    out.push({ unit: next, reason: `${t.name} ${done}/${units.length} — 이어서`, kind: 'continue', score: 100 - (units.length - done) });
  }
  return out;
}

export function recommend(g: Graph, m: LearnerModel, opts: PlanOptions = {}): Recommendation[] {
  const max = opts.max ?? 5;
  const excluded = new Set(opts.excludeSources || []);
  const pool = g.units.filter((u) => !excluded.has(u.source) && !m.unit[u.id]?.touched && (!opts.situation || inSituation(u, opts.situation)));
  const picks = new Map<string, Recommendation>();
  const add = (r: Recommendation) => {
    const cur = picks.get(r.unit.id);
    if (!cur || cur.score < r.score) picks.set(r.unit.id, r);
  };

  // ① 회차 연속
  for (const r of continueTrack(g, m)) {
    if (excluded.has(r.unit.source)) continue;
    if (opts.situation && !inSituation(r.unit, opts.situation)) continue;
    add(r);
  }

  // ② 상황 연속 — 만진 상황 중 아직 안 한 다른 출처 유닛
  const touchedSits = new Set<string>();
  for (const u of g.units) if (m.unit[u.id]?.touched) for (const s of u.situations) touchedSits.add(s);
  for (const u of pool) {
    const hit = u.situations.find((s) => touchedSits.has(s));
    if (!hit) continue;
    const sm = m.situation[hit];
    add({ unit: u, reason: `${sm?.name || hit} — 다른 상황에서 다시`, kind: 'situation', score: 70 + (sm ? (100 - sm.score) / 10 : 0) });
  }

  // ③ 약점 보강 — 점수 낮은 상황 + 약한 표현이 몰린 유닛
  const weakSits = Object.values(m.situation).filter((s) => s.unitsTouched > 0 && s.score < 50).sort((a, b) => a.score - b.score).slice(0, 3);
  for (const s of weakSits) {
    const cands = pool.filter((u) => u.situations.includes(s.id));
    for (const u of cands.slice(0, 2)) add({ unit: u, reason: `${s.name} 숙련도 ${s.score}% — 보강`, kind: 'weak', score: 60 + (100 - s.score) / 5 });
  }

  // ④ 새 상황 열기 — 아무것도 안 만진 상황의 첫 유닛(레벨 낮은 순)
  const untouched = pool.filter((u) => !u.situations.some((s) => touchedSits.has(s)));
  untouched.sort((a, b) => a.level.localeCompare(b.level) || a.order - b.order);
  const seenTrack = new Set<string>();
  const firstPerTrack = untouched.filter((u) => (seenTrack.has(u.track) ? false : (seenTrack.add(u.track), true)));
  for (const u of firstPerTrack.slice(0, 3)) add({ unit: u, reason: `${g.trackById[u.track]?.name || '새 트랙'} — 처음 열기`, kind: 'new', score: 40 + (u.order === 0 ? 5 : 0) });

  // ⑤ 화면 후보 — 프로그램 주차가 지정한 화면으로 가는 유닛이 위에서 하나도 안 잡혔으면
  //    그 화면의 첫 미완 유닛을 넣는다(실전 블록이 늘 구체 유닛을 갖게)
  for (const mode of opts.preferModes || []) {
    if ([...picks.values()].some((r) => r.unit.mode === mode)) continue;
    const cand = pool.filter((u) => u.mode === mode).sort((a, b) => a.order - b.order)[0];
    if (cand) add({ unit: cand, reason: `${g.trackById[cand.track]?.name || ''} — 이번 주 실전`, kind: 'new', score: 45 });
  }

  let list = [...picks.values()];
  for (const r of list) {
    if (opts.preferReal && r.unit.real) r.score += 15;
    if (opts.preferModes?.includes(r.unit.mode)) r.score += 25;
    if (!prereqMet(r.unit, m)) r.score -= 30;
  }
  list.sort((a, b) => b.score - a.score);
  // 같은 트랙이 상위를 독점하지 않게 — 트랙당 최대 2
  const perTrack = new Map<string, number>();
  list = list.filter((r) => {
    const n = perTrack.get(r.unit.track) || 0;
    if (n >= 2) return false;
    perTrack.set(r.unit.track, n + 1);
    return true;
  });
  return list.slice(0, max);
}

/** 한 유닛의 "다음" — 화면이 끝났을 때 자연스럽게 잇는다 */
export function nextAfter(g: Graph, m: LearnerModel, unitId: string): Recommendation | null {
  const u = g.unitById[unitId];
  if (!u) return null;
  const t = g.trackById[u.track];
  const idx = t.unitIds.indexOf(u.id);
  const nextId = t.unitIds[idx + 1];
  if (nextId) return { unit: g.unitById[nextId], reason: `${t.name} — 다음 회차`, kind: 'continue', score: 100 };
  // 트랙이 끝났으면 같은 상황(하위 → 최상위 순)의 다른 출처
  const other = (pred: (x: Unit) => boolean) => g.units.find((x) => x.id !== u.id && x.source !== u.source && !m.unit[x.id]?.touched && pred(x));
  const sameSit = other((x) => x.situations.some((s) => u.situations.includes(s)));
  if (sameSit) return { unit: sameSit, reason: '같은 상황을 다른 방식으로', kind: 'situation', score: 70 };
  const roots = new Set(u.situations.map(rootOf));
  const sameRoot = other((x) => x.situations.some((s) => roots.has(rootOf(s))));
  return sameRoot ? { unit: sameRoot, reason: '같은 영역을 다른 방식으로', kind: 'situation', score: 60 } : null;
}
