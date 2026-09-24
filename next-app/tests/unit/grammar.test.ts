import { beforeEach, describe, expect, test } from 'vitest';
import { GRAMMAR_UNITS, GRAMMAR_LEVELS, grammarDoneToday, grammarStats, normSentence, pickTodayGrammar, recordGrammar, shuffledOptions, tokensOf, unitsAt } from '../../lib/grammar';
import { SITUATION_BY_ID } from '../../lib/ontology/schema';
import { buildGraph } from '../../lib/ontology/graph';
import { startProgram, todayPlan } from '../../lib/program';

beforeEach(() => localStorage.clear());

describe('문법 콘텐츠 무결성', () => {
  test('A1~C1 레벨마다 3개 이상, 총 18유닛', () => {
    expect(GRAMMAR_UNITS.length).toBe(18);
    for (const lv of GRAMMAR_LEVELS) expect(unitsAt(lv).length).toBeGreaterThanOrEqual(3);
  });
  test('유닛 id 유일, 상황은 온톨로지에 존재', () => {
    expect(new Set(GRAMMAR_UNITS.map((u) => u.id)).size).toBe(18);
    for (const u of GRAMMAR_UNITS) expect(SITUATION_BY_ID[u.sit], u.id).toBeTruthy();
  });
  test('사고 단계: 한국어식·영어식·규칙·예문 2개', () => {
    for (const u of GRAMMAR_UNITS) {
      expect(u.think.q && u.think.ko && u.think.en && u.think.rule, u.id).toBeTruthy();
      expect(u.think.ex.length).toBe(2);
    }
  });
  test('판단 3·조립 2·실전 4턴(마지막은 자유 작문)', () => {
    for (const u of GRAMMAR_UNITS) {
      expect(u.checks.length, u.id).toBe(3);
      expect(u.builds.length, u.id).toBe(2);
      expect(u.sim.turns.length, u.id).toBe(4);
      expect(u.sim.turns[3].task, u.id).toBe('free');
    }
  });
  test('보기 정답 인덱스 유효, 보기 중복 없음', () => {
    for (const u of GRAMMAR_UNITS) {
      for (const c of u.checks) {
        expect(c.a).toBeLessThan(c.opts.length);
        expect(new Set(c.opts).size).toBe(c.opts.length);
      }
      for (const t of u.sim.turns) if (t.task === 'choose') expect(t.a).toBeLessThan(t.opts.length);
    }
  });
  test('조립 오답 조각은 정답 문장에 들어 있지 않다(헷갈림용)', () => {
    for (const u of GRAMMAR_UNITS) {
      const bs = [...u.builds, ...u.sim.turns.filter((t) => t.task === 'build')] as { a: string; extra?: string[] }[];
      for (const b of bs) for (const x of b.extra || []) expect(b.a.split(' ').includes(x), `${u.id}: ${x}`).toBe(false);
    }
  });
});

describe('조립·보기 섞기', () => {
  test('조각은 정답 단어 + 오답 조각, 정답 순서 그대로 나오지 않는다', () => {
    const b = { a: 'I am a cloud sales manager', extra: ['is'] };
    const t = tokensOf(b);
    expect(t.slice().sort()).toEqual([...b.a.split(' '), 'is'].sort());
    expect(t.join(' ')).not.toBe(b.a);
  });
  test('정답 비교는 대소문자·마침표 무시', () => {
    expect(normSentence('We found it two hours later.')).toBe(normSentence('we found it two hours later'));
  });
  test('보기를 섞어도 정답 인덱스가 따라간다', () => {
    const r = shuffledOptions(['a', 'b', 'c'], 0, 5);
    expect(r.opts[r.a]).toBe('a');
  });
});

describe('진행 · 오늘의 문법', () => {
  test('현재 레벨의 첫 미완 유닛부터', () => {
    expect(pickTodayGrammar('A2').id).toBe('a2-past');
    recordGrammar('a2-past', 90);
    expect(pickTodayGrammar('A2').id).toBe('a2-future');
  });
  test('80점 미만이면 다시 권한다', () => {
    recordGrammar('a2-past', 60);
    expect(pickTodayGrammar('A2').id).toBe('a2-past');
  });
  test('현재 레벨을 다 끝내면 다음 레벨', () => {
    for (const u of unitsAt('A2')) recordGrammar(u.id, 100);
    expect(pickTodayGrammar('A2').level).toBe('B1');
  });
  test('최고 점수 보존, 오늘 완료 신호', () => {
    recordGrammar('b1-perfect', 90);
    recordGrammar('b1-perfect', 40);
    expect(grammarStats().find((s) => s.level === 'B1')!.mastered).toBe(1);
    expect(grammarDoneToday()).toBe(true);
  });
});

describe('레슨·온톨로지 연결', () => {
  test('오늘의 레슨 2단계 = 문법 시뮬레이션', () => {
    startProgram({ why: 't', minutes: 25 });
    const core = todayPlan()!.blocks.find((b) => b.key === 'core')!;
    expect(core.title).toBe('문법');
    expect(core.mode).toBe('grammar');
    expect(core.unitRef?.source).toBe('grammar');
  });
  test('문법 완주하면 2단계 자동 완료', () => {
    startProgram({ why: 't', minutes: 25 });
    recordGrammar('a1-be', 70);
    expect(todayPlan()!.blocks.find((b) => b.key === 'core')!.done).toBe(true);
  });
  test('그래프에 문법 유닛 18개 + 레벨 트랙', () => {
    const g = buildGraph();
    expect(g.units.filter((u) => u.source === 'grammar').length).toBe(18);
    expect(g.trackById['grammar:B1']).toBeTruthy();
  });
});
