import { beforeEach, describe, expect, test } from 'vitest';
import { AXIS_MIN_COUNT, diagnosedAxes, hvptAxisFor, isWeekday, pickSoundCard, soundCardFor } from '../../lib/soundCardPick';
import { recordHvpt } from '../../lib/soundTrack';
import { matchesReduced, decoderById } from '../../lib/connectedSpeech';
import { setFlag } from '../../lib/flags';
import { store } from '../../lib/state';
import { todayKey } from '../../lib/dates';

/** 평일 소리 카드 1장 — 진단 축 있음+키 있음이면 HVPT, 아니면 디코더(M7·M9 교대 규칙) */
beforeEach(() => localStorage.clear());

const FRI = '2026-10-02';
const SAT = '2026-10-03';
const SUN = '2026-10-04';
const MON = '2026-10-05';
const base = { dateKey: FRI, hasKey: true, topAxes: ['r-l'], decoderOn: true, hvptOn: true };

describe('pickSoundCard — 순수 규칙', () => {
  test('요일: 월~금만, 토·일·잘못된 키는 없음', () => {
    expect(isWeekday(FRI)).toBe(true);
    expect(isWeekday(MON)).toBe(true);
    expect(isWeekday(SAT)).toBe(false);
    expect(isWeekday(SUN)).toBe(false);
    expect(isWeekday('nope')).toBe(false);
    expect(pickSoundCard({ ...base, dateKey: SAT })).toBeNull();
    expect(pickSoundCard({ ...base, dateKey: SUN })).toBeNull();
  });
  test('진단 축 + 키 → HVPT', () => {
    expect(pickSoundCard(base)).toBe('hvpt');
  });
  test('키 없음 → 디코더(HVPT 숨김)', () => {
    expect(pickSoundCard({ ...base, hasKey: false })).toBe('decoder');
  });
  test('진단 축 없음 → 디코더', () => {
    expect(pickSoundCard({ ...base, topAxes: [] })).toBe('decoder');
  });
  test('플래그: hvpt off → 디코더로 내려감, decoder off → 진단 없으면 없음, 둘 다 off → 없음', () => {
    expect(pickSoundCard({ ...base, hvptOn: false })).toBe('decoder');
    expect(pickSoundCard({ ...base, topAxes: [], decoderOn: false })).toBeNull();
    expect(pickSoundCard({ ...base, decoderOn: false })).toBe('hvpt');
    expect(pickSoundCard({ ...base, hvptOn: false, decoderOn: false })).toBeNull();
  });
});

describe('hvptAxisFor — 진단 축 앞당김 → 주차 축 → 익힌 축은 다음', () => {
  test('진단 축이 먼저', () => {
    expect(hvptAxisFor(1, ['r-l'], () => false)).toBe('r-l');
  });
  test('진단 없으면 이번 주 계획 축', () => {
    expect(hvptAxisFor(1, [], () => false)).toBe('final-consonant');
    expect(hvptAxisFor(2, [], () => false)).toBe('r-l');
  });
  test('익힌 축은 건너뛰고 다음 축', () => {
    expect(hvptAxisFor(2, [], (a) => a === 'r-l')).toBe('f-p');
    expect(hvptAxisFor(1, ['r-l'], (a) => a === 'r-l')).toBe('final-consonant');
  });
  test('HVPT 자료 없는 축(관사 등)은 후보에서 뺀다 · 전부 익혔으면 맨 앞 후보', () => {
    expect(hvptAxisFor(1, ['article'], () => false)).toBe('final-consonant');
    expect(hvptAxisFor(2, ['r-l'], () => true)).toBe('r-l');
  });
  test('axisMastered 기본값 — 10문항 9정답이면 다음 축', () => {
    for (let i = 0; i < 10; i++) recordHvpt('r-l', i !== 3);
    expect(hvptAxisFor(2, ['r-l'])).not.toBe('r-l');
  });
});

describe('soundCardFor — 저장값(키·va_pron·플래그)', () => {
  const pron = (key: string, count: number) => store('va_pron', [{ key, date: todayKey(), count }]);
  const today = todayKey();
  const weekday = isWeekday(today);
  test('키 없음 → 디코더(평일), 주말엔 없음', () => {
    pron('r-l', 3);
    expect(soundCardFor({ dateKey: MON })).toBe('decoder');
    expect(soundCardFor({ dateKey: SAT })).toBeNull();
  });
  test('키 + 진단 2회 이상 → HVPT, 1회는 우연으로 보고 디코더', () => {
    store('va_groq_key', 'gsk_test_key');
    pron('r-l', AXIS_MIN_COUNT);
    expect(diagnosedAxes()).toEqual(['r-l']);
    expect(soundCardFor({ dateKey: MON })).toBe('hvpt');
    pron('r-l', 1);
    expect(diagnosedAxes()).toEqual([]);
    expect(soundCardFor({ dateKey: MON })).toBe('decoder');
  });
  test('HVPT 자료 없는 축(관사·누락)만 있으면 디코더', () => {
    store('va_groq_key', 'gsk_test_key');
    pron('article', 5);
    expect(soundCardFor({ dateKey: MON })).toBe('decoder');
  });
  test('플래그 hvpt off → 디코더, decoder off(진단 없음) → 없음', () => {
    store('va_groq_key', 'gsk_test_key');
    pron('r-l', 3);
    setFlag('hvpt', false);
    expect(soundCardFor({ dateKey: MON })).toBe('decoder');
    localStorage.removeItem('va_pron');
    setFlag('decoder', false);
    expect(soundCardFor({ dateKey: MON })).toBeNull();
  });
  test('오늘 날짜도 같은 규칙(평일 여부만 다르다)', () => {
    expect(soundCardFor({ dateKey: today })).toBe(weekday ? 'decoder' : null);
  });
});

describe('matchesReduced — 전사에 축약 표기', () => {
  test('gonna가 찍히면 true, going to면 false, 약형·플랩은 볼 수 없음(false)', () => {
    const gonna = decoderById('gonna')!;
    expect(matchesReduced("I'm gonna send the quote today.", gonna)).toBe(true);
    expect(matchesReduced("I'm going to send the quote today.", gonna)).toBe(false);
    expect(matchesReduced('Gonna, yes.', gonna)).toBe(true);
    expect(matchesReduced('Can I get some wadder?', decoderById('water')!)).toBe(false);
  });
});
