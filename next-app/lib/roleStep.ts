/**
 * 역할극(M2) 순수 로직 — RoleStep 화면이 쓰는 규칙을 화면 밖으로 빼서 단위 테스트가 닿게 한다.
 *
 *  · 빌드업: 10단어 이상 대사는 끝에서부터 4 → 8 → 전체로 쌓는다(끝 억양이 유지되는 통역 훈련 기법)
 *  · 통과 60점, '한 번 더' 최대 2회(= 시도 3회), 넘어가기 화당 3회(키 없음·마이크 거부·복귀·조용히는 무제한)
 *  · 섀도잉(동시 따라 말하기) 화당 4회, 채점은 길이 비·단어 회수율만(혼동축 칩 없음)
 *  · 칩은 전체 1개: 혼동축(diagnose) > 리듬(rhythmChip, M9) > WPM
 *  · 이의 제기(결과 카드 길게 누르기): va_dispute_log 최근 100건, 같은 문장 2회 신고 시 축 칩 숨김
 *  · 키 없음(whisper·Web Speech 둘 다 없음, iOS PWA): 영어 2초 플래시 → 가리고 말하기 → 자기확인(발화 1.0)
 *
 * 저장소(load/store)는 쓰되 화면·오디오는 건드리지 않는다 — tests/unit/roleStep.test.ts가 이 파일만 돌린다.
 */
import { load, store, addPronLapses, addWeakItem, bumpSpoken } from './state';
import { logAttempt, type AttemptQuality, type AttemptSrc } from './reviewEngine';
import { alignedScore, normWords, type AlignedWord } from './align';
import type { LapseKey, PronIssue } from './pronunciation';
import type { RhythmChip } from './rhythm';
import { RESULT_CARD_MSGS } from './dramaSeedMine';

export type RoleMode = 'role' | 'shadow' | 'lip';
/** 어느 인식 경로가 열려 있나 — whisper(키+마이크) > webspeech(키 없음, 브라우저 인식) > self(둘 다 없음: 자기확인) */
export type SttPath = 'whisper' | 'webspeech' | 'self';

/** 통과 기준(역할극·섀도잉 공통) */
export const ROLE_PASS = 60;
/** '한 번 더' 최대 횟수 — 첫 시도 + 2회 = 시도 3회 */
export const RETRY_MAX = 2;
/** 넘어가기 화당 상한 */
export const SKIP_MAX = 3;
/** 섀도잉 화당 상한 */
export const SHADOW_MAX = 4;
/** 이 단어 수 이상이면 끝부터 쌓기 */
export const BUILDUP_MIN_WORDS = 10;
/** 영어 플래시 시간 — 키 있음 1.5초, 키 없음(자기확인) 2초 */
export const FLASH_MS = 1500;
export const FLASH_MS_KEYLESS = 2000;
/** 섀도잉 — 모델 재생이 끝난 뒤 이만큼 더 녹음하고 멈춘다 */
export const SHADOW_TAIL_MS = 1000;
/** 자동 녹음 파라미터(명세 고정) */
export const ROLE_SILENCE_MS = 1800;
export const ROLE_MAX_MS = 15000;
/** 같은 문장을 이만큼 신고하면 혼동축 칩을 숨긴다 */
export const DISPUTE_HIDE_AT = 2;
export const DISPUTE_LOG_MAX = 100;
const DISPUTE_KEY = 'va_dispute_log';

export interface RoleResult {
  sceneIdx: number;
  en: string;
  kr: string;
  who: string;
  said: string;
  /** 0~100(자기확인·입모양은 100) */
  score: number;
  diff: AlignedWord[];
  missed: string[];
  lapses: LapseKey[];
  audio?: Blob;
  latencyMs?: number;
  durationMs?: number;
  wpm?: number;
  pauseCount?: number;
  clausePauses?: number;
  quality?: AttemptQuality;
  /** 몇 번째 시도에서 끝났나(1~3) */
  tries: number;
  mode: RoleMode;
  skipped: boolean;
  disputed: boolean;
  /** 채점 없이 자기확인으로 통과했나(키 없음·입모양·이의 제기) — M3가 '채점 가능/자기확인'을 가른다 */
  self: boolean;
  /** 통과(≥60, 또는 자기확인) */
  passed: boolean;
  /** 어느 경로였나 */
  path: SttPath;
}

export interface SpeakStats {
  spoken: number;
  passed: number;
  /** 가장 많이 어긋난 축(최대 3) */
  lapsesTop: { key: string; count: number }[];
  disputed: number;
  skipped: number;
}

/** 공백 기준 단어 수(축약은 한 단어) — dramaSeedMine.wordCount와 같은 셈법 */
export const wordCount = (en: string) => en.trim().split(/\s+/).filter(Boolean).length;

/**
 * 끝부터 쌓기 구간 — minWords 미만이면 [전체]만.
 * 10단어 이상: [끝 4, 끝 8, 전체]. 8단어로 전체가 다 덮이면 그 구간은 뺀다(같은 문장을 두 번 말하지 않게).
 */
export function buildupStages(en: string, minWords = BUILDUP_MIN_WORDS): string[] {
  const full = en.trim();
  const words = full.split(/\s+/).filter(Boolean);
  if (words.length < minWords) return [full];
  const tail = (n: number) => words.slice(-n).join(' ');
  const out = [tail(4)];
  if (words.length > 8) out.push(tail(8));
  out.push(full);
  return out;
}

/** 통과 여부 */
export const passed = (score: number) => score >= ROLE_PASS;

/** '한 번 더'를 더 할 수 있나 — tries는 지금까지 한 횟수 */
export function canRetry(tries: number, score: number): boolean {
  return !passed(score) && tries < 1 + RETRY_MAX;
}

/** 여러 시도의 최종 점수 — 가장 좋은 시도(두 번째가 더 나빠도 첫 통과를 깎지 않는다) */
export function finalScore(scores: number[]): number {
  return scores.length ? Math.max(...scores) : 0;
}

export interface SkipPolicy {
  keyless?: boolean;
  micDenied?: boolean;
  /** 복귀 첫날(M4 dayState) */
  returning?: boolean;
  /** 조용히 모드(M4) */
  quiet?: boolean;
}

/** 이 상황에서 넘어가기 횟수에 상한이 없나 */
export function unlimitedSkips(p: SkipPolicy = {}): boolean {
  return !!(p.keyless || p.micDenied || p.returning || p.quiet);
}

/** 넘어가기를 더 할 수 있나 */
export function canSkip(used: number, p: SkipPolicy = {}, max = SKIP_MAX): boolean {
  return unlimitedSkips(p) || used < max;
}

/** 섀도잉을 더 할 수 있나 */
export function canShadow(used: number, max = SHADOW_MAX): boolean {
  return used < max;
}

/** 플래시 시간 — 2차 시도부터는 플래시 없이 kr만, 키 없음은 2초 */
export function flashMs(tries: number, path: SttPath): number {
  if (tries > 0) return 0;
  return path === 'self' ? FLASH_MS_KEYLESS : FLASH_MS;
}

/** 인식 경로 결정 */
export function sttPath(o: { whisper: boolean; webSpeech: boolean }): SttPath {
  if (o.whisper) return 'whisper';
  if (o.webSpeech) return 'webspeech';
  return 'self';
}

/** 지정 상대 대사의 기본 모드 — 키가 없으면 섀도잉이 기본(ON), 키가 있으면 보통 재생(길게 누르면 섀도잉) */
export function mineDefaultMode(path: SttPath): 'shadow' | null {
  return path === 'whisper' ? null : 'shadow';
}

/* ── 칩 1개 규칙 ── */
export interface ChipInput {
  issues?: PronIssue[];
  rhythm?: RhythmChip | null;
  wpm?: number;
  /** 같은 문장 신고 2회 → 축 칩 숨김 */
  hideAxis?: boolean;
}
export interface Chip {
  kind: 'axis' | 'rhythm' | 'wpm';
  label: string;
  tip?: string;
  key?: LapseKey;
}

/** 혼동축 > 리듬(원어민 범위 밖일 때만) > WPM. 아무것도 없으면 null. */
export function pickChip(c: ChipInput): Chip | null {
  const issue = c.hideAxis ? undefined : c.issues?.[0];
  if (issue) return { kind: 'axis', label: issue.label, tip: issue.tip, key: issue.key };
  if (c.rhythm && !c.rhythm.ok) return { kind: 'rhythm', label: c.rhythm.chip };
  if (typeof c.wpm === 'number' && c.wpm > 0) return { kind: 'wpm', label: `${c.wpm} WPM` };
  return null;
}

/* ── 섀도잉 채점 — 길이 비·단어 회수율만 ── */
export interface ShadowInput {
  target: string;
  said?: string;
  /** 모델 재생 길이(ms) — 모르면 생략 */
  modelMs?: number;
  /** 내 녹음 길이(ms, 꼬리 1초 제외 전) */
  mineMs?: number;
}
/** 길이 비가 이 안이면 '같이 말했다'로 본다 */
export const SHADOW_RATIO_OK: readonly [number, number] = [0.5, 2.0];

export function shadowScore(s: ShadowInput): { score: number; recall: number | null; ratio: number | null } {
  const ratio = s.modelMs && s.mineMs ? Math.round((Math.max(0, s.mineMs - SHADOW_TAIL_MS) / s.modelMs) * 100) / 100 : null;
  const ratioOk = ratio == null || (ratio >= SHADOW_RATIO_OK[0] && ratio <= SHADOW_RATIO_OK[1]);
  if (s.said != null && normWords(s.said).length) {
    // 단어 회수율 = 목표 단어 중 들린 비율(순서 고려, 정렬 채점의 recall)
    const t = normWords(s.target);
    const got = alignedScore(s.target, s.said).diff.filter((d) => d.ok).length;
    const recall = t.length ? got / t.length : 0;
    const score = Math.round(recall * 100 * (ratioOk ? 1 : 0.8));
    return { score, recall: Math.round(recall * 100) / 100, ratio };
  }
  // 전사가 없다(키 없음 recordOnly) — 길이 비만으로 판단, 소리가 있었으면 통과
  if (s.mineMs == null) return { score: 0, recall: null, ratio };
  return { score: ratioOk ? 100 : 50, recall: null, ratio };
}

/* ── 이의 제기 ── */
interface DisputeRow {
  en: string;
  t: number;
  score: number;
  said?: string;
}

function disputeRows(): DisputeRow[] {
  return load<DisputeRow[]>(DISPUTE_KEY, []).filter((r) => r && typeof r.en === 'string');
}

/** 신고 한 건 — 최근 100건만 남긴다 */
export function recordDispute(en: string, score: number, said?: string): void {
  const rows = disputeRows();
  rows.push({ en, t: Date.now(), score, said });
  store(DISPUTE_KEY, rows.slice(-DISPUTE_LOG_MAX));
}

export function disputeCount(en: string): number {
  const k = normWords(en).join(' ');
  return disputeRows().filter((r) => normWords(r.en).join(' ') === k).length;
}

/** 같은 문장 2회 신고 → 그 문장의 혼동축 칩을 숨긴다 */
export function hideAxisChip(en: string): boolean {
  return disputeCount(en) >= DISPUTE_HIDE_AT;
}

/* ── 결과 카드 문구 ── */
/** 점수대·상황별 한 줄 — dramaSeedMine.RESULT_CARD_MSGS 순서에 의존한다 */
export function resultMessage(r: Pick<RoleResult, 'score' | 'skipped' | 'disputed' | 'mode' | 'self'>, longSentence = false): string {
  if (r.disputed) return RESULT_CARD_MSGS[7];
  if (r.skipped) return RESULT_CARD_MSGS[6];
  if (r.mode === 'shadow') return RESULT_CARD_MSGS[5];
  if (r.self) return RESULT_CARD_MSGS[1];
  if (r.score >= 90) return RESULT_CARD_MSGS[0];
  if (r.score >= 75) return RESULT_CARD_MSGS[1];
  if (r.score >= ROLE_PASS) return RESULT_CARD_MSGS[2];
  if (r.score >= 40 || !longSentence) return RESULT_CARD_MSGS[3];
  return RESULT_CARD_MSGS[4];
}

/* ── 세션 집계 ── */
export function speakStatsFrom(results: RoleResult[]): SpeakStats {
  const tally: Record<string, number> = {};
  let spoken = 0;
  let ok = 0;
  let disputed = 0;
  let skipped = 0;
  for (const r of results) {
    if (r.skipped) {
      skipped++;
      continue;
    }
    spoken++;
    if (r.passed) ok++;
    if (r.disputed) disputed++;
    for (const k of r.lapses) tally[k] = (tally[k] || 0) + 1;
  }
  const lapsesTop = Object.entries(tally)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  return { spoken, passed: ok, lapsesTop, disputed, skipped };
}

/** 엔딩 직전 재소환 후보 — 방금 60점 미만(넘어간 것·이의 제기·입모양 제외, 키 없음 '잘 안 됐어요' 포함) 최대 max개, 같은 문장은 한 번 */
export function recallInlineItems(results: RoleResult[], max = 2): { sceneIdx: number; who: string; en: string; kr: string }[] {
  const seen = new Set<string>();
  const out: { sceneIdx: number; who: string; en: string; kr: string }[] = [];
  for (const r of results) {
    if (r.skipped || r.disputed || r.passed || r.mode === 'lip') continue;
    const k = normWords(r.en).join(' ');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ sceneIdx: r.sceneIdx, who: r.who, en: r.en, kr: r.kr });
    if (out.length >= max) break;
  }
  return out;
}

/* ── 기록 — 시도 로그·혼동축 누적·발화 카운터·복습 카드 ── */
export const patternKeyOf = (epNo: number, idx: number) => `drama:${epNo}:${idx}`;

/**
 * 결과 하나를 학습 기록에 남긴다(녹음 보관은 비동기라 호출부가 따로 한다).
 * 자기확인(채점 없음)은 시도 로그에 넣지 않는다 — 점수 통계를 부풀리지 않게. 발화 수에는 센다.
 */
export function logRoleResult(r: RoleResult, epNo: number, src: AttemptSrc = r.mode === 'shadow' ? 'shadow' : 'drama'): void {
  if (r.skipped) {
    addWeakItem({ en: r.en, kr: r.kr, cat: '드라마', lesson: `drama:${epNo}` }, 1);
    return;
  }
  bumpSpoken();
  if (!r.self || r.disputed) {
    logAttempt({
      t: Date.now(),
      en: r.en,
      score: r.score,
      src,
      latencyMs: r.latencyMs,
      durationMs: r.durationMs,
      wpm: r.wpm,
      pauseCount: r.pauseCount,
      clausePauses: r.clausePauses,
      quality: r.quality || 'ok',
      patternKey: patternKeyOf(epNo, r.sceneIdx),
      disputed: r.disputed || undefined,
    });
  }
  // 혼동축 누적은 역할극만(섀도잉은 스피커 소리가 섞여 진단이 믿을 수 없다)
  if (r.mode === 'role' && r.lapses.length) addPronLapses(r.lapses);
  if (!r.passed) addWeakItem({ en: r.en, kr: r.kr, cat: '드라마', lesson: `drama:${epNo}` }, 1);
}
