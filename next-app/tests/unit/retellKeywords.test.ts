import { describe, expect, test } from 'vitest';
import { KEYWORDS } from '../../lib/dramaSeedMine';
import { SEED_RETELL_KEYWORDS, aiKeywordCandidates, contentWords, mixKeywordsFor, retellKeywordsFor } from '../../lib/retellKeywords';
import { keywordsOf, scoreRetell, MARKERS } from '../../lib/retell';

describe('retellKeywords — 시드 7화 28개', () => {
  test('한국어 키워드가 dramaSeedMine.KEYWORDS와 같다(화·순서까지)', () => {
    expect(Object.keys(SEED_RETELL_KEYWORDS).map(Number).sort()).toEqual(Object.keys(KEYWORDS).map(Number).sort());
    for (const no of Object.keys(KEYWORDS).map(Number)) expect(SEED_RETELL_KEYWORDS[no].map((k) => k.kr)).toEqual(KEYWORDS[no]);
  });
  test('28개 전부 영어 후보 ≥2, 소문자·한글 없음·중복 없음', () => {
    const all = Object.values(SEED_RETELL_KEYWORDS).flat();
    expect(all).toHaveLength(28);
    for (const k of all) {
      expect(k.en.length, k.kr).toBeGreaterThanOrEqual(2);
      for (const en of k.en) {
        expect(en).toBe(en.toLowerCase());
        expect(/[가-힣]/.test(en)).toBe(false);
      }
      expect(new Set(k.en).size).toBe(k.en.length);
    }
  });
  test('담화 표지 단어는 키워드 후보로 쓰지 않는다(이중 점수 방지)', () => {
    const markers = new Set(MARKERS.map((m) => m.en));
    for (const k of Object.values(SEED_RETELL_KEYWORDS).flat()) for (const en of k.en) expect(markers.has(en), `${k.kr}: ${en}`).toBe(false);
  });
  test('원고 대사로 리텔하면 키워드가 적중한다(EP1)', () => {
    const kws = retellKeywordsFor({ no: 1, learn: [] });
    const said = "It was my first day. The elevator got stuck and I was really nervous. The woman was Diane, the CEO.";
    expect(scoreRetell({ said, keywords: kws, markers: [], learn: [], durationMs: 15000, wpm: 60, targetSec: 20 }).keywordHits).toBe(4);
  });
  test('keywordsOf(ep)에 넘기면 그대로 쓰인다', () => {
    const ep = { no: 3, level: 'A2', cliff: '', recap: '', keywords: retellKeywordsFor({ no: 3 }) };
    expect(keywordsOf(ep, 3).map((k) => k.kr)).toEqual(KEYWORDS[3].slice(0, 3));
  });
});

describe('retellKeywords — AI 화', () => {
  const learn = [
    { en: 'We need a backup plan.', kr: '예비 계획이 필요해요.' },
    { en: 'Let me walk you through it.', kr: '차근차근 설명해 드릴게요.' },
  ];
  test('로마자·인물명·같은 낱말을 공유하는 표현에서 후보를 만든다', () => {
    expect(aiKeywordCandidates('Grant의 새 요구', learn)).toContain('grant');
    expect(aiKeywordCandidates('마야의 결정', learn)).toContain('maya');
    expect(aiKeywordCandidates('예비 계획', learn)).toEqual(expect.arrayContaining(['need', 'backup', 'plan']));
    expect(aiKeywordCandidates('아무 상관 없는 말', learn)).toEqual([]);
  });
  test('후보 없는 키워드는 빼고 오늘 표현으로 4개까지 채운다', () => {
    const kws = retellKeywordsFor({ no: 9, ai: true, keywords: ['Grant의 새 요구', '아무 상관 없는 말', '예비 계획', '기쁨'], learn });
    expect(kws.map((k) => k.kr)).toEqual(['Grant의 새 요구', '예비 계획', learn[0].kr, learn[1].kr]);
    for (const k of kws) expect(k.en.length).toBeGreaterThan(0);
    // 표현 전체 문장도 후보(마침표 없이)
    expect(kws[3].en[0]).toBe('let me walk you through it');
  });
  test('AI 화인데 keywords가 없으면 learn만', () => {
    expect(retellKeywordsFor({ no: 8, ai: true, learn }).map((k) => k.kr)).toEqual(learn.map((l) => l.kr));
  });
  test('contentWords — 4글자 이상 내용어', () => {
    expect(contentWords("Let's fix it together.")).toEqual(['together']);
  });
  test('토요일 교차 — 화당 2개씩, 중복 없이', () => {
    const mix = mixKeywordsFor([{ no: 5 }, { no: 6 }, { no: 7 }], 2);
    expect(mix.map((k) => k.kr)).toEqual([...KEYWORDS[5].slice(0, 2), ...KEYWORDS[6].slice(0, 2), ...KEYWORDS[7].slice(0, 2)]);
  });
});
