import { describe, expect, test } from 'vitest';
import { allPairs, pairsFor, hasDrill, drillItemsFor, functionalLoadOf, FUNCTIONAL_LOAD } from '../../lib/minimalPairs';

describe('minimalPairs — 60쌍·기능 부하(M9)', () => {
  test('총 60쌍, 축마다 a≠b', () => {
    const all = allPairs();
    expect(all.length).toBe(60);
    for (const p of all) {
      expect(p.a).not.toBe(p.b);
      expect(p.sentence.en.length).toBeGreaterThan(0);
      expect(p.sentence.kr.length).toBeGreaterThan(0);
    }
  });

  test('모든 쌍에 fl이 있고 축 규칙과 일치한다', () => {
    const all = allPairs();
    const dist = { high: 0, mid: 0, low: 0 };
    for (const p of all) {
      expect(p.fl).toBeDefined();
      expect(p.fl).toBe(functionalLoadOf(p.axis));
      dist[p.fl!] += 1;
    }
    // r-l·f-p·v-b·voicing·vowel-long·vowel-ae-e·final-consonant = high, th·z-s·sh-s·ch-j = mid, vowel = low
    expect(dist.high).toBe(7 + 6 + 5 + 4 + 5 + 4 + 8);
    expect(dist.mid).toBe(5 + 4 + 6 + 3);
    expect(dist.low).toBe(3);
    expect(dist.high + dist.mid + dist.low).toBe(60);
  });

  test('기능 부하 표: 고FL 7축·중FL 4축, 나머지는 low', () => {
    expect(Object.values(FUNCTIONAL_LOAD).filter((v) => v === 'high').length).toBe(7);
    expect(Object.values(FUNCTIONAL_LOAD).filter((v) => v === 'mid').length).toBe(4);
    expect(functionalLoadOf('vowel')).toBe('low');
    expect(functionalLoadOf('omission')).toBe('low');
  });

  test('A1/A2 어휘 — 단어는 짧고(≤8자) 소문자 알파벳만', () => {
    for (const p of allPairs()) {
      for (const w of [p.a, p.b]) {
        expect(w).toMatch(/^[a-z]+$/);
        expect(w.length).toBeLessThanOrEqual(8);
      }
    }
  });

  test('추가된 쌍은 축별 목록 끝에 붙고 기존 첫 쌍은 그대로다', () => {
    expect(pairsFor('r-l')[0].a).toBe('right');
    expect(pairsFor('final-consonant').map((p) => p.a)).toEqual(['back', 'right', 'lock', 'card', 'need', 'hard', 'test', 'site']);
    expect(pairsFor('sh-s').map((p) => p.a)).toContain('show');
  });

  test('기존 export(hasDrill·pairsFor·drillItemsFor) 유지', () => {
    expect(hasDrill('r-l')).toBe(true);
    expect(hasDrill('omission')).toBe(false);
    expect(pairsFor('nope')).toEqual([]);
    expect(drillItemsFor('th').length).toBe(pairsFor('th').length);
    expect(drillItemsFor('th')[0]).toEqual(pairsFor('th')[0].sentence);
  });
});
