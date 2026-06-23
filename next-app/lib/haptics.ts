/**
 * 햅틱(진동) 피드백 — 지원 기기(주로 Android/모바일)에서만 동작하고,
 * navigator.vibrate 가 없으면 조용히 무시한다. 정답·오답·탭 같은 순간에
 * 짧은 촉각 신호를 더해 반응을 또렷하게 만든다.
 */
type Pattern = 'light' | 'success' | 'error' | 'tap';

const PATTERNS: Record<Pattern, number | number[]> = {
  light: 10,
  tap: 15,
  success: [18, 40, 28],
  error: [40, 30, 40],
};

export function haptic(pattern: Pattern = 'light'): void {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav && typeof nav.vibrate === 'function') {
      nav.vibrate(PATTERNS[pattern]);
    }
  } catch {
    /* 일부 브라우저는 사용자 제스처 밖 호출 시 예외 — 무시 */
  }
}
