import { beforeEach, describe, expect, test, vi } from 'vitest';

const replies: string[] = [];
const calls: { role: string; content: string }[][] = [];
vi.mock('../../lib/groq', () => ({
  groqComplete: vi.fn(async (msgs: { role: string; content: string }[]) => {
    calls.push(msgs);
    const r = replies.shift();
    if (r === 'THROW') throw new Error('NETWORK');
    return r ?? '';
  }),
}));

import { cafLite, pickCafLite, retellEvidenceScore, buildCafLiteMessages, taskCefr, CAF_MIN_WORDS } from '../../lib/cafLite';
import { recordSkillResult, evidenceLog, skillLevel } from '../../lib/cefrGrowth';

const SAID = 'First I go to office and the elevator stop. Then I meet Diane she is CEO.';

describe('cafLite — 검증(pickCafLite)', () => {
  test('정상: 전사에 있는 wrong + 한국어 kr + 레벨', () => {
    const r = pickCafLite({ fix: { wrong: 'the elevator stop', better: 'the elevator stopped', kr: '과거 일이라 stopped' }, level: 'a2' }, SAID);
    expect(r).toEqual({ fix: { wrong: 'the elevator stop', better: 'the elevator stopped', kr: '과거 일이라 stopped' }, level: 'A2' });
  });
  test('fix null도 정상', () => {
    expect(pickCafLite({ fix: null, level: 'B1' }, SAID)).toEqual({ fix: null, level: 'B1' });
  });
  test('레벨이 없거나 C1·이상한 값 → null(재시도)', () => {
    expect(pickCafLite({ fix: null }, SAID)).toBeNull();
    expect(pickCafLite({ fix: null, level: 'C1' }, SAID)).toBeNull();
    expect(pickCafLite(null, SAID)).toBeNull();
    expect(pickCafLite([], SAID)).toBeNull();
  });
  test('kr이 영어 → null(한국어로 다시 묻기)', () => {
    expect(pickCafLite({ fix: { wrong: 'the elevator stop', better: 'the elevator stopped', kr: 'past tense' }, level: 'A2' }, SAID)).toBeNull();
  });
  test('전사에 없는 wrong·같은 문장·너무 긴 better → fix만 버리고 레벨은 쓴다', () => {
    expect(pickCafLite({ fix: { wrong: 'I am happy today', better: 'I was happy today', kr: '시제' }, level: 'A2' }, SAID)).toEqual({ fix: null, level: 'A2' });
    expect(pickCafLite({ fix: { wrong: 'the elevator stop', better: 'The elevator stop.', kr: '같음' }, level: 'A2' }, SAID)).toEqual({ fix: null, level: 'A2' });
    const long = Array.from({ length: 30 }, () => 'word').join(' ');
    expect(pickCafLite({ fix: { wrong: 'the elevator stop', better: long, kr: '길다' }, level: 'A2' }, SAID)).toEqual({ fix: null, level: 'A2' });
    expect(pickCafLite({ fix: { wrong: '엘리베이터', better: 'x y', kr: '한글' }, level: 'A1' }, SAID)).toEqual({ fix: null, level: 'A1' });
  });
  test('프롬프트는 짧다 — 전사·오늘 표현·JSON 형식', () => {
    const m = buildCafLiteMessages(SAID, { level: 'A2', learn: ["It's my first day."] });
    expect(m).toHaveLength(2);
    expect(m[0].content).toContain('JSON');
    expect(m[1].content).toContain(SAID);
    expect(m[1].content).toContain("It's my first day.");
    expect(m[0].content.length + m[1].content.length).toBeLessThan(1200);
  });
});

describe('cafLite — 호출(실패 무해)', () => {
  beforeEach(() => {
    localStorage.clear();
    replies.length = 0;
    calls.length = 0;
  });
  test('키 없음 → 호출 없이 null', async () => {
    expect(await cafLite(SAID, { level: 'A2' })).toBeNull();
    expect(calls).toHaveLength(0);
  });
  test('짧은 전사 → 호출 없이 null', async () => {
    localStorage.setItem('va_groq_key', JSON.stringify('gsk_test'));
    expect(await cafLite('hi there', { level: 'A2' })).toBeNull();
    expect(CAF_MIN_WORDS).toBe(3);
    expect(calls).toHaveLength(0);
  });
  test('정상 응답', async () => {
    localStorage.setItem('va_groq_key', JSON.stringify('gsk_test'));
    replies.push(JSON.stringify({ fix: { wrong: 'I go to office', better: 'I went to the office', kr: '어제 일이라 went' }, level: 'A2' }));
    const r = await cafLite(SAID, { level: 'A2' });
    expect(r?.level).toBe('A2');
    expect(r?.fix?.better).toBe('I went to the office');
    expect(calls).toHaveLength(1);
  });
  test('영어 설명 → 한 번 다시 묻고, 그래도 비JSON이면 null', async () => {
    localStorage.setItem('va_groq_key', JSON.stringify('gsk_test'));
    replies.push(JSON.stringify({ fix: { wrong: 'I go to office', better: 'I went to the office', kr: 'tense' }, level: 'A2' }), 'not json');
    expect(await cafLite(SAID, { level: 'A2' })).toBeNull();
    expect(calls).toHaveLength(2);
  });
  test('네트워크 오류도 던지지 않고 null', async () => {
    localStorage.setItem('va_groq_key', JSON.stringify('gsk_test'));
    replies.push('THROW');
    await expect(cafLite(SAID, { level: 'A2' })).resolves.toBeNull();
  });
});

describe('cafLite — 말하기 증거(src retell)', () => {
  beforeEach(() => localStorage.clear());
  test('AI 수준이 과제 레벨 이상이면 점수 그대로, 낮으면 NEAR 미만으로', () => {
    expect(retellEvidenceScore(85, 'A2', 'A2')).toBe(85);
    expect(retellEvidenceScore(85, 'A2', 'B1')).toBe(85);
    expect(retellEvidenceScore(85, 'A2', 'A1')).toBe(59);
    expect(retellEvidenceScore(40, 'A2', 'A1')).toBe(40);
    expect(taskCefr('B1')).toBe('B1');
    expect(taskCefr('??')).toBe('A2');
  });
  test("recordSkillResult('speaking', …, 'retell') — 레벨 입증에 센다(70↑ 3회)", () => {
    localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A1', gse: 20, ts: 1 }));
    for (let i = 0; i < 3; i++) recordSkillResult('speaking', 'A2', retellEvidenceScore(80, 'A2', 'A2'), 'retell');
    const ev = evidenceLog().filter((e) => e.src === 'retell');
    expect(ev).toHaveLength(3);
    expect(ev.every((e) => e.counts && e.skill === 'speaking')).toBe(true);
    expect(skillLevel('speaking').level).toBe('A2');
  });
});
