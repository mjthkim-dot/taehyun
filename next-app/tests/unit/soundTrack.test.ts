import { beforeEach, describe, expect, test } from 'vitest';
import {
  WEEK_PLAN, CARRIERS, KR_DROP, weekOf, planFor, trackState, saveTrackState, currentWeek,
  nextHvptItem, recordHvpt, axisMastered, hasHvpt, SOUND_TRACK_KEY,
} from '../../lib/soundTrack';
import { words } from '../../lib/pronunciation';
import { pairsFor } from '../../lib/minimalPairs';

describe('soundTrack — 8주 커리큘럼·캐리어·krDrop(M9)', () => {
  test('WEEK_PLAN은 8주, 1주차 어말 자음 → 2주차 R/L → … → 8주차 복습', () => {
    expect(WEEK_PLAN.length).toBe(8);
    WEEK_PLAN.forEach((p, i) => {
      expect(p.week).toBe(i + 1);
      expect(p.axes.length).toBeGreaterThan(0);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.krHint.length).toBeGreaterThan(0);
    });
    expect(WEEK_PLAN[0].axes).toEqual(['final-consonant']);
    expect(WEEK_PLAN[1].axes).toEqual(['r-l']);
    expect(WEEK_PLAN[2].axes).toEqual(['f-p', 'v-b']);
    expect(WEEK_PLAN[3].axes).toEqual(['vowel-long', 'vowel-ae-e']);
    expect(WEEK_PLAN[4].axes).toContain('voicing');
    expect(WEEK_PLAN[5].axes).toEqual(['th']);
    expect(WEEK_PLAN[6].axes).toEqual(['sh-s', 'ch-j']);
    // 복습은 앞 7주의 축을 모두 담는다
    const prev = new Set(WEEK_PLAN.slice(0, 7).flatMap((p) => p.axes));
    for (const a of prev) expect(WEEK_PLAN[7].axes).toContain(a);
  });

  test('캐리어 12쌍 = 24문장, ≤10단어, 두 문장은 그 단어 하나만 다르다', () => {
    expect(CARRIERS.length).toBe(12);
    for (const c of CARRIERS) {
      const wa = words(c.a.en);
      const wb = words(c.b.en);
      expect(wa.length).toBeLessThanOrEqual(10);
      expect(wb.length).toBeLessThanOrEqual(10);
      expect(wa.length).toBe(wb.length);
      const diff = wa.filter((w, i) => w !== wb[i]);
      expect(diff.length).toBe(1);
      expect(wa).toContain(c.a.word);
      expect(wb).toContain(c.b.word);
      expect(c.a.kr.length).toBeGreaterThan(0);
      expect(c.b.kr.length).toBeGreaterThan(0);
    }
    // 어말 자음·R/L 위주 + F/P·V/B
    const axes = CARRIERS.map((c) => c.axis);
    expect(axes.filter((a) => a === 'final-consonant').length).toBeGreaterThanOrEqual(4);
    expect(axes.filter((a) => a === 'r-l').length).toBeGreaterThanOrEqual(4);
    expect(axes).toContain('f-p');
    expect(axes).toContain('v-b');
  });

  test('KR_DROP 20개, 중복 없음, 대표 단어 포함', () => {
    expect(KR_DROP.length).toBe(20);
    expect(new Set(KR_DROP.map((k) => k.word)).size).toBe(20);
    for (const w of ['bus', 'school', 'street', 'second', 'first', 'next', 'text', 'list', 'cost', 'risk']) {
      expect(KR_DROP.map((k) => k.word)).toContain(w);
    }
    for (const k of KR_DROP) {
      expect(k.kr.length).toBeGreaterThan(0);
      expect(k.tip.length).toBeGreaterThan(0);
    }
  });

  test('weekOf — 7일 단위, 9주차부터 1주차로 반복, 시작 전·잘못된 날짜는 1', () => {
    expect(weekOf('2026-09-07', '2026-09-07')).toBe(1);
    expect(weekOf('2026-09-07', '2026-09-13')).toBe(1);
    expect(weekOf('2026-09-07', '2026-09-14')).toBe(2);
    expect(weekOf('2026-09-07', '2026-10-26')).toBe(8);
    expect(weekOf('2026-09-07', '2026-11-02')).toBe(1); // 9주차 → 반복
    expect(weekOf('2026-09-07', '2026-11-09')).toBe(2);
    expect(weekOf('2026-09-07', '2026-09-01')).toBe(1);
    expect(weekOf('', '2026-09-01')).toBe(1);
    expect(weekOf(undefined)).toBe(1);
    expect(weekOf(new Date(2026, 8, 7), new Date(2026, 8, 21))).toBe(3);
    expect(planFor(3).axes).toEqual(['f-p', 'v-b']);
    expect(planFor(99).week).toBe(8);
  });
});

describe('soundTrack — 상태 저장·HVPT 기록', () => {
  beforeEach(() => localStorage.clear());

  test('trackState 기본값과 필드 단위 갱신(M7 decoderSeen 공존)', () => {
    expect(trackState()).toEqual({ hvpt: {} });
    localStorage.setItem(SOUND_TRACK_KEY, JSON.stringify({ decoderSeen: { c1: 2 }, decoder: { c1: { tries: 1 } } }));
    saveTrackState({ week: 2, started: '2026-09-07' });
    const st = JSON.parse(localStorage.getItem(SOUND_TRACK_KEY)!);
    expect(st.decoderSeen).toEqual({ c1: 2 });
    expect(st.decoder).toEqual({ c1: { tries: 1 } });
    expect(st.week).toBe(2);
    expect(st.started).toBe('2026-09-07');
    // hvpt는 축 단위로 합친다
    saveTrackState({ hvpt: { 'r-l': { tries: 3, correct: 2 } } });
    saveTrackState({ hvpt: { th: { tries: 1, correct: 1 } } });
    expect(trackState().hvpt['r-l']).toEqual({ tries: 3, correct: 2 });
    expect(trackState().hvpt.th).toEqual({ tries: 1, correct: 1 });
    expect(trackState().decoderSeen).toEqual({ c1: 2 });
  });

  test('currentWeek는 시작일을 처음 한 번 적고 주차를 돌려준다', () => {
    expect(currentWeek('2026-09-07')).toBe(1);
    expect(trackState().started).toBe('2026-09-07');
    expect(currentWeek('2026-09-21')).toBe(3);
    expect(trackState().week).toBe(3);
    expect(trackState().started).toBe('2026-09-07');
  });

  test('nextHvptItem — 결정적, 캐리어 우선, 없으면 최소대립쌍에서 두 문장', () => {
    const a = nextHvptItem('r-l', 5);
    const b = nextHvptItem('r-l', 5);
    expect(a).toEqual(b);
    expect(a!.kind).toBe('carrier');
    expect(['a', 'b']).toContain(a!.answer);
    // seed가 바뀌면 재생할 쪽도 바뀐다
    const answers = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((s) => nextHvptItem('r-l', s)!.answer));
    expect(answers.size).toBe(2);
    // 캐리어가 없는 축은 최소대립쌍 예문에서 단어만 바꾼다
    const t = nextHvptItem('th', 0)!;
    expect(t.kind).toBe('pair');
    expect(t.a.word).toBe(pairsFor('th')[0].a);
    expect(words(t.a.en).length).toBe(words(t.b.en).length);
    expect(words(t.a.en).filter((w, i) => w !== words(t.b.en)[i]).length).toBe(1);
    // 자료 없는 축은 null
    expect(nextHvptItem('omission', 0)).toBeNull();
    expect(hasHvpt('th')).toBe(true);
    expect(hasHvpt('omission')).toBe(false);
  });

  test('recordHvpt 누적·axisMastered는 최근 10회 ≥80%', () => {
    expect(axisMastered('r-l')).toBe(false);
    for (let i = 0; i < 9; i++) recordHvpt('r-l', true);
    // 9회로는 아직 아니다(창이 10회)
    expect(axisMastered('r-l')).toBe(false);
    recordHvpt('r-l', false);
    expect(trackState().hvpt['r-l']!.tries).toBe(10);
    expect(trackState().hvpt['r-l']!.correct).toBe(9);
    expect(axisMastered('r-l')).toBe(true);
    // 오답이 쌓이면 다시 미숙
    recordHvpt('r-l', false);
    recordHvpt('r-l', false);
    expect(axisMastered('r-l')).toBe(false);
    // 창은 10개로 잘린다
    expect(trackState().hvpt['r-l']!.recent!.length).toBe(10);
    expect(trackState().hvpt['r-l']!.tries).toBe(12);
    // 다른 축·M7 필드는 건드리지 않는다
    expect(trackState().hvpt.th).toBeUndefined();
  });
});
