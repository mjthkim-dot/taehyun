import { describe, expect, test } from 'vitest';
import { clauseBoundaries, countWords, pausesFromWords, wordGaps, wordsToMetrics, type FluencyWord } from '../../lib/fluency';
import { analyzePitch } from '../../lib/pitch';
import { deliveryMetrics } from '../../lib/interview';
import { weeklyMetrics } from '../../lib/weeklyTest';

/** 단어 열을 간격(ms) 목록으로 만든다 — 각 단어 300ms, gaps[i]는 i번째와 i+1번째 사이 */
function mk(words: string[], gapsMs: number[], wordMs = 300): FluencyWord[] {
  let t = 0.5;
  return words.map((w, i) => {
    const start = t;
    const end = t + wordMs / 1000;
    t = end + (gapsMs[i] ?? 0) / 1000;
    return { word: w, start, end };
  });
}

describe('wordsToMetrics', () => {
  test('gap 경계 — 299ms는 멈춤이 아니고 300ms는 멈춤, 499ms는 머뭇거림이 아니고 500ms는 머뭇거림', () => {
    const ws = mk(['we', 'found', 'the', 'reason', 'and', 'fixed', 'it'], [299, 300, 100, 499, 500, 0]);
    const m = wordsToMetrics(ws);
    expect(m.pauses300).toBe(3); // 300, 499, 500
    expect(m.hesitations500).toBe(1); // 500
    expect(pausesFromWords(ws)).toEqual([300, 499, 500]);
    expect(wordGaps(ws).map((g) => g.ms)).toEqual([299, 300, 100, 499, 500, 0]);
  });

  test('절 경계 — 목표 문장의 쉼표·접속사 위치에서 쉬면 절 내부 멈춤이 아니다', () => {
    const target = 'It was our team, and we fixed it together.';
    // "team" 뒤(쉼표·and 앞)에서 600ms, "fixed" 뒤(절 안)에서 400ms
    const ws = mk(['It', 'was', 'our', 'team', 'and', 'we', 'fixed', 'it', 'together'], [0, 0, 0, 600, 0, 0, 400, 0]);
    const m = wordsToMetrics(ws, target);
    expect(m.pauses300).toBe(2);
    expect(m.clauseInternalPauses).toBe(1);
    expect([...clauseBoundaries(ws, target)]).toEqual([3]);
  });

  test('절 경계 — 목표 문장이 없으면 전사의 구두점·접속사로 잡는다', () => {
    const ws = mk(['We', 'found', 'it,', 'and', 'we', 'fixed', 'it'], [0, 0, 500, 0, 350, 0]);
    const m = wordsToMetrics(ws);
    expect(m.pauses300).toBe(2);
    // "it," 뒤는 경계(쉼표 + and), "we" 뒤는 절 안
    expect(m.clauseInternalPauses).toBe(1);
  });

  test('words 없음 — 전부 0', () => {
    expect(wordsToMetrics([])).toEqual({ wpm: 0, articulationRate: 0, pauses300: 0, hesitations500: 0, clauseInternalPauses: 0, mlr: 0 });
  });

  test('WPM — 녹음 길이 기준, articulationRate는 멈춤을 뺀 시간 기준', () => {
    // 10단어, 각 300ms, 사이 멈춤 1000ms 하나 → 발화 구간 = 3000 + 1000 = 4000ms
    const ws = mk(Array.from({ length: 10 }, (_, i) => `w${i}`), [0, 0, 0, 0, 1000, 0, 0, 0, 0]);
    const m = wordsToMetrics(ws, undefined, 6000);
    expect(m.wpm).toBe(100); // 10단어 / 6초
    expect(m.articulationRate).toBe(200); // 10단어 / (4초 - 1초)
    expect(m.pauses300).toBe(1);
    expect(m.hesitations500).toBe(1);
    expect(m.mlr).toBe(5); // 10단어 / (1 + 1)
  });

  test('durationMs가 없으면 첫 단어~마지막 단어 구간으로 WPM을 잰다', () => {
    const ws = mk(['a', 'b', 'c', 'd', 'e'], [0, 0, 0, 0]); // 1500ms
    expect(wordsToMetrics(ws).wpm).toBe(200);
  });

  test('순서가 뒤섞인 단어도 시간순으로 정렬해 센다', () => {
    const ws = mk(['a', 'b', 'c'], [400, 0]);
    const shuffled = [ws[2], ws[0], ws[1]];
    expect(wordsToMetrics(shuffled).pauses300).toBe(1);
  });

  test('mlr — 멈춤 사이 평균 단어 수(소수 첫째 자리)', () => {
    const ws = mk(['a', 'b', 'c', 'd', 'e', 'f', 'g'], [0, 300, 0, 0, 300, 0]);
    expect(wordsToMetrics(ws).mlr).toBe(2.3); // 7 / 3
  });
});

describe('기존 WPM 계산의 위임', () => {
  const text = 'we found the reason and fixed it together today okay';
  const ws = mk(text.split(' '), [0, 0, 0, 0, 1000, 0, 0, 0, 0]);

  test('analyzePitch — words가 있으면 WPM·긴 멈춤을 fluency에 위임, 없으면 기존 계산', () => {
    expect(analyzePitch(text, 12000).wpm).toBe(50); // 10단어 / 12초 (기존)
    expect(analyzePitch(text, 12000, [3500]).longPauses).toBe(1); // RMS 멈춤(기존)
    expect(analyzePitch(text, 6000, [3500], ws).wpm).toBe(100);
    expect(analyzePitch(text, 6000, [3500], ws).longPauses).toBe(0); // words 기준 — 3초 이상 없음
    expect(analyzePitch(text, 6000, [], mk(['a', 'b'], [3200])).longPauses).toBe(1);
    expect(countWords(text)).toBe(10);
  });

  test('deliveryMetrics — words가 있으면 WPM 위임, 텍스트 입력(durationMs 없음)은 null 유지', () => {
    expect(deliveryMetrics(text).wpm).toBeNull();
    expect(deliveryMetrics(text, 12000).wpm).toBe(50);
    expect(deliveryMetrics(text, 6000, ws).wpm).toBe(100);
  });

  test('weeklyMetrics — words가 있으면 WPM 위임', () => {
    expect(weeklyMetrics(text, 12000)).toEqual({ words: 10, seconds: 12, wpm: 50 });
    expect(weeklyMetrics(text, 6000, ws).wpm).toBe(100);
  });
});
