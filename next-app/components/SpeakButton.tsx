'use client';

/**
 * 최소 TTS 재생 버튼 — 브라우저 내장 Web Speech API만 사용한다.
 * 원본 앱의 Groq Orpheus / MMS-TTS 등 고급 음성 파이프라인은 아직 포팅 전이며,
 * 이 버튼은 그 마이그레이션 전까지의 기본 동작(브라우저 음성)을 담당한다.
 */
export default function SpeakButton({ text, lang = 'en-US' }: { text: string; lang?: string }) {
  const speak = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    window.speechSynthesis.speak(u);
  };

  return (
    <button type="button" className="speak-mini" onClick={speak} title="듣기">
      🔊
    </button>
  );
}
