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
