import { beforeEach, describe, expect, test } from 'vitest';
import { programStats, startProgram, todayPlan, syncProgramDay, checkOffBlock, TOTAL_DAYS } from '../../lib/program';
import { todayKey } from '../../lib/dates';

beforeEach(() => localStorage.clear());

describe('12주 프로그램', () => {
  test('시작 당일은 1일째, Day 1', () => {
    startProgram({ why: 'test', minutes: 25 });
    expect(programStats()!.elapsedDays).toBe(1);
    expect(todayPlan()!.day).toBe(1);
  });
  test('실전 블록은 온톨로지 유닛으로 구체화된다', () => {
    startProgram({ why: 'test', minutes: 25 });
    const field = todayPlan()!.blocks.find((b) => b.key === 'field')!;
    expect(field.unitRef).toBeTruthy();
    expect(field.title.startsWith('실전 · ')).toBe(true);
  });
  test('4블록을 채우면 훈련일로 기록되고 Day가 오른다', () => {
    startProgram({ why: 'test', minutes: 25 });
    localStorage.setItem('va_spoken', JSON.stringify({ date: todayKey(), count: 25 }));
    for (const k of ['warmup', 'core', 'field'] as const) checkOffBlock(k);
    expect(syncProgramDay()).toBe(true);
    expect(syncProgramDay()).toBe(false);
    const p = todayPlan()!;
    expect(p.recorded).toBe(true);
    expect(p.completed).toBe(1);
    expect(TOTAL_DAYS).toBe(60);
  });
});

describe('1단계 복습 — 복습할 게 없으면 통과(v1.27.1 버그 수정)', () => {
  test('신규 사용자: 복습 자동 완료 → 다음은 문법', async () => {
    const { nothingToReview } = await import('../../lib/program');
    startProgram({ why: 'test', minutes: 25 });
    expect(nothingToReview()).toBe(true);
    const p = todayPlan()!;
    expect(p.blocks[0].done).toBe(true);
    expect(p.blocks.find((b) => !b.done)!.key).toBe('core');
  });
  test('기한 된 복습 카드가 있으면 1단계는 남는다', async () => {
    const { nothingToReview } = await import('../../lib/program');
    startProgram({ why: 'test', minutes: 25 });
    localStorage.setItem('va_weak', JSON.stringify([{ en: 'Could you send it?', kr: '보내 주시겠어요?', box: 1, lapses: 0, due: Date.now() - 1000 }]));
    expect(nothingToReview()).toBe(false);
    expect(todayPlan()!.blocks[0].done).toBe(false);
  });
  test('단어 복습 기한이 있으면 1단계는 남는다', async () => {
    const { nothingToReview } = await import('../../lib/program');
    localStorage.setItem('va_words', JSON.stringify({ 'core:handle': { b: 1, d: Date.now() - 1000, n: 1, l: 0, t: '2026-09-24' } }));
    expect(nothingToReview()).toBe(false);
  });
});
