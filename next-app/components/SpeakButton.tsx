'use client';

/**
 * TTS 재생 버튼 — Groq PlayAI TTS(자연스러운 음성)를 1차로 쓰고, 키가 없거나 호출이
 * 실패하면 브라우저 내장 Web Speech API(자동 보이스 선택)로 자동 폴백한다.
 * 같은 문장을 반복 재생(다시듣기 등)할 때 과금/한도 소모를 줄이기 위해 합성 결과를
 * 메모리에 캐싱해 재사용한다.
 */
import { groqKey, SERVER_GROQ_SENTINEL } from '../lib/state';

const GROQ_TTS_VOICE = 'Fritz-PlayAI';

// 선호도가 높은 브라우저 내장 음성 이름들 — 폴백 시에만 사용, 일부만 존재할 수 있다.
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

function speakWithBrowser(text: string, lang: string, rate: number, onend?: () => void) {
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

const ttsCache = new Map<string, Blob>();
let currentAudio: HTMLAudioElement | null = null;

/** Groq PlayAI TTS는 현재 영어 음성만 지원한다 — 한국어 등은 항상 브라우저 음성으로 폴백. */
async function speakWithGroq(text: string, lang: string, rate: number, onend?: () => void): Promise<boolean> {
  if (!lang.startsWith('en')) return false;
  const key = groqKey();
  if (!key) return false;

  const cacheKey = `${GROQ_TTS_VOICE}:${text}`;
  try {
    let blob = ttsCache.get(cacheKey);
    if (!blob) {
      const resp = await fetch('/app/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: GROQ_TTS_VOICE,
          key: key === SERVER_GROQ_SENTINEL ? undefined : key,
        }),
      });
      if (!resp.ok) return false;
      blob = await resp.blob();
      ttsCache.set(cacheKey, blob);
    }
    currentAudio?.pause();
    window.speechSynthesis?.cancel();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.playbackRate = rate;
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      onend?.();
    };
    audio.onerror = () => URL.revokeObjectURL(url);
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

export function speakText(text: string, lang = 'en-US', rate = 1, onend?: () => void) {
  speakWithGroq(text, lang, rate, onend).then((ok) => {
    if (!ok) speakWithBrowser(text, lang, rate, onend);
  });
}

/** 진행 중인 TTS(Groq 오디오 + 브라우저 합성 음성)를 모두 멈춘다. */
export function stopSpeaking() {
  currentAudio?.pause();
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
}

export default function SpeakButton({ text, lang = 'en-US', slow = false }: { text: string; lang?: string; slow?: boolean }) {
  return (
    <button type="button" className="speak-mini" onClick={() => speakText(text, lang, slow ? 0.6 : 1)} title={slow ? '0.6배속 느리게' : '듣기'}>
      {slow ? '🐢' : '🔊'}
    </button>
  );
}
