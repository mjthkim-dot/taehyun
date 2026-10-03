import { describe, expect, test } from 'vitest';
import { castNameKo, withIGa, withWa } from '../../lib/drama';
import { fillerText, wpmText } from '../../lib/speakLabels';

/** 리뷰 B8 — 리액션 턴 '{이름}가' 조사, B6 — 쉬운 한국어 문구 */
describe('withIGa — 받침에 맞는 주격 조사', () => {
  test('준이·다이앤이·태오가·마야가', () => {
    expect(withIGa(castNameKo('jun'))).toBe('준이');
    expect(withIGa(castNameKo('diane'))).toBe('다이앤이');
    expect(withIGa(castNameKo('taeo'))).toBe('태오가');
    expect(withIGa(castNameKo('maya'))).toBe('마야가');
    expect(withIGa('Jun')).toBe('Jun가'); // 한글이 아니면 '가'(원고에 없는 인물)
    expect(withWa('준')).toBe('준과'); // 기존 함수는 그대로
  });
});

describe('speakLabels', () => {
  test('WPM·필러 대신 쉬운 한국어', () => {
    expect(wpmText(42)).toBe('말 속도 분당 42단어');
    expect(fillerText(3)).toBe('음·어 같은 군말 3번');
  });
});
