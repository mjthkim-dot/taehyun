/**
 * CEFR 성장 엔진 — "CEFR 기준의 학습 능력 향상이 메인".
 *
 * 이전 구조의 결함(2026-09 진단):
 *   ① 점수를 **연습한 레벨의 구간 안에서** GSE로 환산했다. C2 독해를 0점 맞아도
 *      GSE는 C2 하한(76) — 어려운 걸 고르기만 하면 레벨이 올랐다.
 *   ② 프로필은 오르기만 하는 래칫이고 근거 기록이 없어, 왜 이 레벨인지·다음 레벨까지
 *      무엇이 필요한지 말할 수 없었다.
 *
 * 새 규칙 — 레벨은 "증거"로만 오른다:
 *   · 모든 채점 결과를 {기능, 레벨, 점수}로 남긴다(va_cefr_evidence).
 *   · 한 기능이 레벨 L을 **입증**하려면 최근 90일 안에 L 이상 과제에서 70점 이상을
 *     3회(60~69점은 0.5회). 높은 레벨에서의 통과는 낮은 레벨도 입증한다.
 *   · 기능 레벨 = max(배치고사 사전값, 입증한 최고 레벨). 하루 못 봤다고 내려가지 않는다.
 *   · 종합 레벨 = 4기능 중 **3개 이상**이 도달한 레벨(한 기능만 튀어도, 한 기능만
 *     약해도 종합이 흔들리지 않게 — CEFR 프로필의 대표값).
 *   · GSE는 개별 점수가 아니라 입증 상태에서 나온다: 레벨 하한 + 다음 레벨 진척 × 구간.
 *
 * 말하기 증거는 **자유 발화 평가**(AI 회화 CAF, 면접 리포트)만 인정한다.
 * 문장 따라 읽기(드릴) 발음 점수는 연습 기록으로만 남긴다 — 읽기 낭독 정확도는
 * CEFR 말하기 능력의 증거가 아니다.
 */
import { load, store, getSkillStats, getProfile, saveProfile, SKILLS, type SkillKey, type SkillStats } from './state';
import { CEFR_GSE, CEFR_ORDER, CEFR_NEXT, scaffoldFor, type Cefr } from './cefr';
import { todayKey } from './dates';

export const PASS_SCORE = 70;
export const NEAR_SCORE = 60;
export const PASSES_NEEDED = 3;
export const WINDOW_DAYS = 90;

const EVIDENCE_KEY = 'va_cefr_evidence';
const STATE_KEY = 'va_cefr_state';
const PRESET_KEY = 'va_level_preset';
const EVIDENCE_MAX = 600;

export const SKILL_LABEL: Record<SkillKey, { name: string; icon: string }> = {
  listening: { name: '듣기', icon: '🎧' },
  reading: { name: '읽기', icon: '📖' },
  speaking: { name: '말하기', icon: '🗣' },
  writing: { name: '쓰기', icon: '✍️' },
};

export type EvidenceSrc = 'listening' | 'reading' | 'writing' | 'talk' | 'interview' | 'drill' | 'placement';

export interface Evidence {
  t: number;
  skill: SkillKey;
  level: Cefr;
  /** 0~100 */
  score: number;
  src: EvidenceSrc;
  /** 레벨 입증에 쓰이는가(드릴 낭독 등은 false) */
  counts: boolean;
}

export function evidenceLog(): Evidence[] {
  return load<Evidence[]>(EVIDENCE_KEY, []);
}

const idx = (c: Cefr) => CEFR_ORDER.indexOf(c);

/** 배치고사 결과 — 없으면 null(아직 측정 전) */
export function placementPrior(): Cefr | null {
  const p = load<{ cefr?: Cefr } | null>('va_placed', null);
  return p && p.cefr && CEFR_ORDER.includes(p.cefr) ? p.cefr : null;
}

export interface SkillLevel {
  skill: SkillKey;
  level: Cefr;
  next: Cefr;
  /** 다음 레벨 입증 진척 0~1 */
  progress: number;
  /** 다음 레벨 통과 횟수(0.5 단위) */
  passes: number;
  /** 다음 레벨 이상에서 시도한 횟수 */
  attempts: number;
  /** 다음 레벨 이상 최근 평균 점수 */
  avg: number | null;
  gse: number;
  /** 입증한 레벨(사전값 제외) — 없으면 null */
  proven: Cefr | null;
  lastAt: number | null;
}

function passValue(score: number): number {
  return score >= PASS_SCORE ? 1 : score >= NEAR_SCORE ? 0.5 : 0;
}

export function skillLevel(skill: SkillKey, now = Date.now(), log = evidenceLog()): SkillLevel {
  const since = now - WINDOW_DAYS * 86400000;
  const ev = log.filter((e) => e.skill === skill && e.counts && e.t >= since);
  // 레벨 L 입증 = L 이상에서 통과값 합 ≥ 3
  const passAtOrAbove = (L: Cefr) => ev.filter((e) => idx(e.level) >= idx(L)).reduce((a, e) => a + passValue(e.score), 0);
  let proven: Cefr | null = null;
  for (const L of CEFR_ORDER) if (passAtOrAbove(L) >= PASSES_NEEDED) proven = L;
  const prior = placementPrior() || 'A1';
  const level = proven && idx(proven) > idx(prior) ? proven : prior;
  const next = CEFR_NEXT[level];
  const atNext = ev.filter((e) => idx(e.level) >= idx(next));
  const passes = Math.min(PASSES_NEEDED, atNext.reduce((a, e) => a + passValue(e.score), 0));
  const progress = level === 'C2' ? 1 : passes / PASSES_NEEDED;
  const band = CEFR_GSE[level];
  const gse = Math.round(band.min + (band.max - band.min) * (level === 'C2' ? 0.5 : progress));
  const recent = atNext.slice(-5);
  return {
    skill, level, next, progress, passes, attempts: atNext.length,
    avg: recent.length ? Math.round(recent.reduce((a, e) => a + e.score, 0) / recent.length) : null,
    gse, proven, lastAt: ev.length ? ev[ev.length - 1].t : null,
  };
}

export interface Overall {
  level: Cefr;
  next: Cefr;
  /** 종합 다음 레벨 진척 0~1 — 4기능 중 가장 가까운 3개 기준 */
  progress: number;
  gse: number;
  skills: SkillLevel[];
  /** 다음 레벨에 도달한 기능 수 */
  skillsAtNext: number;
  /** 가장 약한 기능 */
  weakest: SkillLevel;
  measured: boolean;
}

export function overall(now = Date.now()): Overall {
  const log = evidenceLog();
  const skills = SKILLS.map((s) => skillLevel(s.key, now, log));
  const sorted = skills.map((s) => idx(s.level)).sort((a, b) => a - b);
  // 3개 이상이 도달한 레벨 = 오름차순 두 번째 값
  const level = CEFR_ORDER[sorted[1]];
  const next = CEFR_NEXT[level];
  const reach = skills.map((s) => (idx(s.level) >= idx(next) ? 1 : idx(s.level) === idx(level) ? s.progress : 0)).sort((a, b) => b - a);
  const progress = level === 'C2' ? 1 : (reach[0] + reach[1] + reach[2]) / 3;
  const band = CEFR_GSE[level];
  const weakest = skills.slice().sort((a, b) => idx(a.level) - idx(b.level) || a.progress - b.progress)[0];
  return {
    level, next, progress, gse: Math.round(band.min + (band.max - band.min) * (level === 'C2' ? 0.5 : progress)),
    skills, skillsAtNext: skills.filter((s) => idx(s.level) >= idx(next)).length, weakest,
    measured: !!placementPrior() || log.some((e) => e.counts),
  };
}

/* ── 승급 기록 ── */

export interface CefrState {
  level: Cefr | null;
  history: { level: Cefr; date: string }[];
}

export function cefrState(): CefrState {
  return load<CefrState>(STATE_KEY, { level: null, history: [] });
}

/**
 * 종합 레벨을 확정하고, 올랐으면 승급으로 기록한다. 레거시 소비처(프로필·스킬 통계·
 * 진도 화면·스캐폴딩)도 여기서 한 번에 맞춘다. 반환: 새로 승급한 레벨(없으면 null).
 */
export function syncCefr(): Cefr | null {
  const o = overall();
  const st = cefrState();
  let promoted: Cefr | null = null;
  if (!st.level) {
    st.level = o.level;
    st.history = [{ level: o.level, date: todayKey() }];
  } else if (idx(o.level) > idx(st.level)) {
    promoted = o.level;
    st.level = o.level;
    st.history = [...st.history, { level: o.level, date: todayKey() }];
  }
  store(STATE_KEY, st);
  const prof = getProfile();
  if (prof.cefr !== o.level || prof.gse !== o.gse) saveProfile({ cefr: o.level, gse: o.gse, scaffolding: scaffoldFor(o.level) });
  const stats: SkillStats = getSkillStats();
  for (const s of o.skills) stats[s.skill] = { gse: s.gse, sessions: stats[s.skill]?.sessions || 0 };
  store('va_skill_stats', stats);
  return promoted;
}

/** 승급 축하를 한 번만 보여주기 위한 꺼내기 */
export function takePromotion(): Cefr | null {
  const p = load<Cefr | null>('va_cefr_promo', null);
  if (p) store('va_cefr_promo', null);
  return p;
}

/**
 * 채점 결과 기록 — 모든 기능 화면이 이 한 곳으로 보고한다.
 * @param score 0~100
 */
export function recordSkillResult(skill: SkillKey, level: Cefr, score: number, src: EvidenceSrc): Cefr | null {
  const s = Math.max(0, Math.min(100, Math.round(Number.isFinite(score) ? score : 0)));
  const counts = src !== 'drill' && src !== 'placement';
  const log = evidenceLog();
  log.push({ t: Date.now(), skill, level, score: s, src, counts });
  store(EVIDENCE_KEY, log.slice(-EVIDENCE_MAX));
  const stats = getSkillStats();
  stats[skill] = { ...(stats[skill] || { gse: 10, sessions: 0 }), sessions: (stats[skill]?.sessions || 0) + 1 };
  store('va_skill_stats', stats);
  const promoted = syncCefr();
  if (promoted) store('va_cefr_promo', promoted);
  return promoted;
}

/* ── 다음 할 일 ── */

export interface CefrAction {
  skill: SkillKey;
  level: Cefr;
  /** 화면 */
  mode: 'listening' | 'reading' | 'writing' | 'talk';
  title: string;
  detail: string;
  passes: number;
}

/** 말하기 증거용 회화 레슨(레벨별 대표 마스터 유닛) */
export const TALK_LESSON_BY_LEVEL: Record<Cefr, number> = { A1: 201, A2: 104, B1: 305, B2: 405, C1: 503, C2: 607 };

const MODE_OF: Record<SkillKey, CefrAction['mode']> = { listening: 'listening', reading: 'reading', writing: 'writing', speaking: 'talk' };
const TASK_OF: Record<SkillKey, string> = {
  listening: '받아쓰기 1세트',
  reading: '독해 1지문',
  writing: '작문 1편(AI 첨삭)',
  speaking: 'AI 회화 1세션(CAF 평가까지)',
};

/** 종합 레벨을 올리려면 무엇을 — 다음 레벨에 못 미친 기능만, 가까운 것부터(3개만 채우면 되니까) */
export function nextActions(o: Overall = overall()): CefrAction[] {
  return o.skills
    .filter((s) => idx(s.level) < idx(o.next))
    .sort((a, b) => b.progress - a.progress || idx(b.level) - idx(a.level))
    .map((s) => {
      const target = idx(s.level) < idx(o.level) ? o.level : o.next;
      const t = skillLevel(s.skill);
      const passes = target === s.next ? t.passes : 0;
      return {
        skill: s.skill, level: target, mode: MODE_OF[s.skill], passes,
        title: `${SKILL_LABEL[s.skill].icon} ${target} ${SKILL_LABEL[s.skill].name} — ${TASK_OF[s.skill]}`,
        detail: `${PASS_SCORE}점 이상 ${PASSES_NEEDED}회로 입증 · 지금 ${passes}/${PASSES_NEEDED}`,
      };
    });
}

/** 화면에 레벨을 미리 정해 보낸다(한 번 꺼내면 지워진다) */
export function setLevelPreset(skill: SkillKey, level: Cefr) {
  store(PRESET_KEY, { skill, level, t: Date.now() });
}

export function takeLevelPreset(skill: SkillKey): Cefr | null {
  const p = load<{ skill: SkillKey; level: Cefr; t: number } | null>(PRESET_KEY, null);
  if (!p || p.skill !== skill || Date.now() - p.t > 10 * 60_000) return null;
  store(PRESET_KEY, null);
  return p.level;
}

/** 기능 화면의 시작 레벨 — 미리 정한 레벨 > 그 기능의 다음 레벨(i+1) */
export function startLevelFor(skill: SkillKey): Cefr {
  return takeLevelPreset(skill) || skillLevel(skill).next;
}

/** 주간 GSE 추세 — 증거가 쌓인 주마다 그 시점의 종합 GSE */
export function gseTrend(weeks = 8): { label: string; gse: number }[] {
  const out: { label: string; gse: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const at = Date.now() - i * 7 * 86400000;
    const log = evidenceLog().filter((e) => e.t <= at);
    const skills = SKILLS.map((s) => skillLevel(s.key, at, log));
    const sorted = skills.map((s) => idx(s.level)).sort((a, b) => a - b);
    const level = CEFR_ORDER[sorted[1]];
    const next = CEFR_NEXT[level];
    const reach = skills.map((s) => (idx(s.level) >= idx(next) ? 1 : idx(s.level) === idx(level) ? s.progress : 0)).sort((a, b) => b - a);
    const prog = (reach[0] + reach[1] + reach[2]) / 3;
    const band = CEFR_GSE[level];
    const d = new Date(at);
    out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, gse: Math.round(band.min + (band.max - band.min) * prog) });
  }
  return out;
}
