import { beforeEach, describe, expect, test } from 'vitest';
import seed from '../../data/dramaSeed.json';
import { allEpisodes, completeEpisode, INTERACTIVE, nextEpisodeNo, validateEpisode, watched, watchedToday, type Episode } from '../../lib/drama';
import { load } from '../../lib/state';
import { startProgram, todayPlan } from '../../lib/program';

beforeEach(() => localStorage.clear());
const eps = (seed as unknown as { episodes: Episode[] }).episodes;

describe('원고(1~3화) 품질', () => {
  test('각 화가 검증기를 통과한다(원고도 AI와 같은 기준)', () => {
    for (const e of eps) expect(validateEpisode(e, e.no), `EP${e.no}`).not.toBeNull();
  });
  test('참여 문항 3~4개, 형식 3종 이상 — 반복 형식 방지', () => {
    for (const e of eps) {
      const inter = e.scenes.filter((s) => INTERACTIVE.has(s.type));
      expect(inter.length).toBeGreaterThanOrEqual(3);
      expect(new Set(inter.map((s) => s.type)).size).toBeGreaterThanOrEqual(3);
    }
  });
  test('매 화 표현 2개 + 다음 화 예고', () => {
    for (const e of eps) {
      expect(e.learn.length).toBe(2);
      expect(e.cliff.length).toBeGreaterThan(10);
    }
  });
  test('choice는 정답 정확히 1개, 오답엔 이유', () => {
    for (const e of eps)
      for (const s of e.scenes)
        if (s.type === 'choice') {
          expect(s.opts.filter((o) => o.ok).length).toBe(1);
          for (const o of s.opts) if (!o.ok) expect(o.why).toBeTruthy();
        }
  });
});

describe('검증기 — AI 원고 거부 기준', () => {
  const base = eps[0];
  test('참여 문항이 1개뿐이면 거부', () => {
    const scenes = base.scenes.filter((s) => !INTERACTIVE.has(s.type) || s.type === 'choice');
    expect(validateEpisode({ ...base, scenes }, 4)).toBeNull();
  });
  test('정답이 2개인 choice는 거부', () => {
    const scenes = base.scenes.map((s) => (s.type === 'choice' ? { ...s, opts: s.opts.map((o) => ({ ...o, ok: true })) } : s));
    expect(validateEpisode({ ...base, scenes }, 4)).toBeNull();
  });
  test('너무 긴 화(23장면+)는 거부 — 하루 5분 유지', () => {
    const extra = Array.from({ length: 10 }, () => ({ type: 'narr', kr: '장면이 이어진다.' }));
    expect(validateEpisode({ ...base, scenes: [...base.scenes, ...extra] }, 4)).toBeNull();
  });
});

describe('진행', () => {
  test('처음엔 1화, 보고 나면 2화', () => {
    expect(nextEpisodeNo()).toBe(1);
    completeEpisode(eps[0], 100);
    expect(watched()).toEqual([1]);
    expect(watchedToday()).toBe(true);
    expect(nextEpisodeNo()).toBe(2);
  });
  test('본 화의 표현 2개가 복습 카드로', () => {
    completeEpisode(eps[0], 80);
    const weak = load<{ en: string; cat?: string }[]>('va_weak', []);
    expect(weak.filter((w) => w.cat === '드라마').map((w) => w.en)).toEqual(eps[0].learn.map((l) => l.en));
  });
  test('원고 3화 + 생성분이 합쳐진다', () => {
    expect(allEpisodes().map((e) => e.no)).toEqual([1, 2, 3]);
    localStorage.setItem('va_drama_eps', JSON.stringify([{ ...eps[2], no: 4, ai: true }]));
    expect(allEpisodes().map((e) => e.no)).toEqual([1, 2, 3, 4]);
  });
  test('드라마를 보면 레슨의 실전 단계도 완료', () => {
    startProgram({ why: 't', minutes: 25 });
    completeEpisode(eps[0], 100);
    expect(todayPlan()!.blocks.find((b) => b.key === 'field')!.done).toBe(true);
  });
});
