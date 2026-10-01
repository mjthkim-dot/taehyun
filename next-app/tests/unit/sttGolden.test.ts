import { describe, expect, test } from 'vitest';
import { alignedScore } from '../../lib/align';
import { gate } from '../../lib/sttQuality';
// 생성기는 CLI로도 쓰는 .mjs — tsconfig allowJs로 그대로 읽는다
import { CLEAR_SEGMENT, generateVariants, loadBases, rlSwap } from '../fixtures/gen-stt-golden.mjs';

/**
 * 골든 전사 80케이스 — 사람 작성 20 + 규칙 변형 60(R/L 치환·무음 환각·에코).
 * 채점(alignedScore)·게이트(gate)의 임계가 바뀌면 여기서 걸린다.
 */
interface GoldenCase {
  id: string;
  kind: string;
  target: string;
  said: string;
  partner?: string;
  lastTtsText?: string;
  segments?: { start: number; end: number; avg_logprob: number; no_speech_prob: number; compression_ratio: number }[];
  swapped?: { from: string; to: string };
  expectScoreMin: number;
  expectScoreMax: number;
  expectGate: 'ok' | 'silent' | 'unclear' | 'echo' | 'busy';
}

const bases = loadBases() as GoldenCase[];
const variants = generateVariants(bases) as GoldenCase[];
const all = [...bases, ...variants];

describe('fixture 구성', () => {
  test('기본 20(드라마 10·단어 5·리텔 5) + 변형 60 = 80', () => {
    expect(bases).toHaveLength(20);
    expect(bases.filter((c) => c.kind === 'drama')).toHaveLength(10);
    expect(bases.filter((c) => c.kind === 'word')).toHaveLength(5);
    expect(bases.filter((c) => c.kind === 'retell')).toHaveLength(5);
    expect(variants).toHaveLength(60);
    expect(new Set(all.map((c) => c.id)).size).toBe(80);
  });
  test('기본 문장은 6~12단어, r/l·f/p·받침 소리를 포함한다', () => {
    for (const c of bases) {
      const n = c.target.split(/\s+/).length;
      expect(n, c.id).toBeGreaterThanOrEqual(6);
      expect(n, c.id).toBeLessThanOrEqual(12);
    }
    const joined = bases.map((c) => c.target.toLowerCase()).join(' ');
    expect(joined).toMatch(/r/);
    expect(joined).toMatch(/l/);
    expect(joined).toMatch(/f/);
    expect(joined).toMatch(/p/);
    expect(joined).toMatch(/(ck|ght|st|nd)\b/); // 받침(어말 자음군)
  });
});

describe('80케이스 — 점수 범위와 게이트', () => {
  for (const c of all) {
    test(`${c.id}: "${c.said}"`, () => {
      const seg = c.segments ?? [CLEAR_SEGMENT];
      expect(gate({ text: c.said, segments: seg }, c.lastTtsText)).toBe(c.expectGate);
      const { score } = alignedScore(c.target, c.said);
      expect(score).toBeGreaterThanOrEqual(c.expectScoreMin);
      expect(score).toBeLessThanOrEqual(c.expectScoreMax);
    });
  }
});

describe('임계 60/70 — 통과 기준에서 변형이 어떻게 갈리나(고정값)', () => {
  const pass = (th: number, cases: GoldenCase[]) => cases.filter((c) => alignedScore(c.target, c.said).score >= th).length;
  test('기본 20(학습자 전형 전사)은 60·70 모두 전부 통과', () => {
    expect(pass(60, bases)).toBe(20);
    expect(pass(70, bases)).toBe(20);
  });
  test('무음 환각 20은 60·70 모두 전부 탈락(게이트가 아니어도 채점이 막는다)', () => {
    const silent = variants.filter((c) => c.kind === 'silent');
    expect(pass(60, silent)).toBe(0);
  });
  test('에코 20은 채점만으로는 못 거른다 — 그래서 게이트가 먼저다', () => {
    const echo = variants.filter((c) => c.kind === 'echo');
    // 상대 대사와 목표가 단어를 공유해 점수가 0이 아닌 케이스가 있다(채점만으로는 '틀린 답'처럼 보일 뿐)
    expect(echo.every((c) => gate({ text: c.said, segments: c.segments }, c.lastTtsText) === 'echo')).toBe(true);
  });
});

/**
 * 프롬프트 유/무 FAR(false accept rate) 차이 — 왜 채점 경로가 목표 문장을 Whisper 힌트로 넣지 않는가.
 * 목표 문장을 힌트로 주면 Whisper는 R/L을 틀리게 말해도 힌트 쪽(목표 단어)으로 받아쓴다 — 전사 = 목표.
 * 그러면 바뀐 단어가 diff에서 '맞음'으로 잡힌다(단어 FAR 100%). 고유명사만 주면 들린 대로 적혀
 * 바뀐 단어가 '틀림'으로 잡힌다(단어 FAR 0%). 이 차이를 수치로 고정한다.
 */
describe('프롬프트 유/무 FAR 차이(R/L 변형 20)', () => {
  const rl = variants.filter((c) => c.kind === 'rl');
  const swappedOk = (target: string, said: string, from: string) => {
    const d = alignedScore(target, said).diff.find((x) => x.w === from);
    return d ? d.ok : false;
  };
  test('힌트에 목표 문장을 넣은 경우(전사가 목표로 끌려감): 바뀐 단어가 모두 맞음으로 — 단어 FAR 1.0', () => {
    const far = rl.filter((c) => swappedOk(c.target, c.target /* 힌트 편향: 전사 = 목표 */, c.swapped!.from)).length / rl.length;
    expect(far).toBe(1);
  });
  test('고유명사만 준 경우(들린 대로): 바뀐 단어가 모두 틀림으로 — 단어 FAR 0.0', () => {
    const far = rl.filter((c) => swappedOk(c.target, c.said, c.swapped!.from)).length / rl.length;
    expect(far).toBe(0);
  });
  test('문장 점수는 한 단어 치환으로 100 미만, 60 이상(발음 진단으로 넘어갈 수 있는 범위)', () => {
    for (const c of rl) {
      const s = alignedScore(c.target, c.said).score;
      expect(s, c.id).toBeLessThan(100);
      expect(s, c.id).toBeGreaterThanOrEqual(60);
    }
    // 힌트 편향이면 전부 100 — '맞게 말한 것'과 구별이 안 된다
    expect(rl.every((c) => alignedScore(c.target, c.target).score === 100)).toBe(true);
  });
  test('rlSwap — 사전 단어가 있으면 그것을, 없으면 첫 r→l', () => {
    expect(rlSwap('We found the reason.')).toEqual({ from: 'reason', to: 'leason', said: 'We found the leason.' });
    expect(rlSwap('Hurry up.').said).toBe('Hulry up.');
  });
});
