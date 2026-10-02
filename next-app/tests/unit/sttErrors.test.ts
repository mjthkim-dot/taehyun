/**
 * A4 — 녹음·받아쓰기 실패 문구가 원인별로 갈린다(예전엔 전부 '마이크를 열지 못했어요').
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { sttErrorKind, sttErrorMessage } from '../../lib/sttErrors';
import { SttError } from '../../lib/stt';

const dom = (name: string) => Object.assign(new Error(name), { name });
afterEach(() => vi.unstubAllGlobals());

describe('sttErrorMessage', () => {
  test('마이크 권한 거부 / 마이크 없음 / 오프라인 / 키 오류(401) / 서버 바쁨(429·5xx) / 기타', () => {
    expect(sttErrorKind(dom('NotAllowedError'))).toBe('mic-denied');
    expect(sttErrorKind(dom('NotFoundError'))).toBe('no-mic');
    expect(sttErrorKind(dom('NotReadableError'))).toBe('no-mic');
    expect(sttErrorKind(new SttError('Invalid API Key', 401))).toBe('key');
    expect(sttErrorKind(new SttError('HTTP 401'))).toBe('key');
    expect(sttErrorKind(new SttError('busy', 429))).toBe('busy');
    expect(sttErrorKind(new SttError('upstream', 503))).toBe('busy');
    expect(sttErrorKind(new TypeError('Failed to fetch'))).toBe('offline');
    expect(sttErrorKind(new Error('weird'))).toBe('other');
    expect(sttErrorKind(undefined)).toBe('other');
  });
  test('navigator.onLine === false면 오프라인(마이크 문구가 아님)', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(sttErrorKind(new SttError('HTTP 500', 500))).toBe('offline');
    expect(sttErrorMessage(new Error('x'))).toMatch(/인터넷/);
    // 마이크 오류는 오프라인이어도 마이크 문구
    expect(sttErrorKind(dom('NotAllowedError'))).toBe('mic-denied');
  });
  test('문구는 한국어 한 줄이고 서로 다르다', () => {
    const msgs = [dom('NotAllowedError'), dom('NotFoundError'), new SttError('x', 401), new SttError('x', 429), new TypeError('Failed to fetch'), new Error('?')].map(sttErrorMessage);
    expect(new Set(msgs).size).toBe(6);
    for (const m of msgs) expect(m).toMatch(/[가-힣]/);
    expect(msgs.filter((m) => m.includes('마이크')).length).toBe(2);
  });
});

// 그룹 B가 따로 만든 같은 함수의 사례 — 합친 구현이 둘 다 만족해야 한다
const domB = (name: string) => Object.assign(new Error('x'), { name });

describe('sttErrorMessage — 그룹 B 사례(NO_GROQ_KEY·한국어 키 오류·reason busy)', () => {
  test('마이크 권한 거부', () => {
    expect(sttErrorMessage(domB('NotAllowedError'))).toMatch(/마이크 권한/);
    expect(sttErrorMessage(domB('SecurityError'))).toMatch(/마이크 권한/);
  });
  test('마이크 없음', () => {
    expect(sttErrorMessage(domB('NotFoundError'))).toMatch(/마이크를 찾지 못했어요/);
  });
  test('오프라인 — navigator.onLine false 또는 fetch TypeError', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(sttErrorMessage(new SttError('HTTP 502'))).toMatch(/인터넷/);
    vi.stubGlobal('navigator', { onLine: true });
    expect(sttErrorMessage(new TypeError('Failed to fetch'))).toMatch(/인터넷/);
  });
  test('키 오류(401)', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(sttErrorMessage(new SttError('API 키가 올바르지 않습니다.'))).toMatch(/키/);
    expect(sttErrorMessage(new SttError('NO_GROQ_KEY'))).toMatch(/키/);
    expect(sttErrorMessage(Object.assign(new SttError('x'), { status: 401 }))).toMatch(/키/);
  });
  test('서버 바쁨(429/busy)', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(sttErrorMessage(new SttError('busy'))).toMatch(/바빠요/);
    expect(sttErrorMessage(Object.assign(new SttError('x'), { reason: 'busy' }))).toMatch(/바빠요/);
  });
  test('그 밖(5xx·알 수 없음) — 마이크 탓을 하지 않는다', () => {
    vi.stubGlobal('navigator', { onLine: true });
    for (const e of [new SttError('HTTP 502'), new Error('weird'), 'str', null, undefined]) {
      const m = sttErrorMessage(e);
      expect(m).toMatch(/잠시 뒤/);
      expect(m).not.toMatch(/마이크/);
    }
  });
});
