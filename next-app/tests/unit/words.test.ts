import { beforeEach, describe, expect, test, vi } from 'vitest';
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
  test('팩을 가로질러 같은 뜻의 같은 단어는 한 장만(감사 #34), 뜻이 다르면 둘 다', () => {
    const head = (w: string) => w.toLowerCase().replace(/-/g, ' ').trim();
    const by = new Map<string, number>();
    for (const w of allWords()) by.set(head(w.w), (by.get(head(w.w)) || 0) + 1);
    for (const k of ['latency', 'pipeline', 'quote', 'deploy', 'forecast', 'roi', 'deal breaker', 'leverage', 'receipt']) expect(by.get(k), k).toBeLessThanOrEqual(k === 'pipeline' ? 2 : 1);
    expect(by.get('availability')).toBe(2); // 가능한 시간 / 가용성
    expect(by.get('check in')).toBe(2); // 안부 확인 / 체크인
  });
  test('이미 공부 중인 중복 카드는 지우지 않는다', async () => {
    const dropped = ['dv-tech:latency', 'dv-ai-data:latency'].find((id) => !allWords().some((w) => w.id === id))!;
    expect(dropped).toBeTruthy();
    localStorage.setItem('va_words', JSON.stringify({ [dropped]: { box: 2, due: 0 } }));
    vi.resetModules();
    const fresh = await import('../../lib/words');
    expect(fresh.allWords().some((w) => w.id === dropped)).toBe(true);
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
  test('같은 난이도 안에서 여러 팩을 번갈아 꺼낸다(상황 인터리빙)', () => {
    localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
    const packsOf = nextNewWords(6).map((w) => w.pack);
    expect(new Set(packsOf).size).toBeGreaterThanOrEqual(5);
  });
  test('고른 팩에서만 꺼낸다(초급은 업무 생존 영어가 늘 함께)', () => {
    setWordConfig({ packs: ['finops'] });
    // 초급(A1·A2 목표): 고른 팩 + 기초 팩
    expect(nextNewWords(8).every((w) => w.pack === 'finops' || w.pack === 'basics')).toBe(true);
    expect(nextNewWords(8).some((w) => w.pack === 'basics')).toBe(true);
    // B1 이상 배치: 고른 팩만
    localStorage.setItem('va_placed', JSON.stringify({ cefr: 'B1', gse: 45, ts: Date.now() }));
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

describe('오답 보기 — 정답과 같은 뜻은 쓰지 않는다', () => {
  test('뜻 고르기 보기 중 정답과 핵심 뜻이 겹치는 것이 없다', async () => {
    const { makeQuiz } = await import('../../lib/words');
    const stems = (kr: string) => new Set(kr.split(/[\s,·()~/]+/).map((t) => t.replace(/[을를이가은는의에]$/, '').replace(/(하다|되다|하는|한|다)$/, '')).filter((t) => t.length >= 2));
    let bad = 0;
    for (const w of allWords().slice(0, 200)) {
      const q = makeQuiz(w, 'meaning', 5);
      const right = stems(w.kr);
      for (const [k, o] of q.options.entries()) if (k !== q.answer && [...stems(o)].some((t) => right.has(t))) bad++;
    }
    expect(bad).toBe(0);
  });
});

describe('초급 단어(감사 v1.31 비평 #12)', () => {
  test('업무 생존 영어 팩 — A1·A2만 100개 이상', () => {
    const basics = getPacks().find((p) => p.id === 'basics')!;
    expect(basics.words.length).toBeGreaterThanOrEqual(100);
    expect(basics.words.every((w) => w.lv === 'A1' || w.lv === 'A2')).toBe(true);
  });
  test('목표보다 어려운 단어는 하루 할당의 20%까지만', () => {
    for (const n of [10, 20, 30]) {
      const picks = nextNewWords(n, 'A2');
      const hard = picks.filter((w) => !['A1', 'A2'].includes(w.lv)).length;
      expect(hard).toBeLessThanOrEqual(Math.floor(n * 0.2));
    }
  });
});
