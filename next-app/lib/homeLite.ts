/**
 * 홈이 첫 화면에서 알아야 하는 몇 가지 — 무거운 모듈을 끌어오지 않고 localStorage만 읽는다.
 *
 * 감사(v1.30)에서 드러난 문제: 홈이 lib/program(→ 온톨로지 그래프 → 실전 코스·커리어·미션·
 * 스크립트 원고)과 lib/drama(드라마 원고), GrammarToday(문법 원고 57KB)를 정적으로 import해
 * 홈 첫 청크가 448KB까지 커졌다. 홈에 필요한 건 "코스를 시작했나 / 드라마를 몇 화 봤나 /
 * 오늘 봤나" 같은 한두 값뿐이라, 그 값만 여기서 직접 읽는다.
 */
import { groqKey, load, markPracticedToday, speakGoalLite, spokenToday, store } from './state';
import { SEED_COUNT, SEED_INDEX, type EpisodeLite } from './dramaIndex';
import { todayKey } from './dates';

/** 12주 프로그램 시작/초기화 이벤트(홈 구성이 바뀜) */
export const PROGRAM_EVENT = 'va:program';

export function programStarted(): boolean {
  const p = load<{ startedAt?: string } | null>('va_program', null);
  return !!(p && p.startedAt);
}

interface DramaProgressLite {
  done?: Record<string, string>;
  score?: Record<string, number>;
}

const EPS_KEY = 'va_drama_eps';
const PROG_KEY = 'va_drama';
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
type EpRaw = { no: number; titleKr: string; cliff?: string; scenes: unknown[]; learn: { en: string }[] };
const isEpRaw = (e: unknown): e is EpRaw => {
  const x = e as Partial<EpRaw> | null;
  return !!x && typeof x.no === 'number' && Array.isArray(x.scenes) && Array.isArray(x.learn) && typeof x.titleKr === 'string';
};

/* ── v1.29 → v1.30 이전 ──
 * v1.29는 원고가 1~3화뿐이라 4화부터 AI가 썼다. v1.30에서 4~7화를 직접 쓰면서, 그때 AI 4~7화를
 * 본 사용자는 '직접 쓴 4~7화를 본 것'으로 처리돼 이야기·복습이 어긋났다(감사 v1.31 견고성 #0).
 * 원고 우선으로 한 번 정리한다: AI로 본 4~7화 기록은 지우고(새 원고 4화부터 다시), 그 화에서
 * 배운 표현은 복습 카드에 그대로 두되 출처를 'drama:ai-N'으로 바꿔 계속 복습되게 한다.
 * 홈 카드도 이전된 기록을 봐야 해서 여기(경량 모듈)에 둔다.
 */
const MIGRATE_KEY = 'va_drama_migrated';
export const DRAMA_NOTICE_KEY = 'va_drama_notice';
let migrated = false;

export function migrateDramaOnce() {
  if (migrated) return;
  if (load<number>(MIGRATE_KEY, 0) >= 1) {
    migrated = true;
    return;
  }
  const raw = load<unknown[]>(EPS_KEY, []);
  const old = raw.filter((e): e is EpRaw => isEpRaw(e) && e.no <= SEED_COUNT);
  if (old.length) {
    const p = load<Record<string, unknown>>(PROG_KEY, {});
    const done = isObj(p.done) ? { ...(p.done as Record<string, string>) } : {};
    const score = isObj(p.score) ? { ...(p.score as Record<string, number>) } : {};
    let reseeded = false;
    for (const e of old) {
      if (done[String(e.no)]) {
        delete done[String(e.no)];
        delete score[String(e.no)];
        reseeded = true;
      }
    }
    const learnOf = new Map(old.map((e) => [e.no, new Set(e.learn.map((l) => l && l.en))]));
    const weak = load<{ en?: string; lesson?: unknown }[]>('va_weak', []);
    let relabel = false;
    for (const w of weak) {
      const n = w && typeof w.lesson === 'string' ? /^drama:(\d+)$/.exec(w.lesson) : null;
      if (n && learnOf.get(Number(n[1]))?.has(String(w.en))) {
        w.lesson = `drama:ai-${n[1]}`;
        relabel = true;
      }
    }
    if (relabel) store('va_weak', weak);
    store(PROG_KEY, { ...p, done, score });
    store(EPS_KEY, raw.filter((e) => !old.includes(e as EpRaw)));
    if (reseeded) store(DRAMA_NOTICE_KEY, 'reseeded');
  }
  store(MIGRATE_KEY, 1);
  migrated = true;
}

function progLite(): { done: Record<string, string>; score: Record<string, number> } {
  migrateDramaOnce();
  const p = load<DramaProgressLite>(PROG_KEY, {});
  return {
    done: p && isObj(p.done) ? (p.done as Record<string, string>) : {},
    score: p && isObj(p.score) ? (p.score as Record<string, number>) : {},
  };
}

function dramaDone(): Record<string, string> {
  return progLite().done;
}

/** 본 화 번호들(오름차순) */
export function dramaWatchedList(): number[] {
  return Object.keys(dramaDone()).map(Number).sort((a, b) => a - b);
}

/** 다음에 볼 화 번호(아직 안 본 가장 앞 화) */
export function dramaNextNo(): number {
  const w = new Set(dramaWatchedList());
  let n = 1;
  while (w.has(n)) n++;
  return n;
}

/** 홈 카드용 화 정보 — 원고 화는 색인에서, AI 화는 저장된 원고에서 제목·예고만 */
export function episodeLite(no: number): EpisodeLite | null {
  if (no >= 1 && no <= SEED_COUNT) return SEED_INDEX[no - 1] || null;
  const e = load<unknown[]>(EPS_KEY, []).find((x) => isEpRaw(x) && x.no === no) as EpRaw | undefined;
  return e ? { no: e.no, titleKr: e.titleKr, cliff: typeof e.cliff === 'string' ? e.cliff : '' } : null;
}

/** 이어 볼 기록이 있는가(홈 버튼 문구용 — 자세한 검증은 재생할 때) */
export function dramaResumeExists(no: number): boolean {
  const r = load<{ v?: number; no?: number; i?: number; at?: number } | null>('va_drama_resume', null);
  // v는 lib/drama RESUME_VERSION(2)과 같아야 한다 — 다른 판은 재생 때 버려지므로 홈도 '이어 보기'라 하지 않는다
  return !!r && r.v === 2 && r.no === no && typeof r.i === 'number' && r.i > 0 && typeof r.at === 'number' && Date.now() - r.at < 24 * 3600 * 1000;
}

export function dramaWatchedCount(): number {
  return Object.keys(dramaDone()).length;
}

export function dramaWatchedToday(): boolean {
  return Object.values(dramaDone()).includes(todayKey());
}

/**
 * 오늘 드라마로 연습했는가 — 새 화를 봤거나, 본 화를 다시 봤거나, 표현 복습을 마쳤으면 참.
 * 키 없이 7화를 다 본 사용자도 복습으로 오늘의 불꽃을 켤 수 있게(감사 v1.31 비평 #3).
 */
const PRACTICE_KEY = 'va_drama_practice_day';
export function markDramaPracticeToday() {
  store(PRACTICE_KEY, todayKey());
  // 학습일(연속일)도 함께 — 표현 복습만 한 날도 🔥가 이어지고 헤더가 바로 갱신된다
  markPracticedToday();
}
export function dramaPracticedToday(): boolean {
  return dramaWatchedToday() || load<string>(PRACTICE_KEY, '') === todayKey();
}

/**
 * 오늘 무엇을 권할까 — '하루 한 편'을 지키고(오늘 봤으면 다음 화 대신 복습), 키 없이 7화를
 * 다 본 날에도 할 일이 있게(표현 복습 → 없으면 가장 어려웠던 화를 자막 없이 다시 듣기).
 * 감사 v1.31 비평 #2·#3. 홈 카드가 원고 없이 계산할 수 있게 경량 모듈에 둔다.
 *
 * M3: 불꽃의 연료가 '발화 N문장'이 되면서 두 갈래가 더해졌다.
 *  · speak  — 오늘 화를 봤(거나 다시 듣기 사다리를 마쳤)는데 발화가 목표 전 → 말하기 세션(기한 된 표현이 있으면
 *             '말로 떠올리기', 없으면 가장 어려웠던 화를 역할극으로 다시)
 *  · ladder — 키 없이 원고 화를 다 본 날(needAi) → 속도 사다리 재청취 0.9× → 1.0× → 1.2×(AI 0, 브라우저 음성).
 *             예전엔 review/replay만 남아 8일차부터 루프가 끊겼다. 3단 통과 시 '귀 뚫림 ✓'.
 */
export interface DramaPlan {
  kind: 'next' | 'review' | 'replay' | 'speak' | 'ladder';
  nextNo: number;
  /** 다음 화 원고가 이미 있는가(원고 화·미리 쓴 AI 화) */
  nextReady: boolean;
  /** 다음 화를 보려면 AI 연결이 필요한가 */
  needAi: boolean;
  /** 오늘 새 화를 이미 봤는가 */
  today: boolean;
  /** 오늘 연습(새 화·다시 보기·표현 복습)을 했는가 */
  practiced: boolean;
  /** 지금 떠올릴 표현 수 */
  due: number;
  /** 다시 들을 화(본 화 중 이해도가 가장 낮은 화) */
  replayNo: number | null;
  /** 오늘 발화(가중 합)와 목표 — kind 'speak' 판단 근거 */
  spoken: number;
  goal: number;
  /** 속도 사다리(kind 'ladder' 또는 오늘 사다리를 시작/마친 날) */
  ladder?: LadderPlan;
}

/* ── 속도 사다리(키 없는 날의 다시 듣기) ── */
export const LADDER_SPEEDS = [0.9, 1, 1.2] as const;
const LADDER_KEY = 'va_drama_ladder';
/** 한 단을 통과로 보는 이해도(자막 없이 다시 들으며 푼 문항) */
export const LADDER_PASS = 60;

export interface LadderPlan {
  no: number;
  /** 지금 들을 속도(다 통과했으면 마지막 속도) */
  speed: number;
  /** 통과한 단 수(0~3) */
  step: number;
  /** 3단 통과 — '귀 뚫림 ✓' */
  done: boolean;
}

interface LadderRaw {
  date?: string;
  no?: number;
  step?: number;
}

/** 오늘의 사다리 상태 — 날이 바뀌면 처음부터(같은 화든 다른 화든) */
export function ladderState(no: number | null): LadderPlan | null {
  const r = load<LadderRaw | null>(LADDER_KEY, null);
  const today = todayKey();
  const sameDay = !!r && r.date === today && typeof r.no === 'number';
  const n = sameDay ? (r!.no as number) : no;
  if (!n) return null;
  const step = sameDay ? Math.min(LADDER_SPEEDS.length, Math.max(0, Math.round(Number(r!.step) || 0))) : 0;
  return { no: n, step, speed: LADDER_SPEEDS[Math.min(step, LADDER_SPEEDS.length - 1)], done: step >= LADDER_SPEEDS.length };
}

/**
 * 사다리 한 단을 마쳤다 — 그 속도가 지금 단이고 이해도가 통과선 이상이면 한 단 오른다.
 * 오른 뒤 상태를 돌려준다(다른 속도로 본 재청취·통과 못 함은 그대로).
 */
export function advanceLadder(no: number, speed: number, score: number): LadderPlan {
  const cur = ladderState(no) || { no, step: 0, speed: LADDER_SPEEDS[0], done: false };
  let step = cur.no === no ? cur.step : 0;
  if (!cur.done && Math.abs(LADDER_SPEEDS[Math.min(step, LADDER_SPEEDS.length - 1)] - speed) < 0.001 && score >= LADDER_PASS) step += 1;
  store(LADDER_KEY, { date: todayKey(), no, step });
  return ladderState(no)!;
}

export function dramaPlan(): DramaPlan {
  const nextNo = dramaNextNo();
  const nextReady = !!episodeLite(nextNo);
  const keyless = !groqKey();
  const needAi = !nextReady && keyless;
  const today = dramaWatchedToday();
  const practiced = dramaPracticedToday();
  const due = dramaDueCount();
  const p = progLite();
  const seenList = Object.keys(p.done).map(Number);
  const replayNo = seenList.length ? seenList.sort((a, b) => (p.score[String(a)] ?? 100) - (p.score[String(b)] ?? 100) || b - a)[0] : null;
  const spoken = spokenToday();
  const goal = speakGoalLite().goal;
  const ladder = needAi ? ladderState(replayNo) : null;
  const rest = today || needAi;
  let kind: DramaPlan['kind'];
  if (!rest) kind = 'next';
  // 오늘 볼 것(새 화 또는 사다리)을 마쳤는데 발화가 목표 전 → 말하기
  else if ((today || !!ladder?.done) && spoken < goal && (due > 0 || !!replayNo)) kind = 'speak';
  else if (ladder && !ladder.done) kind = 'ladder';
  else kind = due > 0 ? 'review' : replayNo ? 'replay' : 'next';
  return { kind, nextNo, nextReady, needAi, today, practiced, due, replayNo, spoken, goal, ...(ladder ? { ladder } : {}) };
}

/* ── 홈 '발화 n/goal' 한 줄(M3) — 불꽃 옆. 원고·habits 없이 저장값만 읽는다 ── */

/** 하루 조절(M4 va_day_gov)이 정한 오늘의 목표 배율 — 짧은 날 0.5, 세션 적응 발동일 0.6. 없으면 1 */
export function dayGoalFactor(): number {
  const g = load<{ date?: string; mode?: string; adapt?: boolean } | null>('va_day_gov', null);
  if (!g || typeof g !== 'object' || g.date !== todayKey()) return 1;
  if (g.mode === 'short') return 0.5;
  if (g.adapt === true) return 0.6;
  return 1;
}

export interface SpeakLine {
  /** 오늘 발화(가중 합, 표시는 내림) */
  spoken: number;
  /** 오늘 목표(배율 반영, 최소 1) */
  goal: number;
  lit: boolean;
  /** 에피소드(또는 연습)만 하고 발화 목표 전 — 반불꽃 */
  half: boolean;
  /** 점 4개: 에피소드(키 없는 8일차+는 다시 듣기)·리텔·회상·회화 */
  dots: { id: 'episode' | 'retell' | 'recall' | 'talk'; label: string; on: boolean }[];
}

/** 오늘 이 출처(src)의 시도가 있었나 — 시도 로그 끝에서부터 오늘 것만 본다 */
function attemptedToday(srcs: string[]): boolean {
  const log = load<{ t?: number; src?: string }[]>('va_attempt_log', []);
  if (!Array.isArray(log)) return false;
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  for (let k = log.length - 1; k >= 0; k--) {
    const a = log[k];
    if (!a || typeof a.t !== 'number') continue;
    if (a.t < start) break;
    if (srcs.includes(String(a.src))) return true;
  }
  return false;
}

export function speakLine(plan: Pick<DramaPlan, 'needAi' | 'ladder'> = dramaPlan()): SpeakLine {
  const today = todayKey();
  const spoken = spokenToday();
  const goal = Math.max(1, Math.round(speakGoalLite().goal * dayGoalFactor()));
  const practiced = dramaPracticedToday();
  const lit = spoken >= goal;
  const keylessLoop = plan.needAi;
  const retell = load<{ date?: string }[]>('va_retell', []);
  const rc = load<Record<string, { asked?: number }>>('va_recall_speak', {});
  return {
    spoken,
    goal,
    lit,
    half: !lit && (practiced || spoken > 0),
    dots: [
      keylessLoop
        ? { id: 'episode', label: '다시 듣기', on: !!plan.ladder && plan.ladder.step > 0 }
        : { id: 'episode', label: '에피소드', on: dramaWatchedToday() },
      { id: 'retell', label: '리텔', on: Array.isArray(retell) && retell.some((r) => r && r.date === today) },
      { id: 'recall', label: '회상', on: (Number(rc && rc[today]?.asked) || 0) > 0 || load<{ date?: string; count?: number }>('va_review_today', {}).date === today },
      { id: 'talk', label: '회화', on: attemptedToday(['dtalk']) },
    ],
  };
}

/** 지금 떠올릴(기한이 된) 드라마 표현 수 — 홈 카드의 '표현 복습 N' */
export function dramaDueCount(now = Date.now()): number {
  return load<{ cat?: string; en?: unknown; due?: number }[]>('va_weak', []).filter((w) => w && w.cat === '드라마' && typeof w.en === 'string' && (w.due == null || w.due <= now)).length;
}

/** 드라마 화면을 열 때 할 일 — 새 화 재생·표현 복습·본 화 다시 듣기(1분 유효) */
export const DRAMA_REQ_KEY = 'va_drama_req';
/** replay에 speed가 있으면 그 속도로 시작(저장하지 않음) — ladder면 끝날 때 사다리 한 단을 정산한다(M3) */
export type DramaRequest = { kind: 'review' } | { kind: 'replay'; no: number; subsOff?: boolean; speed?: number; ladder?: boolean };
export function requestDrama(r: DramaRequest) {
  store(DRAMA_REQ_KEY, { ...r, at: Date.now() });
}

/**
 * 오늘의 미션을 끝냈는가 — 퀘스트·알림·레슨 계획이 이 한 줄 때문에 미션 원고(47KB)를
 * 통째로 끌어와 홈 첫 청크의 3분의 1을 차지했다(감사 v1.31 성능 #5). 값만 여기서 읽는다.
 */
export const MISSION_DONE_KEY = 'va_mission_done';
export function isMissionDoneToday(): boolean {
  return load<string>(MISSION_DONE_KEY, '') === todayKey();
}

/**
 * 드라마 재생 중인가 — 재생 중엔 '새 버전' 배너(탭하면 새로고침)를 엔딩까지 미룬다(감사 v1.31 G20).
 * 모듈 값 + 이벤트(같은 탭 안에서만 의미가 있다).
 */
export const DRAMA_PLAYING_EVENT = 'va:drama-playing';
let dramaPlaying = false;
export function isDramaPlaying(): boolean {
  return dramaPlaying;
}
export function setDramaPlaying(on: boolean) {
  if (dramaPlaying === on) return;
  dramaPlaying = on;
  try {
    window.dispatchEvent(new Event(DRAMA_PLAYING_EVENT));
  } catch {
    /* SSR */
  }
}

/** 홈 → 드라마 화면으로 갈 때 허브를 건너뛰고 바로 재생하라는 표시(1분 유효) */
export const DRAMA_AUTOPLAY_KEY = 'va_drama_autoplay';
export function requestDramaAutoplay() {
  store(DRAMA_AUTOPLAY_KEY, Date.now());
}
