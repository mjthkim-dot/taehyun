'use client';

/**
 * 최소 TTS 재생 버튼 — 브라우저 내장 Web Speech API만 사용한다.
 * 원본 앱의 Groq Orpheus / MMS-TTS 등 고급 음성 파이프라인은 아직 포팅 전이며,
 * 이 버튼은 그 마이그레이션 전까지의 기본 동작(브라우저 음성)을 담당한다.
 */
export function speakText(text: string, lang = 'en-US', rate = 1) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

export default function SpeakButton({ text, lang = 'en-US', slow = false }: { text: string; lang?: string; slow?: boolean }) {
  return (
    <button type="button" className="speak-mini" onClick={() => speakText(text, lang, slow ? 0.6 : 1)} title={slow ? '0.6배속 느리게' : '듣기'}>
      {slow ? '🐢' : '🔊'}
    </button>
  );
}
