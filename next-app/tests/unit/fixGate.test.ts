import { beforeEach, describe, expect, test } from 'vitest';
import {
  canTryGate,
  dtalkEvidenceScore,
  dtalkStats,
  fillerCount,
  FIX_PASS,
  fixFromL1,
  gateTallyLabel,
  gateVerdict,
  isLadderDay,
  judgeReaction,
  latencyLabel,
  longestSentence,
  median,
  mistakeTypeForL1,
  recordL1,
  saveDtalkStats,
  settleGate,
  shouldReactionTurn,
  splitForReaction,
  splitSentences,
  turnLatencyMs,
  wpmOf,
} from '../../lib/fixGate';
import { alignedScore } from '../../lib/align';
import { detectL1 } from '../../lib/l1Grammar';
import { getMistakes } from '../../lib/transfer';
import { weakItems } from '../../lib/state';

beforeEach(() => localStorage.clear());

describe('교정 게이트 — 60점·1회·실패 시 회상 큐', () => {
  test('60점 경계: 60이면 통과, 59면 실패', () => {
    expect(FIX_PASS).toBe(60);
    const better = 'I work in cloud sales every day now.';
    // 같은 문장 = 100, 빈 말 = 0
    expect(gateVerdict(better, better)).toEqual({ score: 100, passed: true });
    expect(gateVerdict(better, '   ')).toEqual({ score: 0, passed: false });
    // 판정은 alignedScore 그대로 — 경계는 ≥60
    const said = 'I work in sales';
    const s = alignedScore(better, said).score;
    expect(gateVerdict(better, said).passed).toBe(s >= 60);
  });
  test('기회는 1회', () => {
    expect(canTryGate(0)).toBe(true);
    expect(canTryGate(1)).toBe(false);
  });
  test('통과하면 회상 큐에 넣지 않고, 실패·건너뜀이면 better를 cat 드라마·내일(dueDays 1)로', () => {
    const fix = { better: 'I work in cloud sales.', kr: '저는 클라우드 영업을 해요.' };
    expect(settleGate(fix, { passed: true }, 1)).toBe('passed');
    expect(weakItems().length).toBe(0);
    const before = Date.now();
    expect(settleGate(fix, { passed: false }, 1)).toBe('queued');
    const w = weakItems().find((x) => x.en === fix.better)!;
    expect(w.cat).toBe('드라마');
    expect(w.lesson).toBe('drama:1');
    expect(w.due).toBeGreaterThanOrEqual(before + 86400000 - 1000);
  });
  test('뜻(kr)이 없는 교정(L1 규칙)은 회상 큐에 넣을 수 없다', () => {
    expect(settleGate({ better: 'He works here.', kr: '' }, { passed: false }, 1)).toBe('none');
    expect(weakItems().length).toBe(0);
  });
  test('집계 문구', () => {
    expect(gateTallyLabel(2, 3)).toBe('교정 재발화 2/3');
  });
});

describe('L1 간섭 → 규칙 교정', () => {
  test('콩글리시는 단어 선택, 전치사 짝은 전치사 — 교정 축적에 남는다', () => {
    const [hit] = detectL1('I lost my hand phone yesterday.', 1);
    expect(hit).toBeTruthy();
    expect(mistakeTypeForL1(hit)).toBe('word-choice');
    const f = fixFromL1(hit);
    expect(f.rule).toBe(true);
    expect(f.kr).toBe('');
    expect(f.better.toLowerCase()).toContain('phone');
    recordL1('I lost my hand phone yesterday.', hit);
    expect(getMistakes()[0].type).toBe('word-choice');
    expect(mistakeTypeForL1({ id: 'prep-choice', kind: 'grammar' })).toBe('preposition');
    expect(mistakeTypeForL1({ id: 'third-person-s', kind: 'grammar' })).toBe('other');
  });
});

describe('리액션 턴 판정', () => {
  test('뱅크 매칭 ✓, clarify 표시', () => {
    const r = judgeReaction('Really?');
    expect(r.kind).toBe('match');
    const c = judgeReaction('Sorry, say that again?');
    expect(c.kind === 'match' && c.clarify).toBe(true);
    expect(c.kind === 'match' && c.fn).toBe('clarify');
  });
  test('um/uh만이면 backchannel(팁), 뱅크 밖은 miss(무벌점), 빈 말은 empty', () => {
    expect(judgeReaction('um uh').kind).toBe('backchannel');
    expect(judgeReaction('mhm').kind).toBe('backchannel');
    expect(judgeReaction('The server is down').kind).toBe('miss');
    expect(judgeReaction('  ').kind).toBe('empty');
  });
  test('두 문장 나누기 — 약어(Mr.)는 붙여 둔다', () => {
    expect(splitSentences('I met Mr. Grant today. He was angry!')).toEqual(['I met Mr. Grant today.', 'He was angry!']);
    expect(splitForReaction('I had a long day. My laptop crashed twice.')).toEqual({ first: 'I had a long day.', rest: 'My laptop crashed twice.' });
    expect(splitForReaction('Just one sentence here')).toBeNull();
  });
  test('3번째 턴 전에만·한 번만·두 문장일 때만 연다', () => {
    const reply = 'I had a really long day. My laptop crashed twice.';
    expect(shouldReactionTurn({ enabled: true, myTurns: 2, reply, done: false })).toBe(true);
    expect(shouldReactionTurn({ enabled: true, myTurns: 1, reply, done: false })).toBe(false);
    expect(shouldReactionTurn({ enabled: true, myTurns: 2, reply, done: true })).toBe(false);
    expect(shouldReactionTurn({ enabled: false, myTurns: 2, reply, done: false })).toBe(false);
    // 짧은 맞장구 + 질문은 reaction 표시가 없으면 열지 않는다
    expect(shouldReactionTurn({ enabled: true, myTurns: 2, reply: 'Great. Tell me more.', done: false })).toBe(false);
    expect(shouldReactionTurn({ enabled: true, myTurns: 2, reply: 'Great. Tell me more.', reaction: true, done: false })).toBe(true);
  });
});

describe('지표', () => {
  test('반응 지연 = (녹음 시작 − 인물 끝) + 첫 유성', () => {
    expect(turnLatencyMs({ partnerEndAt: 1000, recStartAt: 2200, voiceOnsetMs: 600 })).toBe(1800);
    expect(turnLatencyMs({ partnerEndAt: null, recStartAt: 2200, voiceOnsetMs: 600 })).toBe(600);
    expect(turnLatencyMs({ partnerEndAt: 1000, recStartAt: 2200 })).toBeUndefined();
    expect(latencyLabel(1800)).toBe('⏱ 1.8초');
    expect(median([3000, 1000, 2000])).toBe(2000);
    expect(median([])).toBeNull();
  });
  test('WPM·필러·최장 문장·사다리 요일·증거 점수', () => {
    expect(wpmOf('one two three four five', 3500, 500)).toBe(100);
    expect(wpmOf('hi', 800)).toBeUndefined();
    expect(fillerCount('um I uh think so')).toBe(2);
    expect(longestSentence(['Hi.', 'I work in cloud sales now.', 'Okay sure'])).toBe('I work in cloud sales now.');
    expect(longestSentence(['Hi.', 'Yes'])).toBeNull();
    expect(isLadderDay(new Date(2026, 8, 29))).toBe(true); // 화
    expect(isLadderDay(new Date(2026, 9, 2))).toBe(true); // 금
    expect(isLadderDay(new Date(2026, 8, 30))).toBe(false); // 수
    expect(dtalkEvidenceScore('A2', 'B1')).toBe(75);
    expect(dtalkEvidenceScore('A2', 'A1')).toBe(60);
    expect(dtalkEvidenceScore('B1', 'A1')).toBe(40);
  });
  test('va_dtalk_stats — 같은 날 합산, 고유 리액션', () => {
    const now = new Date(2026, 9, 2, 10);
    saveDtalkStats({ turns: 5, latencyMed: 1800, fixPass: 1, fixTotal: 2, reactions: 1, reactionIds: ['ack-01'], clarify: 0, fillers: 2, koTurns: 1 }, now);
    const s = saveDtalkStats({ turns: 5, latencyMed: 1500, fixPass: 1, fixTotal: 1, reactions: 2, reactionIds: ['ack-01', 'clarify-01'], clarify: 1, fillers: 0, koTurns: 0 }, now);
    expect(s.turns).toBe(10);
    expect(s.fixPass).toBe(2);
    expect(s.fixTotal).toBe(3);
    expect(s.reactionsUnique.sort()).toEqual(['ack-01', 'clarify-01']);
    expect(Object.keys(dtalkStats())).toEqual(['2026-10-02']);
  });
});
