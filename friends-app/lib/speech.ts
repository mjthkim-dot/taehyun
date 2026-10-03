/**
 * Web Speech API 래퍼 — TTS(듣기)와 STT(말하기 인식).
 *
 * 외부 API 없이 브라우저 내장 기능만 쓴다. 지원 여부가 브라우저마다 다르므로
 * 모든 진입점에서 지원 체크를 먼저 하고, 미지원이면 조용히 실패하는 대신
 * 호출부가 안내 UI를 띄울 수 있게 boolean/에러로 알린다.
 */

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function sttSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

/**
 * 영어(미국) 음성을 고른다. 우선순위:
 * ① en-US 로컬 음성 ② 아무 en-US ③ 아무 en-* — 그래도 없으면 브라우저 기본.
 * getVoices()는 비동기로 채워질 수 있어 호출 시점마다 다시 조회한다.
 */
function pickEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-US' && v.localService) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
  );
}

/** 진행 중인 발화를 멈춘다 (화면 이탈·새 재생 전 호출). */
export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

/**
 * 한 문장을 영어로 읽는다. rate 0.8(느리게)~1.0(보통).
 * 완료/중단 시점을 알 수 있게 Promise를 돌려준다.
 */
export function speak(text: string, rate = 0.95): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve();
    // 겹쳐 재생 방지 — 이전 큐를 비운다.
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    const voice = pickEnglishVoice();
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export interface SttResult {
  transcript: string;
  /** interim이면 아직 인식 중, final이면 확정. */
  isFinal: boolean;
}

export interface SttSession {
  stop: () => void;
}

/**
 * 음성 인식 세션 시작. onResult로 중간/최종 텍스트를 흘려 주고,
 * onEnd는 (사용자 stop 포함) 세션이 끝났을 때 한 번 불린다.
 */
export function startListening(handlers: {
  onResult: (r: SttResult) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}): SttSession | null {
  if (!sttSupported()) {
    handlers.onError('이 브라우저는 음성 인식을 지원하지 않아요. Chrome 또는 Edge를 사용해 주세요.');
    return null;
  }
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = false;

  rec.onresult = (event) => {
    let transcript = '';
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }
    handlers.onResult({ transcript: transcript.trim(), isFinal });
  };
  rec.onerror = (event) => {
    // 'no-speech'/'aborted'는 흔한 정상 종료 경로 — 에러 배너까지 띄우지 않는다.
    if (event.error === 'no-speech') handlers.onError('목소리가 들리지 않았어요. 다시 시도해 주세요.');
    else if (event.error === 'not-allowed')
      handlers.onError('마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요.');
    else if (event.error !== 'aborted') handlers.onError('음성 인식에 문제가 생겼어요. 다시 시도해 주세요.');
  };
  rec.onend = () => handlers.onEnd();

  try {
    rec.start();
  } catch {
    handlers.onError('음성 인식을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
    return null;
  }
  return { stop: () => rec.stop() };
}
