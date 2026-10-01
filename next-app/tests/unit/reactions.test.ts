import { describe, expect, test } from 'vitest';
import { REACTIONS, REACTION_FNS, expectedFns, isBackchannelOnly, matchReaction, pickFor, pickReactionHints, reactionsFor, type ReactionFn } from '../../lib/reactions';

describe('리액션 뱅크 콘텐츠 무결성', () => {
  test('66개, id 유일', () => {
    expect(REACTIONS.length).toBe(66);
    expect(new Set(REACTIONS.map((r) => r.id)).size).toBe(66);
  });
  test('fn 분포: ack 12·surprise 10·sympathy 8·agree 8·followup 12·hedge 5·close 5·clarify 6', () => {
    const want: Record<ReactionFn, number> = { ack: 12, surprise: 10, sympathy: 8, agree: 8, followup: 12, hedge: 5, close: 5, clarify: 6 };
    for (const fn of REACTION_FNS) expect(reactionsFor(fn).length, fn).toBe(want[fn]);
  });
  test('영어는 6단어 이하, 한국어·when·level 있음', () => {
    for (const r of REACTIONS) {
      expect(r.en.trim().split(/\s+/).length, r.id).toBeLessThanOrEqual(6);
      expect(r.kr.length, r.id).toBeGreaterThan(0);
      expect(r.when.length, r.id).toBeGreaterThan(3);
      expect(['A1', 'A2']).toContain(r.level);
    }
  });
  test('clarify 6개에 생존 청크가 들어 있다', () => {
    const en = reactionsFor('clarify').map((r) => r.en);
    expect(en).toContain('Sorry?');
    expect(en).toContain('Could you say that again?');
    expect(en).toContain('Could you slow down a bit?');
  });
  test('reactionsFor A1은 A1만, A2는 전부', () => {
    expect(reactionsFor('ack', 'A1').every((r) => r.level === 'A1')).toBe(true);
    expect(reactionsFor('ack', 'A2').length).toBe(12);
    expect(reactionsFor('ack', 'A1').length).toBeGreaterThan(0);
  });
});

describe('matchReaction — 발화를 뱅크 항목에 맞춘다', () => {
  test('정확히 같은 말(대소문자·구두점 무시)', () => {
    expect(matchReaction('really?')).toEqual({ id: 'surprise-01', fn: 'surprise' });
    expect(matchReaction('SORRY')).toEqual({ id: 'clarify-01', fn: 'clarify' });
  });
  test('앞에 추임새가 붙어도 부분 일치', () => {
    expect(matchReaction('um, really?')?.fn).toBe('surprise');
  });
  test('"yeah right" 같은 다단어 발화 → 들어 있는 항목(Right.)', () => {
    expect(matchReaction('yeah right')).toEqual({ id: 'ack-03', fn: 'ack' });
  });
  test('긴 항목 우선: "oh no way" → No way!(놀람), "could you say that again please" → clarify', () => {
    expect(matchReaction('oh no way')?.id).toBe('surprise-03');
    expect(matchReaction('Could you say that again, please?')?.fn).toBe('clarify');
    expect(matchReaction('you mean the demo?')?.id).toBe('clarify-03');
  });
  test('단어 경계: surely는 Sure가 아니고, 뱅크 밖의 말은 null', () => {
    expect(matchReaction('surely')).toBeNull();
    expect(matchReaction('I went to Busan')).toBeNull();
    expect(matchReaction('')).toBeNull();
  });
  test('isBackchannelOnly: um/uh/mhm만이면 true', () => {
    expect(isBackchannelOnly('um, uh')).toBe(true);
    expect(isBackchannelOnly('mhm')).toBe(true);
    expect(isBackchannelOnly('um okay')).toBe(false);
    expect(isBackchannelOnly('')).toBe(false);
  });
});

describe('expectedFns — 상대 대사 성격에 맞는 fn', () => {
  test('질문 → followup/ack', () => {
    const f = expectedFns('How was your weekend?');
    expect(f[0]).toBe('followup');
    expect(f).toContain('ack');
  });
  test("나쁜 소식(sorry/delay/can't) → sympathy/clarify", () => {
    const f = expectedFns("Sorry, the shipment is delayed. I can't make it today.");
    expect(f[0]).toBe('sympathy');
    expect(f).toContain('clarify');
  });
  test('좋은 소식(great/done) → surprise/agree', () => {
    const f = expectedFns('Great news. We finally closed the deal!');
    expect(f[0]).toBe('surprise');
    expect(f).toContain('agree');
  });
  test('의견(I think/should) → agree', () => {
    expect(expectedFns('I think we should move the meeting to Friday.')[0]).toBe('agree');
  });
  test('긴 설명 → ack + clarify, 작별 → close', () => {
    const long = 'So the plan is to migrate the database first, then the application servers, and after that we will test everything with the client team before the launch next month.';
    const f = expectedFns(long);
    expect(f).toContain('ack');
    expect(f).toContain('clarify');
    expect(expectedFns('Okay, see you tomorrow. Take care!')[0]).toBe('close');
    expect(expectedFns('Hi Taeo. Good to see you.')[0]).not.toBe('close');
  });
  test('항상 2~3개, 중복 없음', () => {
    for (const line of ['Hello.', 'I went to the gym.', 'Really? What happened then?', '']) {
      const f = expectedFns(line);
      expect(f.length).toBeGreaterThanOrEqual(2);
      expect(f.length).toBeLessThanOrEqual(3);
      expect(new Set(f).size).toBe(f.length);
    }
  });
});

describe('pickReactionHints / pickFor', () => {
  test('n개, 같은 대사면 같은 결과, A1이면 A1 항목만', () => {
    const line = "Sorry, I'm late. The subway was delayed.";
    const a = pickReactionHints(line, 3, 'A1');
    const b = pickReactionHints(line, 3, 'A1');
    expect(a.length).toBe(3);
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
    expect(a.every((r) => r.level === 'A1')).toBe(true);
    expect(a[0].fn).toBe('sympathy');
    expect(new Set(a.map((r) => r.id)).size).toBe(3);
  });
  test('pickFor는 fn·레벨에 맞는 항목, seed로 돌려 뽑는다', () => {
    expect(pickFor('clarify', 'A1')?.fn).toBe('clarify');
    expect(pickFor('hedge', 'A1', 0)?.id).not.toBe(pickFor('hedge', 'A1', 1)?.id);
  });
});
