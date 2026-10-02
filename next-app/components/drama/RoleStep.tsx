'use client';

/**
 * 역할극 한 줄(M2) — "내가 태오" : 인물 목소리를 한 번 듣고, 영어가 1.5초 반짝인 뒤 사라지면,
 * 한국어만 보고 말한다. 녹음은 저절로 시작하고 말이 끝나면 저절로 멈춘다.
 *
 * 모드
 *  · role   — 태오 대사(line/speak) + 엔딩 직전 재소환(recall). 단어별 diff · 칩 1개(혼동축 > 리듬 > WPM) ·
 *             내 소리 ▶ / 태오 ▶ · 60점 미만이면 영어를 보여 주고 '한 번 더'(최대 2회) · 10단어 이상은 끝부터 쌓기(4→8→전체)
 *  · shadow — 상대 대사와 **동시에** 말하기(길게 누르기 / 키 없음 지정 줄 기본). 모델 재생 끝 +1초에 멈춤,
 *             채점은 길이 비·단어 회수율만(혼동축 칩 없음), 화당 4회(상한은 호출부가 센다)
 *  · lip    — 조용히 모드(M4): 듣고 → 한국어 2초 → 영어 공개 → '입으로만 따라했어요 ✓'
 * 인식 경로: whisper(키+마이크) > webspeech(키 없음·브라우저 인식) > self(둘 다 없음, iOS PWA):
 *   self는 '영어 2초 플래시 → 가리고 말하기 → 자기확인'이고 녹음(Blob)이 있으면 '내 소리 ▶'를 준다(칩 없음).
 *
 * 슬롯(이후 모듈은 호출부에서만 주입, 이 파일은 M2 이후 무수정):
 *   chipSlot(M9) · toggleSlot · subsMode(M11) · buildupMinWords · maxSkips/skipsUsed/skipPolicy(M4 복귀·조용히)
 * 기록은 lib/roleStep.logRoleResult(시도 로그·혼동축·발화 수·복습 카드) + 통과 녹음 putRecording(kind 'drama').
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AttemptSrc } from '../../lib/reviewEngine';
import VoiceCompare from '../MyVoice';
import { speakText, stopSpeaking } from '../SpeakButton';
import { castNameKo, voiceOf, withWa } from '../../lib/drama';
import { alignedScore, displayDiff } from '../../lib/align';
import { diagnose, type PronIssue } from '../../lib/pronunciation';
import { rhythmChip } from '../../lib/rhythm';
import { recordAndTranscribe, STT_PROPER_NOUNS, whisperAvailable, micAvailable, type SttResult, type SttWord } from '../../lib/stt';
import { blockingReason, gateMessage } from '../../lib/sttQuality';
import { sttErrorKind, sttErrorMessage } from '../../lib/sttErrors';
import { browserSttAvailable, listenOnce } from '../../lib/browserStt';
import { putRecording } from '../../lib/storage';
import { bumpDiag } from '../../lib/diag';
import { haptic } from '../../lib/haptics';
import type { FluencyMetrics } from '../../lib/fluency';
import {
  buildupStages,
  canRetry,
  canSkip,
  finalScore,
  flashMs,
  hideAxisChip,
  logRoleResult,
  passed as isPass,
  pickChip,
  recordDispute,
  resultMessage,
  ROLE_MAX_MS,
  ROLE_SILENCE_MS,
  SHADOW_TAIL_MS,
  SKIP_MAX,
  sttPath,
  shadowScore,
  shadowVoiced,
  unlimitedSkips,
  wordCount,
  type Chip,
  type RoleMode,
  type RoleResult,
  type SkipPolicy,
  type SttPath,
} from '../../lib/roleStep';
import type { SubsMode } from './Bubble';

export interface RoleScene {
  /** 원고 장면 번호 */
  idx: number;
  who: string;
  en: string;
  kr: string;
}

/** chipSlot에 넘기는 문맥 — null을 돌려주면 기본 칩 규칙(혼동축 > 리듬 > WPM)을 쓴다 */
export interface ChipCtx {
  en: string;
  said: string;
  words?: SttWord[];
  fluency?: FluencyMetrics;
  issues: PronIssue[];
  chip: Chip | null;
  hideAxis: boolean;
}

export interface RoleStepProps {
  scene: RoleScene;
  epNo: number;
  mode: RoleMode;
  /** 엔딩 직전 재소환 — 듣기·플래시 없이 kr만 보고 1회, src 'recall-inline' */
  recall?: boolean;
  /** 시도 로그 출처를 바꾼다(회화 탭 = 'dtalk'). 기록은 늘 이 컴포넌트가 한 번만 한다 — 호출부에서 다시 logRoleResult 하지 말 것(이중 집계) */
  logSrc?: AttemptSrc;
  chipSlot?: (ctx: ChipCtx) => ReactNode | null;
  toggleSlot?: ReactNode;
  subsMode?: SubsMode;
  buildupMinWords?: number;
  maxSkips?: number;
  skipsUsed?: number;
  skipPolicy?: SkipPolicy;
  /** 모델 재생 속도(이미 기본 배속이 곱해진 값 — Player의 speed × SPEED_BASE) */
  rate?: number;
  /** 지금 재생 속도 단계(0.6~1.2) — 2차 시도 속도 권유 표시용 */
  speed?: number;
  mute?: boolean;
  onDone: (r: RoleResult) => void;
  /** 2차 시도 '🐢 0.75×로 들어볼까요'를 눌렀을 때(Player가 속도를 바꾼다) */
  onSlowHint?: () => void;
}

type Phase = 'listen' | 'flash' | 'rec' | 'wait' | 'idle' | 'gate' | 'result' | 'self' | 'lip';

interface Heard {
  said: string;
  score: number;
  diff: { w: string; ok: boolean }[];
  missed: string[];
  issues: PronIssue[];
  audio?: Blob;
  latencyMs?: number;
  durationMs?: number;
  wpm?: number;
  pauseCount?: number;
  clausePauses?: number;
  words?: SttWord[];
  fluency?: FluencyMetrics;
  chip: Chip | null;
  slotNode?: ReactNode | null;
  /** 섀도잉 길이 비 */
  ratio?: number | null;
}

/** 대사 한 줄을 읽는 데 필요한 시간(음소거·추정용) — DramaScreen.lineMs와 같은 식 */
const lineMs = (en: string) => en.split(/\s+/).length * 380 + 700;
const LONG_PRESS_MS = 500;
/** 채점까지 못 간(게이트에 막힌) 시도가 이만큼이면 자기확인 출구를 연다 — 넘어가기 소진과 무관 */
export const GATE_SELF_AT = 2;
const SPEED_BASE = 0.95;

export default function RoleStep({
  scene,
  epNo,
  mode,
  recall = false,
  logSrc,
  chipSlot,
  toggleSlot,
  subsMode,
  buildupMinWords = 10,
  maxSkips = SKIP_MAX,
  skipsUsed = 0,
  skipPolicy = {},
  rate = SPEED_BASE,
  speed = 1,
  mute = false,
  onDone,
  onSlowHint,
}: RoleStepProps) {
  const path: SttPath = sttPath({ whisper: whisperAvailable(), webSpeech: browserSttAvailable() });
  const stages = mode === 'role' && !recall ? buildupStages(scene.en, buildupMinWords) : [scene.en];
  const [stage, setStage] = useState(0);
  const target = stages[stage];
  const last = stage === stages.length - 1;
  const [phase, setPhase] = useState<Phase>(mode === 'lip' ? 'listen' : mode === 'shadow' ? 'rec' : recall ? 'rec' : 'listen');
  const [tries, setTries] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [heard, setHeard] = useState<Heard | null>(null);
  const best = useRef<Heard | null>(null);
  const [msg, setMsg] = useState('');
  const [level, setLevel] = useState(0);
  const [showEn, setShowEn] = useState(false);
  const [micDenied, setMicDenied] = useState(!!skipPolicy.micDenied);
  // 이 대사에서 마이크가 두 번 실패해 자기확인으로 넘어갔으면(micDenied) 그때부터 넘어가기 무제한 — 안내 문구와 맞춘다
  const policy: SkipPolicy = { ...skipPolicy, micDenied: skipPolicy.micDenied || micDenied, keyless: skipPolicy.keyless ?? path === 'self' };
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputed, setDisputed] = useState(false);
  const [lipReveal, setLipReveal] = useState(false);
  /** 이 대사에서 게이트(안 들림·불명확·서버 바쁨)에 막힌 횟수 — 시도·넘어가기 수에는 넣지 않는다 */
  const [gates, setGates] = useState(0);
  const resultHead = useRef<HTMLDivElement | null>(null);
  const alive = useRef(true);
  const stopRec = useRef<(() => void) | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelled = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelStart = useRef(0);
  const modelMs = useRef(0);
  const finished = useRef(false);
  // UI 문구는 한국어 이름(태오 ▶ · 마야와 같이 말하기) — 원고 cast.name은 영어 표기다
  const name = castNameKo(scene.who);
  const subsOn = subsMode ? subsMode !== 'off' : true;

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => alive.current && fn(), ms);
    timers.current.push(t);
    return t;
  };

  /** 채점 불가 — 안내만 하고 🎙 다시(시도·넘어가기 수는 그대로) */
  const toGate = (m: string) => {
    setMsg(m);
    setGates((g) => g + 1);
    setPhase('gate');
  };

  // 결과가 뜨면 포커스를 결과 제목으로(키보드·스크린리더가 BODY로 떨어지지 않게)
  useEffect(() => {
    if (phase === 'result') resultHead.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelled.current = true;
      for (const t of timers.current) clearTimeout(t);
      stopRec.current?.();
      stopSpeaking();
    };
  }, []);

  /** 인물 목소리로 한 번 들려준다(음소거면 읽을 시간만큼 기다린다) */
  function playModel(text: string, onend: () => void) {
    const pace = Math.min(1, rate / SPEED_BASE);
    modelStart.current = Date.now();
    if (mute) {
      later(onend, lineMs(text) / pace);
      return;
    }
    stopSpeaking();
    let done = false;
    const go = () => {
      if (done || !alive.current) return;
      done = true;
      modelMs.current = Date.now() - modelStart.current;
      onend();
    };
    speakText(text, 'en-US', rate, go, voiceOf(scene.who));
    // 안전장치 — onend를 안 주는 기기에서도 멈추지 않게
    later(go, (lineMs(text) * 2) / pace + 3000);
  }

  /** 1단계: 듣기 → 플래시 → 녹음 (role) / 듣기 → kr 2초 → 영어 공개 (lip) */
  useEffect(() => {
    if (mode === 'lip') {
      playModel(scene.en, () => later(() => setLipReveal(true), 2000));
      return;
    }
    if (mode === 'shadow') {
      void startShadow();
      return;
    }
    if (recall) {
      void startRecording();
      return;
    }
    // 2차 시도부터는 플래시 없이 kr만 — 구간이 바뀌면 그 구간 문장을 다시 반짝인다
    if (stage > 0) {
      setPhase('flash');
      setShowEn(true);
      later(() => {
        setShowEn(false);
        void startRecording();
      }, flashMs(0, path));
      return;
    }
    setPhase('listen');
    playModel(scene.en, () => {
      setPhase('flash');
      setShowEn(true);
      later(() => {
        setShowEn(false);
        void startRecording();
      }, flashMs(0, path));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  /** 녹음 → 전사 → 채점. 자동 시작이 실패하면(권한) 수동 버튼으로, 그것도 실패하면 자기확인 */
  async function startRecording(manual = false) {
    if (!alive.current) return;
    cancelled.current = false;
    setMsg('');
    setLevel(0);
    if (path === 'self' && !micAvailable()) {
      setPhase('self');
      return;
    }
    if (micDenied) {
      setPhase('self');
      return;
    }
    setPhase('rec');
    stopSpeaking();
    try {
      let res: SttResult;
      if (path === 'webspeech') {
        const text = await listenOnce({ lang: 'en-US', maxMs: ROLE_MAX_MS, registerStop: (f) => (stopRec.current = f) });
        res = { text, via: 'webspeech', reason: text ? 'ok' : 'silent' };
      } else {
        res = await recordAndTranscribe({
          prompt: STT_PROPER_NOUNS, // 고유명사만 — 목표 문장을 넣으면 점수가 부푼다
          language: 'en',
          silenceMs: ROLE_SILENCE_MS,
          maxMs: ROLE_MAX_MS,
          detail: 'words',
          temperature: 0,
          targetEn: target,
          recordOnly: path === 'self',
          registerStop: (f) => (stopRec.current = f),
          onLevel: (v) => alive.current && setLevel(Math.min(1, v * 8)),
          onState: (s) => {
            if (s === 'transcribing') setPhase('wait');
          },
        });
      }
      stopRec.current = null;
      if (cancelled.current || !alive.current) return;
      if (res.reason === 'busy') {
        toGate(gateMessage('busy'));
        return;
      }
      if (path === 'self') {
        // 키도 Web Speech도 없다 — 녹음만 있고 채점은 자기확인
        setHeard({ said: '', score: 0, diff: [], missed: [], issues: [], audio: res.audio, latencyMs: res.voiceOnsetMs, durationMs: res.durationMs, chip: null });
        setPhase('self');
        return;
      }
      const said = (res.text || '').trim();
      if (!said) {
        toGate(res.reason === 'no-audio' || res.reason === 'silent' ? '소리가 잘 안 잡혔어요 — 한 번만 더' : '말이 들리지 않았어요 — 한 번만 더');
        return;
      }
      // 품질 게이트 — 환각·불명확·누출은 채점하지 않는다. 따라 말하기라 lastTtsText(echo)는 넘기지 않았다.
      const block = path === 'whisper' ? blockingReason(res) : null;
      if (block) {
        toGate(gateMessage(block));
        return;
      }
      grade(said, res);
    } catch (e) {
      stopRec.current = null;
      if (cancelled.current || !alive.current) return;
      // 마이크 권한·네트워크·키·서버를 구분해 안내한다(예전엔 전부 '마이크를 열지 못했어요')
      const why = sttErrorMessage(e);
      if (manual || micDenied) {
        // 두 번째 실패 — 이 기기에서 지금은 채점할 수 없다. 자기확인으로(넘어가기 무제한)
        setMicDenied(true);
        setMsg(`${why} 지금은 소리 내어 말하고 스스로 확인해 주세요.`);
        setPhase('self');
        return;
      }
      setMsg(sttErrorKind(e) === 'mic-denied' || sttErrorKind(e) === 'no-mic' ? why : `${why} 버튼을 눌러 다시 말해 보세요.`);
      setPhase('idle');
    }
  }

  /** 섀도잉 — 녹음을 먼저 열고, 녹음이 시작되면 모델을 재생. 모델이 끝나고 1초 뒤 멈춘다 */
  async function startShadow() {
    if (!alive.current) return;
    cancelled.current = false;
    setPhase('rec');
    if (!micAvailable() || micDenied) {
      // 마이크가 없다 — 듣기만 하고 자기확인
      playModel(scene.en, () => setPhase('self'));
      return;
    }
    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      playModel(scene.en, () => later(() => stopRec.current?.(), SHADOW_TAIL_MS));
    };
    try {
      const res = await recordAndTranscribe({
        prompt: STT_PROPER_NOUNS,
        language: 'en',
        silenceMs: 0, // 모델이 끝날 때 우리가 멈춘다
        maxMs: ROLE_MAX_MS + 5000,
        detail: 'words',
        temperature: 0,
        targetEn: scene.en,
        recordOnly: path !== 'whisper',
        registerStop: (f) => (stopRec.current = f),
        onLevel: (v) => alive.current && setLevel(Math.min(1, v * 8)),
        onState: (s) => {
          if (s === 'recording') begin();
          if (s === 'transcribing') setPhase('wait');
        },
      });
      stopRec.current = null;
      if (cancelled.current || !alive.current) return;
      if (res.reason === 'busy') {
        toGate(gateMessage('busy'));
        return;
      }
      const mMs = modelMs.current || lineMs(scene.en);
      // 침묵은 통과가 아니다 — 녹음이 모델 끝+1초에 늘 멈춰 길이만으로는 못 거른다. 레벨·첫 유성으로 본다
      if (shadowVoiced(res, mMs) === false || (path === 'whisper' && !(res.text || '').trim())) {
        toGate('소리가 안 들렸어요 — 함께 소리 내어 말해 보세요');
        return;
      }
      if (path !== 'whisper') {
        // 키 없음 — 받아쓰기가 없어 점수를 매기지 않는다. 내 소리 ▶ / 인물 ▶ 비교 + 자기확인
        setHeard({ said: '', score: 0, diff: [], missed: [], issues: [], audio: res.audio, latencyMs: res.voiceOnsetMs, durationMs: res.durationMs, chip: null });
        setPhase('self');
        return;
      }
      const sh = shadowScore({ target: scene.en, said: res.text || '', modelMs: mMs, mineMs: res.durationMs });
      const diff = path === 'whisper' && res.text ? alignedScore(scene.en, res.text).diff : [];
      const h: Heard = {
        said: res.text || '',
        score: sh.score,
        diff,
        missed: diff.filter((d) => !d.ok).map((d) => d.w),
        issues: [],
        audio: res.audio,
        latencyMs: res.voiceOnsetMs,
        durationMs: res.durationMs,
        wpm: res.fluency?.wpm,
        pauseCount: res.pauses?.length,
        chip: null,
        ratio: sh.ratio,
      };
      best.current = h;
      setHeard(h);
      setScores([sh.score]);
      setTries(1);
      haptic(isPass(sh.score) ? 'success' : 'error');
      setPhase('result');
    } catch (e) {
      stopRec.current = null;
      if (cancelled.current || !alive.current) return;
      setMicDenied(true);
      setMsg(`${sttErrorMessage(e)} 듣고 따라 말한 뒤 스스로 확인해 주세요.`);
      setPhase('self');
    }
  }

  /** 채점 + 칩 1개 */
  function grade(said: string, res: SttResult) {
    const { score, diff, missed } = alignedScore(target, said);
    const issues = missed.length ? diagnose(target, said) : [];
    const hideAxis = hideAxisChip(scene.en);
    const chip = path === 'whisper' ? pickChip({ issues, rhythm: rhythmChip(res.words, target), wpm: res.fluency?.wpm, hideAxis }) : null;
    const ctx: ChipCtx = { en: target, said, words: res.words, fluency: res.fluency, issues, chip, hideAxis };
    const h: Heard = {
      said,
      score,
      diff,
      missed,
      issues,
      audio: res.audio,
      latencyMs: res.voiceOnsetMs,
      durationMs: res.durationMs,
      wpm: res.fluency?.wpm,
      pauseCount: res.pauses?.length,
      clausePauses: res.fluency?.clauseInternalPauses,
      words: res.words,
      fluency: res.fluency,
      chip,
      slotNode: chipSlot ? chipSlot(ctx) : null,
    };
    const n = tries + 1;
    setTries(n);
    setScores((s) => [...s, score]);
    if (!best.current || score >= best.current.score) best.current = h;
    setHeard(h);
    haptic(isPass(score) ? 'success' : 'error');
    setPhase('result');
  }

  /** 결과 확정 — 기록하고 호출부로 */
  function finish(opts: { skipped?: boolean; self?: boolean; selfOk?: boolean } = {}) {
    if (finished.current) return;
    finished.current = true;
    cancelled.current = true;
    stopRec.current?.();
    const b = best.current;
    const skipped = !!opts.skipped;
    const selfMode = !!opts.self || mode === 'lip';
    const score = skipped ? 0 : selfMode ? (opts.selfOk ? 100 : 0) : finalScore(scores);
    const pass = !skipped && (disputed || (selfMode ? !!opts.selfOk : isPass(score)));
    const r: RoleResult = {
      sceneIdx: scene.idx,
      en: scene.en,
      kr: scene.kr,
      who: scene.who,
      said: b?.said || '',
      score,
      diff: b?.diff || [],
      missed: b?.missed || [],
      lapses: b?.issues.map((i) => i.key) || [],
      audio: b?.audio,
      latencyMs: b?.latencyMs,
      durationMs: b?.durationMs,
      wpm: b?.wpm,
      pauseCount: b?.pauseCount,
      clausePauses: b?.clausePauses,
      quality: 'ok',
      tries: Math.max(1, tries),
      mode,
      skipped,
      disputed,
      self: selfMode,
      passed: pass,
      path,
    };
    try {
      logRoleResult(r, epNo, logSrc ?? (recall ? 'recall-inline' : mode === 'shadow' ? 'shadow' : 'drama'));
    } catch {
      /* 기록 실패는 흐름을 막지 않는다 */
    }
    if (pass && r.audio && !selfMode) {
      void putRecording({ kind: 'drama', blob: r.audio, mime: r.audio.type || 'audio/webm', durationMs: r.durationMs || 0, en: scene.en, score, wpm: r.wpm, epNo }).then((id) => {
        if (!id) bumpDiag('recSaveFail');
      });
    }
    onDone(r);
  }

  function skip() {
    cancelled.current = true;
    stopRec.current?.();
    stopSpeaking();
    finish({ skipped: true });
  }

  function retry() {
    setHeard(null);
    setMsg('');
    setDisputeOpen(false);
    // 2차 시도부터는 플래시 없이 kr만
    void startRecording();
  }

  function nextStage() {
    setHeard(null);
    setScores([]);
    setTries(0);
    best.current = null;
    setStage((s) => s + 1);
  }

  function dispute() {
    if (!heard) return;
    recordDispute(scene.en, heard.score, heard.said);
    setDisputed(true);
    setDisputeOpen(false);
    haptic('success');
  }

  const pressStart = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setDisputeOpen(true), LONG_PRESS_MS);
  };
  const pressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  // 플래그 off(예전 SpeakStep 동작)·키 없음·마이크 거부·복귀·조용히는 무제한
  const unlimited = unlimitedSkips(policy) || !Number.isFinite(maxSkips);
  const skipOk = unlimited || canSkip(skipsUsed, policy, maxSkips);
  const skipLabel = unlimited ? '말하지 않고 넘어가기' : `넘어가기 (${Math.min(skipsUsed + 1, maxSkips)}/${maxSkips})`;
  const label = mode === 'shadow' ? `👄 ${withWa(name)} 같이 말하기` : mode === 'lip' ? '🤫 입으로만 따라 하기' : recall ? '🔁 방금 그 대사, 한국어만 보고' : '🎙 태오가 되어 말해 보세요';
  const compareLabels = { native: `${name} ▶`, mine: '내 소리 ▶', title: '번갈아 들어보기' };

  /** 모델 다시 듣기 — 게이트 안내('아니면 들어보기 ▶')가 가리키는 버튼. 녹음 중이 아닐 때만 */
  const replayBtn = (
    <button type="button" className="mini-btn rs-replay" onClick={() => playModel(mode === 'shadow' ? scene.en : target, () => {})}>
      🔊 다시 듣기
    </button>
  );

  const skipBtn = (
    <button type="button" className="dr-skip rs-skip" disabled={!skipOk} onClick={skip} aria-disabled={!skipOk}>
      {skipOk ? skipLabel : '넘어가기는 다 썼어요'}
    </button>
  );

  /* ── 결과 카드 ── */
  function renderResult() {
    if (!heard) return null;
    const pass = disputed || isPass(heard.score);
    // 이의 제기로 통과 처리된 카드엔 '한 번 더'를 내지 않는다(자기확인 통과 — 다시 시키면 이의 제기가 무의미)
    const retryOk = !disputed && mode === 'role' && !recall && canRetry(tries, heard.score);
    const longSentence = wordCount(scene.en) >= buildupMinWords;
    const r = { score: heard.score, skipped: false, disputed, mode, self: false };
    return (
      <div
        className={`rs-result${pass ? ' ok' : ''}`}
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerLeave={pressEnd}
        onPointerCancel={pressEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          setDisputeOpen(true);
        }}
      >
        <div className="rs-score" aria-label={`점수 ${heard.score}점`} tabIndex={-1} ref={resultHead}>
          {mode === 'shadow' ? '같이 말하기' : stages.length > 1 ? `끝부터 쌓기 ${stage + 1}/${stages.length}` : '내 발화'} · <b>{heard.score}점</b>
          {heard.ratio != null && <span className="rs-ratio"> · 길이 {heard.ratio}×</span>}
        </div>
        {heard.diff.length > 0 ? (
          <p className="rs-diff" lang="en">
            {/* 단어 사이 공백을 글자로 — 복사·스크린리더가 문장 그대로 읽고, 틀린 단어는 색만이 아니라 글로도 알린다 */}
            {displayDiff(target, heard.diff).map((d, k) => (
              <span key={k}>
                {k > 0 && ' '}
                <span className={d.ok ? 'rs-w ok' : 'rs-w bad'}>
                  {d.w}
                  {!d.ok && <span className="sr-only">(틀림)</span>}
                </span>
              </span>
            ))}
          </p>
        ) : (
          <p className="rs-en" lang="en">
            {target}
          </p>
        )}
        {subsOn && <p className="rs-kr">{scene.kr}</p>}
        {heard.said && <p className="rs-said">내가 한 말: “{heard.said}”</p>}
        {heard.slotNode ?? (heard.chip && (
          <div className={`rs-chip rs-chip-${heard.chip.kind}`} title={heard.chip.tip || ''}>
            {heard.chip.kind === 'axis' ? `🔎 ${heard.chip.label}` : heard.chip.kind === 'rhythm' ? `🎵 ${heard.chip.label}` : `⏱ ${heard.chip.label}`}
            {heard.chip.tip && <span className="rs-chip-tip">{heard.chip.tip}</span>}
          </div>
        ))}
        <p className="rs-msg" role="status">
          {resultMessage(r, longSentence)}
        </p>
        {heard.audio && <VoiceCompare sentence={target} clip={heard.audio} labels={compareLabels} voice={voiceOf(scene.who)} rate={rate} />}
        {toggleSlot}
        {disputeOpen && !disputed && (
          <button type="button" className="btn ghost rs-dispute" onClick={dispute}>
            이 채점이 틀렸어요
          </button>
        )}
        {!pass && retryOk && speed > 0.75 && onSlowHint && (
          <button
            type="button"
            className="rs-slow-hint"
            onClick={() => {
              onSlowHint();
              playModel(target, () => {});
            }}
          >
            🐢 0.75×로 다시 들어볼까요
          </button>
        )}
        <div className="dr-row rs-row">
          {retryOk && (
            <button type="button" className={`btn${pass ? ' ghost' : ' primary'} rs-retry`} onClick={retry}>
              한 번 더
            </button>
          )}
          {!last ? (
            <button type="button" className="btn primary rs-next" onClick={nextStage}>
              다음 구간 ▶
            </button>
          ) : (
            <button type="button" className={`btn${retryOk && !pass ? ' ghost' : ' primary'} rs-next`} onClick={() => finish()}>
              다음 ▶
            </button>
          )}
        </div>
        {!pass && !retryOk && last && skipOk && mode === 'role' && skipBtn}
        <p className="rs-hint">결과를 길게 누르면 ‘이 채점이 틀렸어요’</p>
      </div>
    );
  }

  /* ── 자기확인(키 없음·마이크 거부) ── */
  function renderSelf() {
    return (
      <div className="rs-self">
        <p className="rs-en" lang="en">
          {scene.en}
        </p>
        {subsOn && <p className="rs-kr">{scene.kr}</p>}
        {msg && <p className="dr-msg">{msg}</p>}
        {heard?.audio ? <VoiceCompare sentence={scene.en} clip={heard.audio} labels={compareLabels} voice={voiceOf(scene.who)} rate={rate} /> : replayBtn}
        <div className="dr-row rs-row">
          <button type="button" className="btn ghost rs-self-no" onClick={() => finish({ self: true, selfOk: false })}>
            잘 안 됐어요
          </button>
          <button type="button" className="btn primary rs-self-ok" onClick={() => finish({ self: true, selfOk: true })}>
            🗣 소리 내어 말했어요 ✓
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`dr-act rs-root rs-${mode}`} data-mode={mode} data-phase={phase} data-path={path}>
      <div className="dr-ask rs-ask">
        {label}
        {stages.length > 1 && phase !== 'result' && <span className="rs-stage"> · 끝부터 쌓기 {stage + 1}/{stages.length}</span>}
      </div>

      {mode === 'lip' && (
        <div className="rs-lip">
          {subsOn && <p className="rs-kr big">{scene.kr}</p>}
          {lipReveal ? (
            <>
              <p className="rs-en" lang="en">
                {scene.en}
              </p>
              <button type="button" className="btn primary rs-lip-ok" onClick={() => finish({ self: true, selfOk: true })}>
                입으로만 따라했어요 ✓
              </button>
            </>
          ) : (
            <p className="rs-status" role="status">
              🔊 {name}의 말을 듣는 중…
            </p>
          )}
          {skipBtn}
        </div>
      )}

      {mode !== 'lip' && phase === 'listen' && (
        <div className="rs-stage-box">
          <p className="rs-status" role="status">
            🔊 {name}의 목소리로 한 번 들어 보세요
          </p>
          {subsOn && <p className="rs-kr big">{scene.kr}</p>}
          {skipBtn}
        </div>
      )}

      {mode !== 'lip' && phase === 'flash' && (
        <div className="rs-stage-box">
          <p className={`rs-flash${showEn ? ' on' : ''}`} lang="en" aria-live="polite">
            {showEn ? target : '…'}
          </p>
          {subsOn && <p className="rs-kr big">{scene.kr}</p>}
        </div>
      )}

      {mode !== 'lip' && (phase === 'rec' || phase === 'wait') && (
        <div className="rs-stage-box">
          {subsOn && <p className="rs-kr big">{scene.kr}</p>}
          <div className="rs-level" aria-hidden="true">
            <span style={{ transform: `scaleX(${phase === 'rec' ? level : 0})` }} />
          </div>
          <p className="rs-status" role="status">
            {phase === 'wait' ? '… 듣고 있어요(변환 중)' : mode === 'shadow' ? `🎙 ${withWa(name)} 동시에 말하세요` : '🎙 말씀하세요 — 말이 끝나면 저절로 멈춰요'}
          </p>
          {mode === 'shadow' && path === 'whisper' && phase === 'rec' && <p className="rs-hint">🎧 이어폰을 끼면 스피커 소리가 섞이지 않아 더 정확해요</p>}
          <button type="button" className="dr-mic on rs-mic" disabled={phase === 'wait'} onClick={() => stopRec.current?.()} aria-label="말하기 끝">
            {phase === 'wait' ? '…' : '⏹'}
          </button>
          {skipBtn}
        </div>
      )}

      {mode !== 'lip' && (phase === 'idle' || phase === 'gate') && (
        <div className="rs-stage-box">
          {subsOn && <p className="rs-kr big">{scene.kr}</p>}
          {msg && (
            <p className="dr-msg rs-gate" role="status">
              {msg}
            </p>
          )}
          <button type="button" className="dr-mic rs-mic" onClick={() => (mode === 'shadow' ? void startShadow() : void startRecording(true))} aria-label="말하기">
            🎙
          </button>
          {replayBtn}
          {/* 채점 불가가 거듭되면(넘어가기를 다 썼어도) 스스로 확인하고 지나갈 출구 */}
          {gates >= GATE_SELF_AT && (
            <button
              type="button"
              className="btn ghost rs-to-self"
              onClick={() => {
                stopSpeaking();
                setMsg('채점이 어려운 상황이에요 — 소리 내어 말하고 스스로 확인해 주세요.');
                setPhase('self');
              }}
            >
              🗣 스스로 확인하고 넘어가기
            </button>
          )}
          {skipBtn}
        </div>
      )}

      {phase === 'result' && renderResult()}
      {phase === 'self' && renderSelf()}
    </div>
  );
}
