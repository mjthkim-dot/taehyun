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
 */
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Mode } from './NavBar';
import { primeAudio, speakText, stopSpeaking } from './SpeakButton';
import TtsDegradedChip from './TtsDegradedChip';
import { haptic } from '../lib/haptics';
import { addWeakItem, BACK_EVENT, bumpSpoken, calcStreak, gradeWeakItem, groqKey, load, slowRate, store } from '../lib/state';
import { browserSttAvailable, listenOnce } from '../lib/browserStt';
import { DRAMA_REQ_KEY, markDramaPracticeToday, setDramaPlaying, type DramaRequest } from '../lib/homeLite';
import { recordAndTranscribe, whisperAvailable } from '../lib/stt';
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
  reviewItems,
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
  type Scene,
} from '../lib/drama';

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


/** 플레이어가 도는 장면 — 원고 장면 + 첫머리 복습(recall) */
type PScene = Scene | ({ type: 'recall' } & RecallItem);

/** 화면에 쌓이는 대화 기록 한 줄 */
type LogItem = { kind: 'narr'; kr: string } | { kind: 'line'; who: string; en: string; kr: string } | { kind: 'note'; ok: boolean; text: string };

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

function Bubble({ item, subs, onReplay }: { item: LogItem; subs: boolean; onReplay: (en: string, who?: string) => void }) {
  // 자막을 꺼 둔 채 들을 때 — 못 알아들은 말풍선만 눌러서 한국어를 볼 수 있다(듣기 먼저, 뜻은 나중)
  const [reveal, setReveal] = useState(false);
  if (item.kind === 'narr') return <div className="dr-narr">{item.kr}</div>;
  if (item.kind === 'note') return <div className={`dr-note${item.ok ? ' ok' : ''}`}>{item.text}</div>;
  const c = castOf(item.who);
  const me = item.who === 'taeo';
  const showKr = (subs || reveal) && !!item.kr;
  return (
    <div className={`dr-line${me ? ' me' : ''}`}>
      {!me && <span className="dr-av" aria-hidden="true">{c.icon}</span>}
      <button
        type="button"
        className="dr-bub"
        onClick={() => {
          setReveal(true);
          onReplay(item.en, item.who);
        }}
      >
        {/* 접근성 이름 = 보이는 내용 그대로(인물·영어·자막) — 예전엔 aria-label이 자막을 덮어 한국어가 읽히지 않았다 */}
        <span className={me ? 'sr-only' : 'dr-name'}>{c.name}</span>
        <span className="dr-en" lang="en">
          {item.en}
        </span>
        {showKr && <span className="dr-kr">{item.kr}</span>}
        <span className="sr-only">(다시 듣기)</span>
      </button>
      {me && <span className="dr-av" aria-hidden="true">{c.icon}</span>}
    </div>
  );
}

/** 따라 말하기 — 선택(보너스). 문장을 먼저 들려주고, 말하면 얼마나 비슷했는지 알려준다 */
function SpeakStep({ scene, onDone, play }: { scene: Extract<Scene, { type: 'speak' }>; onDone: (said: string | null, match: number) => void; play: (en: string) => void }) {
  const [st, setSt] = useState<'idle' | 'rec' | 'wait' | 'heard'>('idle');
  const [msg, setMsg] = useState('');
  const [heard, setHeard] = useState<{ text: string; m: number } | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);
  // 키가 있으면 Whisper, 없으면 브라우저 내장 받아쓰기, 둘 다 없으면 '말했어요 ✓' 자기 확인
  const useWhisper = whisperAvailable() && !!groqKey();
  const canVoice = useWhisper || browserSttAvailable();

  useEffect(() => {
    // 무엇을 말할지 먼저 들려준다(예전엔 한 번도 소리로 들려주지 않았다)
    play(scene.en);
    return () => {
      cancelled.current = true;
      stop.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function rec() {
    cancelled.current = false;
    stopSpeaking();
    setSt('rec');
    setMsg('');
    try {
      // 받아쓰기 힌트엔 목표 문장을 넣지 않는다 — 넣으면 받아쓰기가 목표 쪽으로 끌려가 일치도가 부풀었다.
      // 고유명사만 알려 준다.
      const text = useWhisper
        ? (
            await recordAndTranscribe({
              prompt: 'Taeo, Maya, Jun, Diane, Mr. Grant, Nimbus.',
              language: 'en',
              silenceMs: 1800,
              maxMs: 15000,
              registerStop: (f) => (stop.current = f),
              onState: (s) => {
                if (s === 'transcribing') setSt('wait');
              },
            })
          ).text
        : await listenOnce({ lang: 'en-US', maxMs: 12000, registerStop: (f) => (stop.current = f) });
      stop.current = null;
      // 녹음 중에 '넘어가기'를 눌렀으면 결과를 버린다(예전엔 그래도 반영돼 대사가 중복됐다)
      if (cancelled.current) return;
      const said = (text || '').trim();
      if (!said) {
        setMsg('소리가 안 잡혔어요. 한 번 더 해볼까요?');
        setSt('idle');
        return;
      }
      bumpSpoken();
      setHeard({ text: said, m: speakMatch(scene.en, said) });
      setSt('heard');
    } catch {
      stop.current = null;
      if (cancelled.current) return;
      setMsg('녹음이나 받아 적기에 실패했어요. 한 번 더 하거나 넘어가도 괜찮아요.');
      setSt('idle');
    }
  }

  const verdict = heard ? (heard.m >= 0.7 ? '좋아요! 거의 똑같이 말했어요 🎉' : heard.m >= 0.4 ? '비슷해요 — 한 번 더 들어보고 말해 볼까요?' : '조금 달라요 — 천천히 한 번 더 들어볼까요?') : '';

  return (
    <div className="dr-act">
      <div className="dr-ask">🎙 태오가 되어 말해 보세요</div>
      <button type="button" className="dr-target" onClick={() => play(scene.en)}>
        <span className="dr-en">🔊 {scene.en}</span>
        <span className="dr-kr">{scene.kr}</span>
      </button>
      {heard && (
        <div className={`dr-note${heard.m >= 0.7 ? ' ok' : ''}`}>
          내가 한 말: “{heard.text}” · {verdict}
        </div>
      )}
      {canVoice && st !== 'heard' && (
        <button type="button" className={`dr-mic${st === 'rec' ? ' on' : ''}`} disabled={st === 'wait'} onClick={() => (st === 'rec' ? stop.current?.() : void rec())} aria-label={st === 'rec' ? '말하기 끝' : '말하기'}>
          {st === 'rec' ? '⏹' : st === 'wait' ? '…' : '🎙'}
        </button>
      )}
      {msg && <p className="dr-msg">{msg}</p>}
      {st === 'heard' && heard ? (
        <div className="dr-row">
          <button type="button" className="btn" onClick={() => { setHeard(null); setSt('idle'); }}>
            다시 말하기
          </button>
          <button type="button" className="btn primary" onClick={() => onDone(heard.text, heard.m)}>
            계속
          </button>
        </div>
      ) : (
        <>
          {!canVoice && (
            // 받아쓰기를 못 쓰는 기기 — 소리 내어 말했다고 스스로 확인(말한 문장 수에 센다)
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                bumpSpoken();
                onDone(scene.en, 1);
              }}
            >
              🗣 소리 내어 말했어요 ✓
            </button>
          )}
          <button
            type="button"
            className="dr-skip"
            onClick={() => {
              cancelled.current = true;
              stop.current?.();
              onDone(null, 0);
            }}
          >
            말하지 않고 넘어가기
          </button>
        </>
      )}
    </div>
  );
}

export interface PlayResult {
  score: number;
  asked: number;
  ok: number;
  missed: MissedItem[];
  /** 틀린 참여 장면(바로 앞 대사 포함) — '틀린 장면 다시 풀기'용 */
  retry: Scene[];
  /** 문항 레벨별 성적(원고의 B1 문항 → B1 듣기 증거) */
  byLevel: LevelStats;
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
}: {
  ep: Episode;
  onEnd: (r: PlayResult) => void;
  onExit: () => void;
  practice?: boolean;
  review?: RecallItem[];
  /** 이어 보기 — 지난번 멈춘 장면부터(기록·점수 그대로) */
  resume?: ResumeState | null;
  subsOff?: boolean;
}) {
  // 첫머리 복습 — 지난 화 표현 떠올리기(간격 반복). 이어 볼 때는 그때 문항 그대로(장면 번호가 어긋나지 않게)
  const rc = useMemo<RecallItem[]>(() => (review ? review : practice ? [] : resume ? resume.rc : recallItems(ep.no)), [ep, practice, resume, review]);
  const scenes = useMemo<PScene[]>(() => {
    if (review) return [{ type: 'narr', kr: `표현 복습 — 지난 화들에서 배운 표현 ${review.length}개를 떠올려 봐요.` } as Scene, ...review.map((r) => ({ type: 'recall' as const, ...r }))];
    if (practice || !rc.length) return ep.scenes;
    return [{ type: 'narr', kr: '지난 화 기억나요? 표현 하나만 떠올려 보고 시작해요.' } as Scene, ...rc.map((r) => ({ type: 'recall' as const, ...r })), { type: 'narr', kr: `EP ${ep.no} · ${ep.titleKr}` } as Scene, ...ep.scenes];
  }, [ep, practice, rc, review]);
  const saveProgress = !practice && !review;

  const [i, setI] = useState(() => (resume ? Math.min(resume.i, scenes.length - 1) : 0));
  const [log, setLog] = useState<LogItem[]>(() => (resume ? (resume.log as LogItem[]) : []));
  const logRef = useRef(log);
  logRef.current = log;
  const [picked, setPicked] = useState<number | null>(null);
  const [subs, setSubs] = useState(() => (subsOff ? false : load<boolean>(SUBS_KEY, true)));
  const [mute, setMute] = useState(() => load<boolean>(MUTE_KEY, false));
  // 재생 속도 — 0.6×~1.2×(설정은 다음 화에도 유지). 처음 보는 A1이거나 방금 쉬워진 사용자는 0.75×
  const [speed, setSpeed] = useState(initialSpeed);
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
    if (cur + 1 >= total) {
      if (ended.current) return;
      ended.current = true;
      stopSpeaking();
      const score = askedRef.current ? Math.round((okRef.current / askedRef.current) * 100) : 100;
      if (saveProgress) clearResume();
      onEnd({ score, asked: askedRef.current, ok: okRef.current, missed: missedRef.current, retry: retryRef.current, byLevel: byLevelRef.current });
      return;
    }
    setI(cur + 1);
    // 이어 보기 저장 — 넘어간 순간 기준(답한 문항의 점수까지 확정된 상태)
    snapshot(cur + 1);
  }

  /** 이어 보기 저장 — nextI부터 다시 보면 되는 상태(그 전 장면의 기록·점수는 확정) */
  function snapshot(nextI: number) {
    if (!saveProgress || nextI <= 0 || nextI >= total) return;
    saveResume({
      no: ep.no,
      i: nextI,
      ok: okRef.current,
      asked: askedRef.current,
      log: logRef.current,
      missed: missedRef.current,
      retryIdx: retryRef.current.map((x) => ep.scenes.indexOf(x)).filter((k) => k >= 0),
      rc,
    });
  }
  // 전화·알림으로 앱을 벗어나거나 앱이 종료될 때도 저장 — 화면 안 이동만이 아니라(감사 v1.31 G02)
  useEffect(() => {
    const save = () => {
      if (document.visibilityState !== 'hidden' && !ended.current) return;
      if (ended.current) return;
      const sc = scenes[iRef.current];
      const unanswered = !!sc && (INTERACTIVE.has(sc.type) || sc.type === 'recall') && pickedRef.current === null;
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

  /** 지금 장면에서 기다렸다가 넘어가도 되는가(자동 재생 켜짐 + 내 차례가 아니거나 이미 답함) */
  const canFlow = () => {
    const sc = scenes[iRef.current];
    return autoRef.current && !!sc && (!INTERACTIVE.has(sc.type) && sc.type !== 'recall' ? true : pickedRef.current !== null);
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
    pendingVoice.current = voiceLines.map((x) => (typeof x === 'string' ? { en: x, who: 'taeo' } : x));
    speakSeq(voiceLines, () => {
      pendingVoice.current = [];
      if (canFlow()) scheduleNext(good ? 1400 : 3400);
    });
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

  const isAct = !!scene && (INTERACTIVE.has(scene.type) || scene.type === 'recall');
  const pct = Math.round((i / total) * 100);

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
      <div className="dr-ep">
        {review ? '표현 복습' : practice ? `EP ${ep.no} · 틀린 장면 다시 풀기` : `EP ${ep.no} · ${ep.titleKr}`}
      </div>

      <div className="dr-log" aria-live="polite" ref={logBoxRef}>
        {log.map((it, k) => (
          <Bubble key={k} item={it} subs={subs} onReplay={replay} />
        ))}

        {scene?.type === 'recall' && picked === null && (
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

        {scene?.type === 'speak' && picked === null && (
          <SpeakStep
            key={i}
            scene={scene}
            play={(en) => speakSeq([en])}
            onDone={(said, m) => {
              const items: LogItem[] = [{ kind: 'line', who: 'taeo', en: scene.en, kr: scene.kr }];
              // 많이 다르게 말했으면 그 문장을 복습 카드로(내일부터) — 결과를 버리지 않는다
              if (said && m < 0.4 && !practice && !review) addWeakItem({ en: scene.en, kr: scene.kr, cat: '드라마', lesson: `drama:${ep.no}` }, 1);
              afterAnswer(0, true, items, []);
            }}
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
  const nextIsAi = !nextEpInfo || !!nextEpInfo.ai;
  return (
    <div className="screen dr-screen">
      <div className="study-card dr-end">
        <div className="dr-end-ep">EP {ep.no} 완료</div>
        <h2 className="dr-end-title" ref={titleRef} tabIndex={-1}>
          {ep.titleKr}
        </h2>
        <div className="dr-end-score">이해도 {result.score}%</div>
        {!retried && streak > 0 && <p className="dr-flame">🔥 오늘 불꽃이 켜졌어요 · 연속 {streak}일</p>}
        {!retried && growth && (
          <p className="dr-msg">
            🎯 듣기 {growth.next} 입증 {growth.n}/{PASSES_NEEDED} — 드라마의 {growth.next} 문항을 맞히면 쌓여요
          </p>
        )}
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
  const [levelChange, setLevelChange] = useState<-1 | 0 | 1>(0);
  const [retried, setRetried] = useState<{ ok: number; total: number } | null>(null);
  const [binge, setBinge] = useState(false);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const [writing, setWriting] = useState(false);
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
    const items = reviewItems();
    if (!items.length) {
      setErr('지금 떠올릴 표현이 없어요 — 배운 표현은 하루 뒤부터 복습에 나와요.');
      setView('hub');
      return;
    }
    setReviewSet(items);
    setView('review');
  }

  async function open(no: number, o: { subsOff?: boolean } = {}) {
    primeAudio(); // 탭(제스처) 안에서 오디오 언락 — iOS 첫 대사 무음 방지
    setErr('');
    setRetried(null);
    setSubsOffPlay(!!o.subsOff);
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
        void open(req.no, { subsOff: !!req.subsOff });
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
          onExit={() => {
            stopSpeaking();
            setView('hub');
          }}
          onEnd={(r) => {
            if (r.asked > 0) markDramaPracticeToday(); // 복습도 오늘의 연습(불꽃·퀘스트)
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
            const { levelChange: lc } = completeEpisode(ep, r.score, r.asked, r.missed, r.byLevel);
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
        {plan.kind === 'review' ? (
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
        {plan.kind === 'next' && plan.due > 0 && (
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
