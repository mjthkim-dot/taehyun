import { beforeEach, describe, expect, test } from 'vitest';
import bank from '../../data/wordBank.json';
import {
  allWords, clozeOf, dueWords, getPacks, gradeWord, makeQuiz, nextNewWords, newQuotaLeft, progress,
  quizKindFor, setWordConfig, todayQueue, wordStats, wordStatsBySituation, INTERVAL_DAYS,
} from '../../lib/words';
import { wordsGradedToday } from '../../lib/wordProgress';
import { SITUATION_BY_ID, rootOf } from '../../lib/ontology/schema';

beforeEach(() => localStorage.clear());

describe('단어 뱅크', () => {
  test('모든 원본 항목은 6칸(단어·품사·뜻·레벨·예문·예문뜻)', () => {
    for (const p of (bank as { packs: { words: unknown[][] }[] }).packs) for (const w of p.words) expect(w.length).toBe(6);
  });
  test('500개 이상, 팩 13+직무 6', () => {
    expect(allWords().length).toBeGreaterThanOrEqual(500);
    expect(getPacks().length).toBeGreaterThanOrEqual(19);
  });
  test('단어 id는 유일하다', () => {
    const ids = allWords().map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test('모든 단어의 상황은 온톨로지 분류표에 있다', () => {
    for (const w of allWords()) expect(SITUATION_BY_ID[w.sit], w.id).toBeTruthy();
  });
  test('뜻은 한국어, 예문은 영어', () => {
    for (const w of allWords()) {
      expect(/[가-힣]/.test(w.kr), w.id).toBe(true);
      expect(/[a-z]/i.test(w.ex), w.id).toBe(true);
    }
  });
});

describe('간격 반복', () => {
  test('맞히면 상자가 오르고 다음 복습이 뒤로 간다', () => {
    const w = allWords()[0];
    const s1 = gradeWord(w.id, true);
    expect(s1.b).toBe(1);
    const s2 = gradeWord(w.id, true);
    expect(s2.b).toBe(2);
    expect(s2.d - Date.now()).toBeGreaterThan((INTERVAL_DAYS[2] - 0.01) * 86400000);
  });
  test('틀리면 상자 1로 떨어지고 오답이 쌓인다', () => {
    const w = allWords()[1];
    gradeWord(w.id, true);
    gradeWord(w.id, true);
    const s = gradeWord(w.id, false);
    expect(s.b).toBe(1);
    expect(s.l).toBe(1);
  });
  test('세션 내 재출제(retry)는 상자를 움직이지 않는다', () => {
    const w = allWords()[2];
    gradeWord(w.id, false);
    const s = gradeWord(w.id, true, { retry: true });
    expect(s.b).toBe(1);
  });
  test('채점이 오늘 기록에 쌓인다(프로그램 워밍업 신호)', () => {
    for (const w of allWords().slice(0, 10)) gradeWord(w.id, true);
    expect(wordsGradedToday()).toBe(10);
    expect(wordStats().today.new).toBe(10);
  });
});

describe('오늘의 큐', () => {
  test('신규 할당량만큼 — 채점할수록 줄어든다', () => {
    setWordConfig({ daily: 10 });
    expect(todayQueue().filter((q) => q.kind === 'learn').length).toBe(10);
    for (const w of nextNewWords(4)) gradeWord(w.id, true);
    expect(newQuotaLeft()).toBe(6);
  });
  test('여러 팩을 번갈아 꺼낸다(상황 인터리빙)', () => {
    const packsOf = nextNewWords(6).map((w) => w.pack);
    expect(new Set(packsOf).size).toBeGreaterThanOrEqual(5);
  });
  test('고른 팩에서만 꺼낸다', () => {
    setWordConfig({ packs: ['finops'] });
    expect(nextNewWords(8).every((w) => w.pack === 'finops')).toBe(true);
  });
  test('복습 기한이 된 단어가 먼저 온다', () => {
    const w = allWords()[5];
    gradeWord(w.id, false);
    const all = progress();
    all[w.id].d = Date.now() - 1000;
    localStorage.setItem('va_words', JSON.stringify(all));
    expect(dueWords().map((x) => x.id)).toContain(w.id);
    expect(todayQueue()[0].word.id).toBe(w.id);
  });
});

describe('문제', () => {
  test('상자가 오를수록 어려운 유형', () => {
    expect(quizKindFor(0)).toBe('meaning');
    expect(['reverse', 'meaning']).toContain(quizKindFor(2, 1));
    expect(['cloze', 'listen', 'reverse']).toContain(quizKindFor(5, 1));
  });
  test('보기 4개, 정답 1개, 중복 없음', () => {
    for (const w of allWords().slice(0, 40)) {
      for (const k of ['meaning', 'reverse', 'cloze', 'listen'] as const) {
        const q = makeQuiz(w, k, 3);
        expect(q.options.length).toBe(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.options[q.answer]).toBe(q.kind === 'meaning' || q.kind === 'listen' ? w.kr : w.w);
      }
    }
  });
  test('빈칸은 예문에서 표제어를 지운다(활용형 포함)', () => {
    const w = allWords().find((x) => x.w === 'reduce')!;
    expect(clozeOf(w)).toBe('We _____ costs by 20%.');
  });
});

describe('온톨로지 연결', () => {
  test('상황별 단어 집계가 최상위 상황으로 모인다', () => {
    const w = allWords().find((x) => x.pack === 'finops')!;
    gradeWord(w.id, true);
    const by = wordStatsBySituation(rootOf);
    expect(by['finops'].seen).toBe(1);
    expect(by['finops'].total).toBeGreaterThan(30);
  });
});
