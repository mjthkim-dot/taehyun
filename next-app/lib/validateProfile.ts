/**
 * AI 원고 '역할극 프로필' 검증(M2) — 태오(학습자 역할) 대사가 역할극 재료로 충분한가.
 *
 * validateEpisode(lib/drama.ts)는 형식·몰입·레벨을 본다. 여기서는 **말하기 분량**을 본다:
 *   · 태오 line/speak 5줄 이상(화당 발화 기회의 바닥)
 *   · 단어 수 — A1/A2는 5~8, B1+는 7~12(평균 기준; 한두 줄 벗어나는 건 봐준다)
 * gpt-oss(기본 모델) **첫 시도만 하드**(어긋나면 거부 → 재작성), 재시도·다른 모델(qwen·llama 폴백)은
 * 소프트(경고만, 원고는 받는다). 모델이 한 번 놓쳤다고 이야기 자체를 못 보게 하지 않는다.
 * 실패 시 안내 문구(PROFILE_FAIL_HINT)는 전날 화 리플레이 역할극으로 보낸다.
 */
import type { Episode } from './drama';

export const PROFILE_MIN_LINES = 5;
/** 레벨별 태오 대사 단어 수 범위 */
export const PROFILE_WORD_RANGE: Record<'low' | 'high', readonly [number, number]> = { low: [5, 8], high: [7, 12] };

export interface ProfileReport {
  ok: boolean;
  /** 어긋났을 때 거부해야 하나(하드) — false면 경고만 */
  hard: boolean;
  lines: number;
  avgWords: number;
  warnings: string[];
}

export const PROFILE_FAIL_HINT = '작가가 역할극 분량을 못 맞췄어요 — 오늘은 지난 화를 다시 열어 태오 대사를 연습해 볼까요?';

const wc = (en: string) => en.trim().split(/\s+/).filter(Boolean).length;

/** 태오가 입 밖에 내는 줄(line·speak) */
export function taeoLines(ep: Pick<Episode, 'scenes'>): string[] {
  return ep.scenes.flatMap((s) => ((s.type === 'line' || s.type === 'speak') && s.who === 'taeo' ? [s.en] : []));
}

export function wordRangeFor(level: string): readonly [number, number] {
  return /^A[12]/.test(String(level || '')) ? PROFILE_WORD_RANGE.low : PROFILE_WORD_RANGE.high;
}

/** 하드 기준인가 — gpt-oss 첫 시도만 */
export function isHard(model: string, attempt: number): boolean {
  return attempt === 0 && /gpt-oss/i.test(model || '');
}

export function validateProfile(model: string, ep: Pick<Episode, 'scenes' | 'level'>, attempt = 0): ProfileReport {
  const lines = taeoLines(ep);
  const [lo, hi] = wordRangeFor(ep.level);
  const avg = lines.length ? Math.round((lines.reduce((a, l) => a + wc(l), 0) / lines.length) * 10) / 10 : 0;
  const warnings: string[] = [];
  if (lines.length < PROFILE_MIN_LINES) warnings.push(`태오 대사 ${lines.length}줄(최소 ${PROFILE_MIN_LINES})`);
  if (lines.length && (avg < lo || avg > hi)) warnings.push(`태오 대사 평균 ${avg}단어(${ep.level}: ${lo}~${hi})`);
  return { ok: warnings.length === 0, hard: isHard(model, attempt), lines: lines.length, avgWords: avg, warnings };
}

/** 원고를 받아도 되나 — 하드일 때만 거부 */
export function acceptByProfile(r: ProfileReport): boolean {
  return r.ok || !r.hard;
}
