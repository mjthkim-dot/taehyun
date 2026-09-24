/**
 * 학습자 상태 — 그래프 노드마다 "얼마나 내 것이 됐는가"를 0~100으로.
 *
 * 새 기록을 만들지 않는다. 이미 앱이 쌓고 있는 신호를 노드에 투영한다:
 *   표현  ← va_weak(SRS 상자·누락), va_attempt_log(발화 점수), va_phrases(저장)
 *   패턴  ← va_maturity_patterns(정착), va_pattern_srs(리콜 상자)
 *   유닛  ← 출처별 열람/완료 키(va_course_seen, va_career_seen, 미션 단계, 읽은 에피소드,
 *           면접 기록, 레슨 통계·숙제)
 *   상황  ← 그 상황에 속한 유닛·표현·패턴의 가중 평균
 *
 * 이 투영 덕에 "미션에서 5개 표현을 정착시켰다"는 사실이 같은 상황의 코스 유닛
 * 점수에도 반영된다 — 학습이 화면을 넘어 이어진다.
 */
import { load, getPhrases, type WeakItem, SRS_MAX_BOX, getLessonStats, getDoneHomework } from '../state';
import { getAttempts } from '../reviewEngine';
import { donePatterns } from '../maturity';
import { seenScenarios } from '../realCourse';
import { seenCareer } from '../careerPack';
import { getProgress, isMastered as missionPhraseMastered } from '../missionProgress';
import { BUSINESS_MISSIONS, doneMissionKeys } from '../dailyMission';
import { readEpisodes } from '../immersion';
import { interviewHistory } from '../interview';
import { WORKATO_ROLE, WORKATO_HR_ROLE } from '../workatoPrep';
import type { Graph, Unit } from './schema';
import { rootOf, rootSituations, childSituations, SITUATION_BY_ID } from './schema';

export interface ExpressionMastery {
  /** 0~100 */
  score: number;
  /** 근거 — 화면이 "왜 이 점수"를 보여줄 수 있게 */
  evidence: ('srs' | 'spoken' | 'saved' | 'lapse')[];
}

export interface UnitMastery {
  /** 0~100 */
  score: number;
  /** 열람/완료했는가(출처 키 기준) */
  touched: boolean;
  /** 표현 중 정착 비율 */
  exprMastered: number;
  exprTotal: number;
}

export interface SituationMastery {
  id: string;
  name: string;
  score: number;
  unitsTouched: number;
  unitsTotal: number;
  /** 약한 표현 수(점수 40 미만이면서 만난 적 있는 것) */
  weak: number;
  /** 정착한 패턴 / 관련 패턴 */
  patternsDone: number;
  patternsTotal: number;
}

export interface LearnerModel {
  expression: Record<string, ExpressionMastery>;
  unit: Record<string, UnitMastery>;
  pattern: Record<string, number>;
  /** 하위 상황 id → */
  situation: Record<string, SituationMastery>;
  /** 최상위 상황 → 하위 집계 */
  root: Record<string, SituationMastery>;
}

function normEn(en: string): string {
  return en.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ── 표현 ── */
function expressionScores(g: Graph): Record<string, ExpressionMastery> {
  const weak = new Map<string, WeakItem>();
  for (const w of load<WeakItem[]>('va_weak', [])) if (w.en) weak.set(normEn(w.en), w);
  const saved = new Set(getPhrases().map((p) => normEn(p.en)));
  const spoken = new Map<string, { n: number; sum: number }>();
  for (const a of getAttempts()) {
    const k = normEn(a.en);
    const cur = spoken.get(k) || { n: 0, sum: 0 };
    cur.n += 1;
    cur.sum += a.score || 0;
    spoken.set(k, cur);
  }
  const out: Record<string, ExpressionMastery> = {};
  for (const x of g.expressions) {
    const k = normEn(x.en);
    const ev: ExpressionMastery['evidence'] = [];
    let score = 0;
    const w = weak.get(k);
    if (w) {
      ev.push('srs');
      score = Math.max(score, Math.round(((w.box || 0) / SRS_MAX_BOX) * 100));
      if ((w.lapses || 0) >= 3) ev.push('lapse');
    }
    const sp = spoken.get(k);
    if (sp && sp.n > 0) {
      ev.push('spoken');
      score = Math.max(score, Math.round(sp.sum / sp.n));
    }
    if (saved.has(k)) {
      ev.push('saved');
      score = Math.max(score, 20);
    }
    if (ev.length) out[x.id] = { score, evidence: ev };
  }
  return out;
}

/* ── 유닛 ── */
function unitTouched(u: Unit, ctx: { course: Set<string>; career: Set<string>; read: Set<number>; ivRoles: Set<string>; lessonIds: Set<number>; hw: Set<number> }): boolean {
  switch (u.source) {
    case 'course':
      return ctx.course.has(u.ref.key);
    case 'career':
      return ctx.career.has(u.ref.key);
    case 'story':
      return ctx.read.has(Number(u.ref.key));
    case 'pattern':
      return donePatterns().includes(u.ref.key);
    case 'mission': {
      if (doneMissionKeys().includes(u.ref.key)) return true;
      const m = BUSINESS_MISSIONS.find((x) => x.key === u.ref.key);
      if (!m) return false;
      const prog = getProgress(m.key); // 오늘 진행 중인 미션의 표현 완주도 접촉으로 본다
      return m.phrases.some((p) => missionPhraseMastered(prog[p.en]));
    }
    case 'interview':
      return u.ref.key === 'workato-hr' ? ctx.ivRoles.has(WORKATO_HR_ROLE) : u.ref.key === 'workato' ? ctx.ivRoles.has(WORKATO_ROLE) : ctx.ivRoles.size > 0;
    case 'lesson':
    case 'library':
      return ctx.lessonIds.has(Number(u.ref.key)) || ctx.hw.has(Number(u.ref.key));
    case 'script':
      return false; // 스크립트는 열람 기록이 없다 — 표현 점수로만 반영
  }
}

export function buildLearnerModel(g: Graph): LearnerModel {
  const expression = expressionScores(g);
  const ctx = {
    course: new Set(seenScenarios()),
    career: new Set(seenCareer()),
    read: new Set(readEpisodes()),
    ivRoles: new Set(interviewHistory().map((r) => r.role)),
    lessonIds: new Set(Object.keys(getLessonStats()).map(Number)),
    hw: new Set(getDoneHomework()),
  };
  const psrs = new Map(load<{ key: string; box: number }[]>('va_pattern_srs', []).map((p) => [p.key, p.box]));
  const done = new Set(donePatterns());
  const pattern: Record<string, number> = {};
  for (const p of g.patterns) {
    const box = psrs.get(p.key);
    pattern[p.key] = done.has(p.key) ? Math.max(60, Math.round(((box ?? 1) / SRS_MAX_BOX) * 100)) : 0;
  }

  const unit: Record<string, UnitMastery> = {};
  for (const u of g.units) {
    const touched = unitTouched(u, ctx);
    const total = u.expressions.length;
    const mastered = u.expressions.filter((id) => (expression[id]?.score || 0) >= 60).length;
    const met = u.expressions.filter((id) => expression[id]).length;
    // 열람 40% + 표현 정착 40% + 표현 접촉 20%
    const score = Math.round((touched ? 40 : 0) + (total ? (mastered / total) * 40 : 0) + (total ? (met / total) * 20 : 0));
    unit[u.id] = { score: Math.min(100, score), touched, exprMastered: mastered, exprTotal: total };
  }

  const situation: Record<string, SituationMastery> = {};
  for (const [sid, uids] of Object.entries(g.unitsBySituation)) {
    const us = uids.map((id) => g.unitById[id]).filter(Boolean);
    const touched = us.filter((u) => unit[u.id]?.touched).length;
    const exprIds = new Set(us.flatMap((u) => u.expressions));
    let weakN = 0;
    for (const id of exprIds) {
      const e = expression[id];
      if (e && e.score < 40) weakN++;
    }
    const pats = new Set(us.flatMap((u) => u.patterns));
    const pdone = [...pats].filter((k) => pattern[k] > 0).length;
    const avg = us.length ? us.reduce((a, u) => a + (unit[u.id]?.score || 0), 0) / us.length : 0;
    situation[sid] = {
      id: sid, name: SITUATION_BY_ID[sid]?.name || sid, score: Math.round(avg), unitsTouched: touched, unitsTotal: us.length,
      weak: weakN, patternsDone: pdone, patternsTotal: pats.size,
    };
  }
  const root: Record<string, SituationMastery> = {};
  for (const r of rootSituations()) {
    const kids = [r.id, ...childSituations(r.id).map((c) => c.id)].map((id) => situation[id]).filter(Boolean);
    const ut = kids.reduce((a, k) => a + k.unitsTotal, 0);
    root[r.id] = {
      id: r.id, name: r.name,
      score: ut ? Math.round(kids.reduce((a, k) => a + k.score * k.unitsTotal, 0) / ut) : 0,
      unitsTouched: kids.reduce((a, k) => a + k.unitsTouched, 0), unitsTotal: ut,
      weak: kids.reduce((a, k) => a + k.weak, 0),
      patternsDone: kids.reduce((a, k) => a + k.patternsDone, 0), patternsTotal: kids.reduce((a, k) => a + k.patternsTotal, 0),
    };
  }
  return { expression, unit, pattern, situation, root };
}

export { rootOf };
