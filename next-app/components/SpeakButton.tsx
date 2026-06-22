'use client';

/**
 * TTS 재생 — Groq PlayAI 신경망 음성(실제 사람에 가까운 목소리)을 1순위로 쓴다.
 *
 * iOS 사파리 대응: 오디오 재생은 사용자 제스처(클릭) 안에서 시작돼야 한다. 그런데 Groq
 * 음성은 네트워크로 받아오므로(비동기) 제스처 컨텍스트를 벗어나 차단된다. 그래서 클릭 순간
 * 공용 <audio> 엘리먼트에 무음 클립을 동기적으로 play()해 "언락"해 두고(primeAudio),
 * 음성이 도착하면 같은 엘리먼트의 src만 바꿔 재생한다 — 한 번 언락된 엘리먼트는 이후
 * 비동기 재생도 허용된다(Howler 등이 쓰는 표준 기법).
 *
 * 합성 결과(blob URL)는 캐싱해 다시듣기·반복 재생 시 추가 호출/지연이 없게 한다.
 * 키가 없거나 합성에 실패하면 브라우저 내장 음성으로 폴백한다.
 */
import { groqKey, SERVER_GROQ_SENTINEL } from '../lib/state';

export const GROQ_TTS_VOICE = 'Fritz-PlayAI';
/** 화자별 Groq 보이스 — A 남성 / B 여성으로 대화 몰입감을 준다. */
export const SPEAKER_GROQ_VOICE: Record<string, string> = { A: 'Fritz-PlayAI', B: 'Celeste-PlayAI' };

// iOS 오디오 언락용 무음 WAV(8kHz·mono·0샘플).
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/* ── 공용 오디오 엘리먼트(언락 상태 공유) ── */
let sharedAudio: HTMLAudioElement | null = null;
function audioEl(): HTMLAudioElement {
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}

/** 반드시 사용자 제스처(클릭) 안에서 동기적으로 호출 — iOS 오디오 재생을 언락한다. */
export function primeAudio() {
  if (typeof window === 'undefined') return;
  try {
    const a = audioEl();
    if (!a.src) a.src = SILENT_WAV;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    /* ignore */
  }
}

/* ── 브라우저 내장 음성(폴백) ── */
const PREFERRED_VOICE_NAMES = [
  'Microsoft Aria Online (Natural)',
  'Microsoft Jenny Online (Natural)',
  'Google US English',
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

/* ── Groq 신경망 음성 ── */
const ttsCache = new Map<string, string>(); // `${voice}:${text}` -> objectURL

/** Groq에서 음성을 받아 objectURL을 돌려준다(캐시). 실패 시 null. */
export async function fetchGroqTTS(text: string, voice = GROQ_TTS_VOICE): Promise<string | null> {
  const key = groqKey();
  if (!key) return null;
  const cacheKey = `${voice}:${text}`;
  const cached = ttsCache.get(cacheKey);
  if (cached) return cached;
  try {
    const resp = await fetch('/app/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, key: key === SERVER_GROQ_SENTINEL ? undefined : key }),
    });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    ttsCache.set(cacheKey, url);
    return url;
  } catch {
    return null;
  }
}

/** 공용 엘리먼트로 objectURL을 재생한다. Promise는 play() 결과. */
export function playUrl(url: string, rate: number, onended?: () => void): Promise<void> {
  const a = audioEl();
  window.speechSynthesis?.cancel();
  a.pause();
  a.src = url;
  a.playbackRate = rate;
  a.onended = onended ? () => onended() : null;
  const p = a.play();
  return p && typeof p.then === 'function' ? p : Promise.resolve();
}

/**
 * 한 문장 재생. voice: Groq 보이스 이름(대화문 화자별로 다르게 줄 때).
 * 키가 있으면 Groq 신경망 음성, 없거나 실패하면 브라우저 음성.
 */
export function speakText(text: string, lang = 'en-US', rate = 1, onend?: () => void, voice?: string) {
  primeAudio(); // 제스처 안에서 동기 언락
  if (!lang.startsWith('en') || !groqKey()) {
    speakWithBrowser(text, lang, rate, onend);
    return;
  }
  fetchGroqTTS(text, voice || GROQ_TTS_VOICE).then((url) => {
    if (url) {
      playUrl(url, rate, onend).catch(() => speakWithBrowser(text, lang, rate, onend));
    } else {
      speakWithBrowser(text, lang, rate, onend);
    }
  });
}

/** 진행 중인 모든 음성(Groq 오디오 + 브라우저 합성)을 멈춘다. */
export function stopSpeaking() {
  sharedAudio?.pause();
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
}

export default function SpeakButton({ text, lang = 'en-US', slow = false }: { text: string; lang?: string; slow?: boolean }) {
  return (
    <button type="button" className="speak-mini" onClick={() => speakText(text, lang, slow ? 0.6 : 1)} title={slow ? '0.6배속 느리게' : '듣기'}>
      {slow ? '🐢' : '🔊'}
    </button>
  );
}
