/**
 * 녹음·받아쓰기 실패를 학습자가 알아듣는 한 줄로 — 예전엔 모든 카드가 오류 종류와 상관없이
 * '마이크를 열지 못했어요'라고 해서, 인터넷이 끊기거나 키가 틀린 사용자가 마이크 설정만 뒤졌다.
 *
 * 가르는 근거(무거운 import 없이 모양만 본다 — lib/stt의 SttError는 status를 싣는다):
 *   · getUserMedia 오류 이름 — NotAllowedError/SecurityError(권한 거부) · NotFoundError/NotReadableError/OverconstrainedError(마이크 없음·사용 중)
 *   · navigator.onLine === false 또는 fetch TypeError(네트워크)
 *   · SttError.status / 메시지 — 401·403(키 오류) · 429·5xx·busy(서버 바쁨)
 */
export type SttErrorKind = 'mic-denied' | 'no-mic' | 'offline' | 'key' | 'busy' | 'other';

export function sttErrorKind(e: unknown): SttErrorKind {
  const o = (e && typeof e === 'object' ? e : {}) as { name?: unknown; message?: unknown; status?: unknown };
  const name = typeof o.name === 'string' ? o.name : '';
  const msg = typeof o.message === 'string' ? o.message : typeof e === 'string' ? e : '';
  const status = typeof o.status === 'number' ? o.status : 0;
  if (name === 'NotAllowedError' || name === 'SecurityError' || /permission|not allowed/i.test(msg)) return 'mic-denied';
  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError' || /device not found|no microphone/i.test(msg)) return 'no-mic';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (status === 401 || status === 403 || /\b40[13]\b|api key|unauthori[sz]ed/i.test(msg)) return 'key';
  if (status === 429 || status >= 500 || /\b429\b|\b5\d\d\b|busy|rate limit|overloaded/i.test(msg)) return 'busy';
  if (name === 'TypeError' && /fetch|network|load failed/i.test(msg)) return 'offline';
  return 'other';
}

const MESSAGES: Record<SttErrorKind, string> = {
  'mic-denied': '마이크 권한이 꺼져 있어요 — 브라우저 설정에서 마이크를 허용해 주세요.',
  'no-mic': '마이크를 찾지 못했어요 — 연결돼 있는지, 다른 앱이 쓰고 있지 않은지 봐 주세요.',
  offline: '인터넷이 끊겼어요 — 연결되면 다시 눌러 주세요.',
  key: '키가 맞지 않아요 — 설정에서 Groq 키를 확인해 주세요.',
  busy: '서버가 바빠요 — 잠시 뒤 다시 눌러 주세요.',
  other: '잠깐 문제가 생겼어요 — 다시 눌러 주세요.',
};

/** 녹음·전사 실패 한 줄(쉬운 한국어) */
export function sttErrorMessage(e: unknown): string {
  return MESSAGES[sttErrorKind(e)];
}
