'use client';

/**
 * 최소 TTS 재생 버튼 — 브라우저 내장 Web Speech API만 사용한다.
 * 다만 브라우저가 제공하는 음성 목록 중 더 자연스러운 음성(Google/Microsoft Online Natural 등)을
 * 자동으로 골라 써서 추가 비용 없이 음질을 개선한다. 원본 앱의 Groq Orpheus / MMS-TTS 등
 * 고급 음성 파이프라인은 무료 한도 부담이 커서 보류했다.
 */

// 선호도가 높은 음성 이름들 — 브라우저/OS에 따라 일부만 존재할 수 있다.
const PREFERRED_VOICE_NAMES = [
  'Google US English',
  'Microsoft Aria Online (Natural)',
  'Microsoft Jenny Online (Natural)',
  'Samantha',
  'Google UK English Female',
];

let voiceCache: SpeechSynthesisVoice[] = [];
if (typeof window !== 'undefined' && window.speechSynthesis) {
  voiceCache = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    voiceCache = window.speechSynthesis.getVoices();
  };
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (!voiceCache.length) return undefined;
  const prefix = lang.split('-')[0];
  for (const name of PREFERRED_VOICE_NAMES) {
    const v = voiceCache.find((v) => v.name === name && v.lang.startsWith(prefix));
    if (v) return v;
  }
  return voiceCache.find((v) => v.lang === lang) || voiceCache.find((v) => v.lang.startsWith(prefix));
}

export function speakText(text: string, lang = 'en-US', rate = 1, onend?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  if (onend) u.onend = onend;
  window.speechSynthesis.speak(u);
}

export default function SpeakButton({ text, lang = 'en-US', slow = false }: { text: string; lang?: string; slow?: boolean }) {
  return (
    <button type="button" className="speak-mini" onClick={() => speakText(text, lang, slow ? 0.6 : 1)} title={slow ? '0.6배속 느리게' : '듣기'}>
      {slow ? '🐢' : '🔊'}
    </button>
  );
}
