/**
 * 녹음·받아쓰기 실패를 학습자가 알아듣는 한국어 한 줄로(리뷰 A4/B5).
 *
 * 예전엔 카드마다 catch에서 '마이크를 열지 못했어요'만 띄웠다 — 실제로는 인터넷이 끊겼거나(fetch TypeError),
 * 키가 틀렸거나(401 → SttError 'API 키가 올바르지 않습니다.'), 서버가 바빴는데도(429 → SttError 'busy')
 * 마이크 탓을 해서 학습자가 엉뚱한 설정을 뒤졌다.
 *
 * 분류 기준(위에서부터):
 *   · getUserMedia 거부(NotAllowedError·SecurityError)        → 마이크 권한
 *   · 마이크 장치 없음(NotFoundError·OverconstrainedError)     → 마이크 연결
 *   · navigator.onLine === false 또는 fetch 네트워크 TypeError → 인터넷
 *   · 401·키 오류(NO_GROQ_KEY·'API 키')                       → 키 확인
 *   · 429·busy·rate limit                                    → 서버 바쁨
 *   · 그 밖(5xx·알 수 없음)                                   → 잠시 뒤 다시
 * SttError에 reason 필드가 생기면(그룹 A) 그 값을 먼저 본다 — 메시지 문자열보다 확실하다.
 */
export function sttErrorMessage(e: unknown): string {
  const err = (e && typeof e === 'object' ? e : {}) as { name?: string; message?: string; reason?: string; status?: number };
  const name = String(err.name || '');
  const msg = String(err.message ?? (typeof e === 'string' ? e : ''));
  const reason = String(err.reason || '');
  const status = typeof err.status === 'number' ? err.status : 0;

  if (name === 'NotAllowedError' || name === 'SecurityError' || reason === 'mic-denied' || /permission denied|not-allowed/i.test(msg)) {
    return '마이크 권한이 꺼져 있어요 — 브라우저 설정에서 마이크를 허용한 뒤 다시 눌러 주세요.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError' || reason === 'no-mic') {
    return '마이크를 찾지 못했어요 — 마이크·이어폰 연결을 확인하고 다시 눌러 주세요.';
  }
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline || reason === 'offline' || (name === 'TypeError' && /fetch|network|load failed/i.test(msg))) {
    return '인터넷이 끊겼어요 — 연결되면 다시 눌러 주세요.';
  }
  if (reason === 'auth' || status === 401 || /NO_GROQ_KEY|API 키|HTTP 401|invalid api key|unauthorized/i.test(msg)) {
    return 'AI 키에 문제가 있어요 — 설정에서 키를 확인해 주세요.';
  }
  if (reason === 'busy' || status === 429 || /^busy$|HTTP 429|rate limit|too many/i.test(msg)) {
    return '받아쓰기 서버가 바빠요 — 10초쯤 뒤에 다시 눌러 주세요.';
  }
  return '받아쓰기가 잠깐 안 돼요 — 잠시 뒤 다시 눌러 주세요.';
}
