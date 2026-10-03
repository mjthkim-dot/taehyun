/**
 * 회화 탭(M6) 녹음 한 번 — Whisper(키+마이크)가 있으면 그것, 없으면 브라우저 받아쓰기.
 * 회화 턴·교정 게이트·리액션 턴·사다리가 같은 모양의 결과를 받도록 한 곳에 모았다.
 *
 * echo 게이트(lastTtsText)는 **다른 말을 하는** 경로(대화 턴·리액션)에서만 넘긴다 —
 * 따라 말하기(게이트·사다리)는 원래 직전 TTS와 같은 문장이라 넘기면 전부 'echo'로 막힌다.
 */
import { recordAndTranscribe, STT_PROPER_NOUNS, whisperAvailable, type SttLanguage, type SttState } from './stt';
import { blockingReason } from './sttQuality';
import { browserSttAvailable, listenOnce } from './browserStt';
import type { AttemptQuality } from './reviewEngine';

export interface RecOnce {
  text: string;
  /** 녹음 시작 시각(epoch ms) — 반응 지연 계산용 */
  recStartAt: number;
  voiceOnsetMs?: number;
  durationMs?: number;
  /** 채점을 막는 게이트 사유(무음 환각·불명확·에코·바쁨). 없으면 null */
  block: Exclude<AttemptQuality, 'ok'> | null;
  via: 'whisper' | 'webspeech';
}

export function recAvailable(): boolean {
  return whisperAvailable() || browserSttAvailable();
}

export async function recOnce(o: {
  language: SttLanguage;
  maxMs: number;
  silenceMs: number;
  lastTtsText?: string;
  temperature?: number;
  registerStop?: (stop: () => void) => void;
  onState?: (s: SttState) => void;
}): Promise<RecOnce> {
  const recStartAt = Date.now();
  if (whisperAvailable()) {
    const r = await recordAndTranscribe({
      // 받아쓰기 힌트는 고유명사만(모범 문장을 넣으면 전사가 그쪽으로 끌려간다)
      prompt: STT_PROPER_NOUNS,
      language: o.language,
      detail: 'segments',
      silenceMs: o.silenceMs,
      maxMs: o.maxMs,
      temperature: o.temperature,
      lastTtsText: o.lastTtsText,
      registerStop: o.registerStop,
      onState: o.onState,
    });
    return { text: (r.text || '').trim(), recStartAt, voiceOnsetMs: r.voiceOnsetMs, durationMs: r.durationMs, block: blockingReason(r), via: 'whisper' };
  }
  const text = await listenOnce({ lang: o.language === 'ko' ? 'ko-KR' : 'en-US', maxMs: o.maxMs, registerStop: o.registerStop });
  return { text: (text || '').trim(), recStartAt, block: null, via: 'webspeech' };
}
