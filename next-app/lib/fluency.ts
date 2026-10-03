/**
 * 유창성 지표 — Whisper 단어 타임스탬프에서 WPM·멈춤·절 내부 멈춤을 잰다.
 *
 * 지금까지 WPM은 "전사 단어 수 ÷ 녹음 길이", 멈춤은 마이크 레벨(RMS)이 1초 넘게
 * 조용한 구간으로 쟀다. 둘 다 거칠다 — 녹음 길이에는 입이 떨어지기 전 침묵과 끝의
 * 여백이 섞이고, RMS는 숨소리·주변 소음에 흔들린다. verbose_json의 단어 시각은
 * "어느 단어와 어느 단어 사이에서 얼마나 쉬었나"를 그대로 주므로 여기서 다시 정의한다.
 *
 *  · pause300      : 단어 사이 300ms 이상(일반적인 '멈춤' 기준)
 *  · hesitation500 : 500ms 이상(머뭇거림 — 다음 말을 찾는 중)
 *  · 절 내부 멈춤   : 쉼표·접속사 같은 절 경계가 **아닌** 곳에서의 멈춤. 경계에서 쉬는 건
 *                    원어민도 하는 일이라 벌점이 아니다. 경계는 목표 문장(targetEn)의
 *                    쉼표/마침표/접속사 위치로 잡고, 목표가 없으면 전사 자체의 구두점·접속사로 잡는다.
 *  · mlr           : 멈춤 사이 평균 발화 길이(mean length of run, 단어 수) — 유창성 연구의 표준 지표
 *  · articulationRate : 멈춤 시간을 뺀 '실제로 말한 시간' 기준 분당 단어 수
 *
 * 단어 타임스탬프가 없는 호출(브라우저 인식·구형 응답)은 lib/pitch.ts·lib/interview.ts의
 * 기존 계산을 그대로 쓴다 — 이 파일은 words가 있을 때만 위임받는다.
 */

export interface FluencyWord {
  word: string;
  /** 초 단위(Whisper verbose_json 그대로) */
  start: number;
  end: number;
}

export interface FluencyMetrics {
  /** 녹음 길이 기준 분당 단어 수 */
  wpm: number;
  /** 멈춤을 뺀 발화 시간 기준 분당 단어 수 */
  articulationRate: number;
  /** 300ms 이상 멈춤 수 */
  pauses300: number;
  /** 500ms 이상 머뭇거림 수(pauses300에 포함) */
  hesitations500: number;
  /** 절 경계가 아닌 곳의 300ms 이상 멈춤 수 */
  clauseInternalPauses: number;
  /** 멈춤 사이 평균 단어 수 */
  mlr: number;
}

export const PAUSE_MS = 300;
export const HESITATION_MS = 500;

/** 한국어 화자가 영어로 길게 말할 때 급증하는 채움말 — pitch·interview가 공유한다 */
export const FILLER_RE = /\b(um+|uh+|er+|ah+|hmm+|like|you know|i mean|kind of|sort of|actually|basically|so yeah)\b/gi;

/** 절을 여는 접속사·관계사 — 이 단어 **앞**에서 쉬는 것은 절 경계로 본다 */
const CLAUSE_OPENERS = new Set([
  'and', 'but', 'so', 'or', 'because', 'when', 'if', 'then', 'that', 'which', 'while', 'after', 'before', 'until', 'though', 'although', 'unless', 'since', 'where', 'as',
]);

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
const endsClause = (w: string) => /[,.;:!?…]["')]*$/.test(w.trim());

/** 영문 단어 수 — 전사 텍스트용(타임스탬프 없는 경로와 같은 규칙) */
export function countWords(text: string): number {
  return (text.match(/[A-Za-z']+/g) || []).length;
}

/** 단어 i와 i+1 사이 간격(ms). 시간순으로 정렬해 계산한다. */
export function wordGaps(words: FluencyWord[]): { i: number; ms: number }[] {
  const ws = sorted(words);
  const out: { i: number; ms: number }[] = [];
  for (let i = 0; i + 1 < ws.length; i++) {
    out.push({ i, ms: Math.max(0, Math.round((ws[i + 1].start - ws[i].end) * 1000)) });
  }
  return out;
}

/** 멈춤 구간 목록(ms) — SttResult.pauses의 words 기반 정의 */
export function pausesFromWords(words: FluencyWord[], minMs = PAUSE_MS): number[] {
  return wordGaps(words)
    .filter((g) => g.ms >= minMs)
    .map((g) => g.ms);
}

/**
 * 단어 i **뒤**가 절 경계인가(i ∈ 결과면 i와 i+1 사이 멈춤은 경계 멈춤).
 * 목표 문장이 있으면 그 문장의 구두점·접속사 위치를 전사 단어에 대응시키고(같은 단어가
 * 경계 직전에 있으면 경계), 없으면 전사 단어 자체의 구두점·다음 단어 접속사로 본다.
 */
export function clauseBoundaries(words: FluencyWord[], targetEn?: string): Set<number> {
  const ws = sorted(words);
  const out = new Set<number>();
  // 목표 문장에서 '경계 직전 단어' 집합을 뽑는다
  const beforeBoundary = new Set<string>();
  if (targetEn) {
    const toks = targetEn.split(/\s+/).filter(Boolean);
    for (let i = 0; i < toks.length; i++) {
      const next = toks[i + 1];
      if (endsClause(toks[i]) || (next && CLAUSE_OPENERS.has(norm(next)))) beforeBoundary.add(norm(toks[i]));
    }
  }
  for (let i = 0; i + 1 < ws.length; i++) {
    const cur = ws[i].word;
    const next = norm(ws[i + 1].word);
    if (endsClause(cur) || CLAUSE_OPENERS.has(next) || beforeBoundary.has(norm(cur))) out.add(i);
  }
  return out;
}

export function wordsToMetrics(words: FluencyWord[], targetEn?: string, durationMs?: number): FluencyMetrics {
  const ws = sorted(words);
  if (!ws.length) return { wpm: 0, articulationRate: 0, pauses300: 0, hesitations500: 0, clauseInternalPauses: 0, mlr: 0 };
  const gaps = wordGaps(ws);
  const boundaries = clauseBoundaries(ws, targetEn);
  let pauses300 = 0;
  let hesitations500 = 0;
  let clauseInternalPauses = 0;
  let pausedMs = 0;
  for (const g of gaps) {
    if (g.ms < PAUSE_MS) continue;
    pauses300++;
    pausedMs += g.ms;
    if (g.ms >= HESITATION_MS) hesitations500++;
    if (!boundaries.has(g.i)) clauseInternalPauses++;
  }
  const spanMs = Math.max(0, (ws[ws.length - 1].end - ws[0].start) * 1000);
  // 녹음 길이를 모르면 첫 단어~마지막 단어 구간으로 대신한다
  const totalMs = durationMs && durationMs > 0 ? durationMs : spanMs;
  const speakingMs = Math.max(0, spanMs - pausedMs);
  const n = ws.length;
  const perMin = (ms: number) => (ms > 0 ? Math.round((n / ms) * 60000) : 0);
  return {
    wpm: perMin(totalMs),
    // 한 단어뿐이면 발화 시간이 0에 가깝다 — 그때는 전체 기준으로 대신한다
    articulationRate: speakingMs >= 200 ? perMin(speakingMs) : perMin(totalMs),
    pauses300,
    hesitations500,
    clauseInternalPauses,
    mlr: Math.round((n / (pauses300 + 1)) * 10) / 10,
  };
}

function sorted(words: FluencyWord[]): FluencyWord[] {
  return [...words].filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end)).sort((a, b) => a.start - b.start);
}
