import { beforeEach, describe, expect, test } from 'vitest';
import { nextActions, overall, recordSkillResult, skillLevel, startLevelFor, syncCefr, takePromotion, cefrState, setLevelPreset } from '../../lib/cefrGrowth';
import { CAN_DOS, canDosFor } from '../../lib/cefrDescriptors';
import { getProfile } from '../../lib/state';
import { levelRank, nextNewWords } from '../../lib/words';

beforeEach(() => localStorage.clear());
const place = (cefr: string) => localStorage.setItem('va_placed', JSON.stringify({ cefr, gse: 30, ts: Date.now() }));

describe('Can-do 기술문', () => {
  test('4기능 × 6레벨 × 3문항 = 72', () => {
    expect(CAN_DOS.length).toBe(72);
    expect(canDosFor('B1', 'speaking').length).toBe(3);
    expect(new Set(CAN_DOS.map((c) => c.id)).size).toBe(72);
  });
});

describe('레벨 인플레이션 회귀 — 어려운 걸 고르기만 해서는 오르지 않는다', () => {
  test('C2 과제를 0점 받아도 C2가 되지 않는다(이전: GSE 76)', () => {
    place('A2');
    for (let i = 0; i < 5; i++) recordSkillResult('reading', 'C2', 0, 'reading');
    const s = skillLevel('reading');
    expect(s.level).toBe('A2');
    expect(s.gse).toBeLessThan(36);
  });
  test('레벨은 한 번 통과로 오르지 않는다(70점+ 3회)', () => {
    place('A2');
    recordSkillResult('listening', 'B1', 90, 'listening');
    recordSkillResult('listening', 'B1', 90, 'listening');
    expect(skillLevel('listening').level).toBe('A2');
    expect(skillLevel('listening').progress).toBeCloseTo(2 / 3);
    recordSkillResult('listening', 'B1', 75, 'listening');
    expect(skillLevel('listening').level).toBe('B1');
  });
  test('60~69점은 반 번으로 센다', () => {
    place('A2');
    recordSkillResult('reading', 'B1', 65, 'reading');
    expect(skillLevel('reading').passes).toBe(0.5);
  });
  test('높은 레벨 통과는 낮은 레벨도 입증한다', () => {
    place('A1');
    for (let i = 0; i < 3; i++) recordSkillResult('writing', 'B2', 80, 'writing');
    expect(skillLevel('writing').level).toBe('B2');
  });
  test('드릴(따라 읽기) 점수는 말하기 레벨을 올리지 않는다', () => {
    place('A2');
    for (let i = 0; i < 6; i++) recordSkillResult('speaking', 'C1', 100, 'drill');
    expect(skillLevel('speaking').level).toBe('A2');
  });
});

describe('종합 레벨 = 4기능 중 3개', () => {
  test('한 기능만 튀어도 종합은 그대로', () => {
    place('A2');
    for (let i = 0; i < 3; i++) recordSkillResult('reading', 'B2', 90, 'reading');
    expect(overall().level).toBe('A2');
  });
  test('3개 기능이 B1을 입증하면 승급하고, 한 번만 축하한다', () => {
    place('A2');
    syncCefr();
    for (const sk of ['listening', 'reading', 'writing'] as const) for (let i = 0; i < 3; i++) recordSkillResult(sk, 'B1', 80, sk);
    const o = overall();
    expect(o.level).toBe('B1');
    expect(takePromotion()).toBe('B1');
    expect(takePromotion()).toBeNull();
    expect(cefrState().history.map((h) => h.level)).toEqual(['A2', 'B1']);
    expect(getProfile().cefr).toBe('B1');
  });
  test('진척은 가장 가까운 3개 기능 기준', () => {
    place('A2');
    for (let i = 0; i < 3; i++) recordSkillResult('listening', 'B1', 80, 'listening');
    expect(overall().progress).toBeCloseTo(1 / 3);
  });
  test('측정 전이면 measured=false', () => {
    expect(overall().measured).toBe(false);
    place('B1');
    expect(overall().measured).toBe(true);
  });
});

describe('다음 할 일 · 레벨 시작점', () => {
  test('다음 레벨에 못 미친 기능만, 가까운 것부터', () => {
    place('A2');
    recordSkillResult('reading', 'B1', 90, 'reading');
    const a = nextActions();
    expect(a.length).toBe(4);
    expect(a[0].skill).toBe('reading');
    expect(a.every((x) => x.level === 'B1')).toBe(true);
    expect(a.find((x) => x.skill === 'speaking')!.mode).toBe('talk');
  });
  test('기능 화면은 i+1(다음 레벨)로 시작, 프리셋이 있으면 그것', () => {
    place('A2');
    expect(startLevelFor('listening')).toBe('B1');
    setLevelPreset('listening', 'C1');
    expect(startLevelFor('listening')).toBe('C1');
    expect(startLevelFor('listening')).toBe('B1');
  });
});

describe('단어도 CEFR 목표 레벨부터', () => {
  test('levelRank: 목표 → 한 단계 아래 → 더 아래 → 위', () => {
    expect(levelRank('B1', 'B1')).toBe(0);
    expect(levelRank('A2', 'B1')).toBe(1);
    expect(levelRank('A1', 'B1')).toBe(3);
    expect(levelRank('B2', 'B1')).toBe(6);
  });
  test('초급(A2) 학습자의 첫 신규 단어는 A2가 가장 많다(전문어 폭탄 방지)', () => {
    place('A2');
    const lv = nextNewWords(20).map((w) => w.lv);
    expect(lv.filter((x) => x === 'A2').length).toBeGreaterThanOrEqual(10);
    expect(lv.filter((x) => x === 'B2' || x === 'C1').length).toBe(0);
  });
  test('B1 학습자는 한 단계 위(B2) 단어부터', () => {
    place('B1');
    const lv = nextNewWords(20).map((w) => w.lv);
    expect(lv.filter((x) => x === 'B2').length).toBeGreaterThanOrEqual(10);
  });
});

describe('M1 — 집중 모드 발화 증거(retell·dtalk·drama-blind)는 레벨 입증에 센다', () => {
  test('리텔 2회 + 회화 1회(70점↑)로 말하기 B1 입증, 자막 없이 듣기는 듣기 증거', async () => {
    const { EVIDENCE_SRCS, isEvidenceSrc } = await import('../../lib/cefrGrowth');
    expect(EVIDENCE_SRCS).toEqual(expect.arrayContaining(['retell', 'dtalk', 'drama-blind']));
    expect(isEvidenceSrc('retell')).toBe(true);
    expect(isEvidenceSrc('hacker')).toBe(false);
    place('A2');
    recordSkillResult('speaking', 'B1', 80, 'retell');
    recordSkillResult('speaking', 'B1', 75, 'retell');
    expect(skillLevel('speaking').level).toBe('A2');
    recordSkillResult('speaking', 'B1', 90, 'dtalk');
    expect(skillLevel('speaking').level).toBe('B1');
    for (let i = 0; i < 3; i++) recordSkillResult('listening', 'B1', 85, 'drama-blind');
    expect(skillLevel('listening').level).toBe('B1');
    const ev = JSON.parse(localStorage.getItem('va_cefr_evidence') || '[]') as { src: string; counts: boolean }[];
    expect(ev.every((e) => e.counts)).toBe(true);
  });
});
