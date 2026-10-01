import { beforeEach, describe, expect, test } from 'vitest';
import {
  DECODER,
  decoderOfDay,
  decoderSeen,
  markDecoderSeen,
  spokenForms,
  spokenLine,
  kindLabel,
} from '../../lib/connectedSpeech';
import { load, store } from '../../lib/state';

describe('connectedSpeech — 소리 디코더 30(고정)', () => {
  test('30항목·kind 분포 12/6/6/6·id 중복 없음', () => {
    expect(DECODER).toHaveLength(30);
    const count = (k: string) => DECODER.filter((d) => d.kind === k).length;
    expect(count('contraction')).toBe(12);
    expect(count('weak')).toBe(6);
    expect(count('flap')).toBe(6);
    expect(count('linking')).toBe(6);
    expect(new Set(DECODER.map((d) => d.id)).size).toBe(30);
    // 명세의 축약 12종이 전부 있다
    for (const s of ['gonna', 'wanna', 'gotta', 'hafta', 'kinda', 'sorta', 'lotta', 'outta', 'gimme', 'lemme', 'dunno', 'didja']) {
      expect(DECODER.some((d) => d.spoken === s)).toBe(true);
    }
  });

  test('모든 필드가 차 있고 IPA 문자가 없다(한글 근사만)', () => {
    const ipa = /[əɪʊɛɔæʌɑːˈˌθðʃʒŋɹ]/;
    for (const d of DECODER) {
      expect(d.written.trim()).not.toBe('');
      expect(d.spoken.trim()).not.toBe('');
      expect(d.kr.trim()).not.toBe('');
      expect(d.tip.trim()).not.toBe('');
      expect(d.spoken).not.toMatch(ipa);
      expect(d.kr).not.toMatch(ipa);
      // 한글 근사는 한글로만
      expect(d.kr).toMatch(/^[가-힣\s]+$/);
    }
  });

  test('예문은 ≤10단어이고 해당 소리가 실제로 들어 있다', () => {
    for (const d of DECODER) {
      const words = d.example.en.trim().split(/\s+/);
      expect(words.length, d.id).toBeLessThanOrEqual(10);
      expect(d.example.kr.trim()).not.toBe('');
      const ids = spokenForms(d.example.en).map((s) => s.id);
      expect(ids, `${d.id}: ${d.example.en}`).toContain(d.id);
    }
  });

  test('kindLabel은 네 종류 모두 한국어', () => {
    expect(kindLabel('contraction')).toBe('축약');
    expect(kindLabel('flap')).toBe('플랩 T');
  });
});

describe('spokenForms — 문장 안의 디코더 구간', () => {
  test("I'm going to check it out → gonna + checkitout 2건", () => {
    const en = "I'm going to check it out";
    const spans = spokenForms(en);
    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({ id: 'gonna', spoken: 'gonna', kr: '거너' });
    expect(spans[1]).toMatchObject({ id: 'check-it-out', spoken: 'checkitout' });
    expect(en.slice(spans[0].start, spans[0].end)).toBe('going to');
    expect(en.slice(spans[1].start, spans[1].end)).toBe('check it out');
    expect(spokenLine(en)).toBe("I'm gonna checkitout");
  });

  test('대소문자·구두점 무시, 단어 경계 매칭', () => {
    expect(spokenForms('GOING TO? Going to!').map((s) => s.id)).toEqual(['gonna', 'gonna']);
    // waters / watering 은 water가 아니다
    expect(spokenForms('The waters are watering.')).toHaveLength(0);
    // can't 에서 can을 잡지 않는다
    expect(spokenForms("I can't do it.")).toHaveLength(0);
  });

  test('겹치면 긴 쪽 우선 — did you는 you(약형)를 삼킨다', () => {
    const ids = spokenForms('Did you get my email?').map((s) => s.id);
    expect(ids).toEqual(['didja']);
    expect(spokenForms('We have a lot of users now.').map((s) => s.id)).toEqual(['lotta']);
  });

  test('약형은 문장 끝에서는 잡지 않는다(강형)', () => {
    expect(spokenForms('Thank you.')).toHaveLength(0);
    // 가운데의 you·for는 둘 다 약형
    expect(spokenForms('Thank you for coming.').map((s) => s.id)).toEqual(['you', 'for']);
  });

  test('구간이 없으면 빈 배열, spokenLine은 null', () => {
    expect(spokenForms('Hello.')).toEqual([]);
    expect(spokenForms('')).toEqual([]);
    expect(spokenLine('Hello.')).toBeNull();
  });
});

describe('decoderOfDay / seen 저장', () => {
  beforeEach(() => localStorage.clear());

  test('같은 날·같은 seen이면 항상 같은 항목(결정성)', () => {
    const a = decoderOfDay('2026-10-01', []);
    const b = decoderOfDay('2026-10-01', []);
    expect(a.id).toBe(b.id);
    expect(decoderOfDay('2026-10-02', []).id).not.toBe(a.id);
  });

  test('안 본 것 우선 — seen은 제외, 전부 봤으면 전체에서 복습', () => {
    const d = '2026-10-01';
    const first = decoderOfDay(d, []);
    const next = decoderOfDay(d, [first.id]);
    expect(next.id).not.toBe(first.id);
    const all = DECODER.map((x) => x.id);
    expect(all).toContain(decoderOfDay(d, all).id);
    const seen = all.slice(0, 29);
    expect(decoderOfDay(d, seen).id).toBe(all[29]);
  });

  test('30일 동안 30개가 한 번씩 나온다(seen 없이 날짜만 바뀔 때)', () => {
    const ids = new Set<string>();
    for (let day = 1; day <= 30; day++) ids.add(decoderOfDay(`2026-10-${String(day).padStart(2, '0')}`, []).id);
    expect(ids.size).toBe(30);
  });

  test('markDecoderSeen은 va_sound_track의 decoderSeen 필드만 갱신한다(M9 필드 보존)', () => {
    store('va_sound_track', { hvpt: { 'r-l': 3 } });
    expect(decoderSeen()).toEqual([]);
    markDecoderSeen('gonna');
    markDecoderSeen('gonna'); // 중복 없음
    markDecoderSeen('no-such-id'); // 모르는 id는 무시
    expect(decoderSeen()).toEqual(['gonna']);
    const track = load<Record<string, unknown>>('va_sound_track', {});
    expect(track.hvpt).toEqual({ 'r-l': 3 });
  });

  test('손상된 저장값은 빈 배열로', () => {
    store('va_sound_track', { decoderSeen: 'oops' });
    expect(decoderSeen()).toEqual([]);
  });
});
