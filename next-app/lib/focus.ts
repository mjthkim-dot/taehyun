/**
 * 집중 모드 — "기능이 너무 많아서 뭐부터 해야 할지 모르겠다"에 대한 답.
 *
 * 처음 배우는 사람에게 38개 화면은 선택지가 아니라 부담이다. 집중 모드(기본값)는
 * 앱을 세 가지로 줄인다: ① 레벨 진단(한 번) ② 오늘의 레슨(매일) ③ 단어(레슨 복습에
 * 포함). 나머지 기능은 지우지 않고 "모든 기능 보기"로 언제든 켤 수 있다.
 */
import { load, store } from './state';

const KEY = 'va_mode';
export const FOCUS_EVENT = 'va:focus';

export function isFocusMode(): boolean {
  return load<string>(KEY, 'focus') !== 'full';
}

export function setFocusMode(on: boolean) {
  store(KEY, on ? 'focus' : 'full');
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FOCUS_EVENT));
}
