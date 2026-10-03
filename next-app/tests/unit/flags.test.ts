import { beforeEach, describe, expect, test } from 'vitest';
import { changedFlagCount, FLAG_DEFAULTS, FLAG_LABELS, flagList, isOn, registerFlag, resetFlags, setFlag } from '../../lib/flags';
import { load } from '../../lib/state';

/** 실험 기능 플래그(M1) — 기본 전부 켜짐, 열린 키, 저장에는 덮어쓴 값만 */
beforeEach(() => localStorage.clear());

describe('기본값', () => {
  test('8종 모두 켜짐 + 한국어 라벨', () => {
    const keys = ['rolePlay', 'speakRecall', 'retell', 'fixGate', 'dayGovernor', 'decoder', 'hvpt', 'wordSpeak'];
    for (const k of keys) {
      expect(FLAG_DEFAULTS[k], k).toBe(true);
      expect(isOn(k), k).toBe(true);
      expect(/[가-힣]/.test(FLAG_LABELS[k]), k).toBe(true);
    }
    // M7: 표시 설정 soundLine(말풍선 '원어민 소리' 줄)이 9번째로 붙었다 — 켜는 설정이라 기본 꺼짐
    expect(flagList().map((f) => f.key)).toEqual([...keys, 'soundLine']);
    expect(FLAG_DEFAULTS.soundLine).toBe(false);
    expect(isOn('soundLine')).toBe(false);
    expect(changedFlagCount()).toBe(0);
  });
  test('모르는 키(열린 union)는 켜짐으로 본다', () => {
    expect(isOn('somethingNew')).toBe(true);
  });
});

describe('끄기·되돌리기', () => {
  test('off 분기 — 저장에는 바꾼 키만, 기본값으로 돌리면 저장에서 빠진다', () => {
    setFlag('retell', false);
    expect(isOn('retell')).toBe(false);
    expect(load<Record<string, boolean>>('va_flags', {})).toEqual({ retell: false });
    expect(changedFlagCount()).toBe(1);
    setFlag('retell', true);
    expect(load<Record<string, boolean>>('va_flags', {})).toEqual({});
  });
  test('손상된 저장값(불리언 아님)은 무시한다', () => {
    localStorage.setItem('va_flags', JSON.stringify({ retell: 'no', hvpt: false, decoder: 0 }));
    expect(isOn('retell')).toBe(true);
    expect(isOn('hvpt')).toBe(false);
    expect(isOn('decoder')).toBe(true);
    localStorage.setItem('va_flags', JSON.stringify([false]));
    expect(isOn('hvpt')).toBe(true);
  });
  test('resetFlags — 전부 기본값', () => {
    setFlag('hvpt', false);
    setFlag('decoder', false);
    resetFlags();
    expect(changedFlagCount()).toBe(0);
    expect(isOn('hvpt')).toBe(true);
  });
  test('registerFlag — 다른 모듈(M11)이 키를 더하면 목록·기본값에 들어가고, 이미 있는 키는 덮지 않는다', () => {
    registerFlag('earFirst', '귀 먼저(자막 없이 듣기)', false);
    expect(isOn('earFirst')).toBe(false);
    expect(flagList().find((f) => f.key === 'earFirst')?.label).toBe('귀 먼저(자막 없이 듣기)');
    registerFlag('retell', '다른 이름', false);
    expect(FLAG_DEFAULTS.retell).toBe(true);
    expect(FLAG_LABELS.retell).not.toBe('다른 이름');
    delete FLAG_DEFAULTS.earFirst;
    delete FLAG_LABELS.earFirst;
  });
});
