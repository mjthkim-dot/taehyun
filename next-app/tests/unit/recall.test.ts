/**
 * M3 말로 떠올리기 — 회상 문항 모드 분기·box 0 고르기·두 번째 실패 뒤에만 힌트·거머리 분기·키 없는 기기(iOS) 고르기,
 * gradeRecall 점수 채점, va_recall_speak 일별 기록, 엔딩 회상 카드 등록(order 20/40).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import seed from '../../data/dramaSeed.json';
import {
  completeEpisode,
  gradeRecall,
  loadResume,
  recallItems,
  recallNext,
  recallSpeakLog,
  recallStages,
  recallUiMode,
  recordRecallSpeak,
  reviewItems,
  saveResume,
  whoOf,
  type Episode,
} from '../../lib/drama';
import { load, SRS_LEECH_THRESHOLD } from '../../lib/state';
import { todayKey, shiftKey } from '../../lib/dates';

const eps = (seed as unknown as { episodes: Episode[] }).episodes;
beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());
const later = (days = 2) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + days * 86400000);
};
const card = (en: string, kr: string, box: number, lapses = 0, lesson = 'drama:1') => ({ en, kr, cat: '드라마', lesson, box, lapses, due: 0 });

describe('recallItems mode 분기', () => {
  test("mode 'speak' — box≥1은 speak, box 0은 늘 choice. 보기(opts 3개)·who·box는 모드와 상관없이 채운다", () => {
    completeEpisode(eps[0], 90, 3);
    localStorage.setItem('va_weak', JSON.stringify([card("It's my first day.", '첫 출근이에요.', 2), card('Hang in there.', '조금만 버텨요.', 0)]));
    const r = recallItems(3, 3, { mode: 'speak' });
    const first = r.find((x) => x.en === "It's my first day.")!;
    const fresh = r.find((x) => x.en === 'Hang in there.')!;
    expect(first.mode).toBe('speak');
    expect(first.box).toBe(2);
    expect(fresh.mode).toBe('choice'); // 처음 묻는 카드는 재인부터
    for (const it of r) {
      expect(it.opts.length).toBe(3);
      expect(it.opts[it.a]).toBe(it.en);
      expect(typeof it.who).toBe('string');
    }
  });
  test('mode를 안 주면 예전 그대로(모드 필드 없음 = choice) — 플래그 off 경로', () => {
    localStorage.setItem('va_weak', JSON.stringify([card("It's my first day.", '첫 출근이에요.', 3)]));
    const r = recallItems(3);
    expect(r[0].mode).toBeUndefined();
    expect(r[0].opts.length).toBe(3);
  });
  test('reviewItems도 같은 분기(기한 된 카드만, 최대 8)', () => {
    localStorage.setItem('va_weak', JSON.stringify(Array.from({ length: 10 }, (_, k) => card(`Phrase number ${k}.`, `표현 ${k}`, k % 2 ? 1 : 0))));
    const r = reviewItems(8, { mode: 'speak' });
    expect(r.length).toBe(8);
    expect(r.filter((x) => x.mode === 'speak').every((x) => (x.box || 0) > 0)).toBe(true);
    expect(r.filter((x) => x.mode === 'choice').every((x) => x.box === 0)).toBe(true);
  });
  test('who — 그 표현을 말한 인물(원고 대사)을 찾고, 없으면 태오', () => {
    const line = eps.flatMap((e) => e.scenes).find((s) => s.type === 'line' && s.who !== 'taeo') as { who: string; en: string };
    expect(whoOf(line.en)).toBe(line.who);
    expect(whoOf('Totally unknown sentence here.')).toBe('taeo');
  });
  test('speak 모드 rc는 이어 보기에 저장 → 복원된다(mode·who·box 유지)', () => {
    localStorage.setItem('va_weak', JSON.stringify([card("It's my first day.", '첫 출근이에요.', 2)]));
    const rc = recallItems(3, 3, { mode: 'speak' });
    saveResume({ no: 3, i: 2, ok: 0, asked: 0, log: [], missed: [], retryIdx: [], rc });
    const r = loadResume(3)!;
    expect(r.rc[0]).toMatchObject({ en: "It's my first day.", mode: 'speak', box: 2 });
  });
});

describe('채점 — 점수·두 번째 실패 뒤 힌트', () => {
  test('gradeRecall(en, score): ≥60 good(상자 +1), <60 again(상자 0) · 힌트로 맞히면 hard · 옛 불리언 호출 호환', () => {
    localStorage.setItem('va_weak', JSON.stringify([card('A.', '가', 2), card('B.', '나', 2), card('C.', '다', 2), card('D.', '라', 2)]));
    expect(gradeRecall('A.', 60)).toBe('good');
    expect(gradeRecall('B.', 59)).toBe('again');
    expect(gradeRecall('C.', true, { hinted: true })).toBe('hard');
    expect(gradeRecall('D.', true)).toBe('good');
    const w = Object.fromEntries(load<{ en: string; box: number }[]>('va_weak', []).map((x) => [x.en, x.box]));
    expect(w).toEqual({ 'A.': 3, 'B.': 0, 'C.': 2, 'D.': 3 });
  });
  test('recallNext — 첫 실패는 한 번 더(정답·보기 없음), 두 번째 실패 뒤에만 보기 3개', () => {
    expect(recallNext(1, 80)).toBe('good');
    expect(recallNext(1, 40)).toBe('retry');
    expect(recallNext(2, 59)).toBe('hint');
    expect(recallNext(2, 60)).toBe('good');
  });
});

describe('거머리(leech) 분기', () => {
  test('잊은 횟수가 기준 이상이면 leech — 따라 말하기를 끝부터 쌓기로 나눈다(짧은 문장은 통째로)', () => {
    localStorage.setItem('va_weak', JSON.stringify([card('I will send you the report by Friday.', '금요일까지 보고서 보낼게요.', 1, SRS_LEECH_THRESHOLD), card('Okay.', '알겠어요.', 1, 1)]));
    const r = recallItems(3, 3, { mode: 'speak' });
    const leech = r.find((x) => x.en.startsWith('I will'))!;
    expect(leech.leech).toBe(true);
    expect(r.find((x) => x.en === 'Okay.')!.leech).toBeUndefined();
    expect(recallStages(leech.en, true)).toEqual(['the report by Friday.', 'I will send you the report by Friday.']);
    expect(recallStages(leech.en, false)).toEqual([leech.en]);
    expect(recallStages('Hang in there.', true)).toEqual(['Hang in there.']);
    const long = 'Could you please send me the updated pricing sheet before our meeting?';
    expect(recallStages(long, true)).toHaveLength(3); // 4 → 8 → 전체
  });
});

describe('키 없는 기기(iOS — Whisper·Web Speech 둘 다 없음)', () => {
  test('speak 문항도 고르기 + 녹음 A/B로, box 0·플래그 off는 어디서나 고르기', () => {
    expect(recallUiMode('speak', 'whisper')).toBe('speak');
    expect(recallUiMode('speak', 'webspeech')).toBe('speak'); // 키 없어도 브라우저 인식이 있으면 말로
    expect(recallUiMode('speak', 'self')).toBe('choice');
    expect(recallUiMode('choice', 'whisper')).toBe('choice');
    expect(recallUiMode(undefined, 'whisper')).toBe('choice');
  });
});

describe('va_recall_speak — 일별 asked·passed·개시 지연 중앙값(60일)', () => {
  test('중앙값·통과 수가 쌓이고, 60일 넘은 날은 지운다', () => {
    recordRecallSpeak(true, 1200);
    recordRecallSpeak(false, 3000);
    const d = recordRecallSpeak(true, 1800);
    expect(d).toMatchObject({ asked: 3, passed: 2, latencyMed: 1800 });
    recordRecallSpeak(true, undefined, shiftKey(todayKey(), -70));
    recordRecallSpeak(true); // 지연을 못 잰 시도도 asked에는 센다
    const log = recallSpeakLog();
    expect(Object.keys(log)).toEqual([todayKey()]);
    expect(log[todayKey()].asked).toBe(4);
  });
});

describe('엔딩 회상 카드 등록', () => {
  test("RecallCard — 기본 'recall'(order 20) + 조금 더 'recall-more'(order 40), 재소환·첫머리 문장과 겹치지 않는다", async () => {
    later(0);
    const { endingCards } = await import('../../components/drama/endingRegistry');
    const mod = await import('../../components/drama/cards/RecallCard');
    const ids = endingCards().map((c) => [c.id, c.order, c.basic]);
    expect(ids).toContainEqual(['recall', 20, true]);
    expect(ids).toContainEqual(['recall-more', 40, false]);
    localStorage.setItem('va_weak', JSON.stringify(['A one.', 'B two.', 'C three.', 'D four.', 'E five.'].map((en, k) => card(en, `뜻 ${k}`, 1))));
    const ctx = { ep: eps[1], dateKey: todayKey(), keyless: false, inlineEns: ['A one.'], recallEns: ['B two.'] };
    const items = mod.endingRecallItems(ctx);
    expect(items.map((x) => x.en)).not.toContain('A one.');
    expect(items.map((x) => x.en)).not.toContain('B two.');
    expect(items.slice(0, 3).every((x) => x.mode === 'speak')).toBe(true);
    // 기한 된 카드가 모자라면 이번 화 오늘의 표현으로 채운다(간격 반복엔 매기지 않는 연습)
    expect(items.some((x) => x.noSrs && eps[1].learn.some((l) => l.en === x.en))).toBe(true);
    expect(items.length).toBeLessThanOrEqual(6);
  });
});
