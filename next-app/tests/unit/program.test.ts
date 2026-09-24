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
