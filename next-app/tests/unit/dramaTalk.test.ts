import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import seed from '../../data/dramaSeed.json';
import { completeEpisode, recallItems, type Episode } from '../../lib/drama';
import { saveFixes, talkSetup, talkSystemPrompt, usedExpressions, validateTalk } from '../../lib/dramaTalk';
import { getMistakes } from '../../lib/transfer';

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());
const eps = (seed as unknown as { episodes: Episode[] }).episodes;

describe('드라마 인물과 대화하기(집중 모드 회화)', () => {
  test('본 화가 없으면 대화 상대가 없다(1화 보러 가기)', () => {
    expect(talkSetup()).toBeNull();
  });
  test('가장 최근에 본 화의, 태오 말고 가장 많이 말한 인물이 상대', () => {
    completeEpisode(eps[0], 100);
    completeEpisode(eps[2], 100);
    const s = talkSetup()!;
    expect(s.ep.no).toBe(3);
    expect(s.partner).toBe('grant');
    const sys = talkSystemPrompt(s);
    expect(sys).toContain('Mr. Grant');
    for (const l of eps[2].learn) expect(sys).toContain(l.en);
  });
  test('응답 검증 — 영어 대사+한국어 번역 필수, 고침·힌트는 모양이 맞을 때만', () => {
    expect(validateTalk({ reply: '안녕', kr: '안녕' })).toBeNull();
    expect(validateTalk({ reply: 'Hi, Taeo!', kr: 'Hi' })).toBeNull();
    const ok = validateTalk({ reply: 'Hi, Taeo!', kr: '안녕, 태오!', fix: { better: 'I am fine.', kr: '괜찮아요.', why: '주어가 필요해요' }, hint: { en: 'Nice to see you.', kr: '만나서 반가워요' } })!;
    expect(ok.fix?.better).toBe('I am fine.');
    expect(ok.hint?.en).toBe('Nice to see you.');
    const bad = validateTalk({ reply: 'Hi!', kr: '안녕!', fix: { better: '괜찮아', why: 'x' }, hint: { en: '', kr: '' } })!;
    expect(bad.fix).toBeNull();
    expect(bad.hint).toBeNull();
  });
  test('그 화 표현을 내 말 속에서 찾아낸다(대소문자·문장부호 무시)', () => {
    expect(usedExpressions(eps[0], ["well it's MY first day, sorry", 'ok'])).toEqual(["It's my first day."]);
    expect(usedExpressions(eps[0], ['hang in'])).toEqual([]);
  });
  test('고쳐 준 문장은 뜻이 있을 때만 복습 카드로 → 다음 화 첫머리에 나온다', () => {
    completeEpisode(eps[0], 100);
    expect(saveFixes(eps[0], [{ better: 'Could you say that again?', kr: '다시 말해 줄래요?' }, { better: 'No meaning here.', kr: '' }])).toBe(1);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 2 * 86400000); // 첫 복습은 다음 날부터
    expect(recallItems(2, 5).map((r) => r.en)).toContain('Could you say that again?');
  });
  test('M6: fix.wrong·type·reaction은 선택 필드 — 있으면 싣고, 없어도 통과', () => {
    const r = validateTalk({ reply: 'I had a long day. My laptop crashed.', kr: '긴 하루였어요. 노트북이 멈췄어요.', fix: { better: 'I work in sales.', kr: '영업해요.', why: 'be동사 빼요', wrong: 'I am work', type: 'tense' }, hint: null, reaction: true })!;
    expect(r.reaction).toBe(true);
    expect(r.fix).toEqual({ better: 'I work in sales.', kr: '영업해요.', why: 'be동사 빼요', wrong: 'I am work', type: 'tense' });
    const old = validateTalk({ reply: 'Hi!', kr: '안녕!', fix: { better: 'Hi there.', kr: '안녕.', why: '인사' }, hint: null })!;
    expect(old.reaction).toBeUndefined();
    expect(old.fix && 'wrong' in old.fix).toBe(false);
    // 모르는 유형은 other, 한글 섞인 wrong은 버린다
    const odd = validateTalk({ reply: 'Hi!', kr: '안녕!', fix: { better: 'Hi there.', kr: '안녕.', why: '인사', wrong: '안녕 there', type: 'weird' } })!;
    expect(odd.fix?.type).toBe('other');
    expect(odd.fix?.wrong).toBeUndefined();
    expect(validateTalk({ reply: 'Hi!', kr: '안녕!', reaction: 'yes' })!.reaction).toBeUndefined();
  });
  test('M6: 프롬프트에 교정 정책·리액션 턴·한국어 hint·clarify 규칙', () => {
    completeEpisode(eps[0], 100);
    const sys = talkSystemPrompt(talkSetup()!);
    expect(sys).toContain('"reaction":true');
    expect(sys).toContain('리캐스트');
    expect(sys).toContain('hint.en');
    expect(sys).toContain('Sorry?');
    expect(sys).toContain('wrong');
  });
  test('M6: saveFixes는 회상 큐(addWeakItem)와 교정 축적(recordMistake)을 함께 — wrong이 있을 때만 축적', () => {
    completeEpisode(eps[0], 100);
    saveFixes(eps[0], [
      { better: 'I work in cloud sales.', kr: '클라우드 영업해요.', why: 'be동사와 일반동사를 같이 안 써요', wrong: 'I am work in cloud sales.', type: 'tense' },
      { better: 'See you.', kr: '또 봐요.', why: '짧게' },
    ]);
    const ms = getMistakes();
    expect(ms.length).toBe(1);
    expect(ms[0]).toMatchObject({ wrong: 'I am work in cloud sales.', right: 'I work in cloud sales.', type: 'tense' });
    const weak = JSON.parse(localStorage.getItem('va_weak') || '[]');
    expect(weak.map((w: { en: string }) => w.en)).toEqual(expect.arrayContaining(['I work in cloud sales.', 'See you.']));
  });
});
