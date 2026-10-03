import { beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import bank from '../../data/wordBank.json';
import {
  allWords, clozeOf, dueWords, getPacks, gradeWord, makeQuiz, nextNewWords, newQuotaLeft, progress,
  quizKindFor, setWordConfig, todayQueue, wordStats, wordStatsBySituation, INTERVAL_DAYS,
  AI_EXCLUDED_PACKS, bumpWordsSpoken, generateMoreWords, speakQuizAvailable, speakScore, wordsSpokenToday, SPEAK_PASS, WORDS_SPEAK_GOAL,
} from '../../lib/words';
import { wordsGradedToday } from '../../lib/wordProgress';
import { SITUATION_BY_ID, rootOf } from '../../lib/ontology/schema';
import { KONGLISH_RULES } from '../../lib/l1Grammar';
import { VOCAB_DOMAINS } from '../../lib/domainVocab';

const ROOT = path.resolve(__dirname, '../..');
type RawBank = { packs: { id: string; words: string[][] }[] };
const RAW = bank as RawBank;

beforeEach(() => localStorage.clear());

describe('단어 뱅크', () => {
  test('모든 원본 항목은 6칸(단어·품사·뜻·레벨·예문·예문뜻)', () => {
    for (const p of RAW.packs) for (const w of p.words) expect(w.length).toBe(6);
  });
  test('500개 이상, 팩 16(M8: konglish·numbers 추가)+직무 연어 팩', () => {
    expect(allWords().length).toBeGreaterThanOrEqual(500);
    expect(RAW.packs.length).toBe(16);
    expect(getPacks().length).toBe(RAW.packs.length + VOCAB_DOMAINS.length);
  });
  test('lib/words.ts 머리 주석의 팩·단어 수가 JSON과 같다(낡은 수치를 두지 않는다)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'lib/words.ts'), 'utf8');
    const m = src.match(/wordBank\.json\((\d+)개 상황 팩 (\d+)개/);
    expect(m, '머리 주석 "data/wordBank.json(N개 상황 팩 M개"').toBeTruthy();
    expect(Number(m![1])).toBe(RAW.packs.length);
    expect(Number(m![2])).toBe(RAW.packs.reduce((a, p) => a + p.words.length, 0));
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

describe('M8 콩글리시·숫자 팩', () => {
  test('basics 다음에 konglish·numbers, 각 10개(6칸 튜플), 중복 정리 뒤에도 10개', () => {
    const ids = RAW.packs.map((p) => p.id);
    expect(ids.slice(0, 3)).toEqual(['basics', 'konglish', 'numbers']);
    for (const id of ['konglish', 'numbers']) {
      const raw = RAW.packs.find((p) => p.id === id)!;
      expect(raw.words.length).toBe(10);
      for (const w of raw.words) expect(w.length).toBe(6);
      // 팩을 가로지르는 중복 정리(dedupeAcrossPacks)가 한 장도 지우지 않는다
      expect(getPacks().find((p) => p.id === id)!.words.length).toBe(10);
      // 노출 순서도 basics 다음
      expect(getPacks().findIndex((p) => p.id === id)).toBeLessThanOrEqual(2);
    }
  });
  test('뱅크 전체에 같은 표제어(같은 뜻)가 두 번 없다 — 새 팩이 중복을 들여오지 않았다', () => {
    const key = (w: string) => w.toLowerCase().replace(/-/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const seen = new Map<string, string>();
    for (const w of allWords().filter((x) => x.pack === 'konglish' || x.pack === 'numbers')) {
      expect(seen.has(key(w.w)), w.id).toBe(false);
      seen.set(key(w.w), w.id);
    }
  });
  test('콩글리시 팩은 회화 교정 규칙(lib/l1Grammar KONGLISH_RULES)과 같은 10개 집합', () => {
    // 규칙 id ↔ 바른 영어 표제어
    const expectHead: Record<string, string> = {
      'hand-phone': 'cell phone', notebook: 'laptop', aircon: 'AC', remocon: 'remote', handle: 'steering wheel',
      'after-service': 'warranty', sns: 'social media', 'one-room': 'studio', 'manner-mode': 'silent mode', event: 'promotion',
    };
    expect(KONGLISH_RULES.map((r) => r.id).sort()).toEqual(Object.keys(expectHead).sort());
    const heads = getPacks().find((p) => p.id === 'konglish')!.words.map((w) => w.w);
    expect(heads.sort()).toEqual(Object.values(expectHead).sort());
    // 표제어는 바른 영어, 뜻에는 콩글리시가 괄호로
    for (const w of getPacks().find((p) => p.id === 'konglish')!.words) {
      expect(w.kr, w.id).toMatch(/\(콩글리시: .+\)/);
      expect(w.lv === 'A1' || w.lv === 'A2', w.id).toBe(true);
    }
  });
  test('숫자 팩 — A1·A2, 예문은 자연스러운 한 문장(표제어 포함), 가격·일정·SLA·용량이 모두 있다', () => {
    const ws = getPacks().find((p) => p.id === 'numbers')!.words;
    for (const w of ws) {
      expect(w.lv === 'A1' || w.lv === 'A2', w.id).toBe(true);
      expect(w.ex.toLowerCase(), w.id).toContain(w.w.toLowerCase());
      expect(w.ex.split(/[.!?]\s/).length, w.id).toBe(1);
    }
    const all = ws.map((w) => w.w).join(' | ');
    for (const needle of ['dollars', 'next week', 'percent', 'terabytes', 'gigabytes', 'quarter', 'people', 'korea time', 'version']) expect(all.toLowerCase(), needle).toContain(needle);
  });
  test('두 팩은 AI로 늘리지 않는다', async () => {
    expect([...AI_EXCLUDED_PACKS].sort()).toEqual(['konglish', 'numbers']);
    localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
    expect(await generateMoreWords('konglish')).toBe(0);
    expect(await generateMoreWords('numbers')).toBe(0);
  });
});

describe('M8 말하기 문항(quizKindFor speak)', () => {
  test('받아쓰기가 가능하면 상자 2·4는 speak — 다른 상자 분포는 그대로', () => {
    expect(quizKindFor(2, 0, true)).toBe('speak');
    expect(quizKindFor(2, 1, true)).toBe('speak');
    expect(quizKindFor(4, 0, true)).toBe('speak');
    expect(quizKindFor(4, 2, true)).toBe('speak');
    for (const box of [0, 1, 3, 5, 6]) for (const seed of [0, 1, 2]) expect(quizKindFor(box, seed, true), `box ${box}`).toBe(quizKindFor(box, seed, false));
    expect(quizKindFor(0, 0, true)).toBe('meaning');
    expect(quizKindFor(3, 1, true)).toBe('cloze');
    expect(quizKindFor(5, 1, true)).toBe('listen');
  });
  test('STT가 불가하면(단위 테스트 환경 = 마이크·브라우저 인식 없음) 기존 유형', () => {
    expect(speakQuizAvailable()).toBe(false);
    expect(quizKindFor(2, 0)).toBe('meaning');
    expect(quizKindFor(2, 1)).toBe('reverse');
    expect(['cloze', 'listen', 'reverse']).toContain(quizKindFor(4, 1));
    expect(quizKindFor(2, 0, false)).toBe('meaning');
    expect(quizKindFor(4, 0, false)).toBe('cloze');
  });
  test('플래그 wordSpeak가 꺼져 있으면 STT가 있어도 speak가 아니다', async () => {
    localStorage.setItem('va_flags', JSON.stringify({ wordSpeak: false }));
    vi.resetModules();
    vi.doMock('../../lib/stt', () => ({ whisperAvailable: () => true, STT_PROPER_NOUNS: '' }));
    vi.doMock('../../lib/browserStt', () => ({ browserSttAvailable: () => true }));
    const fresh = await import('../../lib/words');
    expect(fresh.speakQuizAvailable()).toBe(false);
    expect(fresh.quizKindFor(2, 0)).toBe('meaning');
    localStorage.removeItem('va_flags');
    vi.resetModules();
    const on = await import('../../lib/words');
    expect(on.speakQuizAvailable()).toBe(true);
    expect(on.quizKindFor(2, 0)).toBe('speak');
    expect(on.quizKindFor(4, 0)).toBe('speak');
    expect(on.quizKindFor(3, 0)).toBe('reverse');
    vi.doUnmock('../../lib/stt');
    vi.doUnmock('../../lib/browserStt');
    vi.resetModules();
  });
  test('makeQuiz speak — 뜻·예문 번역을 묻고 보기는 없다', () => {
    const w = allWords().find((x) => x.pack === 'numbers')!;
    const q = makeQuiz(w, 'speak', 3);
    expect(q.kind).toBe('speak');
    expect(q.prompt).toBe(w.kr);
    expect(q.sub).toBe(w.exKr);
    expect(q.options).toEqual([]);
    expect(q.answer).toBe(-1);
  });
  test('speakScore — 예문 일치 ≥60 통과, 표제어 포함 +10(최대 100), 빈 발화 0', () => {
    const w = { w: 'warranty', ex: 'Is the laptop still under warranty?' };
    expect(speakScore(w, 'is the laptop still under warranty').score).toBe(100);
    expect(speakScore(w, '').score).toBe(0);
    expect(speakScore(w, '').pass).toBe(false);
    // 표제어가 들어가면 같은 일치도라도 10점 더
    const withHead = speakScore(w, 'the laptop under warranty');
    const noHead = speakScore({ w: 'laptop', ex: w.ex }, 'is the still under warranty');
    expect(withHead.hasHead).toBe(true);
    expect(noHead.hasHead).toBe(false);
    expect(withHead.pass).toBe(true);
    expect(SPEAK_PASS).toBe(60);
    // 전혀 다른 말은 실패
    expect(speakScore(w, 'good morning everyone').pass).toBe(false);
    // 여러 단어 표제어도 순서대로 들어 있어야 한다
    expect(speakScore({ w: 'two terabytes', ex: 'You get two terabytes of storage.' }, 'you get two terabytes of storage').hasHead).toBe(true);
    expect(speakScore({ w: 'two terabytes', ex: 'You get two terabytes of storage.' }, 'you get terabytes two of storage').hasHead).toBe(false);
  });
  test("'오늘 말한 단어' 카운터는 일별(va_words_spoken)", () => {
    expect(WORDS_SPEAK_GOAL).toBe(4);
    expect(wordsSpokenToday()).toBe(0);
    expect(bumpWordsSpoken()).toBe(1);
    expect(bumpWordsSpoken()).toBe(2);
    expect(wordsSpokenToday()).toBe(2);
    localStorage.setItem('va_words_spoken', JSON.stringify({ date: '2000-01-01', count: 9 }));
    expect(wordsSpokenToday()).toBe(0);
    localStorage.setItem('va_words_spoken', JSON.stringify({ date: 'x', count: 'bad' }));
    expect(wordsSpokenToday()).toBe(0);
  });
});

describe('M8 번들 — 단어 탭 정적 import 그래프에 원고가 없다', () => {
  /** 상대 import만 따라가는 작은 그래프 탐색(tests/perf/words-chunk.mjs는 빌드 산출물로 같은 것을 본다) */
  function graph(entry: string): string[] {
    const seen = new Set<string>();
    const resolve = (from: string, spec: string) => {
      const base = path.resolve(path.dirname(from), spec);
      for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, path.join(base, 'index.ts')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
      return null;
    };
    const walk = (f: string) => {
      if (seen.has(f)) return;
      seen.add(f);
      if (f.endsWith('.json')) return;
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(?:from|import\()\s*['"](\.[^'"]+)['"]/g)) {
        const r = resolve(f, m[1]);
        if (r) walk(r);
      }
    };
    walk(path.join(ROOT, entry));
    return [...seen].map((f) => path.relative(ROOT, f));
  }
  test('WordsScreen·SpeakQuiz·lib/words가 dramaSeed·lib/drama·habits·dailyMission을 끌고 오지 않는다', () => {
    const files = graph('components/WordsScreen.tsx').concat(graph('components/words/SpeakQuiz.tsx'), graph('lib/words.ts'));
    expect(files).toContain('lib/align.ts');
    expect(files.some((f) => f === 'components/words/SpeakQuiz.tsx')).toBe(true);
    for (const bad of ['data/dramaSeed.json', 'lib/drama.ts', 'lib/habits.ts', 'lib/dailyMission.ts', 'store/useLessonStore.ts']) expect(files, bad).not.toContain(bad);
  });
  test('lib/align은 아무것도 import하지 않는다(채점이 원고를 끌고 오지 않게)', () => {
    expect(graph('lib/align.ts')).toEqual(['lib/align.ts']);
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
