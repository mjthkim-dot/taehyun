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
  test('80점 미만 유닛은 하루 쉬고(다른 미완 유닛 먼저) 나중에 다시 권한다', () => {
    recordGrammar('a2-past', 60);
    expect(pickTodayGrammar('A2').id).toBe('a2-future');
    // 모든 미완 유닛이 쉬는 중이면 다시 첫 미완으로
    for (const u of unitsAt('A2').slice(1)) recordGrammar(u.id, 50);
    for (const lv of ['B1', 'B2', 'C1', 'A1'] as const) for (const u of unitsAt(lv)) recordGrammar(u.id, 50);
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

describe('변형 생성 — 같은 문법, 새 상황', async () => {
  const { validateVariant, nextScene, applyVariant, SCENE_POOL } = await import('../../lib/grammarGen');
  const good = {
    scene: '호텔 체크인 문제를 프런트에 설명한다.',
    ex: [['I booked a room last week.', '지난주에 방을 예약했어요.'], ['The system lost my booking.', '시스템이 예약을 잃어버렸어요.']],
    checks: [0, 1, 2].map((i) => ({ q: `I ___ it yesterday (${i}).`, opts: ['booked', 'book', 'booking'], a: 0, why: '어제 = 끝난 일 → 과거형.' })),
    builds: [
      { kr: '어제 예약했어요.', a: 'I booked it yesterday.', extra: ['book'] },
      { kr: '확인 메일을 받았어요.', a: 'I got a confirmation email', extra: ['get'] },
    ],
    sim: {
      who: '호텔 프런트 직원',
      turns: [
        { them: 'When did you book?', kr: '언제 예약하셨어요?', task: 'choose', opts: ['I booked it on Monday.', 'I book it on Monday.', 'I booking it on Monday.'], a: 0, why: '과거 시점 → 과거형.' },
        { them: 'Did you get an email?', kr: '메일 받으셨어요?', task: 'build', a: 'Yes I got it last night', extra: ['get'], why: 'get의 과거 got.' },
        { them: 'Did you pay already?', kr: '결제하셨어요?', task: 'choose', opts: ['Yes, I paid online.', 'Yes, I pay online.', 'Yes, I paying online.'], a: 0, why: 'pay의 과거 paid.' },
        { them: 'What happened?', kr: '무슨 일이죠?', task: 'free', prompt: '무슨 일이 있었는지 과거 시제로 말해 보세요.', model: 'I booked a room, but the system lost it.', focus: 'past simple' },
      ],
    },
  };
  test('올바른 변형은 통과(마침표 제거)', () => {
    const v = validateVariant(good)!;
    expect(v).not.toBeNull();
    expect(v.builds[0].a).toBe('I booked it yesterday');
  });
  test('오답 조각이 정답에 있으면 거부', () => {
    expect(validateVariant({ ...good, builds: [{ ...good.builds[0], extra: ['booked'] }, good.builds[1]] })).toBeNull();
  });
  test('보기 정답 인덱스가 틀리면 거부', () => {
    expect(validateVariant({ ...good, checks: [{ ...good.checks[0], a: 5 }, good.checks[1], good.checks[2]] })).toBeNull();
  });
  test('턴 구성이 다르면 거부(4턴: 고르기·조립·고르기·말하기)', () => {
    expect(validateVariant({ ...good, sim: { ...good.sim, turns: good.sim.turns.slice(0, 3) } })).toBeNull();
  });
  test('상황은 회차마다 바뀐다', () => {
    const a = nextScene('a2-past', 1, 20260925);
    const b = nextScene('a2-past', 2, 20260925);
    expect(a).not.toBe(b);
    expect(SCENE_POOL.length).toBeGreaterThanOrEqual(30);
  });
  test('변형을 입혀도 사고 단계의 규칙은 원본 유지', () => {
    const u = GRAMMAR_UNITS.find((x) => x.id === 'a2-past')!;
    const w = applyVariant(u, validateVariant(good));
    expect(w.scene).toContain('호텔');
    expect(w.think.rule).toBe(u.think.rule);
  });
});
