import { beforeEach, describe, expect, test } from 'vitest';
import { buildGraph } from '../../lib/ontology/graph';
import { detectPatterns } from '../../lib/ontology/patternDetect';
import { buildLearnerModel } from '../../lib/ontology/mastery';
import { continueTrack, nextAfter, recommend } from '../../lib/ontology/planner';
import { SITUATION_BY_ID, SITUATIONS, rootSituations } from '../../lib/ontology/schema';
import { setUnitHandoff, takeUnitHandoff } from '../../lib/ontology/handoff';

beforeEach(() => localStorage.clear());

describe('그래프 무결성', () => {
  const g = buildGraph();
  test('유닛 id는 유일하다', () => {
    const ids = g.units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test('모든 유닛은 상황이 있고, 상황 id는 분류표에 존재한다', () => {
    for (const u of g.units) {
      expect(u.situations.length, u.id).toBeGreaterThan(0);
      for (const s of u.situations) expect(SITUATION_BY_ID[s], `${u.id} → ${s}`).toBeTruthy();
    }
  });
  test('하위 상황의 parent는 최상위에 존재한다', () => {
    const roots = new Set(rootSituations().map((r) => r.id));
    for (const s of SITUATIONS) if (s.parent) expect(roots.has(s.parent), s.id).toBe(true);
  });
  test('트랙의 unitIds는 실제 유닛을 가리키고 순서가 맞다', () => {
    for (const t of g.tracks) {
      t.unitIds.forEach((id, i) => {
        expect(g.unitById[id], `${t.id}[${i}]`).toBeTruthy();
        expect(g.unitById[id].order).toBe(i);
        expect(g.unitById[id].track).toBe(t.id);
      });
    }
  });
  test('선수 유닛은 존재한다', () => {
    for (const u of g.units) for (const r of u.requires || []) expect(g.unitById[r], `${u.id} requires ${r}`).toBeTruthy();
  });
  test('같은 문장은 출처가 달라도 한 표현 노드로 합쳐진다', () => {
    const multi = g.expressions.filter((x) => x.unitIds.length > 1);
    expect(multi.length).toBeGreaterThan(0);
    for (const x of multi) expect(new Set(x.unitIds).size).toBe(x.unitIds.length);
  });
  test('14개 모듈 중 8개 출처가 그래프에 들어온다(레슨은 선택)', () => {
    const srcs = new Set(g.units.map((u) => u.source));
    for (const s of ['pattern', 'course', 'career', 'mission', 'script', 'story', 'interview']) expect(srcs.has(s as never), s).toBe(true);
    expect(g.hasLessons).toBe(false);
  });
  test('실전형 유닛은 근거(grounding)를 가진다', () => {
    for (const u of g.units.filter((u) => u.real)) expect(u.grounding, u.id).toBeTruthy();
  });
});

describe('패턴 감지', () => {
  test('템플릿 패턴을 실제 문장에서 찾는다', () => {
    expect(detectPatterns("I'd like to schedule a quick call.")).toContain('id-like');
    expect(detectPatterns('Could you send me the deck?')).toContain('could-you');
    expect(detectPatterns('Let me check and get back to you.')).toContain('get-back');
    expect(detectPatterns("Let's circle back on that next week.")).toContain('circle-back');
  });
  test('완충 kind of만 잡고 명사 용법은 제외한다', () => {
    expect(detectPatterns('The timeline feels a bit tight.')).toContain('kind-of');
    expect(detectPatterns('What kind of budget were you working with?')).not.toContain('kind-of');
  });
  test('go over는 검토 의미만', () => {
    expect(detectPatterns('Can we go over the contract terms?')).toContain('go-over');
    expect(detectPatterns('Every call goes over the public internet.')).not.toContain('go-over');
  });
  test('패턴 유닛 자신의 예문은 그 패턴을 감지한다(40개 전부)', () => {
    const g = buildGraph();
    const misses = g.patterns.filter((p) => !detectPatterns(p.ex).includes(p.key)).map((p) => p.key);
    expect(misses).toEqual([]);
  });
});

describe('학습자 상태 투영', () => {
  test('아무 기록이 없으면 전부 0', () => {
    const g = buildGraph();
    const m = buildLearnerModel(g);
    expect(Object.values(m.unit).every((u) => u.score === 0 && !u.touched)).toBe(true);
  });
  test('코스 열람(va_course_seen)이 유닛·상황 점수로 올라간다', () => {
    const g = buildGraph();
    localStorage.setItem('va_course_seen', JSON.stringify(['finops-1']));
    const m = buildLearnerModel(g);
    expect(m.unit['course:finops-1'].touched).toBe(true);
    expect(m.unit['course:finops-1'].score).toBeGreaterThanOrEqual(40);
    expect(m.situation['finops/cost-review'].unitsTouched).toBe(1);
    expect(m.root['finops'].unitsTouched).toBe(1);
  });
  test('SRS 상자가 표현 점수가 되고, 같은 문장을 쓰는 다른 출처 유닛에도 반영된다', () => {
    const g = buildGraph();
    const shared = g.expressions.find((x) => x.unitIds.length > 1)!;
    localStorage.setItem('va_weak', JSON.stringify([{ en: shared.en, kr: shared.kr, box: 5, lapses: 0, due: 0 }]));
    const m = buildLearnerModel(g);
    expect(m.expression[shared.id].score).toBe(100);
    for (const uid of shared.unitIds) expect(m.unit[uid].exprMastered).toBeGreaterThanOrEqual(1);
  });
  test('정착 패턴은 패턴 점수 ≥ 60', () => {
    const g = buildGraph();
    localStorage.setItem('va_maturity_patterns', JSON.stringify(['id-like']));
    const m = buildLearnerModel(g);
    expect(m.pattern['id-like']).toBeGreaterThanOrEqual(60);
    expect(m.unit['pattern:id-like'].touched).toBe(true);
  });
});

describe('플래너 — 연속성', () => {
  test('회차 연속: 시작한 트랙의 다음 회차를 이어서 권한다', () => {
    const g = buildGraph();
    localStorage.setItem('va_course_seen', JSON.stringify(['finops-1']));
    const m = buildLearnerModel(g);
    const cont = continueTrack(g, m);
    expect(cont.some((r) => r.unit.id === 'course:finops-2' && r.kind === 'continue')).toBe(true);
    const recs = recommend(g, m, { max: 3 });
    expect(recs[0].unit.id).toBe('course:finops-2');
  });
  test('상황 연속: 미션에서 만진 상황의 다른 출처 유닛이 후보에 든다', () => {
    const g = buildGraph();
    // 미션 kickoff(meeting/opening) 표현 하나를 정착 → 같은 상황의 스크립트(opening)가 후보
    localStorage.setItem('va_mission_done_keys', JSON.stringify(['kickoff']));
    const m = buildLearnerModel(g);
    const recs = recommend(g, m, { max: 8 });
    expect(recs.some((r) => r.kind === 'situation' && r.unit.situations.includes('meeting/opening'))).toBe(true);
  });
  test('실전형 우선: preferReal이면 근거 있는 유닛 점수가 오른다', () => {
    const g = buildGraph();
    const m = buildLearnerModel(g);
    const plain = recommend(g, m, { max: 10, excludeSources: ['pattern', 'story'] });
    const real = recommend(g, m, { max: 10, excludeSources: ['pattern', 'story'], preferReal: true });
    expect(real[0].unit.real).toBe(true);
    expect(plain.length).toBeGreaterThan(0);
  });
  test('preferModes: 주차의 실전 화면으로 가는 유닛을 앞세운다', () => {
    const g = buildGraph();
    const m = buildLearnerModel(g);
    const [top] = recommend(g, m, { preferModes: ['interview'], max: 1, excludeSources: ['pattern', 'story'] });
    expect(top.unit.mode).toBe('interview');
  });
  test('nextAfter: 트랙 끝이면 같은 상황의 다른 출처로 잇는다', () => {
    const g = buildGraph();
    const m = buildLearnerModel(g);
    const n = nextAfter(g, m, 'course:finops-1');
    expect(n?.unit.id).toBe('course:finops-2');
    const end = nextAfter(g, m, 'course:finops-3');
    expect(end).not.toBeNull();
    expect(end!.unit.source).not.toBe('course');
  });
  test('트랙당 최대 2개 — 한 트랙이 추천을 독점하지 않는다', () => {
    const g = buildGraph();
    const m = buildLearnerModel(g);
    const recs = recommend(g, m, { max: 10 });
    const per = new Map<string, number>();
    for (const r of recs) per.set(r.unit.track, (per.get(r.unit.track) || 0) + 1);
    for (const n of per.values()) expect(n).toBeLessThanOrEqual(2);
  });
});

describe('핸드오프', () => {
  test('출처가 맞을 때만 꺼내고, 꺼내면 지워진다', () => {
    setUnitHandoff({ source: 'course', key: 'finops-2', track: 'finops' });
    expect(takeUnitHandoff('career')).toBeNull();
    expect(takeUnitHandoff('course')).toEqual({ source: 'course', key: 'finops-2', track: 'finops' });
    expect(takeUnitHandoff('course')).toBeNull();
  });
});
