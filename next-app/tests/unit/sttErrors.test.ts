import { afterEach, describe, expect, test, vi } from 'vitest';
import { sttErrorMessage } from '../../lib/sttErrors';
import { SttError } from '../../lib/stt';

/** 리뷰 A4/B5 — 녹음·받아쓰기 실패를 원인별 쉬운 한국어 한 줄로(예전엔 전부 '마이크를 열지 못했어요') */
const dom = (name: string) => Object.assign(new Error('x'), { name });

afterEach(() => vi.unstubAllGlobals());

describe('sttErrorMessage', () => {
  test('마이크 권한 거부', () => {
    expect(sttErrorMessage(dom('NotAllowedError'))).toMatch(/마이크 권한/);
    expect(sttErrorMessage(dom('SecurityError'))).toMatch(/마이크 권한/);
  });
  test('마이크 없음', () => {
    expect(sttErrorMessage(dom('NotFoundError'))).toMatch(/마이크를 찾지 못했어요/);
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
