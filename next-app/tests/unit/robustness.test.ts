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

describe('M1 — 새 키 모양 검사(복원 허용목록)', () => {
  test('일별 집계·플래그·진단·발화 목표·기록 키의 어긋난 값만 걷어 낸다', () => {
    localStorage.setItem('va_attempt_daily', JSON.stringify({ '2026-09-01': { n: 3, passed: 1 }, '2026-09-02': null, '2026-09-03': { passed: 1 }, '2026-09-04': 'x' }));
    localStorage.setItem('va_flags', JSON.stringify({ retell: false, hvpt: 'off', decoder: 1 }));
    localStorage.setItem('va_diag', JSON.stringify({ '2026-09-01': { tts429: 2 }, bad: 5 }));
    localStorage.setItem('va_tts_meta', JSON.stringify({ '2026-09-01': { hit: 2 }, bad: [] }));
    localStorage.setItem('va_speak_goal', JSON.stringify({ goal: 'ten' }));
    localStorage.setItem('va_day_gov', JSON.stringify('busy'));
    localStorage.setItem('va_growth', JSON.stringify([1, 2]));
    localStorage.setItem('va_sound_track', JSON.stringify({ axis: 'r-l' }));
    localStorage.setItem('va_retell', JSON.stringify('nope'));
    localStorage.setItem('va_recall_speak', JSON.stringify([null, { en: 'ok' }]));
    localStorage.setItem('va_baseline', JSON.stringify({ at: 1 }));
    localStorage.setItem('va_ear', JSON.stringify(3));
    localStorage.setItem('va_attempt_log', JSON.stringify([null, { t: 1, en: 'a', score: 80, quality: 'echo' }, { t: 'x' }, 'str']));
    localStorage.setItem('va_drama_resume', JSON.stringify({ no: 2, i: 3, log: [], rc: [] })); // v 없음(옛 판)
    const fixed = sanitizeStorage();
    expect(fixed).toBeGreaterThanOrEqual(9);
    expect(Object.keys(load<Record<string, unknown>>('va_attempt_daily', {}))).toEqual(['2026-09-01']);
    expect(load<Record<string, unknown>>('va_flags', {})).toEqual({ retell: false });
    expect(Object.keys(load<Record<string, unknown>>('va_diag', {}))).toEqual(['2026-09-01']);
    expect(Object.keys(load<Record<string, unknown>>('va_tts_meta', {}))).toEqual(['2026-09-01']);
    expect(localStorage.getItem('va_speak_goal')).toBeNull();
    expect(localStorage.getItem('va_day_gov')).toBeNull();
    expect(localStorage.getItem('va_growth')).toBeNull();
    expect(load<Record<string, unknown>>('va_sound_track', {})).toEqual({ axis: 'r-l' }); // 모양 맞으면 그대로
    expect(localStorage.getItem('va_retell')).toBeNull();
    expect(load<unknown[]>('va_recall_speak', [])).toEqual([{ en: 'ok' }]);
    expect(load<Record<string, unknown>>('va_baseline', {})).toEqual({ at: 1 });
    expect(localStorage.getItem('va_ear')).toBeNull();
    expect(load<unknown[]>('va_attempt_log', [])).toEqual([{ t: 1, en: 'a', score: 80, quality: 'echo' }]);
    expect(localStorage.getItem('va_drama_resume')).toBeNull();
    expect(sanitizeStorage()).toBe(0);
  });
  test('레벨 증거 출처(src) 허용목록 — 새 출처(retell·dtalk·drama-blind)는 살리고 모르는 출처는 뺀다', () => {
    const ev = (src: string) => ({ t: 1, skill: 'speaking', level: 'B1', score: 90, src, counts: true });
    localStorage.setItem('va_cefr_evidence', JSON.stringify([ev('retell'), ev('dtalk'), ev('drama-blind'), ev('talk'), ev('hacker'), { ...ev('talk'), src: undefined }]));
    sanitizeStorage();
    expect(load<{ src: string }[]>('va_cefr_evidence', []).map((e) => e.src)).toEqual(['retell', 'dtalk', 'drama-blind', 'talk']);
  });
  test('백업 복원은 새 키를 받아들이고 녹음 안내 문구가 있다', async () => {
    const { restoreBackup } = await import('../../lib/backup');
    const { BACKUP_SCOPE_NOTE } = await import('../../lib/backupNote');
    const data: Record<string, string> = {};
    for (const k of ['va_retell', 'va_attempt_daily', 'va_flags', 'va_day_gov', 'va_growth', 'va_sound_track', 'va_recall_speak', 'va_baseline', 'va_diag', 'va_speak_goal', 'va_ear'])
      data[k] = JSON.stringify(k === 'va_speak_goal' ? { goal: 12, kind: 'scored' } : k === 'va_flags' ? { retell: false } : {});
    data.va_groq_key = JSON.stringify('gsk_leak');
    const r = restoreBackup(JSON.stringify({ app: 'my-english-coach', format: 1, exportedAt: 'x', data }));
    expect(r.ok).toBe(true);
    expect(r.restored).toBe(11);
    expect(localStorage.getItem('va_groq_key')).toBeNull();
    expect(load<{ goal: number }>('va_speak_goal', { goal: 0 }).goal).toBe(12);
    expect(BACKUP_SCOPE_NOTE).toContain('녹음');
    expect(BACKUP_SCOPE_NOTE).toContain('포함되지 않');
  });
});

describe('M1 — 발화 목표 경량 읽기(speakGoalLite)', () => {
  test('기본 {goal:10, kind:"scored"}, 저장값은 goal·kind만 읽고 범위(1~35)로 자른다', async () => {
    const { speakGoalLite } = await import('../../lib/state');
    expect(speakGoalLite()).toEqual({ goal: 10, kind: 'scored' });
    localStorage.setItem('va_speak_goal', JSON.stringify({ goal: 14, kind: 'self', adaptedAt: 1, extra: true }));
    expect(speakGoalLite()).toEqual({ goal: 14, kind: 'self' });
    localStorage.setItem('va_speak_goal', JSON.stringify({ goal: 99, kind: 'weird' }));
    expect(speakGoalLite()).toEqual({ goal: 35, kind: 'scored' });
    localStorage.setItem('va_speak_goal', JSON.stringify('x'));
    expect(speakGoalLite()).toEqual({ goal: 10, kind: 'scored' });
  });
});

describe('M1 — 진단 카운터(va_diag)·TTS 지표(va_tts_meta)', () => {
  test('오늘 날짜에 누적, 모양 복원, 90일 보존', async () => {
    const { bumpDiag, diagLog, diagSum, bumpTtsMeta, ttsMetaToday } = await import('../../lib/diag');
    const old: Record<string, unknown> = {};
    for (let i = 0; i < 95; i++) old[`2020-01-${String((i % 28) + 1).padStart(2, '0')}-${i}`] = { tts429: 1 };
    localStorage.setItem('va_diag', JSON.stringify(old));
    bumpDiag('tts429');
    bumpDiag('tts429');
    bumpDiag('recSaveFail');
    bumpDiag('newReason');
    const days = Object.keys(diagLog());
    expect(days.length).toBe(90);
    const today = days[days.length - 1];
    expect(diagLog()[today]).toEqual({ canDetectFail: 0, stt429: 0, tts429: 2, recSaveFail: 1 });
    expect(diagSum(7).tts429).toBe(2);
    bumpTtsMeta('hit');
    bumpTtsMeta('miss');
    bumpTtsMeta('synth');
    bumpTtsMeta('hit');
    expect(ttsMetaToday()).toEqual({ hit: 2, miss: 1, synth: 1, tts429: 0 });
  });
});
