'use client';

// 화면 전용 스타일 — 이 화면을 처음 열 때 함께 받는다(홈 첫 로딩의 렌더 차단 CSS에서 분리)
import '../app/screens.css';

/**
 * 드라마 레슨 화면 — 허브(시리즈·출연진·에피소드) + 플레이어(대화가 한 줄씩 흐르고,
 * 중간중간 태오의 대사를 내가 고르거나 말한다) + 엔딩(오늘의 표현·다음 화 예고).
 *
 * v1.30 감사 반영:
 *  - 소리는 한 줄씩 순서대로(태오 정답 → 상대 반응)만 나고, 대화 기록 순서도 항상 같다
 *    (예전엔 반응이 900ms 타이머로 태오 목소리를 끊고, 수동 재생 땐 다음 줄보다 뒤에 붙었다)
 *  - 답한 뒤에도 '뜻 알아듣기'·'빈칸' 대사와 해설이 기록에 남는다
 *  - 말풍선 다시 듣기·음소거가 자동 재생을 멈춰 세우지 않는다
 *  - 다음 화 첫머리에 '지난 화 기억나요?' — 드라마 표현의 간격 반복 복습
 *  - AI 원고가 실패·오류여도 무한 로딩·영구 막힘이 없다
 *
 * M2 역할극(내가 태오): 태오 대사(line/speak) 전부 + 지정 상대 대사(lib/dramaSeedMine)는 RoleStep이 맡는다.
 *  - 말풍선은 components/drama/Bubble.tsx, 역할극은 components/drama/RoleStep.tsx(따로 받는 청크, 미리 받기), 엔딩 추가 카드는
 *    components/drama/EndingExtras.tsx(레지스트리). 이 파일은 분기·슬롯·넘어가기 카운터만 가진다.
 *  - 역할극 장면에서는 자동 흐름이 멈추고 결과 뒤 '다음'으로 이어진다. 플래그 rolePlay가 꺼지면 예전 동작
 *    (태오 대사 자동 재생, speak 장면만 따라 말하기·넘어가기 무제한).
 *  - 엔딩 직전 '방금 60점 미만' 최대 2개를 한국어만 보고 다시 말한다(세션 내 재소환, src 'recall-inline').
 *
 * M3 말로 떠올리기: 첫머리 '지난 화 기억나요?'·표현 복습 세션의 회상은 components/drama/RecallStep.tsx(한국어만 보고 바로 말하기).
 *  - box 0 카드와 플래그 speakRecall off는 예전 3지선다 그대로(이 파일 안의 고르기). 키도 Web Speech도 없으면 RecallStep의 고르기 + 녹음 A/B.
 *  - 키 없는 날의 속도 사다리(0.9→1.0→1.2× 자막 없이 다시 듣기)는 홈 요청(requestDrama replay+speed+ladder)으로 열고, 끝나면 한 단 정산.
 *
 * M4 하루 조절(lib/dayGovernor): Player에 dayState(조용히·복귀·짧은 날·적응)를 넘기고, 상단에 예산 바(DayBudgetBar)를 둔다.
 *  - 짧은 날: 역할극 태오 대사 3줄만 · 조용히: 역할극 입모양(lip)·회상 고르기 · 적응: 속도 한 단계↓(0.75× 이상)·빌드업 7단어↑
 *  - 1차 시도(역할극·말로 떠올리기)는 recordTry로 세고, 시간 갈래(Four Strands)는 setStrand·markInteraction으로 알린다.
 */
import { Component, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import type { Mode } from './NavBar';
import { primeAudio, speakText, stopSpeaking } from './SpeakButton';
import TtsDegradedChip from './TtsDegradedChip';
import Bubble, { type LogItem } from './drama/Bubble';
import EndingExtras from './drama/EndingExtras';
import { DayBudgetBar } from './DayModeSheet';
import { ADAPT_BUILDUP_MIN_WORDS, adaptSpeed, dayState as readDayState, endingNote, limitRoleTargets, markInteraction, markQuietDone, noteActivity, playerDay, recordTry, setDaySession, setStrand, startDayTracking, type DayState } from '../lib/dayGovernor';
import { haptic } from '../lib/haptics';
import { BACK_EVENT, calcStreak, gradeWeakItem, groqKey, load, slowRate, store } from '../lib/state';
import { browserSttAvailable } from '../lib/browserStt';
import { advanceLadder, DRAMA_REQ_KEY, markDramaPracticeToday, setDramaPlaying, type DramaRequest, type LadderPlan } from '../lib/homeLite';
import { speakGoal } from '../lib/speakGoal';
import { whisperAvailable } from '../lib/stt';
import { isOn } from '../lib/flags';
import { todayKey } from '../lib/dates';
import { logRoleResult, recallInlineItems, roleFromSummary, roleSummary, SHADOW_MAX, SKIP_MAX, speakStatsFrom, sttPath, type RoleMode, type RoleResult } from '../lib/roleStep';
import { evidenceLog, overall, PASS_SCORE, PASSES_NEEDED } from '../lib/cefrGrowth';
import {
  allEpisodes,
  CAST,
  castOf,
  dramaPlan,
  clearResume,
  completeEpisode,
  discardGenerated,
  dramaAdjust,
  dramaLevel,
  DRAMA_AUTOPLAY_KEY,
  episodeByNo,
  episodeScore,
  fillFull,
  generateEpisode,
  gradeRecall,
  gradeRecycled,
  INTERACTIVE,
  speakMatch,
  isGenerating,
  loadResume,
  nextEpisodeNo,
  prefetchEpisode,
  recallItems,
  recallUiMode,
  reviewItems,
  roleTargets,
  saveResume,
  SERIES,
  SERIES_KR,
  voiceOf,
  watched,
  watchedToday,
  type Episode,
  type LevelStats,
  type MissedItem,
  type RecallItem,
  type ResumeState,
  type RoleTarget,
  type Scene,
  type SpeakStats,
} from '../lib/drama';

// 역할극 한 줄 — 녹음·채점·비교 재생까지 들어 있어 무겁다. 첫 화면 번들에 넣지 않고 따로 받는다.
// next/dynamic(React.lazy)은 청크를 미리 받아 둬도 처음 그릴 때 한 번은 서스펜드해 '준비 중…'(문항 문구 없음)이
// 끼었다 — 내 차례가 오는 순간 문구가 비는 셈이라, 받은 모듈을 여기 캐시해 두고 이미 있으면 바로 그린다.
type RoleStepComp = typeof import('./drama/RoleStep').default;
let roleStepMod: RoleStepComp | null = null;
let roleStepLoad: Promise<RoleStepComp | null> | null = null;
function loadRoleStep(): Promise<RoleStepComp | null> {
  if (roleStepMod) return Promise.resolve(roleStepMod);
  if (!roleStepLoad)
    roleStepLoad = import('./drama/RoleStep')
      .then((m) => (roleStepMod = m.default))
      .catch(() => {
        roleStepLoad = null; // 오프라인 등으로 실패하면 다음 장면에서 다시 시도
        return null;
      });
  return roleStepLoad;
}
// 말로 떠올리기(M3) — 역할극과 같은 이유로 따로 받고 받은 모듈을 캐시한다
type RecallStepComp = typeof import('./drama/RecallStep').default;
let recallStepMod: RecallStepComp | null = null;
let recallStepLoad: Promise<RecallStepComp | null> | null = null;
function loadRecallStep(): Promise<RecallStepComp | null> {
  if (recallStepMod) return Promise.resolve(recallStepMod);
  if (!recallStepLoad)
    recallStepLoad = import('./drama/RecallStep')
      .then((m) => (recallStepMod = m.default))
      .catch(() => {
        recallStepLoad = null;
        return null;
      });
  return recallStepLoad;
}
/**
 * 지연 청크 로더 — 받는 동안 '준비 중…', 실패하면(오프라인) 영구 대기 대신 '다시 불러오기'와 '이 줄 넘어가기'.
 * try가 바뀌면 다시 받는다(loadX는 실패 시 캐시를 비워 둔다).
 */
function useLazy<C>(mod: C | null, load: () => Promise<C | null>): { Comp: C | null; failed: boolean; retry: () => void } {
  const [Comp, setComp] = useState<C | null>(() => mod);
  const [failed, setFailed] = useState(false);
  const [tryNo, setTryNo] = useState(0);
  useEffect(() => {
    if (Comp) return;
    let on = true;
    setFailed(false);
    void load().then((c) => {
      if (!on) return;
      if (c) setComp(() => c);
      else setFailed(true);
    });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Comp, tryNo]);
  return { Comp, failed, retry: () => setTryNo((n) => n + 1) };
}

function LazyFail({ cls, onRetry, onSkip }: { cls: string; onRetry: () => void; onSkip: () => void }) {
  return (
    <div className={`dr-act ${cls} dr-lazy-fail`} role="status">
      <p className="dr-msg">이 화면을 불러오지 못했어요 — 인터넷 연결을 확인해 주세요.</p>
      <div className="dr-row">
        <button type="button" className="btn ghost dr-lazy-retry" onClick={onRetry}>
          다시 불러오기
        </button>
        <button type="button" className="btn primary dr-lazy-skip" onClick={onSkip}>
          이 줄 넘어가기
        </button>
      </div>
    </div>
  );
}

function RecallStep(props: ComponentProps<RecallStepComp>) {
  const { Comp, failed, retry } = useLazy(recallStepMod, loadRecallStep);
  if (Comp) return <Comp {...props} />;
  if (failed) {
    const it = props.item;
    // 채점 없이 넘긴다 — 간격 반복은 건드리지 않고(again 기록 없음) 화면에만 '다시 볼게요'
    return <LazyFail cls="rc-loading" onRetry={retry} onSkip={() => props.onDone({ en: it.en, kr: it.kr, who: it.who || 'taeo', grade: 'again', good: false, firstScore: 0, hinted: false, mode: 'choice', path: 'self' })} />;
  }
  return <div className="dr-act rc-loading">🎙 준비 중…</div>;
}

function RoleStep(props: ComponentProps<RoleStepComp>) {
  const { Comp, failed, retry } = useLazy(roleStepMod, loadRoleStep);
  if (Comp) return <Comp {...props} />;
  if (failed) {
    const sc = props.scene;
    // tries 0 = 불러오지 못해 넘김(호출부가 넘어가기 횟수에 넣지 않는다). 넘어간 줄처럼 내일 복습 카드로만 남긴다
    return (
      <LazyFail
        cls="rs-loading"
        onRetry={retry}
        onSkip={() => {
          const r: RoleResult = { sceneIdx: sc.idx, en: sc.en, kr: sc.kr, who: sc.who, said: '', score: 0, diff: [], missed: [], lapses: [], tries: 0, mode: props.mode, skipped: true, disputed: false, self: false, passed: false, path: 'self' };
          try {
            logRoleResult(r, props.epNo);
          } catch {
            /* 기록 실패는 흐름을 막지 않는다 */
          }
          props.onDone(r);
        }}
      />
    );
  }
  return <div className="dr-act rs-loading">🎙 준비 중…</div>;
}

const MUTE_KEY = 'va_drama_mute';
const AUTO_KEY = 'va_drama_auto';
const SUBS_KEY = 'va_drama_subs';
const SLOW_KEY = 'va_drama_slow';
const SPEED_KEY = 'va_drama_speed';

/** 재생 속도 단계 — 1×가 예전 보통 속도(0.95), 0.75×가 예전 '🐢 천천히'와 같은 빠르기 */
export const DRAMA_SPEEDS = [0.6, 0.75, 0.9, 1, 1.2] as const;
const SPEED_BASE = 0.95;
const speedLabel = (v: number) => `${v}×`;

/** 저장된 속도 — 없으면 예전 '천천히' 설정을 이어받고, 그것도 없으면 A1·방금 쉬워진 사용자는 0.75× */
function initialSpeed(): number {
  const v = load<number | null>(SPEED_KEY, null);
  if (typeof v === 'number' && (DRAMA_SPEEDS as readonly number[]).includes(v)) return v;
  const old = load<boolean | null>(SLOW_KEY, null);
  if (typeof old === 'boolean') return old ? 0.75 : 1;
  try {
    return dramaLevel() === 'A1' || dramaAdjust() === -1 ? 0.75 : 1;
  } catch {
    return 1;
  }
}

/** 같은 말풍선을 두 번 누르면 — 지금 속도보다 한 단계 더 느리게(최저 0.55) */
const slowerOf = (speed: number) => Math.max(0.55, Math.min(slowRate(), speed - 0.25)) * SPEED_BASE;


/** 플레이어가 도는 장면 — 원고 장면 + 첫머리 복습(recall) + 엔딩 직전 재소환(recallInline, M2) */
type PScene = Scene | ({ type: 'recall' } & RecallItem) | { type: 'recallInline'; idx: number; who: string; en: string; kr: string };

function shuffleIdx(n: number, seed: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  let s = seed + 11;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

// 따라 말하기 일치도는 lib로 옮겼다(회화 화면도 쓰는데 이 화면 전체를 끌어오지 않게)
export { speakMatch } from '../lib/drama';

/** 대사 한 줄을 읽는 데 필요한 시간(음소거·추정용) */
const lineMs = (en: string) => en.split(/\s+/).length * 380 + 700;

// 말풍선(Bubble)은 components/drama/Bubble.tsx로, 따라 말하기(SpeakStep)는 components/drama/RoleStep.tsx로 옮겼다(M2).

export interface PlayResult {
  score: number;
  asked: number;
  ok: number;
  missed: MissedItem[];
  /** 틀린 참여 장면(바로 앞 대사 포함) — '틀린 장면 다시 풀기'용 */
  retry: Scene[];
  /** 문항 레벨별 성적(원고의 B1 문항 → B1 듣기 증거) */
  byLevel: LevelStats;
  /** 역할극 집계(M2) — 역할극이 없던 세션(복습·다시 풀기)은 undefined */
  speakStats?: SpeakStats;
  /** 엔딩 직전 재소환한 문장·첫머리에 떠올린 문장(M3 — 엔딩 회상 카드가 겹치지 않게) */
  inlineEns?: string[];
  recallEns?: string[];
}

/** 참여 장면의 정답 문장과 그 뜻(복습 카드용) */
function answerOf(sc: Scene): MissedItem | null {
  if (sc.type === 'choice') {
    const right = sc.opts.find((o) => o.ok);
    // 복습 카드의 뜻은 번역이어야 한다(상황 지시문이면 '“잘 들린다고 말하자.” — 영어로는?'이 된다)
    return right && right.kr && /[가-힣]/.test(right.kr) ? { en: right.en, kr: right.kr } : null;
  }
  if (sc.type === 'meaning') return { en: sc.en, kr: sc.opts[sc.a] };
  if (sc.type === 'fill') return { en: fillFull(sc), kr: sc.kr };
  return null;
}

/**
 * practice: '틀린 장면 다시 풀기' — 첫머리 복습 없이 주어진 장면만, 채점은 복습 카드로 반영
 * review: '표현 복습' — 기한이 된 드라마 표현만 떠올리기(새 화가 없는 날에도 매일 복습)
 * subsOff: 본 화를 '자막 없이 다시 듣기'
 */
function Player({
  ep,
  onEnd,
  onExit,
  practice,
  review,
  resume,
  subsOff,
  dayState,
  speedOverride,
}: {
  ep: Episode;
  onEnd: (r: PlayResult) => void;
  onExit: () => void;
  practice?: boolean;
  review?: RecallItem[];
  /** 이어 보기 — 지난번 멈춘 장면부터(기록·점수 그대로) */
  resume?: ResumeState | null;
  subsOff?: boolean;
  /**
   * 하루 상태(M4 dayGovernor.playerDay):
   * quiet(조용히 — 역할극이 입모양 모드·회상은 고르기, 넘어가기 무제한) · returning(복귀 첫날 — 넘어가기 무제한) ·
   * adapt(세션 적응 — 속도 한 단계↓·빌드업 7단어↑) · short/roleLinesMax(짧은 날 — 태오 대사 3줄만 역할극)
   */
  dayState?: { quiet?: boolean; returning?: boolean; adapt?: boolean; short?: boolean; roleLinesMax?: number; buildupMinWords?: number };
  /** 이 재생만의 시작 속도(속도 사다리 — 저장하지 않는다) */
  speedOverride?: number;
}) {
  // 첫머리 복습 — 지난 화 표현 떠올리기(간격 반복). 이어 볼 때는 그때 문항 그대로(장면 번호가 어긋나지 않게)
  // M3: 플래그 speakRecall이 켜져 있으면 box≥1 카드는 말로 떠올리기(mode 'speak'), 꺼져 있으면 예전 3지선다
  const speakRecall = isOn('speakRecall');
  const rc = useMemo<RecallItem[]>(
    // M4 조용히 모드: 소리를 못 내는 날이라 회상은 고르기(mode 'choice')
    () => (review ? review : practice ? [] : resume ? resume.rc : recallItems(ep.no, 3, speakRecall ? { mode: dayState?.quiet ? 'choice' : 'speak' } : {})),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ep, practice, resume, review]
  );
  const baseScenes = useMemo<PScene[]>(() => {
    if (review) return [{ type: 'narr', kr: `표현 복습 — 지난 화들에서 배운 표현 ${review.length}개를 떠올려 봐요.` } as Scene, ...review.map((r) => ({ type: 'recall' as const, ...r }))];
    if (practice || !rc.length) return ep.scenes;
    return [{ type: 'narr', kr: '지난 화 기억나요? 표현 하나만 떠올려 보고 시작해요.' } as Scene, ...rc.map((r) => ({ type: 'recall' as const, ...r })), { type: 'narr', kr: `EP ${ep.no} · ${ep.titleKr}` } as Scene, ...ep.scenes];
  }, [ep, practice, rc, review]);
  /** 엔딩 직전 재소환 장면(M2) — 마지막 장면을 지날 때 '방금 60점 미만' 최대 2개를 덧붙인다 */
  const [extra, setExtra] = useState<PScene[]>([]);
  const scenes = useMemo<PScene[]>(() => (extra.length ? [...baseScenes, ...extra] : baseScenes), [baseScenes, extra]);
  const saveProgress = !practice && !review;
  /** 플레이어 장면 번호 → 원고 장면 번호(첫머리 복습 블록만큼 밀린다). 복습 세션은 역할극 없음(-1) */
  const sceneOffset = review ? -1 : practice || !rc.length ? 0 : rc.length + 2;

  // ── 역할극(M2) ──
  // 플래그가 꺼지면 예전 동작: 태오 대사는 자동 재생, speak 장면만 따라 말하기(넘어가기 무제한)
  const rolePlay = !practice && !review && !subsOff && isOn('rolePlay');
  const path = sttPath({ whisper: whisperAvailable(), webSpeech: browserSttAvailable() });
  const keyless = path === 'self';
  const quiet = !!dayState?.quiet;
  const roleMap = useMemo(() => {
    const m = new Map<number, RoleTarget>();
    if (review) return m;
    // M4 짧은 날: 태오 대사 앞 3줄만 역할극(speak 문항은 그대로, 지정 상대 대사는 쉼) — 나머지 대사는 예전처럼 흐른다
    if (rolePlay) for (const t of limitRoleTargets(roleTargets(ep), (k) => ep.scenes[k]?.type === 'speak', dayState?.roleLinesMax ?? Infinity)) m.set(t.idx, t);
    else ep.scenes.forEach((sc, idx) => sc.type === 'speak' && m.set(idx, { idx, who: sc.who, en: sc.en, kr: sc.kr, kind: 'role', afterQuiz: false }));
    return m;
  }, [ep, rolePlay, review]);
  /** 지정 상대 대사의 영어(길게 누르기 표시용) */
  const mineEns = useMemo(() => new Set([...roleMap.values()].filter((t) => t.kind === 'mine').map((t) => t.en)), [roleMap]);
  /**
   * 이 플레이어 장면이 역할극인가 — role: 태오 대사(조용히면 입모양), mine: 키 없음이면 섀도잉 기본(ON),
   * 키 있음이면 보통 재생(말풍선 길게 누르기). 뜻·빈칸 문항에 지정된 상대 줄은 퀴즈 뒤에 붙는다(afterQuiz).
   */
  const roleOf = (k: number): { t: RoleTarget; mode: RoleMode } | null => {
    const sc = scenes[k];
    if (!sc) return null;
    if (sc.type === 'recallInline') return { t: { idx: sc.idx, who: sc.who, en: sc.en, kr: sc.kr, kind: 'role', afterQuiz: false }, mode: 'role' };
    if (sceneOffset < 0) return null;
    const t = roleMap.get(k - sceneOffset);
    if (!t) return null;
    if (t.kind === 'role') return sc.type === 'line' || sc.type === 'speak' ? { t, mode: quiet ? 'lip' : 'role' } : null;
    if (sc.type !== 'line' || path === 'whisper') return null;
    return { t, mode: quiet ? 'lip' : 'shadow' };
  };
  /** 역할극 결과 모음 — 집계(speakStats)·재소환 후보 */
  // 이어 보기면 지난번 역할극 결과 요약·넘어가기 수를 이어받는다(없으면 0 — 예전 저장본)
  const roleResults = useRef<RoleResult[]>(resume?.roles ? resume.roles.map(roleFromSummary) : []);
  const [skips, setSkips] = useState(() => resume?.skips ?? 0);
  const skipsRef = useRef(resume?.skips ?? 0);
  const [shadows, setShadows] = useState(0);
  /** 길게 누른 상대 대사(키 있음) — 섀도잉이 열려 있는 동안 흐름을 멈춘다 */
  const [shadowOf, setShadowOf] = useState<{ who: string; en: string; kr: string; idx: number } | null>(null);
  const shadowRef = useRef(shadowOf);
  shadowRef.current = shadowOf;
  /** 뜻·빈칸 문항이 끝난 직후 붙는 지정 상대 대사(키 없음 섀도잉) */
  const [postQuiz, setPostQuiz] = useState<RoleTarget | null>(null);
  const postQuizRef = useRef(postQuiz);
  postQuizRef.current = postQuiz;
  const inlineDone = useRef(false);
  const inlineEnsRef = useRef<string[]>([]);
  /** 이 회상 장면을 RecallStep(말로 떠올리기·키 없는 고르기+A/B)이 맡나 — box 0·플래그 off는 예전 고르기 */
  const recallByStep = (sc: PScene | undefined) => !!sc && sc.type === 'recall' && speakRecall && !quiet && (recallUiMode(sc.mode, path) === 'speak' || path === 'self');

  const [i, setI] = useState(() => (resume ? Math.min(resume.i, scenes.length - 1) : 0));
  const [log, setLog] = useState<LogItem[]>(() => (resume ? (resume.log as LogItem[]) : []));
  const logRef = useRef(log);
  logRef.current = log;
  const [picked, setPicked] = useState<number | null>(null);
  const [subs, setSubs] = useState(() => (subsOff ? false : load<boolean>(SUBS_KEY, true)));
  const [mute, setMute] = useState(() => load<boolean>(MUTE_KEY, false));
  // 재생 속도 — 0.6×~1.2×(설정은 다음 화에도 유지). 처음 보는 A1이거나 방금 쉬워진 사용자는 0.75×
  // M4 세션 적응: 한 단계 느리게 시작(0.75× 아래로는 안 내림, 저장하지 않음)
  const [speed, setSpeed] = useState(() => (speedOverride && (DRAMA_SPEEDS as readonly number[]).includes(speedOverride) ? speedOverride : dayState?.adapt ? adaptSpeed(initialSpeed(), DRAMA_SPEEDS) : initialSpeed()));
  /** 재생 도중 적응이 켜졌나(그때부터 빌드업 7단어) */
  const [adaptLive, setAdaptLive] = useState(!!dayState?.adapt);
  const [speedOpen, setSpeedOpen] = useState(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const lastReplay = useRef<{ en: string; at: number } | null>(null);
  /** 지금 장면의 대사를 끝까지 들려줬는가(다시 듣기로 끊겼으면 이어서 들려준다) */
  const lineDone = useRef(true);
  /** 답한 뒤 아직 다 들려주지 못한 정답·반응 대사 */
  const pendingVoice = useRef<{ en: string; who?: string }[]>([]);
  const missedRef = useRef<MissedItem[]>(resume ? resume.missed : []);
  const retryRef = useRef<Scene[]>(resume ? resume.retryIdx.map((k) => ep.scenes[k]).filter(Boolean) : []);
  // 자동 재생 — 대사는 목소리가 끝나고 자막을 읽을 틈만큼 쉬었다가 저절로 넘어간다.
  // 멈추는 곳은 내 차례(참여 문항)뿐이고, 답하면 해설을 읽을 시간 뒤 다시 흐른다.
  const [auto, setAuto] = useState(() => load<boolean>(AUTO_KEY, true));
  const endRef = useRef<HTMLDivElement | null>(null);
  const scene = scenes[i];
  const total = scenes.length;
  const totalRef = useRef(total);
  totalRef.current = total;
  const okRef = useRef(resume ? resume.ok : 0);
  const askedRef = useRef(resume ? resume.asked : 0);
  const byLevelRef = useRef<LevelStats>({});
  const logBoxRef = useRef<HTMLDivElement | null>(null);
  const focusAfter = useRef(false);
  // 사용자가 지난 대사를 보려고 위로 올렸으면 새 대사가 나와도 끌어내리지 않는다(대신 '새 대사 ↓')
  const atBottom = useRef(true);
  const lastAuto = useRef(0);
  const [newBelow, setNewBelow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useRef(0);
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const muteRef = useRef(mute);
  muteRef.current = mute;
  const iRef = useRef(i);
  iRef.current = i;
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  /** 회상(RecallStep)이 채점을 마친 장면 번호 — 아직 '다음 ▶'을 안 눌렀어도 답한 것으로 저장한다 */
  const gradedAt = useRef(-1);
  const ended = useRef(false);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      clearTimer();
      token.current++;
      stopSpeaking();
    },
    []
  );
  // 역할극 청크를 첫 역할극 장면에 닿을 때야 받으면 내 차례에 '준비 중…'(문항 문구 없음)이 끼었다
  // (플래그 off의 speak 장면은 예전엔 인라인 SpeakStep이라 바로 떴다). 이 화에 역할극 장면이 있으면 재생 시작과 함께 미리 받는다.
  useEffect(() => {
    if (roleMap.size) void loadRoleStep();
  }, [roleMap]);
  useEffect(() => {
    if (rc.some((r) => recallByStep({ type: 'recall', ...r }))) void loadRecallStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rc]);
  useEffect(() => {
    const sc = endRef.current?.closest('.app-content') as HTMLElement | null;
    if (!sc) return;
    const on = () => {
      if (Date.now() - lastAuto.current < 900) return; // 우리가 내린 스크롤은 사용자 의도가 아니다
      atBottom.current = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 160;
      if (atBottom.current) setNewBelow(false);
    };
    sc.addEventListener('scroll', on, { passive: true });
    return () => sc.removeEventListener('scroll', on);
  }, []);
  const toBottom = () => {
    lastAuto.current = Date.now();
    atBottom.current = true;
    setNewBelow(false);
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  };
  useEffect(() => {
    if (atBottom.current) toBottom();
    else setNewBelow(true);
    // 키보드·스크린리더: 답한 뒤엔 방금 나온 해설로, 새 문제가 나오면 질문으로 포커스를 옮긴다(예전엔 BODY로 사라졌다)
    const box = logBoxRef.current;
    if (!box) return;
    const raf = requestAnimationFrame(() => {
      let el: HTMLElement | null = null;
      if (focusAfter.current) {
        focusAfter.current = false;
        const items = box.querySelectorAll<HTMLElement>(':scope > .dr-note, :scope > .dr-line');
        el = items[items.length - 1] || null;
      } else if (box.querySelector('.dr-act') && pickedRef.current === null) {
        el = box.querySelector<HTMLElement>('.dr-act .dr-ask');
      }
      if (el && box.contains(document.activeElement) === false && document.activeElement !== document.body) return;
      if (el) {
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
        el.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log.length, i, picked]);

  const push = (...items: LogItem[]) => setLog((l) => [...l, ...items]);

  function advance() {
    clearTimer();
    token.current++;
    setPicked(null);
    const cur = iRef.current;
    if (cur + 1 >= totalRef.current) {
      // 엔딩 직전 재소환(M2) — 방금 60점 미만 최대 2개를 한국어만 보고 다시(한 번만 붙인다)
      if (rolePlay && !inlineDone.current) {
        inlineDone.current = true;
        const items = recallInlineItems(roleResults.current);
        if (items.length) {
          inlineEnsRef.current = items.map((x) => x.en);
          setExtra(items.map((x) => ({ type: 'recallInline' as const, idx: x.sceneIdx, who: x.who, en: x.en, kr: x.kr })));
          setI(cur + 1);
          return;
        }
      }
      if (ended.current) return;
      ended.current = true;
      stopSpeaking();
      const score = askedRef.current ? Math.round((okRef.current / askedRef.current) * 100) : 100;
      if (saveProgress) clearResume();
      onEnd({
        score,
        asked: askedRef.current,
        ok: okRef.current,
        missed: missedRef.current,
        retry: retryRef.current,
        byLevel: byLevelRef.current,
        speakStats: roleResults.current.length ? speakStatsFrom(roleResults.current) : undefined,
        inlineEns: inlineEnsRef.current,
        recallEns: rc.map((r) => r.en),
      });
      return;
    }
    setI(cur + 1);
    // 이어 보기 저장 — 넘어간 순간 기준(답한 문항의 점수까지 확정된 상태)
    snapshot(cur + 1);
  }

  /** 이어 보기 저장 — nextI부터 다시 보면 되는 상태(그 전 장면의 기록·점수는 확정) */
  function snapshot(nextI: number) {
    // 재소환 장면(extra)은 저장하지 않는다 — 다시 열면 엔딩으로 간다
    if (!saveProgress || nextI <= 0 || nextI >= baseScenes.length) return;
    saveResume({
      no: ep.no,
      i: nextI,
      ok: okRef.current,
      asked: askedRef.current,
      log: logRef.current,
      missed: missedRef.current,
      retryIdx: retryRef.current.map((x) => ep.scenes.indexOf(x)).filter((k) => k >= 0),
      rc,
      skips: skipsRef.current,
      roles: roleResults.current.map(roleSummary),
    });
  }
  // 전화·알림으로 앱을 벗어나거나 앱이 종료될 때도 저장 — 화면 안 이동만이 아니라(감사 v1.31 G02)
  useEffect(() => {
    const save = () => {
      if (document.visibilityState !== 'hidden' && !ended.current) return;
      if (ended.current) return;
      const sc = scenes[iRef.current];
      // 회상 카드는 채점(간격 반복·발화 수)이 '다음 ▶' 전에 끝난다 — 채점된 장면은 답한 것으로(이어 볼 때 두 번 세지 않게)
      const unanswered = !!sc && (INTERACTIVE.has(sc.type) || sc.type === 'recall' || !!roleOf(iRef.current)) && pickedRef.current === null && gradedAt.current !== iRef.current;
      snapshot(unanswered ? iRef.current : iRef.current + 1);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 지금 장면에서 기다렸다가 넘어가도 되는가(자동 재생 켜짐 + 내 차례가 아니거나 이미 답함 + 섀도잉·퀴즈 뒤 역할극이 열려 있지 않음) */
  const canFlow = () => {
    const sc = scenes[iRef.current];
    if (shadowRef.current || postQuizRef.current) return false;
    const mine = !!sc && (INTERACTIVE.has(sc.type) || sc.type === 'recall' || !!roleOf(iRef.current));
    return autoRef.current && !!sc && (!mine ? true : pickedRef.current !== null);
  };

  /** ms 뒤 다음으로(그 사이 장면이 바뀌었거나 멈췄으면 무시) */
  function scheduleNext(ms: number) {
    clearTimer();
    const at = iRef.current;
    const t = token.current;
    timer.current = setTimeout(() => {
      if (t !== token.current || at !== iRef.current || !canFlow()) return;
      advance();
    }, ms);
  }

  /**
   * 대사들을 순서대로 소리 내고, 다 끝나면 then(). 음소거면 글자 수로 시간을 추정한다.
   * 새 호출이나 장면 전환이 있으면 이전 순서는 조용히 버려진다(token).
   */
  function speakSeq(input: (string | { en: string; who?: string; rate?: number })[], then?: () => void, rateOverride?: number) {
    const rate = rateOverride ?? speedRef.current * SPEED_BASE;
    // 빠르게 들을 땐 대사 사이 읽을 시간도 그만큼 줄인다(느릴 땐 원래 시간 이상)
    const pace = (r: number) => Math.min(1, r / SPEED_BASE);
    // 줄마다 속도를 따로 줄 수 있다(다시 듣기로 천천히 들은 줄 뒤에 이어지는 현재 대사는 보통 속도로)
    const lines = input.map((x) => (typeof x === 'string' ? { en: x, who: 'taeo', rate } : { en: x.en, who: x.who || 'taeo', rate: x.rate ?? rate }));
    clearTimer();
    const t = ++token.current;
    const at = iRef.current;
    const alive = () => t === token.current && at === iRef.current;
    if (!lines.length || muteRef.current) {
      const ms = lines.reduce((a, l) => a + lineMs(l.en) / pace(l.rate), 0);
      timer.current = setTimeout(() => alive() && then?.(), ms);
      return;
    }
    stopSpeaking();
    let k = 0;
    const next = () => {
      if (!alive()) return;
      if (k >= lines.length) {
        then?.();
        return;
      }
      const { en, who, rate: r } = lines[k++];
      let done = false;
      const startedAt = Date.now();
      // 음성이 곧바로 실패해도(키 없는 기기·음성 없음) 대사를 읽을 최소 시간은 지킨다 — 소리 없이 휙휙 넘어가지 않게
      const minMs = (lineMs(en) * 0.7) / Math.max(1, r / SPEED_BASE);
      const go = () => {
        if (done) return;
        done = true;
        const left = minMs - (Date.now() - startedAt);
        if (left > 50) setTimeout(() => alive() && next(), left);
        else next();
      };
      // 인물마다 다른 목소리(예전엔 모두 같은 남성 목소리 하나)
      speakText(en, 'en-US', r, go, voiceOf(who));
      // 안전장치 — onend를 안 주는 기기에서도 멈추지 않게
      setTimeout(go, (lineMs(en) * 2) / pace(r) + 3000);
    };
    next();
  }

  /** 말풍선 다시 듣기 — 같은 말풍선을 곧바로 한 번 더 누르면 천천히. 자동 재생 중이면 다 듣고 이어서 흐른다 */
  function replay(en: string, who?: string) {
    markInteraction(); // M4: 다시 듣기도 상호작용
    if (muteRef.current) return;
    const now = Date.now();
    const again = lastReplay.current?.en === en && now - lastReplay.current.at < 8000;
    lastReplay.current = { en, at: now };
    // 지금 대사(또는 답한 뒤의 정답·반응)가 아직 다 나오기 전이었다면, 다시 듣기 뒤에 이어서 들려준다
    // (끊긴 채 넘어가지 않게). 천천히는 다시 들은 줄에만, 이어지는 줄은 보통 속도로.
    const cur = scenes[iRef.current];
    const tail: { en: string; who?: string }[] =
      cur && cur.type === 'line' && !lineDone.current && cur.en !== en
        ? [{ en: cur.en, who: cur.who }]
        : pickedRef.current !== null && pendingVoice.current.length
          ? pendingVoice.current.filter((x) => x.en !== en)
          : [];
    const lineWait = cur && cur.type === 'line' && tail.length ? 700 + (subs ? cur.kr.length * 30 : 0) : 600;
    speakSeq(
      [{ en, who, rate: again ? slowerOf(speedRef.current) : undefined }, ...tail],
      () => {
        lineDone.current = true;
        pendingVoice.current = [];
        if (canFlow()) scheduleNext(lineWait);
      }
    );
  }

  // 장면 도착 — 해설·대사는 기록에 올리고 소리 낸 뒤 자동으로 넘어간다
  useEffect(() => {
    if (!scene) return;
    if (roleOf(i)) return; // 역할극(M2) — 듣기·녹음·결과는 RoleStep이 맡고, 결과 뒤 '다음'으로 이어진다
    if (scene.type === 'narr') {
      push({ kind: 'narr', kr: scene.kr });
      if (autoRef.current) scheduleNext(Math.max(2200, scene.kr.length * 70));
    } else if (scene.type === 'line') {
      push({ kind: 'line', who: scene.who, en: scene.en, kr: scene.kr });
      lineDone.current = false;
      speakSeq([{ en: scene.en, who: scene.who }], () => {
        lineDone.current = true;
        if (canFlow()) scheduleNext(700 + (subs ? scene.kr.length * 30 : 0));
      });
    } else if (scene.type === 'meaning') {
      speakSeq([{ en: scene.en, who: scene.who }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const order = useMemo(() => {
    if (!scene || !('opts' in scene)) return [];
    return shuffleIdx(scene.opts.length, ep.no * 31 + i);
  }, [scene, ep.no, i]);

  /** 참여 문항 채점 — 틀린 문장은 복습 카드로, 다시 나온 지난 표현은 간격 반복 한 번으로 */
  function grade(good: boolean, sc?: Scene) {
    markInteraction(); // M4: 퀴즈에 답한 재생은 input 시간으로 센다
    askedRef.current += 1;
    if (good) okRef.current += 1;
    haptic(good ? 'success' : 'error');
    if (sc) {
      const lv = (sc as { level?: string }).level || ep.level;
      const st = (byLevelRef.current[lv] ||= { asked: 0, ok: 0 });
      st.asked += 1;
      if (good) st.ok += 1;
    }
    const ans = sc ? answerOf(sc) : null;
    if (!ans) return;
    if (practice) {
      gradeWeakItem(ans.en, good ? 'good' : 'again');
      return;
    }
    if (!good) {
      missedRef.current.push(ans);
      const k = ep.scenes.indexOf(sc!);
      const prev = k > 0 ? ep.scenes[k - 1] : null;
      if (prev && prev.type === 'line') retryRef.current.push(prev);
      retryRef.current.push(sc!);
    }
    try {
      gradeRecycled(ans.en, good, ep.no);
    } catch {
      /* 복습 기록 실패는 재생을 막지 않는다 */
    }
  }

  /** 답한 뒤: 기록을 순서대로 남기고, 소리를 순서대로 낸 뒤, 해설을 읽을 시간 뒤 흐른다 */
  function afterAnswer(k: number, good: boolean, items: LogItem[], voiceLines: (string | { en: string; who?: string })[]) {
    pickedRef.current = k;
    setPicked(k);
    focusAfter.current = true;
    push(...items);
    // 뜻·빈칸 문항에 지정된 상대 대사(키 없음) — 퀴즈가 끝난 직후 섀도잉을 붙인다(퀴즈 자체는 그대로)
    const t = sceneOffset >= 0 ? roleMap.get(iRef.current - sceneOffset) : undefined;
    if (t && t.kind === 'mine' && t.afterQuiz && path !== 'whisper' && !quiet) {
      postQuizRef.current = t;
      setPostQuiz(t);
    }
    pendingVoice.current = voiceLines.map((x) => (typeof x === 'string' ? { en: x, who: 'taeo' } : x));
    speakSeq(voiceLines, () => {
      pendingVoice.current = [];
      if (canFlow()) scheduleNext(good ? 1400 : 3400);
    });
  }

  /** 역할극 한 줄이 끝났다(M2) — 이해도 합산·기록·말풍선 추가, 결과 뒤 '다음'(자동이면 잠시 뒤 저절로) */
  function onRoleDone(r: RoleResult, t: { who: string; en: string; kr: string }, o: { counts: boolean; inline?: boolean; optIn?: boolean; noLine?: boolean } = { counts: true }) {
    roleResults.current.push(r);
    noteActivity();
    // M4 세션 적응 — 태오 대사의 1차 시도(채점된 것만)를 센다. 막 켜졌으면 속도 한 단계↓·빌드업 7단어
    if (r.mode === 'role' && !r.skipped && !r.self && !o.inline) {
      const g = recordTry(r.passed && r.tries === 1);
      if (g.newly) {
        const v = adaptSpeed(speedRef.current, DRAMA_SPEEDS);
        setSpeed(v);
        speedRef.current = v;
        setAdaptLive(true);
      }
    }
    // tries 0 = 역할극 화면을 불러오지 못해(오프라인) 이 줄을 넘긴 것 — 사용자의 넘어가기 횟수를 쓰지 않는다
    if (r.skipped && r.mode !== 'shadow' && !o.inline && r.tries > 0) {
      skipsRef.current += 1;
      setSkips(skipsRef.current);
    }
    // 역할극은 말하기다 — 이해도(듣기: askedRef/okRef·byLevel → 레벨 조정·듣기 CEFR)에 넣지 않고 speakStats로만 센다.
    // 지난 표현 재등장 채점도 '채점된' 발화만(자기확인 ✓은 증거가 아니다), 퀴즈 뒤 섀도잉(noLine)은 퀴즈가 이미 채점했다.
    if (!r.skipped && o.counts && !o.inline && !o.noLine && !(r.self && !r.disputed)) {
      try {
        gradeRecycled(t.en, r.passed, ep.no);
      } catch {
        /* 복습 기록 실패는 재생을 막지 않는다 */
      }
    }
    const items: LogItem[] = [];
    if (o.inline) {
      items.push({ kind: 'note', ok: r.passed, text: r.skipped ? `재소환 — “${t.en}” 다음에 다시` : `재소환 “${t.en}” · ${r.self ? (r.passed ? '말했어요 ✓' : '다음에 다시') : `${r.score}점`}` });
    } else if (!o.optIn) {
      // 퀴즈 뒤에 붙은 줄(noLine)은 말풍선이 이미 올라가 있다 — 결과 노트만
      if (!o.noLine) items.push({ kind: 'line', who: t.who, en: t.en, kr: t.kr });
      if (r.skipped) items.push({ kind: 'note', ok: false, text: o.noLine ? '같이 말하기는 넘어갔어요.' : '넘어갔어요 — 내일 복습에 넣어 둘게요.' });
      else if (!r.self) items.push({ kind: 'note', ok: r.passed, text: `${r.mode === 'shadow' ? '같이 말하기' : '내 발화'} ${r.score}점${r.missed.length ? ` · 다시: ${r.missed.slice(0, 3).join(', ')}` : ''}${r.disputed ? ' · 채점 이의 접수' : ''}` });
    } else if (!r.skipped) {
      items.push({ kind: 'note', ok: r.passed, text: `같이 말하기 “${t.en}” · ${r.self ? '완료 ✓' : `${r.score}점`}` });
    }
    focusAfter.current = true;
    if (items.length) push(...items);
    if (o.optIn) {
      setShadows((n) => n + 1);
      shadowRef.current = null;
      setShadowOf(null);
    } else if (postQuizRef.current && !o.inline && r.sceneIdx === postQuizRef.current.idx && t.who !== 'taeo') {
      postQuizRef.current = null;
      setPostQuiz(null);
    } else {
      pickedRef.current = 0;
      setPicked(0);
    }
    if (canFlow()) scheduleNext(r.skipped ? 600 : 900);
  }

  /** 상대 대사 길게 누르기(키 있음) — 같이 말하기. 화당 4회 */
  function openShadow(item: Extract<LogItem, { kind: 'line' }>) {
    if (!rolePlay || item.who === 'taeo' || shadows >= SHADOW_MAX || shadowRef.current) return;
    markInteraction();
    clearTimer();
    token.current++;
    stopSpeaking();
    const idx = Math.max(0, ep.scenes.findIndex((sc) => sc.type === 'line' && sc.en === item.en));
    shadowRef.current = { who: item.who, en: item.en, kr: item.kr, idx };
    setShadowOf(shadowRef.current);
  }

  function toggleAuto() {
    const next = !auto;
    store(AUTO_KEY, next);
    setAuto(next);
    autoRef.current = next;
    if (!next) {
      clearTimer();
      token.current++;
      return;
    }
    if (canFlow()) scheduleNext(600);
  }

  const role = roleOf(i);
  // M4 Four Strands — 지금 시간이 어느 갈래로 쌓이나(역할극 output · 섀도잉/입모양 shadow · 회상 output · 나머지 듣기 input)
  const strandNow = shadowOf || postQuiz ? 'shadow' : role ? (role.mode === 'role' ? 'output' : 'shadow') : scene?.type === 'recall' && picked === null ? 'output' : 'input';
  useEffect(() => {
    setStrand(strandNow);
  }, [strandNow]);
  const isAct = !!scene && (INTERACTIVE.has(scene.type) || scene.type === 'recall' || !!role);
  const pct = Math.round((i / total) * 100);
  const roleRate = speed * SPEED_BASE;
  const skipPolicy = { keyless, returning: !!dayState?.returning, quiet };
  const canLongPress = rolePlay && path === 'whisper' && shadows < SHADOW_MAX && !shadowOf;

  return (
    <div className="screen dr-screen">
      <TtsDegradedChip />
      <div className="dr-top">
        <div className="dr-prog" role="progressbar" aria-label="에피소드 진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <button type="button" className="mini-btn dr-exit" onClick={onExit} aria-label={practice ? '다시 풀기 그만하기' : review ? '복습 그만하기' : '나가기 — 다음에 이어서 볼 수 있어요'}>
          ✕
        </button>
        <span className="dr-top-gap" aria-hidden="true" />
        <button type="button" className="mini-btn dr-auto" onClick={toggleAuto} aria-pressed={auto} aria-label="자동 재생">
          {auto ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          onClick={() => {
            store(SUBS_KEY, !subs);
            setSubs((v) => !v);
          }}
          aria-pressed={subs}
          className={`mini-btn${subs ? ' active' : ''}`}
        >
          자막
        </button>
        <button
          type="button"
          onClick={() => setSpeedOpen((o) => !o)}
          aria-expanded={speedOpen}
          aria-controls="dr-speed-row"
          aria-label={`재생 속도 ${speedLabel(speed)}`}
          className={`mini-btn dr-speed-btn${speed !== 1 ? ' active' : ''}`}
        >
          {speed < 1 ? '🐢 ' : speed > 1 ? '⚡ ' : ''}
          {speedLabel(speed)}
        </button>
        <button
          type="button"
          className="mini-btn"
          onClick={() => {
            const m = !mute;
            store(MUTE_KEY, m);
            setMute(m);
            muteRef.current = m;
            stopSpeaking();
            // 끊긴 대사 때문에 멈춰 있지 않게 — 읽을 시간만 주고 이어서
            if (canFlow()) scheduleNext(1500);
          }}
          aria-pressed={mute}
          aria-label="소리 끔"
        >
          {mute ? '🔇' : '🔊'}
        </button>
        {speedOpen && (
          <div id="dr-speed-row" className="dr-speed-row" role="radiogroup" aria-label="재생 속도">
            {DRAMA_SPEEDS.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={speed === v}
                className={`mini-btn${speed === v ? ' active' : ''}`}
                onClick={() => {
                  store(SPEED_KEY, v);
                  setSpeed(v);
                  speedRef.current = v;
                  setSpeedOpen(false);
                }}
              >
                {speedLabel(v)}
              </button>
            ))}
            <span className="dr-speed-hint">다음 대사부터 적용돼요</span>
          </div>
        )}
      </div>
      <DayBudgetBar />
      <div className="dr-ep">
        {review ? '표현 복습' : practice ? `EP ${ep.no} · 틀린 장면 다시 풀기` : `EP ${ep.no} · ${ep.titleKr}`}
      </div>

      <div className="dr-log" aria-live="polite" ref={logBoxRef}>
        {log.map((it, k) => (
          <Bubble
            key={k}
            item={it}
            subs={subs}
            onReplay={replay}
            onLongPress={canLongPress && it.kind === 'line' && it.who !== 'taeo' ? openShadow : undefined}
            mark={canLongPress && it.kind === 'line' && mineEns.has(it.en) ? '👄' : undefined}
          />
        ))}

        {scene?.type === 'recall' && picked === null && recallByStep(scene) && (
          <RecallStep
            key={`rc-${i}`}
            item={scene}
            review={!!review}
            rate={roleRate}
            mute={mute}
            onGraded={() => {
              gradedAt.current = iRef.current;
            }}
            onDone={(res) => {
              noteActivity();
              if (res.mode === 'speak') recordTry(res.firstScore >= 60);
              // 표현 복습 세션에선 떠올린 개수가 곧 성적(힌트로 떠올린 것도 '기억'으로 센다)
              if (review) {
                askedRef.current += 1;
                if (res.good) okRef.current += 1;
              }
              pickedRef.current = 0;
              setPicked(0);
              focusAfter.current = true;
              push({ kind: 'note', ok: res.good, text: `${res.good ? (res.hinted ? '힌트로 떠올렸어요 — ' : '기억하고 있네요! ') : '다시 볼게요 — '}“${scene.en}” = ${scene.kr}` });
              if (canFlow()) scheduleNext(900);
            }}
          />
        )}
        {scene?.type === 'recall' && picked === null && !recallByStep(scene) && (
          <div className="dr-act">
            <div className="dr-ask">🧠 지난 화: “{scene.kr}” — 영어로는?</div>
            {order.map((k) => (
              <button
                key={k}
                type="button"
                className="wd-opt dr-opt"
                onClick={() => {
                  const good = k === scene.a;
                  gradeRecall(scene.en, good);
                  haptic(good ? 'success' : 'error');
                  // 표현 복습 세션에선 떠올린 개수가 곧 성적
                  if (review) {
                    askedRef.current += 1;
                    if (good) okRef.current += 1;
                  }
                  afterAnswer(k, good, [{ kind: 'note', ok: good, text: `${good ? '기억하고 있네요! ' : '다시 볼게요 — '}“${scene.en}” = ${scene.kr}` }], [scene.en]);
                }}
              >
                {scene.opts[k]}
              </button>
            ))}
          </div>
        )}

        {scene?.type === 'choice' && picked === null && (
          <div className="dr-act">
            <div className="dr-ask">💬 {scene.prompt}</div>
            {order.map((k) => {
              const o = scene.opts[k];
              return (
                <button
                  key={k}
                  type="button"
                  className="wd-opt dr-opt"
                  onClick={() => {
                    grade(o.ok, scene);
                    const right = scene.opts.find((x) => x.ok)!;
                    const items: LogItem[] = [];
                    if (!o.ok && o.why) items.push({ kind: 'note', ok: false, text: `“${o.en}” — ${o.why}` });
                    items.push({ kind: 'line', who: 'taeo', en: right.en, kr: right.kr || '' });
                    if (right.reply) items.push({ kind: 'line', who: right.reply.who, en: right.reply.en, kr: right.reply.kr });
                    afterAnswer(k, o.ok, items, right.reply ? [right.en, { en: right.reply.en, who: right.reply.who }] : [right.en]);
                  }}
                >
                  {o.en}
                </button>
              );
            })}
          </div>
        )}

        {scene?.type === 'meaning' && picked === null && (
          <div className="dr-act">
            <Bubble item={{ kind: 'line', who: scene.who, en: scene.en, kr: '' }} subs={false} onReplay={replay} />
            <div className="dr-ask">🤔 무슨 뜻일까요?</div>
            {order.map((k) => (
              <button
                key={k}
                type="button"
                className="wd-opt dr-opt"
                onClick={() => {
                  const good = k === scene.a;
                  grade(good, scene);
                  // 답한 뒤에도 대사와 해설이 기록에 남는다
                  afterAnswer(
                    k,
                    good,
                    [
                      { kind: 'line', who: scene.who, en: scene.en, kr: scene.opts[scene.a] },
                      { kind: 'note', ok: good, text: `${good ? '맞아요 — ' : `정답은 “${scene.opts[scene.a]}” — `}${scene.why}` },
                    ],
                    []
                  );
                }}
              >
                {scene.opts[k]}
              </button>
            ))}
          </div>
        )}

        {scene?.type === 'fill' && picked === null && (
          <div className="dr-act">
            <div className="dr-ask">✏️ 빈칸에 들어갈 말은?</div>
            <div className="dr-fill">
              {scene.before} <b className="dr-blank">____</b> {scene.after}
              {subs && <span className="dr-kr">{scene.kr}</span>}
            </div>
            <div className="dr-fill-opts">
              {order.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="wd-opt dr-opt dr-chip"
                  onClick={() => {
                    const good = k === scene.a;
                    grade(good, scene);
                    const full = fillFull(scene);
                    afterAnswer(
                      k,
                      good,
                      [
                        { kind: 'line', who: scene.who, en: full, kr: scene.kr },
                        { kind: 'note', ok: good, text: `${good ? '맞아요 — ' : `정답은 “${scene.opts[scene.a]}” — `}${scene.why}` },
                      ],
                      [{ en: full, who: scene.who }]
                    );
                  }}
                >
                  {scene.opts[k]}
                </button>
              ))}
            </div>
          </div>
        )}

        {role && picked === null && (
          <RoleStep
            key={`${i}-${role.mode}`}
            scene={{ idx: role.t.idx, who: role.t.who, en: role.t.en, kr: role.t.kr }}
            epNo={ep.no}
            mode={role.mode}
            recall={scene?.type === 'recallInline'}
            buildupMinWords={adaptLive ? dayState?.buildupMinWords ?? ADAPT_BUILDUP_MIN_WORDS : undefined}
            maxSkips={rolePlay ? SKIP_MAX : Infinity}
            skipsUsed={skips}
            skipPolicy={skipPolicy}
            rate={roleRate}
            speed={speed}
            mute={mute}
            onSlowHint={() => {
              store(SPEED_KEY, 0.75);
              setSpeed(0.75);
              speedRef.current = 0.75;
            }}
            onDone={(r) => onRoleDone(r, role.t, { counts: true, inline: scene?.type === 'recallInline' })}
          />
        )}
        {postQuiz && picked !== null && !role && (
          <RoleStep
            key={`pq-${i}`}
            scene={{ idx: postQuiz.idx, who: postQuiz.who, en: postQuiz.en, kr: postQuiz.kr }}
            epNo={ep.no}
            mode="shadow"
            maxSkips={Infinity}
            skipsUsed={skips}
            skipPolicy={skipPolicy}
            rate={roleRate}
            speed={speed}
            mute={mute}
            onDone={(r) => onRoleDone(r, postQuiz, { counts: true, noLine: true })}
          />
        )}
        {shadowOf && (
          <RoleStep
            key={`sh-${shadowOf.idx}-${shadows}`}
            scene={shadowOf}
            epNo={ep.no}
            mode="shadow"
            maxSkips={Infinity}
            skipsUsed={0}
            skipPolicy={skipPolicy}
            rate={roleRate}
            speed={speed}
            mute={mute}
            onDone={(r) => onRoleDone(r, shadowOf, { counts: mineEns.has(shadowOf.en), optIn: true })}
          />
        )}
        {/* 끝 표시 겸 여백 — 아래 고정 바(다음·자동 재생) 높이만큼 비워 마지막 대사가 바 뒤에 숨지 않게 */}
        <div ref={endRef} className="dr-anchor" aria-hidden="true" />
      </div>
      {newBelow && (
        <button type="button" className="dr-newbelow" onClick={toBottom}>
          새 대사 ↓
        </button>
      )}

      {(!isAct || picked !== null) &&
        !shadowOf &&
        !postQuiz &&
        (auto ? (
          <button type="button" className="dr-playing" onClick={toggleAuto} aria-label="자동 재생 멈추기">
            <span className="dr-eq" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            자동 재생 중 · 탭하면 멈춤
          </button>
        ) : (
          <button type="button" className="dr-next" onClick={advance}>
            {i + 1 >= total ? '엔딩 보기' : '다음 ▶'}
          </button>
        ))}
    </div>
  );
}

/** 생성 원고가 화면을 죽이면 — 그 원고를 버리고 허브로(시리즈가 영구히 막히지 않게) */
/** 마운트되면 포커스를 받는 제목 — 화면이 바뀔 때 키보드·스크린리더 위치를 잃지 않게 */
function FocusTitle({ children, className = 'dr-end-title' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h2 className={className} ref={ref} tabIndex={-1}>
      {children}
    </h2>
  );
}

class PlayerGuard extends Component<{ ep: Episode; onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // 이어 보기 기록이 원인일 수 있다 — 지워야 같은 크래시가 반복되지 않는다
    clearResume();
    if (this.props.ep.ai) discardGenerated(this.props.ep.no);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="screen dr-screen">
          <div className="study-card dr-end" role="alert">
            <FocusTitle>이 화를 재생하지 못했어요</FocusTitle>
            <p className="muted">{this.props.ep.ai ? '원고에 문제가 있어 버렸어요. 다시 열면 작가가 새로 써요.' : '저장된 진행 기록에 문제가 있어 지웠어요. 다시 열면 처음부터 볼 수 있어요.'}</p>
            <button type="button" className="btn primary dr-go" onClick={this.props.onFail}>
              에피소드 목록으로
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Ending({
  ep,
  result,
  levelChange,
  retried,
  binge,
  hasKey,
  onNext,
  onRetry,
  onHub,
  onNavigate,
  ladder,
  onLadderNext,
  day,
}: {
  ep: Episode;
  result: PlayResult;
  levelChange: -1 | 0 | 1;
  /** 방금 '틀린 장면 다시 풀기'를 마쳤다면 그 결과 */
  retried: { ok: number; total: number } | null;
  binge: boolean;
  hasKey: boolean;
  onNext: () => void;
  onRetry: () => void;
  onHub: () => void;
  onNavigate?: (m: Mode) => void;
  /** 속도 사다리로 본 재청취의 결과(M3) */
  ladder?: { plan: LadderPlan; speed: number } | null;
  onLadderNext?: (speed: number) => void;
  /** 하루 상태(M4) — 엔딩 카드(ctx.day)·'오늘은 여기까지' 안내 */
  day?: DayState;
}) {
  const say = (en: string) => {
    stopSpeaking();
    speakText(en, 'en-US', 0.95);
  };
  const nextNo = nextEpisodeNo() > ep.no ? nextEpisodeNo() : ep.no + 1;
  const [nextReady, setNextReady] = useState(() => !!episodeByNo(nextNo));
  const [writing, setWriting] = useState(false);
  useEffect(() => {
    // 다음 화 미리 쓰기 — 내일 열 때 기다림 없이 바로 재생되게(키가 있고 AI 화일 때만)
    if (nextReady || !hasKey) return;
    let alive = true;
    const p = prefetchEpisode(nextNo);
    if (!p) return;
    setWriting(true);
    void p.then((ok) => {
      if (!alive) return;
      setWriting(false);
      setNextReady(ok);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const canNext = nextReady || hasKey;
  const low = result.score < 70;
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    // 키보드·스크린리더 포커스를 엔딩 제목으로(예전엔 BODY로 사라졌다)
    titleRef.current?.focus({ preventScroll: true });
  }, []);
  const streak = calcStreak();
  // 레벨 진척 — 다음 레벨 듣기 입증이 몇 번 쌓였나(드라마만 해도 레벨이 움직인다는 걸 보여 준다)
  const growth = useMemo(() => {
    try {
      const o = overall();
      if (o.level === 'C2') return null;
      const n = evidenceLog().filter((e) => e.skill === 'listening' && e.level === o.next && e.counts && e.score >= PASS_SCORE).length;
      return { next: o.next, n: Math.min(n, PASSES_NEEDED) };
    } catch {
      return null;
    }
  }, []);
  const canRetry = result.retry.length > 0 && !retried;
  const nextEpInfo = episodeByNo(nextNo);
  const endingCtx = useMemo(
    () => ({
      ep,
      dateKey: todayKey(),
      keyless: !whisperAvailable() && !browserSttAvailable(),
      speak: result.speakStats,
      // M3 회상 카드 — 엔딩 직전 재소환·첫머리 회상과 같은 문장은 다시 묻지 않는다
      inlineEns: result.inlineEns || [],
      recallEns: result.recallEns || [],
      // M4 하루 상태 — EndingExtras가 hideMore('조금 더 ▾' 숨김)·quiet(리텔·오늘 질문 숨김)를 본다
      day,
    }),
    [ep, result.speakStats, result.inlineEns, result.recallEns, day]
  );
  const dayNote = useMemo(() => (day && !retried ? endingNote(day) : null), [day, retried]);
  const nextIsAi = !nextEpInfo || !!nextEpInfo.ai;
  return (
    <div className="screen dr-screen">
      <div className="study-card dr-end">
        <div className="dr-end-ep">EP {ep.no} 완료</div>
        <h2 className="dr-end-title" ref={titleRef} tabIndex={-1}>
          {ep.titleKr}
        </h2>
        <div className="dr-end-score">이해도 {result.score}%</div>
        {ladder && (
          <div className={`rc-ladder${ladder.plan.done ? ' done' : ''}`} role="status">
            <div className="rc-ladder-steps" aria-label="속도 사다리">
              {[0.9, 1, 1.2].map((v, k) => (
                <span key={v} className={`rc-ladder-step${k < ladder.plan.step ? ' ok' : ''}`}>
                  {v.toFixed(1)}×{k < ladder.plan.step ? ' ✓' : ''}
                </span>
              ))}
            </div>
            {ladder.plan.done ? (
              <p className="rc-ladder-msg">👂 귀 뚫림 ✓ — 세 빠르기 모두 자막 없이 통과했어요</p>
            ) : ladder.plan.speed !== ladder.speed ? (
              <>
                <p className="rc-ladder-msg">{ladder.speed.toFixed(1)}× 통과! 다음은 {ladder.plan.speed.toFixed(1)}×</p>
                {onLadderNext && (
                  <button type="button" className="btn primary dr-go rc-ladder-next" onClick={() => onLadderNext(ladder.plan.speed)}>
                    🎧 {ladder.plan.speed.toFixed(1)}×로 다시 듣기
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="rc-ladder-msg">이해도 60% 이상이면 다음 빠르기로 올라가요</p>
                {onLadderNext && (
                  <button type="button" className="btn ghost dr-go rc-ladder-next" onClick={() => onLadderNext(ladder.speed)}>
                    🎧 {ladder.speed.toFixed(1)}×로 한 번 더
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {!retried && streak > 0 && <p className="dr-flame">🔥 오늘 불꽃이 켜졌어요 · 연속 {streak}일</p>}
        {!retried && growth && (
          <p className="dr-msg">
            🎯 듣기 {growth.next} 입증 {growth.n}/{PASSES_NEEDED} — 드라마의 {growth.next} 문항을 맞히면 쌓여요
          </p>
        )}
        {!retried && result.speakStats && (
          <p className="dr-speak-sum" role="status">
            🎙 발화 {result.speakStats.spoken} · 통과 {result.speakStats.passed}
            {!!result.speakStats.self && ` · 스스로 확인 ${result.speakStats.self}`}
            {result.speakStats.skipped > 0 && ` · 넘어감 ${result.speakStats.skipped}`}
          </p>
        )}
        {/* M4 하루 조절 — 캡·적응·복귀·짧은 날·조용히면 첫 카드로 '오늘은 여기까지' */}
        {dayNote && (
          <p className={`dg-stop${dayNote.kind === 'cap' || dayNote.kind === 'adapt' ? ' strong' : ''}`} data-kind={dayNote.kind} role="status">
            🌙 {dayNote.text}
          </p>
        )}
        {/* 엔딩 추가 카드(M2 레지스트리) — 이해도 아래. M3 회상·M5 리텔·M7/M9 소리 카드·M10/M11 조건부 카드가 등록한다 */}
        {!retried && <EndingExtras ctx={endingCtx} />}
        {retried && (
          <p className="dr-msg" role="status">
            다시 풀기 {retried.ok}/{retried.total} — {retried.ok === retried.total ? '이제 다 맞혔어요! 👏' : '틀린 문장은 복습 카드에 남겨 뒀어요.'}
          </p>
        )}
        {levelChange === -1 && (
          <p className="dr-msg">
            이번 화들이 조금 어려웠죠? {nextIsAi ? '다음 AI 화부터는 한 단계 쉬운 영어로 써 드릴게요. ' : ''}자막을 켜 두고 속도를 0.75×로 낮춰 들어도 좋아요.
          </p>
        )}
        {levelChange === 1 && <p className="dr-msg">이해도가 아주 좋아요! {nextIsAi ? '다음 AI 화부터 한 단계 어려운 영어로 써 드릴게요.' : '이대로 쭉 가요.'}</p>}
        {canRetry && (
          <button type="button" className={`btn ${low ? 'primary' : 'ghost'} dr-go`} onClick={onRetry}>
            틀린 장면 다시 풀기 ({result.missed.length})
          </button>
        )}
        <div className="dr-sec">오늘의 표현 — 내일 다음 화 첫머리에 다시 물어볼게요</div>
        {ep.learn.map((l, k) => (
          <button key={k} type="button" className="dr-learn" onClick={() => say(l.en)}>
            <b>🔊 {l.en}</b>
            <span>{l.kr}</span>
            {l.note && <em>{l.note}</em>}
          </button>
        ))}
        {result.missed.length > 0 && (
          <>
            <div className="dr-sec">틀린 문장 — 복습 카드에 담았어요</div>
            {result.missed.map((m, k) => (
              <button key={k} type="button" className="dr-learn dr-missed" onClick={() => say(m.en)}>
                <b>🔊 {m.en}</b>
                <span>{m.kr}</span>
              </button>
            ))}
          </>
        )}
      </div>
      <div className="study-card dr-cliff">
        <div className="dr-sec">다음 화 예고</div>
        <p>{ep.cliff}</p>
        {/* 하루 한 편 — 기본 행동은 '오늘은 여기까지', 더 보기는 보조 */}
        <button type="button" className={`btn ${canRetry && low ? 'ghost' : 'primary'} dr-go`} onClick={onHub}>
          {binge ? '오늘은 충분해요 — 내일 이어서' : '오늘은 여기까지 — 내일 이어서'}
        </button>
        {writing && <p className="dr-msg">✍️ 작가가 다음 화를 미리 쓰는 중이에요 — 내일은 바로 볼 수 있어요.</p>}
        {!writing && nextReady && ep.no >= 7 && <p className="dr-msg">✓ 다음 화가 준비됐어요.</p>}
        {canNext ? (
          <button type="button" className="btn ghost dr-go" onClick={onNext}>
            보너스로 다음 화 보기 (내일 볼 화가 줄어요)
          </button>
        ) : (
          <>
            <p className="dr-msg">다음 화부터는 AI 작가가 이어서 써요 — AI를 연결하면 볼 수 있어요.</p>
            {onNavigate && (
              <button type="button" className="btn ghost dr-go" onClick={() => onNavigate('apikey')}>
                AI 연결하기
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type View = 'hub' | 'loading' | 'resume' | 'play' | 'retry' | 'end' | 'review' | 'reviewEnd';

export default function DramaScreen({ onNavigate }: { onNavigate?: (m: Mode) => void } = {}) {
  const [view, setViewRaw] = useState<View>('hub');
  const [ep, setEp] = useState<Episode | null>(null);
  /** 이어 보기 — 고를 때까지 대기 중인 저장본, 고른 뒤 플레이어에 넘길 저장본 */
  const [pending, setPending] = useState<ResumeState | null>(null);
  const [resume, setResume] = useState<ResumeState | null>(null);
  const [result, setResult] = useState<PlayResult>({ score: 0, asked: 0, ok: 0, missed: [], retry: [], byLevel: {} });
  /** 표현 복습 세션 문항과 결과 */
  const [reviewSet, setReviewSet] = useState<RecallItem[] | null>(null);
  const [reviewRes, setReviewRes] = useState<{ ok: number; total: number } | null>(null);
  /** 본 화를 '자막 없이 다시 듣기'로 여는 중인가 */
  const [subsOffPlay, setSubsOffPlay] = useState(false);
  /** 이 재생의 시작 속도·사다리 여부(M3 속도 사다리) */
  const [playOpts, setPlayOpts] = useState<{ speed?: number; ladder?: boolean }>({});
  const [ladderRes, setLadderRes] = useState<{ plan: LadderPlan; speed: number } | null>(null);
  const [levelChange, setLevelChange] = useState<-1 | 0 | 1>(0);
  const [retried, setRetried] = useState<{ ok: number; total: number } | null>(null);
  const [binge, setBinge] = useState(false);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const [writing, setWriting] = useState(false);
  /** 하루 상태(M4) — 화면이 바뀔 때마다 다시 읽는다(모드·적응·캡) */
  const [day, setDay] = useState<DayState>(() => readDayState());
  const eps = useMemo(() => allEpisodes(), [tick]);
  const seen = useMemo(() => new Set(watched()), [tick]);
  const nextNo = useMemo(() => nextEpisodeNo(), [tick]);
  const plan = useMemo(() => dramaPlan(), [tick]);
  const loadingNo = useRef(nextNo);
  const viewRef = useRef(view);
  viewRef.current = view;
  // 재생 중 표시 — '새 버전' 배너를 엔딩까지 미룬다
  useEffect(() => {
    setDramaPlaying(view === 'play' || view === 'retry' || view === 'review');
  }, [view]);
  useEffect(() => () => setDramaPlaying(false), []);
  // M4 시간 측정 — 재생 중 + 엔딩 화면(조금 더 카드·회상·리텔도 오늘 시간). 측정 규칙은 dayGovernor 한 곳
  useEffect(() => {
    startDayTracking();
    setDaySession(view === 'end');
    setDay(readDayState());
  }, [view]);
  useEffect(() => () => setDaySession(false), []);
  // 발화 목표(M3) — 하루가 바뀌었으면 연속일·가산을 정산해 저장(홈은 저장값만 읽는다)
  useEffect(() => {
    try {
      speakGoal();
    } catch {
      /* 저장소 오류는 화면을 막지 않는다 */
    }
  }, [view]);

  /**
   * 화면 전환 + 브라우저 기록 — 휴대폰 '뒤로'가 앱을 닫지 않고 재생 → 목록으로 한 단계 돌아가게.
   * 목록이 아닌 화면(재생·엔딩 등)은 기록 한 칸(sub)을 쓰고, 목록으로 갈 땐 그 칸을 되돌린다.
   */
  function setView(v: View) {
    viewRef.current = v;
    setViewRaw(v);
    try {
      const st = (window.history.state || {}) as { sub?: string };
      if (v === 'hub') {
        if (st.sub) window.history.back();
      } else if (st.sub) window.history.replaceState({ ...st, mode: 'drama', sub: v }, '');
      else window.history.pushState({ ...st, mode: 'drama', sub: v }, '');
    } catch {
      /* 기록 API가 없는 환경 */
    }
  }
  useEffect(() => {
    const on = (e: Event) => {
      const st = ((e as CustomEvent).detail || {}) as { sub?: string };
      if (!st.sub && viewRef.current !== 'hub') {
        stopSpeaking();
        viewRef.current = 'hub';
        setViewRaw('hub');
        setTick((t) => t + 1);
      }
    };
    window.addEventListener(BACK_EVENT, on);
    return () => window.removeEventListener(BACK_EVENT, on);
  }, []);

  /** 표현 복습 — 기한이 된 드라마 표현만(새 화가 없는 날에도 매일) */
  function startReview() {
    primeAudio();
    setErr('');
    // M3: 말로 떠올리기(플래그 off면 예전 고르기)
    // M4: 복귀 첫날 6 · 짧은 날·적응 3 · 보통 8, 조용히 모드는 고르기
    const d = readDayState();
    const items = reviewItems(d.dueMax, isOn('speakRecall') ? { mode: d.quiet ? 'choice' : 'speak' } : {});
    if (!items.length) {
      setErr('지금 떠올릴 표현이 없어요 — 배운 표현은 하루 뒤부터 복습에 나와요.');
      setView('hub');
      return;
    }
    setReviewSet(items);
    setView('review');
  }

  async function open(no: number, o: { subsOff?: boolean; speed?: number; ladder?: boolean } = {}) {
    primeAudio(); // 탭(제스처) 안에서 오디오 언락 — iOS 첫 대사 무음 방지
    setErr('');
    setRetried(null);
    setSubsOffPlay(!!o.subsOff);
    setPlayOpts({ speed: o.speed, ladder: !!o.ladder && typeof o.speed === 'number' });
    setLadderRes(null);
    const have = episodeByNo(no);
    if (have) {
      setEp(have);
      const r = loadResume(no);
      if (r) {
        // 지난번에 보다 만 화 — 이어서 볼지 처음부터 볼지 고르게
        setPending(r);
        setView('resume');
        return;
      }
      setResume(null);
      setView('play');
      return;
    }
    if (!groqKey()) {
      setErr('NO_KEY');
      setView('hub');
      return;
    }
    loadingNo.current = no;
    setView('loading');
    viewRef.current = 'loading';
    // 같은 화를 이미 쓰는 중이면(미리 쓰기·연타) 그 요청을 함께 기다린다 — 중복 호출 없음
    const made = await generateEpisode(no).catch(() => null);
    setTick((t) => t + 1);
    // '나중에 볼게요'로 나갔다면 원고만 저장해 두고 화면은 그대로
    if (viewRef.current !== 'loading' || loadingNo.current !== no) return;
    if (!made) {
      setErr('작가가 원고를 완성하지 못했어요(연결 오류나 사용량 한도일 수 있어요). 잠시 후 다시 눌러 주세요.');
      setView('hub');
      return;
    }
    setEp(made);
    setResume(null);
    setView('play');
  }

  useEffect(() => {
    // 홈의 '오늘의 에피소드'에서 들어오면 허브를 건너뛰고 바로 재생
    const t = load<number>(DRAMA_AUTOPLAY_KEY, 0);
    if (t && Date.now() - t < 60_000) {
      store(DRAMA_AUTOPLAY_KEY, 0);
      void open(nextEpisodeNo());
      return;
    }
    // 홈·진도의 '표현 복습'·'자막 없이 다시 듣기'
    const req = load<(DramaRequest & { at?: number }) | null>(DRAMA_REQ_KEY, null);
    if (req && typeof req.at === 'number' && Date.now() - req.at < 60_000) {
      store(DRAMA_REQ_KEY, null);
      if (req.kind === 'review') {
        startReview();
        return;
      }
      if (req.kind === 'replay' && typeof req.no === 'number') {
        void open(req.no, { subsOff: !!req.subsOff, speed: typeof req.speed === 'number' ? req.speed : undefined, ladder: !!req.ladder });
        return;
      }
    }
    // 허브에서 다음 AI 화를 미리 써 두기(누를 때 기다림을 줄인다) — 다 쓰면 목록에 바로 보이게
    const p = prefetchEpisode(nextEpisodeNo());
    if (p) {
      setWriting(true);
      void p.then(() => {
        setWriting(false);
        setTick((t) => t + 1);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (view === 'review' && reviewSet) {
    const stub: Episode = { no: 100000, level: 'A2', title: 'Review', titleKr: '표현 복습', recap: '', scenes: [], learn: [], cliff: '' };
    return (
      <PlayerGuard key="review" ep={stub} onFail={() => setView('hub')}>
        <Player
          ep={stub}
          review={reviewSet}
          dayState={playerDay(day)}
          onExit={() => {
            stopSpeaking();
            setView('hub');
          }}
          onEnd={(r) => {
            if (r.asked > 0) markDramaPracticeToday(); // 복습도 오늘의 연습(불꽃·퀘스트)
            if (day.quiet) markQuietDone();
            setReviewRes({ ok: r.ok, total: r.asked });
            setTick((t) => t + 1);
            setView('reviewEnd');
          }}
        />
      </PlayerGuard>
    );
  }
  if (view === 'reviewEnd' && reviewRes) {
    const streak = calcStreak();
    return (
      <div className="screen dr-screen">
        <div className="study-card dr-end">
          <div className="dr-end-ep">표현 복습 완료</div>
          <h2 className="dr-end-title">
            {reviewRes.total}개 중 {reviewRes.ok}개 기억했어요
          </h2>
          <p className="muted">맞힌 표현은 더 긴 간격으로, 헷갈린 표현은 내일 다시 물어볼게요.</p>
          {streak > 0 && <p className="dr-flame">🔥 오늘 불꽃이 켜졌어요 · 연속 {streak}일</p>}
          <button type="button" className="btn primary dr-go" onClick={() => setView('hub')}>
            에피소드 목록으로
          </button>
          {onNavigate && (
            <button type="button" className="btn ghost dr-go" onClick={() => onNavigate('master')}>
              홈으로
            </button>
          )}
        </div>
      </div>
    );
  }
  if (view === 'resume' && ep && pending) {
    const pct = Math.round((pending.i / Math.max(1, ep.scenes.length + (pending.rc.length ? pending.rc.length + 2 : 0))) * 100);
    return (
      <div className="screen dr-screen">
        <div className="study-card dr-end">
          <div className="dr-end-ep">EP {ep.no} · {ep.titleKr}</div>
          <FocusTitle>지난번에 {pct}%까지 봤어요</FocusTitle>
          <button
            type="button"
            className="btn primary dr-go"
            onClick={() => {
              setResume(pending);
              setPending(null);
              setView('play');
            }}
          >
            이어서 보기
          </button>
          <button
            type="button"
            className="btn ghost dr-go"
            onClick={() => {
              clearResume();
              setResume(null);
              setPending(null);
              setView('play');
            }}
          >
            처음부터 보기
          </button>
        </div>
      </div>
    );
  }
  if (view === 'loading') {
    return (
      <div className="screen dr-screen">
        <div className="study-card gm-loading" role="status">
          <div className="gm-loading-dot" aria-hidden="true" />
          <b>EP {loadingNo.current}</b>
          <span className="muted">작가가 다음 이야기를 쓰는 중… (보통 10~30초)</span>
          <button type="button" className="btn ghost" onClick={() => setView('hub')}>
            나중에 볼게요
          </button>
        </div>
      </div>
    );
  }
  if ((view === 'play' || view === 'retry') && ep) {
    const practice = view === 'retry';
    return (
      <PlayerGuard
        key={`${ep.no}-${view}`}
        ep={ep}
        onFail={() => {
          setTick((t) => t + 1);
          setView('hub');
        }}
      >
        <Player
          ep={practice ? { ...ep, scenes: result.retry } : ep}
          practice={practice}
          resume={practice ? null : resume}
          subsOff={!practice && subsOffPlay}
          speedOverride={practice ? undefined : playOpts.speed}
          dayState={playerDay(day)}
          onExit={() => {
            stopSpeaking();
            setTick((t) => t + 1);
            setView(practice ? 'end' : 'hub');
          }}
          onEnd={(r) => {
            if (practice) {
              setRetried({ ok: r.ok, total: r.asked });
              setView('end');
              return;
            }
            // 오늘 이미 다른 화를 봤다면 몰아보기 — 엔딩에서 '내일'을 더 권한다
            setBinge(watchedToday() && !seen.has(ep.no));
            // 기록이 쌓이기 시작하면 브라우저에 '지우지 말아 달라'고 한 번 요청(저장 공간 압박·ITP 대비)
            // (거절됐으면 하루에 한 번만 다시 묻는다 — 일부 브라우저는 물을 때마다 창을 띄운다)
            try {
              const asked = load<number>('va_persist_at', 0);
              if (load<boolean>('va_persisted', false) !== true && Date.now() - asked > 86400000) {
                store('va_persist_at', Date.now());
                void navigator.storage?.persist?.().then((ok) => store('va_persisted', ok)).catch(() => undefined);
              }
            } catch {
              /* 미지원 브라우저 */
            }
            const { levelChange: lc } = completeEpisode(ep, r.score, r.asked, r.missed, r.byLevel, r.speakStats);
            // M4: 사다리 완주도 '상호작용 있던 재생'(input 확정) · 조용히 모드 낮 세션 완료(저녁 보충 안내)
            if (playOpts.ladder) markInteraction();
            if (day.quiet) markQuietDone();
            // 속도 사다리(M3) — 이해도 60% 이상이면 한 단 오른다
            if (playOpts.ladder && typeof playOpts.speed === 'number') setLadderRes({ plan: advanceLadder(ep.no, playOpts.speed, r.score), speed: playOpts.speed });
            // 너무 어려웠으면 다음 화는 자막을 켜 둔다(듣기 발판)
            if (lc === -1) {
              store(SUBS_KEY, true);
              if (load<number>(SPEED_KEY, 1) > 0.75) store(SPEED_KEY, 0.75);
            }
            setLevelChange(lc);
            setResult(r);
            setTick((t) => t + 1);
            setView('end');
          }}
        />
      </PlayerGuard>
    );
  }
  if (view === 'end' && ep) {
    return (
      <Ending
        key={`${ep.no}-${retried ? 'r' : 'e'}`}
        ep={ep}
        result={result}
        levelChange={levelChange}
        retried={retried}
        binge={binge}
        hasKey={!!groqKey()}
        onNext={() => void open(nextEpisodeNo() > ep.no ? nextEpisodeNo() : ep.no + 1)}
        onRetry={() => setView('retry')}
        onHub={() => setView('hub')}
        onNavigate={onNavigate}
        ladder={retried ? null : ladderRes}
        onLadderNext={(sp) => void open(ep.no, { subsOff: true, speed: sp, ladder: true })}
        day={day}
      />
    );
  }

  const nextEp = episodeByNo(nextNo);
  const noKeyWall = err === 'NO_KEY' && !plan.needAi;
  return (
    <div className="screen dr-screen">
      <div className="study-card dr-hero" data-tilt>
        <div className="pg-kicker">드라마로 배우는 영어</div>
        <h2 className="dr-hero-title">{SERIES}</h2>
        <p className="muted">{SERIES_KR} — 하루 한 편, 5분</p>
        <div className="dr-cast">
          {CAST.map((c) => (
            <span key={c.id} className="dr-cast-item" title={c.desc}>
              <span className="dr-cast-ic">{c.icon}</span>
              {c.name}
            </span>
          ))}
        </div>
        {/* 오늘 무엇을 할까 — 오늘 봤거나(하루 한 편) 키 없이 다 봤으면 복습이 먼저, 다음 화는 보조 */}
        {plan.kind === 'speak' ? (
          <button type="button" className="btn primary dr-go" onClick={() => (plan.due > 0 ? startReview() : plan.replayNo && void open(plan.replayNo))}>
            🗣 발화 {Math.floor(plan.spoken)}/{plan.goal} — {plan.due > 0 ? `표현 ${plan.due}개 말로 떠올리기` : `EP ${plan.replayNo} 역할극 다시`}
          </button>
        ) : plan.kind === 'ladder' && plan.ladder ? (
          <button type="button" className="btn primary dr-go" onClick={() => void open(plan.ladder!.no, { subsOff: true, speed: plan.ladder!.speed, ladder: true })}>
            🎧 EP {plan.ladder.no} {plan.ladder.speed.toFixed(1)}×로 다시 듣기
          </button>
        ) : plan.kind === 'review' ? (
          <button type="button" className="btn primary dr-go" onClick={startReview}>
            🧠 오늘의 복습 — 표현 {plan.due}개 떠올리기
          </button>
        ) : plan.kind === 'replay' && plan.replayNo ? (
          <button type="button" className="btn primary dr-go" onClick={() => void open(plan.replayNo!, { subsOff: true })}>
            🎧 EP {plan.replayNo} 자막 없이 다시 듣기
          </button>
        ) : (
          <button type="button" className="btn primary dr-go" onClick={() => void open(nextNo)}>
            EP {nextNo} 보기{nextEp ? ` · ${nextEp.titleKr}` : ' · 새 에피소드'}
          </button>
        )}
        {(plan.kind === 'next' || plan.kind === 'ladder') && plan.due > 0 && (
          <button type="button" className="btn ghost dr-go" onClick={startReview}>
            🧠 표현 복습 {plan.due}개
          </button>
        )}
        {plan.kind !== 'next' &&
          (plan.needAi ? (
            onNavigate && (
              <button type="button" className="btn ghost dr-go" onClick={() => onNavigate('apikey')}>
                AI 연결하고 EP {nextNo} 보기
              </button>
            )
          ) : (
            <button type="button" className="btn ghost dr-go" onClick={() => void open(nextNo)}>
              보너스로 EP {nextNo} 먼저 보기 (내일 볼 화가 줄어요)
            </button>
          ))}
        {!nextEp && (writing || isGenerating(nextNo)) && (
          <p className="dr-msg" role="status">
            ✍️ 작가가 EP {nextNo}를 쓰는 중이에요.
          </p>
        )}
        <p className="dr-tip">재생 중 위쪽 속도 버튼(1×)으로 0.6×~1.2× 조절, 말풍선을 누르면 다시 듣기(한 번 더 누르면 더 천천히).</p>
        {noKeyWall ? (
          <>
            <p className="dr-msg">EP {nextNo}부터는 AI 작가가 이어서 써요 — AI를 연결하면 볼 수 있어요.</p>
            {onNavigate && (
              <button type="button" className="btn ghost dr-go" onClick={() => onNavigate('apikey')}>
                AI 연결하기
              </button>
            )}
          </>
        ) : (
          err && <p className="dr-msg">{err}</p>
        )}
      </div>
      <div className="pg-sec-h">에피소드</div>
      <ul className="dr-list">
        {eps.map((e) => {
          const sc = episodeScore(e.no);
          return (
            <li key={e.no}>
              <button type="button" className={`gm-unit${seen.has(e.no) ? ' master' : ''}`} onClick={() => void open(e.no)}>
                <span className="gm-unit-n">{e.no}</span>
                <span className="gm-unit-body">
                  <b>{e.titleKr}</b>
                  <span className="muted">{e.title}</span>
                </span>
                <span className="gm-unit-state">{seen.has(e.no) ? `✓ ${sc ?? ''}%` : e.no === nextNo ? '다음' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
