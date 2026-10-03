/**
 * 전사 품질 게이트 — 채점하기 전에 "이 전사를 믿어도 되는가"를 가른다.
 *
 * Whisper는 무음에도 그럴듯한 문장을 지어내고(환각 — "Thank you.", "Bye." 류),
 * 스피커로 나온 직전 TTS를 마이크가 되받아 적기도 한다(스피커 누출). 그 전사를 그대로
 * 채점하면 "잘 말했다/틀렸다"가 아니라 **아예 다른 소리**를 진단한 셈이 된다.
 * verbose_json의 세그먼트 확신도(no_speech_prob·avg_logprob·compression_ratio)와
 * 직전 TTS 텍스트로 네 가지를 걸러낸다.
 *
 *  silent  : 세그먼트 과반이 no_speech_prob > 0.6 — 말소리가 없었다(환각 가능성)
 *  unclear : avg_logprob 평균 < -1 또는 compression_ratio > 2.4 — 또렷하지 않거나 반복 환각
 *  echo    : 전사가 직전 TTS 텍스트와 80% 이상 일치 — 스피커 누출
 *  busy    : 서버가 429를 두 번 돌려줬다(재시도 후에도) — 잠시 후 다시
 *
 * ⚠️ echo는 **학습자가 TTS와 다른 말을 해야 하는 경로**(대화 턴·리액션·회상)에서만
 * lastTtsText를 넘겨 쓴다. 따라 말하기·섀도잉처럼 같은 문장을 말해야 하는 경로에서
 * 넘기면 정답을 누출로 오판한다. 세그먼트가 없는 응답(기본 json·브라우저 인식)은
 * 텍스트 유무와 echo만 본다(폴백).
 */
import { alignedScore, normWords } from './align';

export type GateReason = 'ok' | 'silent' | 'unclear' | 'echo' | 'busy';

export interface SttQuality {
  ok: boolean;
  reason: Exclude<GateReason, 'ok'> | null;
  /** 세그먼트 avg_logprob 평균(세그먼트가 없으면 0) — 진단 표·추세용 */
  logprobMean: number;
}

/** gate가 보는 최소 형태 — lib/stt.ts의 SttResult가 이를 만족한다 */
export interface GateInput {
  text: string;
  reason?: string;
  segments?: { start: number; end: number; avg_logprob: number; no_speech_prob: number; compression_ratio: number }[];
}

export const SILENT_NO_SPEECH = 0.6;
export const UNCLEAR_LOGPROB = -1;
export const UNCLEAR_COMPRESSION = 2.4;
export const ECHO_MATCH = 80;
/** 이 단어 수 미만의 짧은 전사("Yes.")는 누출 판정을 하지 않는다 — 우연 일치가 흔하다 */
const ECHO_MIN_WORDS = 3;

/** 전사가 직전 TTS와 얼마나 겹치나(0~100) — 채점과 같은 LCS F1 */
export function echoMatch(text: string, lastTtsText?: string): number {
  if (!lastTtsText || !text) return 0;
  if (normWords(text).length < ECHO_MIN_WORDS) return 0;
  return alignedScore(lastTtsText, text).score;
}

export function logprobMean(segments?: GateInput['segments']): number {
  if (!segments?.length) return 0;
  const vals = segments.map((s) => s.avg_logprob).filter((v) => Number.isFinite(v));
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) / 1000;
}

export function gate(result: GateInput, lastTtsText?: string): GateReason {
  if (result.reason === 'busy') return 'busy';
  const segs = result.segments || [];
  const text = (result.text || '').trim();
  if (segs.length) {
    const silentCount = segs.filter((s) => s.no_speech_prob > SILENT_NO_SPEECH).length;
    if (silentCount * 2 > segs.length) return 'silent';
  } else if (!text) {
    // 세그먼트가 없는 폴백 — 텍스트가 비면 무음으로 본다
    return 'silent';
  }
  if (echoMatch(text, lastTtsText) >= ECHO_MATCH) return 'echo';
  if (segs.length) {
    const lp = logprobMean(segs);
    const maxComp = Math.max(...segs.map((s) => (Number.isFinite(s.compression_ratio) ? s.compression_ratio : 0)));
    if (lp < UNCLEAR_LOGPROB || maxComp > UNCLEAR_COMPRESSION) return 'unclear';
  }
  return 'ok';
}

export function assessQuality(result: GateInput, lastTtsText?: string): SttQuality {
  const r = gate(result, lastTtsText);
  return { ok: r === 'ok', reason: r === 'ok' ? null : r, logprobMean: logprobMean(result.segments) };
}

/**
 * 채점을 **막아야 하는** 사유만 돌려준다(없으면 null) — 화면 호출부용.
 * busy·unclear·echo는 언제나 막는다. silent는 세그먼트가 그렇게 말할 때만(무음 환각) 막고,
 * 세그먼트 없는 빈 전사는 호출부의 기존 처리(마이크 안내·브라우저 인식 재시도)에 맡긴다.
 */
export function blockingReason(result: GateInput & { quality?: SttQuality }): SttQuality['reason'] {
  const q = result.quality ?? assessQuality(result);
  if (q.ok || !q.reason) return null;
  if (q.reason === 'silent' && !result.segments?.length) return null;
  return q.reason;
}

/** 게이트 결과를 학습자 문구로 — 모든 화면이 같은 말을 쓴다 */
export function gateMessage(reason: GateReason | SttQuality['reason']): string {
  switch (reason) {
    case 'silent':
      return '소리가 잘 안 잡혔어요 — 한 번만 더';
    case 'unclear':
      return '또렷하게 다시 — 아니면 들어보기 ▶';
    case 'echo':
      return '스피커 소리가 섞였어요 — 한 번 더';
    case 'busy':
      return '잠시 후 다시(서버가 바빠요)';
    default:
      return '';
  }
}
