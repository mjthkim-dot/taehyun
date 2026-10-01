import { describe, expect, test } from 'vitest';
import { FUNCTION_WORDS, stressProfile, rhythmChip, RHYTHM_CHIPS, isFunctionWord } from '../../lib/rhythm';

/** 단어 목록과 길이(ms)로 타임스탬프를 만든다 */
function timed(pairs: [string, number][]) {
  let t = 0;
  return pairs.map(([word, dur]) => {
    const w = { word, start: t, end: t + dur };
    t += dur;
    return w;
  });
}

describe('rhythm — 기능어 리듬 칩(M9)', () => {
  test('기능어 목록 ~40개, 관사·전치사·조동사·대명사·접속사 포함', () => {
    expect(FUNCTION_WORDS.size).toBeGreaterThanOrEqual(40);
    for (const w of ['the', 'to', 'a', 'of', 'can', 'is', 'you', 'and']) expect(FUNCTION_WORDS.has(w)).toBe(true);
    expect(FUNCTION_WORDS.has('data')).toBe(false);
  });

  test('stressProfile — 내용어/기능어 구분, 축약형은 앞부분으로', () => {
    expect(stressProfile('I will send the file to you.')).toEqual([
      { w: 'i', content: false },
      { w: 'will', content: false },
      { w: 'send', content: true },
      { w: 'the', content: false },
      { w: 'file', content: true },
      { w: 'to', content: false },
      { w: 'you', content: false },
    ]);
    expect(isFunctionWord("I'm")).toBe(true);
    expect(isFunctionWord("don't")).toBe(false);
    expect(stressProfile('')).toEqual([]);
  });

  test('비율 계산 — 내용어 평균 ÷ 기능어 평균', () => {
    // send 400, file 400 / the 200, to 200 → 2.0
    const r = rhythmChip(timed([['send', 400], ['the', 200], ['file', 400], ['to', 200]]));
    expect(r).not.toBeNull();
    expect(r!.ratio).toBe(2);
    expect(r!.ok).toBe(true);
    expect(r!.chip).toBe(RHYTHM_CHIPS.good);
  });

  test('칩 3종 — 비율 <1.0 가볍게 / 1.0~1.3 내용어 길게 / ≥1.3 좋아요', () => {
    const lighten = rhythmChip(timed([['send', 300], ['the', 400], ['file', 300], ['to', 400]]));
    expect(lighten!.ratio).toBeCloseTo(0.75, 2);
    expect(lighten!.chip).toBe(RHYTHM_CHIPS.lighten);
    expect(lighten!.ok).toBe(false);

    const stress = rhythmChip(timed([['send', 330], ['the', 300], ['file', 330], ['to', 300]]));
    expect(stress!.ratio).toBe(1.1);
    expect(stress!.chip).toBe(RHYTHM_CHIPS.stress);
    expect(stress!.ok).toBe(false);

    const good = rhythmChip(timed([['send', 390], ['the', 300], ['file', 390], ['to', 300]]));
    expect(good!.ratio).toBe(1.3);
    expect(good!.chip).toBe(RHYTHM_CHIPS.good);
    expect(good!.ok).toBe(true);
    expect(new Set([lighten!.chip, stress!.chip, good!.chip]).size).toBe(3);
  });

  test('null 경로 — 타임스탬프 없음, 빈 배열, 한쪽 품사 없음, 길이 0', () => {
    expect(rhythmChip(undefined)).toBeNull();
    expect(rhythmChip(null)).toBeNull();
    expect(rhythmChip([])).toBeNull();
    expect(rhythmChip(timed([['send', 300], ['file', 300]]))).toBeNull(); // 기능어 없음
    expect(rhythmChip(timed([['the', 300], ['to', 300]]))).toBeNull(); // 내용어 없음
    expect(rhythmChip([{ word: 'send', start: 1, end: 1 }, { word: 'the', start: 1, end: 1 }])).toBeNull();
  });

  test('targetEn이 있고 단어 수가 같으면 목표 문장 기준으로 품사를 본다', () => {
    // Whisper가 the를 'da'로 들어도 목표의 자리로 기능어로 센다
    const r = rhythmChip(timed([['send', 400], ['da', 200], ['file', 400]]), 'Send the file.');
    expect(r!.ratio).toBe(2);
    // 단어 수가 다르면 들린 단어 자체로 판단한다
    const r2 = rhythmChip(timed([['send', 400], ['da', 200]]), 'Send the file.');
    expect(r2).toBeNull(); // 'da'는 내용어로 취급 → 기능어 없음
  });
});
