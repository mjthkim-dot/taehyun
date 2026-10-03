import { describe, expect, test } from 'vitest';
import seed from '../../data/dramaSeed.json';
import { CAST_ICONS, SEED_COUNT, SEED_INDEX, SERIES_NAME } from '../../lib/dramaIndex';

describe('드라마 홈 카드 색인 = 원고와 일치', () => {
  const s = seed as unknown as { series: string; cast: { id: string; icon: string }[]; episodes: { no: number; titleKr: string; cliff: string }[] };
  test('시리즈·화 수', () => {
    expect(SERIES_NAME).toBe(s.series);
    expect(SEED_COUNT).toBe(s.episodes.length);
  });
  test('화마다 번호·제목·예고가 같다', () => {
    expect(SEED_INDEX).toEqual(s.episodes.map((e) => ({ no: e.no, titleKr: e.titleKr, cliff: e.cliff })));
  });
  test('출연진 아이콘', () => {
    for (const c of s.cast) expect(CAST_ICONS[c.id]).toBe(c.icon);
  });
});
