import { beforeEach, describe, expect, test, vi } from 'vitest';
import seed from '../../data/dramaSeed.json';
import type { Episode } from '../../lib/drama';
import { sanitizeStorage } from '../../lib/sanitize';
import { addWeakItem, dueWeak, getSkillStats, load, WEAK_MAX } from '../../lib/state';
import { evidenceLog, cefrState, overall } from '../../lib/cefrGrowth';
import { reminderBody } from '../../lib/reminders';

beforeEach(() => localStorage.clear());
const eps = (seed as unknown as { episodes: Episode[] }).episodes;

describe('v1.29 → v1.30 드라마 이전(AI 4~7화를 본 사용자)', () => {
  test('AI로 본 4화 기록은 지우고, 그 화 표현은 출처만 바꿔 복습에 남긴다', async () => {
    const ai4 = { ...eps[0], no: 4, ai: true, titleKr: 'AI 4화', learn: [{ en: 'That makes sense.', kr: '이해가 돼요.', note: '' }] };
    localStorage.setItem('va_drama_eps', JSON.stringify([ai4, { ...eps[1], no: 9, ai: true }]));
    localStorage.setItem('va_drama', JSON.stringify({ done: { 1: '2026-09-27', 2: '2026-09-28', 3: '2026-09-28', 4: '2026-09-29' }, score: { 4: 90 } }));
    localStorage.setItem('va_weak', JSON.stringify([{ en: 'That makes sense.', kr: '이해가 돼요.', cat: '드라마', lesson: 'drama:4', box: 0, lapses: 0, due: 0 }]));
    vi.resetModules();
    const d = await import('../../lib/drama');
    expect(d.watched()).toEqual([1, 2, 3]);
    expect(d.nextEpisodeNo()).toBe(4);
    expect(d.episodeByNo(4)?.titleKr).toBe(eps[3].titleKr); // 직접 쓴 4화
    expect(d.episodeByNo(9)).toBeTruthy(); // 8화 이후 생성분은 유지
    const w = load<{ en: string; lesson: string }[]>('va_weak', [])[0];
    expect(w.lesson).toBe('drama:ai-4');
    expect(d.recallItems(4, 5).map((r) => r.en)).toContain('That makes sense.'); // 계속 복습된다
    expect(load<string>('va_drama_notice', '')).toBe('reseeded');
  });
  test('이전은 한 번만(다시 돌지 않음), 해당 없는 사용자는 아무것도 바뀌지 않는다', async () => {
    localStorage.setItem('va_drama', JSON.stringify({ done: { 1: '2026-09-27' }, score: {} }));
    vi.resetModules();
    const d = await import('../../lib/drama');
    expect(d.watched()).toEqual([1]);
    expect(load<number>('va_drama_migrated', 0)).toBe(1);
    expect(load<string>('va_drama_notice', '')).toBe('');
  });
});

describe('손상된 저장값 — 점검·복구', () => {
  test('빈 칸·모양이 틀린 값을 걸러 내고, 읽을 수 없는 JSON은 지운다', () => {
    localStorage.setItem('va_weak', JSON.stringify([null, { en: 'ok', kr: '좋아', box: 0, lapses: 0, due: 0 }, 'x']));
    localStorage.setItem('va_cefr_evidence', JSON.stringify([null]));
    localStorage.setItem('va_skill_stats', JSON.stringify('x'));
    localStorage.setItem('va_words', JSON.stringify({ a: null, b: { b: 1, d: 0, n: 1, l: 0 } }));
    localStorage.setItem('va_words_extra', JSON.stringify({ core: null, sales: [['w', 'n', '뜻', 'A2', 'ex', '예']] }));
    localStorage.setItem('va_cefr_state', JSON.stringify({ level: 'A2' }));
    localStorage.setItem('va_days', '{not json');
    expect(sanitizeStorage()).toBeGreaterThanOrEqual(6);
    expect(load<unknown[]>('va_weak', []).length).toBe(1);
    expect(load<unknown[]>('va_cefr_evidence', ['x']).length).toBe(0);
    expect(localStorage.getItem('va_skill_stats')).toBeNull();
    expect(Object.keys(load<Record<string, unknown>>('va_words', {}))).toEqual(['b']);
    expect(Object.keys(load<Record<string, unknown>>('va_words_extra', {}))).toEqual(['sales']);
    expect(load<{ level?: string; history?: unknown[] }>('va_cefr_state', {})).toEqual({ level: 'A2', history: [] }); // 레벨은 살린다
    expect(localStorage.getItem('va_days')).toBeNull();
    expect(sanitizeStorage()).toBe(0); // 두 번째엔 고칠 게 없다
  });
  test('읽는 쪽도 빈 칸에 죽지 않는다(점검 전에도)', () => {
    localStorage.setItem('va_weak', JSON.stringify([null, { en: 'hi', kr: '안녕', box: 0, lapses: 0, due: 0 }]));
    localStorage.setItem('va_cefr_evidence', JSON.stringify([null, { skill: 'x' }]));
    localStorage.setItem('va_skill_stats', JSON.stringify(123));
    localStorage.setItem('va_cefr_state', JSON.stringify({ level: 'Z9', history: 'no' }));
    expect(dueWeak().map((w) => w.en)).toEqual(['hi']);
    expect(evidenceLog()).toEqual([]);
    expect(getSkillStats().speaking.gse).toBe(10);
    expect(cefrState()).toEqual({ level: null, history: [] });
    expect(() => overall()).not.toThrow();
  });
});

describe('복습 카드 상한', () => {
  test(`${WEAK_MAX}장을 넘으면 외운 카드부터 빠진다(새 카드는 남는다)`, () => {
    const many = Array.from({ length: WEAK_MAX }, (_, i) => ({ en: `s${i}`, kr: '뜻', box: i < 5 ? 5 : 0, lapses: 0, due: 0 }));
    localStorage.setItem('va_weak', JSON.stringify(many));
    addWeakItem({ en: 'new one', kr: '새 카드' });
    const w = load<{ en: string }[]>('va_weak', []);
    expect(w.length).toBe(WEAK_MAX);
    expect(w.some((x) => x.en === 'new one')).toBe(true);
    expect(w.some((x) => x.en === 's0')).toBe(false); // 외운(박스 5) 카드가 먼저 빠짐
    expect(w.some((x) => x.en === 's5')).toBe(true);
  });
});

describe('알림 문구 — 집중 모드는 드라마로', () => {
  test('집중 모드: 미션 대신 드라마', () => {
    expect(reminderBody(2, false, true)).toContain('드라마');
    expect(reminderBody(2, false, true)).not.toContain('미션');
    expect(reminderBody(3, true, true)).toContain('3개');
    expect(reminderBody(0, false)).toContain('미션');
  });
});
