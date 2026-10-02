'use client';

/**
 * 엔딩 리텔 카드(M5) — 방금 본 이야기를 준비 없이 영어로 다시 말한다(유창성 4/3/2의 축약판).
 *
 *   기본(order 10): 1회차 — 첫 14일(또는 A1)은 '3문장 20초', A2 45초, B1+ 60초. 토요일(3화 이상)은 지난 3화를 섞어 60초(mix).
 *   조금 더 ▾(order 30): '✏️ 한 줄만 고쳐요'(키 있음 — cafLite AI 1문장 교정, 없으면 생략) → 2회차 → 3회차(건너뛰기 가능)
 *     → 'WPM 비교 + 가장 빨랐던 회차 ▶'. 한 달에 한 번(첫째 일요일 이후 첫 리텔)은 2·3회차 대신 '정확하게 말하기 날' 30초×3.
 *
 * 화면: 청자(Maya → Jun → Diane) 문구 + 키워드 칩(한국어만 — 영어는 가림, 채점은 lib/retellKeywords의 영어 후보로)
 *   + 담화 표지 2개(영어 노출) + 오늘 표현(한국어만) → '🎙 시작'(엔딩이 뜨자마자 마이크를 열지 않는다)
 *   → 카운트다운 막대(silenceMs 0 — 생각하느라 쉬어도 끊기지 않는다, 시간이 되면 저절로 끝) → 결과:
 *   전사 위 멈춤 '|'(단어 타임스탬프 300ms↑) · WPM·멈춤·필러 칩 · scoreRetell 점수 · 키워드/표현/표지 적중.
 *   키 없음(전사 불가): recordOnly — 말한 시간·시작까지 걸린 시간 + '내 소리 ▶'만(점수 없음, 자기확인 발화).
 *
 * 기록(회차마다): saveRetell(va_retell — 홈 '리텔' 점) · logAttempt(src 'retell', 채점된 것만) · putRecording(kind 'retell')
 *   · bumpSpoken(1) · addMinutes('fluency'). 1회차(short·1·mix)는 키가 있으면 cafLite 1회 → 교정 1개 + 말하기 증거
 *   recordSkillResult('speaking', 화 레벨, 점수, 'retell') — AI가 본 수준이 화 레벨보다 낮으면 통과로 치지 않는다(cafLite.retellEvidenceScore).
 * 플래그 retell off면 카드 자체가 없다.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { registerEndingCard, type EndingCtx } from '../endingRegistry';
import { episodeByNo, voiceOf, type Episode } from '../../../lib/drama';
import { isOn } from '../../../lib/flags';
import {
  LISTENERS, MIX_ROUND, RETELL_GUIDES, ROUND_333, countFillers, daysSinceStart, markersFor, monthly333Due, pauseMarks, retellPlanFor,
  saveRetell, scoreRetell, usedLearn, weeklyMixDue, type Listener, type Marker, type RetellKeyword, type RetellPhase, type RetellRound, type RetellRoundNo,
} from '../../../lib/retell';
import { mixKeywordsFor, retellKeywordsFor } from '../../../lib/retellKeywords';
import { recordAndTranscribe, createUnlockedAudioContext, micAvailable, whisperAvailable, STT_PROPER_NOUNS, type SttResult } from '../../../lib/stt';
import { blockingReason, gateMessage } from '../../../lib/sttQuality';
import { countWords } from '../../../lib/fluency';
import { logAttempt, type AttemptQuality } from '../../../lib/reviewEngine';
import { putRecording } from '../../../lib/storage';
import { bumpSpoken } from '../../../lib/state';
import { addMinutes } from '../../../lib/timeBudget';
import { recordSkillResult } from '../../../lib/cefrGrowth';
import { cafLite, retellEvidenceScore, taskCefr, type CafLiteResult } from '../../../lib/cafLite';
import { alignedScore } from '../../../lib/align';
import { speakText, stopSpeaking } from '../../SpeakButton';

/* ───────── 녹음 공용(오늘 질문 카드도 쓴다) ───────── */

export type FreePath = 'whisper' | 'record' | 'none';

/** 이 기기의 자유 발화 경로 — 키 있음(전사) / 마이크만(녹음만, iOS PWA 키 없음) / 마이크 없음(소리 내어 말하기만) */
export function freePath(): FreePath {
  try {
    if (whisperAvailable()) return 'whisper';
    return micAvailable() ? 'record' : 'none';
  } catch {
    return 'none';
  }
}

/** 녹음 결과를 '채점 불가 사유'로 — null이면 채점 가능 */
export function blockOf(res: SttResult, path: FreePath): AttemptQuality | null {
  if (res.reason === 'no-audio') return 'silent';
  if (path !== 'whisper') return null;
  if (res.reason === 'busy') return 'busy';
  if (!(res.text || '').trim()) return res.reason === 'silent' ? 'silent' : 'unclear';
  const b = blockingReason(res);
  return b ? (b as AttemptQuality) : null;
}

/** 내 녹음 다시 듣기 — 객체 URL은 바뀌거나 떠날 때 해제한다 */
export function ClipButton({ clip, label = '내 소리 ▶', className = '' }: { clip: Blob | null | undefined; label?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!clip) return setUrl(null);
    const u = URL.createObjectURL(clip);
    setUrl(u);
    return () => {
      audio.current?.pause();
      URL.revokeObjectURL(u);
    };
  }, [clip]);
  if (!url) return null;
  return (
    <button
      type="button"
      className={`mini-btn rt-play ${className}`.trim()}
      onClick={() => {
        stopSpeaking();
        if (!audio.current) audio.current = new Audio();
        audio.current.src = url;
        audio.current.play().catch(() => {});
      }}
    >
      {label}
    </button>
  );
}

/** 카운트다운 막대 + 남은 초 + 멈춤 버튼 */
export function RecBar({ elapsed, sec, onStop, level }: { elapsed: number; sec: number; onStop: () => void; level: number }) {
  const left = Math.max(0, Math.ceil(sec - elapsed / 1000));
  return (
    <div className="rt-rec">
      <div className="rt-bar" role="progressbar" aria-valuemin={0} aria-valuemax={sec} aria-valuenow={Math.min(sec, Math.round(elapsed / 1000))} aria-label="남은 시간">
        <span style={{ transform: `scaleX(${Math.min(1, elapsed / (sec * 1000))})` }} />
      </div>
      <div className="rt-rec-row">
        <span className="rt-time" aria-live="off">
          🎙 {Math.min(sec, Math.floor(elapsed / 1000))} / {sec}초 · 남은 {left}초
        </span>
        <span className="rt-level" aria-hidden="true">
          <span style={{ transform: `scaleX(${level})` }} />
        </span>
        <button type="button" className="btn ghost rt-stop" onClick={onStop}>
          ⏹ 끝
        </button>
      </div>
    </div>
  );
}

const sec1 = (ms?: number) => (typeof ms === 'number' ? `${(ms / 1000).toFixed(1)}초` : '–');

/* ───────── 리텔 설정(화·날짜별 한 번) ───────── */

export interface RetellSetup {
  key: string;
  phase: RetellPhase;
  first: RetellRound & { listener: Listener };
  /** '조금 더' 회차(2·3회차 또는 3/3/3의 2·3번째) */
  more: (RetellRound & { listener: Listener })[];
  mix: boolean;
  m333: boolean;
  keywords: RetellKeyword[];
  markers: [Marker, Marker];
  learn: { en: string; kr: string }[];
  /** 증거·교정에 쓰는 과제 레벨 */
  level: string;
  recap: string;
}

let setupMemo: RetellSetup | null = null;

export function retellSetup(ctx: EndingCtx): RetellSetup {
  const ep: Episode = ctx.ep;
  const key = `${ep.no}|${ctx.dateKey}`;
  if (setupMemo && setupMemo.key === key) return setupMemo;
  const plan = retellPlanFor(
    { no: ep.no, level: ep.level, cliff: ep.cliff, recap: ep.recap, keywords: retellKeywordsFor(ep), learn: ep.learn },
    daysSinceStart(ctx.dateKey),
    ctx.dateKey
  );
  // 토요일: 1회차가 지난 3화 교차 60초(3화 미만이면 섞을 게 없어 평소대로)
  const mixEps = weeklyMixDue(ctx.dateKey) && ep.no >= 3 ? [ep.no - 2, ep.no - 1].map((n) => episodeByNo(n)).filter((e): e is Episode => !!e).concat(ep) : [];
  const mix = mixEps.length === 3;
  // 월 1회 3/3/3 — 첫 2주·토요일 교차 날은 하지 않는다(요일 규칙은 2종만)
  const m333 = !mix && plan.phase !== 'first14' && monthly333Due(ctx.dateKey);
  const rounds333 = ROUND_333.map((r, i) => ({ ...r, listener: LISTENERS[i % LISTENERS.length] }));
  setupMemo = {
    key,
    phase: plan.phase,
    first: mix ? { ...MIX_ROUND, listener: LISTENERS[0] } : plan.rounds[0],
    more: mix ? [] : m333 ? rounds333 : plan.rounds.slice(1),
    mix,
    m333,
    keywords: mix ? mixKeywordsFor(mixEps, 2) : plan.keywords,
    markers: plan.markers || markersFor(ctx.dateKey),
    learn: mix ? mixEps.flatMap((e) => e.learn).slice(-3) : ep.learn,
    level: ep.level,
    recap: ep.recap || ep.cliff || '',
  };
  return setupMemo;
}

/* ───────── 세션 상태(기본 카드 ↔ '조금 더' 카드 공유) ───────── */

export interface RetellRunOut {
  round: RetellRoundNo;
  label: string;
  sec: number;
  text: string;
  wpm: number;
  score: number;
  durationMs: number;
  pauses: number;
  fillers: number;
  latencyMs?: number;
  audio?: Blob;
  keyless: boolean;
}

interface Session {
  runs: RetellRunOut[];
  /** cafLite: undefined = 안 부름(키 없음·짧음) · 'pending' · 결과 · null(실패) */
  caf?: 'pending' | CafLiteResult | null;
}

const sessions = new Map<string, Session>();
const subs = new Set<() => void>();
const sessionOf = (key: string): Session => {
  let s = sessions.get(key);
  if (!s) sessions.set(key, (s = { runs: [] }));
  return s;
};
const notify = () => subs.forEach((f) => f());

function useSession(key: string): Session {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    subs.add(force);
    return () => {
      subs.delete(force);
    };
  }, []);
  return sessionOf(key);
}

/* ───────── 한 회차 ───────── */

type Phase = 'idle' | 'rec' | 'wait' | 'gate' | 'done';

function Prompts({ setup, round, guide }: { setup: RetellSetup; round: RetellRound & { listener: Listener }; guide: string }) {
  const L = round.listener;
  return (
    <div className="rt-prompts">
      <p className="rt-listener">
        <span className="rt-avatar" aria-hidden="true">
          {L.icon}
        </span>
        <span>
          <b>{L.name}에게</b> · {L.kr}
        </span>
      </p>
      <p className="rt-guide">{guide}</p>
      <div className="rt-chips" aria-label="키워드">
        {setup.keywords.map((k) => (
          <span key={k.kr} className="rt-chip kw">
            {k.kr}
          </span>
        ))}
        {setup.markers.map((m) => (
          <span key={m.en} className="rt-chip mk" lang="en" title={m.kr}>
            {m.en} <small>{m.kr}</small>
          </span>
        ))}
        {setup.learn.map((l) => (
          <span key={l.en} className="rt-chip lr" title="오늘 표현(영어는 직접 떠올려요)">
            💬 {l.kr}
          </span>
        ))}
      </div>
    </div>
  );
}

function Result({ run, setup }: { run: RetellRunOut; setup: RetellSetup }) {
  if (run.keyless) {
    return (
      <div className="rt-result keyless" role="status">
        <div className="rt-chips">
          <span className="rt-chip stat">말한 시간 {sec1(run.durationMs)}</span>
          <span className="rt-chip stat">시작까지 {sec1(run.latencyMs)}</span>
        </div>
        <p className="rt-note">키가 없어 받아쓰기는 못 했어요 — 내 소리를 들어 보고 키워드를 다 말했는지 스스로 확인해요.</p>
        <ClipButton clip={run.audio} />
      </div>
    );
  }
  const sc = scoreRetell({ said: run.text, keywords: setup.keywords, markers: setup.markers, learn: setup.learn.map((l) => l.en), durationMs: run.durationMs, wpm: run.wpm, targetSec: run.sec });
  return (
    <div className="rt-result" role="status">
      <div className="rt-score">
        점수 <b>{run.score}</b>
      </div>
      <div className="rt-chips">
        <span className="rt-chip stat">WPM {run.wpm}</span>
        <span className="rt-chip stat">멈춤 {run.pauses}</span>
        <span className="rt-chip stat">필러 {run.fillers}</span>
        {sc.chips.slice(1).map((c) => (
          <span key={c} className="rt-chip stat">
            {c}
          </span>
        ))}
      </div>
      <div className="rt-chips" aria-label="키워드 적중">
        {setup.keywords.map((k) => {
          const hit = scoreRetell({ said: run.text, keywords: [k], markers: [], learn: [], durationMs: 0, wpm: 0 }).keywordHits > 0;
          return (
            <span key={k.kr} className={`rt-chip kw${hit ? ' hit' : ''}`}>
              {hit ? '✓ ' : ''}
              {k.kr}
            </span>
          );
        })}
      </div>
      <ClipButton clip={run.audio} />
    </div>
  );
}

function Transcript({ words, text }: { words?: SttResult['words']; text: string }) {
  const toks = words?.length ? pauseMarks(words) : null;
  return (
    <p className="rt-said" lang="en">
      {toks
        ? toks.map((t, k) => (
            <span key={k}>
              {k > 0 && ' '}
              {t.w}
              {t.pauseAfter && <span className="rt-pause" aria-label="멈춤"> |</span>}
            </span>
          ))
        : text}
    </p>
  );
}

/** 한 회차: 시작 → 녹음(카운트다운) → 결과. 기록은 여기서 한다. */
function RetellRunner({ ctx, setup, round, guide, onDone, first }: { ctx: EndingCtx; setup: RetellSetup; round: RetellRound & { listener: Listener }; guide: string; onDone: (r: RetellRunOut) => void; first?: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [msg, setMsg] = useState('');
  const [run, setRun] = useState<RetellRunOut | null>(null);
  const [words, setWords] = useState<SttResult['words']>();
  const stop = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const path = useMemo(freePath, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current?.();
    };
  }, []);

  function commit(out: RetellRunOut, res: SttResult | null) {
    const ep = ctx.ep;
    const markers = setup.markers.map((m) => m.en);
    saveRetell({
      date: ctx.dateKey,
      epNo: ep.no,
      round: out.round,
      wpm: out.wpm,
      score: out.score,
      durationMs: out.durationMs,
      pauses: out.pauses,
      clausePauses: res?.fluency?.clauseInternalPauses,
      fillers: out.fillers,
      usedLearn: out.keyless ? undefined : usedLearn(out.text, setup.learn.map((l) => l.en)),
      usedMarkers: out.keyless ? undefined : markers.filter((m) => usedLearn(out.text, [m]).length > 0),
      latencyMs: out.latencyMs,
      keyless: out.keyless || undefined,
    });
    // 채점된 발화만 시도 로그에(자기확인은 점수 통계를 부풀리지 않게 — roleStep과 같은 규칙)
    if (!out.keyless)
      logAttempt({
        t: Date.now(),
        en: `retell EP${ep.no} ${out.round}`,
        score: out.score,
        src: 'retell',
        latencyMs: out.latencyMs,
        durationMs: out.durationMs,
        wpm: out.wpm,
        pauseCount: out.pauses,
        clausePauses: res?.fluency?.clauseInternalPauses,
        quality: 'ok',
      });
    bumpSpoken(1, out.keyless ? 'self' : 'scored');
    addMinutes('fluency', Math.max(0.1, Math.round((out.durationMs / 60000) * 10) / 10));
    if (out.audio) void putRecording({ kind: 'retell', blob: out.audio, mime: out.audio.type || 'audio/webm', durationMs: out.durationMs, score: out.keyless ? undefined : out.score, wpm: out.keyless ? undefined : out.wpm, epNo: ep.no, en: out.text || undefined });
    // 1회차(키 있음): 한 줄 교정 + 말하기 증거 — cafLite 1회, 실패는 조용히
    if (first && !out.keyless && out.text) {
      const s = sessionOf(setup.key);
      s.caf = 'pending';
      void cafLite(out.text, { level: setup.level, learn: setup.learn.map((l) => l.en), recap: setup.recap }).then((r) => {
        s.caf = r;
        if (r) {
          try {
            recordSkillResult('speaking', taskCefr(setup.level), retellEvidenceScore(out.score, setup.level, r.level), 'retell');
          } catch {
            /* 증거 저장 실패는 학습 흐름을 막지 않는다 */
          }
        }
        notify();
      });
    }
  }

  async function start() {
    if (phase === 'rec' || phase === 'wait') return;
    setMsg('');
    if (path === 'none') {
      // 마이크가 없다 — 소리 내어 말해 보고 스스로 확인(자기확인 발화)
      const out: RetellRunOut = { round: round.round, label: round.label, sec: round.sec, text: '', wpm: 0, score: 0, durationMs: round.sec * 1000, pauses: 0, fillers: 0, keyless: true };
      commit(out, null);
      setRun(out);
      setPhase('done');
      onDone(out);
      return;
    }
    const audioCtx = createUnlockedAudioContext(); // iOS — 클릭 안에서 동기로
    stopSpeaking();
    setElapsed(0);
    setPhase('rec');
    try {
      const res = await recordAndTranscribe({
        prompt: STT_PROPER_NOUNS, // 고유명사만 — 줄거리를 넣으면 전사가 끌려간다
        language: 'en',
        silenceMs: 0,
        maxMs: round.sec * 1000,
        detail: 'words',
        temperature: 0,
        recordOnly: path !== 'whisper',
        audioCtx,
        registerStop: (f) => (stop.current = f),
        onElapsed: (ms) => alive.current && setElapsed(ms),
        onLevel: (v) => alive.current && setLevel(Math.min(1, v * 8)),
        onState: (s) => s === 'transcribing' && alive.current && setPhase('wait'),
      });
      stop.current = null;
      if (!alive.current) return;
      const block = blockOf(res, path);
      if (block) {
        if (path === 'whisper') logAttempt({ t: Date.now(), en: `retell EP${ctx.ep.no} ${round.round}`, score: 0, src: 'retell', latencyMs: res.voiceOnsetMs, quality: block });
        setMsg(gateMessage(block));
        setPhase('gate');
        return;
      }
      const durationMs = res.durationMs || 0;
      let out: RetellRunOut;
      if (path === 'whisper') {
        const text = (res.text || '').trim();
        const wpm = Math.round(res.fluency?.wpm ?? (durationMs > 0 ? (countWords(text) / durationMs) * 60000 : 0));
        const sc = scoreRetell({ said: text, keywords: setup.keywords, markers: setup.markers, learn: setup.learn.map((l) => l.en), durationMs, wpm, targetSec: round.sec });
        out = {
          round: round.round, label: round.label, sec: round.sec, text, wpm, score: sc.score, durationMs,
          pauses: res.fluency?.pauses300 ?? res.pauses?.length ?? 0,
          fillers: countFillers(text, setup.markers.map((m) => m.en)),
          latencyMs: res.voiceOnsetMs, audio: res.audio, keyless: false,
        };
        setWords(res.words);
      } else {
        out = { round: round.round, label: round.label, sec: round.sec, text: '', wpm: 0, score: 0, durationMs, pauses: res.pauses?.length ?? 0, fillers: 0, latencyMs: res.voiceOnsetMs, audio: res.audio, keyless: true };
      }
      commit(out, res);
      setRun(out);
      setPhase('done');
      onDone(out);
    } catch {
      stop.current = null;
      if (!alive.current) return;
      setMsg('마이크를 열지 못했어요 — 권한을 확인하고 다시 눌러 주세요.');
      setPhase('gate');
    }
  }

  return (
    <div className="rt-run" data-phase={phase} data-path={path} data-round={String(round.round)}>
      <div className="rt-round">{round.label}</div>
      {phase !== 'done' && <Prompts setup={setup} round={round} guide={guide} />}
      {(phase === 'idle' || phase === 'gate') && (
        <>
          {msg && (
            <p className="dr-msg rt-gate" role="status">
              {msg}
            </p>
          )}
          <button type="button" className="btn primary rt-start" onClick={() => void start()}>
            {phase === 'gate' ? '🎙 다시 말하기' : path === 'none' ? '🗣 소리 내어 말했어요' : `🎙 시작 · ${round.sec}초`}
          </button>
        </>
      )}
      {phase === 'rec' && <RecBar elapsed={elapsed} sec={round.sec} level={level} onStop={() => stop.current?.()} />}
      {phase === 'wait' && (
        <p className="rt-status" role="status">
          … 받아쓰는 중
        </p>
      )}
      {phase === 'done' && run && (
        <>
          {!run.keyless && run.text && <Transcript words={words} text={run.text} />}
          <Result run={run} setup={setup} />
        </>
      )}
    </div>
  );
}

/* ───────── 카드 ───────── */

const on = () => {
  try {
    return isOn('retell');
  } catch {
    return false;
  }
};

function RetellCardBasic({ ctx }: { ctx: EndingCtx }) {
  const setup = useMemo(() => retellSetup(ctx), [ctx]);
  const s = useSession(setup.key);
  const done = s.runs.some((r) => r.round === setup.first.round);
  const guide = setup.mix ? RETELL_GUIDES.mix : setup.phase === 'first14' ? RETELL_GUIDES.short : RETELL_GUIDES.round1;
  return (
    <div className="rt-card" data-phase={setup.phase} data-mix={setup.mix ? '1' : '0'}>
      <div className="ee-title rt-title">🗣 {setup.mix ? '이번 주 이야기 다시 말하기' : '이야기 다시 말하기'}</div>
      <RetellRunner
        ctx={ctx}
        setup={setup}
        round={setup.first}
        guide={guide}
        first
        onDone={(r) => {
          sessionOf(setup.key).runs.push(r);
          notify();
        }}
      />
      {done && setup.more.length > 0 && <p className="rt-note">{setup.m333 ? '오늘은 한 달에 한 번 "정확하게 말하기 날" — 아래 조금 더 ▾ 에서 이어서.' : '아래 조금 더 ▾ 에서 2회차 — 더 짧게, 더 빠르게.'}</p>}
    </div>
  );
}

/** 2회차 전 '한 줄 교정' — 인물 목소리로 듣고 한 번 따라 말하기 */
function FixStep({ caf, listener, onNext }: { caf: Session['caf']; listener: Listener; onNext: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'rec' | 'wait' | 'done'>('idle');
  const [score, setScore] = useState<number | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  if (caf === 'pending')
    return (
      <div className="rt-fix">
        <p className="rt-status" role="status">
          ✏️ 한 줄 교정 준비 중…
        </p>
        <button type="button" className="btn ghost rt-skip" onClick={onNext}>
          교정 없이 2회차로
        </button>
      </div>
    );
  const fix = caf && typeof caf === 'object' ? caf.fix : null;
  if (!fix) return null;
  async function follow() {
    const audioCtx = createUnlockedAudioContext();
    setPhase('rec');
    try {
      const res = await recordAndTranscribe({ prompt: STT_PROPER_NOUNS, language: 'en', silenceMs: 1500, maxMs: 10000, temperature: 0, audioCtx, registerStop: (f) => (stop.current = f), onState: (s) => s === 'transcribing' && setPhase('wait') });
      stop.current = null;
      const said = (res.text || '').trim();
      const sc = said ? alignedScore(fix!.better, said).score : 0;
      if (said) {
        logAttempt({ t: Date.now(), en: fix!.better, score: sc, src: 'retell', latencyMs: res.voiceOnsetMs, durationMs: res.durationMs, quality: 'ok' });
        bumpSpoken(1);
      }
      setScore(sc);
    } catch {
      setScore(null);
    }
    setPhase('done');
  }
  return (
    <div className="rt-fix" data-phase={phase}>
      <div className="rt-sub">✏️ 한 줄만 고쳐요</div>
      <p className="rt-fix-wrong" lang="en">
        <s>{fix.wrong}</s>
      </p>
      <p className="rt-fix-better" lang="en">
        → {fix.better}
      </p>
      <p className="rt-fix-kr">{fix.kr}</p>
      <div className="rt-row">
        <button type="button" className="mini-btn rt-fix-play" onClick={() => speakText(fix.better, 'en-US', 0.95, undefined, voiceOf(listener.id))}>
          🔊 {listener.name}의 목소리로
        </button>
        {phase === 'idle' && (
          <button type="button" className="btn ghost rt-fix-follow" onClick={() => void follow()}>
            🎙 따라 말하기
          </button>
        )}
        {phase === 'rec' && (
          <button type="button" className="btn ghost rt-stop" onClick={() => stop.current?.()}>
            ⏹ 끝
          </button>
        )}
      </div>
      {phase === 'wait' && <p className="rt-status">… 받아쓰는 중</p>}
      {phase === 'done' && <p className="rt-fix-res">{score === null ? '녹음하지 못했어요 — 들은 것만으로도 충분해요.' : `따라 말하기 ${score}점${score >= 60 ? ' ✓' : ''}`}</p>}
      <button type="button" className="btn primary rt-fix-next" onClick={onNext}>
        2회차로 ▶
      </button>
    </div>
  );
}

/** 회차별 WPM 비교 + 가장 빨랐던 회차 ▶ */
function WpmCompare({ runs }: { runs: RetellRunOut[] }) {
  const scored = runs.filter((r) => !r.keyless);
  if (!scored.length) {
    const last = runs[runs.length - 1];
    return (
      <div className="rt-cmp" role="status">
        <p className="rt-note">
          {runs.length}번 말했어요 · 말한 시간 {runs.map((r) => sec1(r.durationMs)).join(' → ')}
        </p>
        <ClipButton clip={last?.audio} label="마지막 회차 ▶" />
      </div>
    );
  }
  const max = Math.max(1, ...scored.map((r) => r.wpm));
  const best = scored.reduce((a, b) => (b.wpm > a.wpm ? b : a));
  return (
    <div className="rt-cmp" role="status">
      <div className="rt-sub">WPM 비교</div>
      {scored.map((r, k) => (
        <div key={k} className={`rt-cmp-row${r === best ? ' best' : ''}`}>
          <span className="rt-cmp-label">{r.label.split(' · ')[0].replace(/ \(.*\)$/, '')}</span>
          <span className="rt-cmp-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${r.wpm / max})` }} />
          </span>
          <span className="rt-cmp-n">
            {r.wpm}
            {r === best ? ' ★' : ''}
          </span>
        </div>
      ))}
      <ClipButton clip={best.audio} label="가장 빨랐던 회차 ▶" className="rt-best" />
    </div>
  );
}

function RetellCardMore({ ctx }: { ctx: EndingCtx }) {
  const setup = useMemo(() => retellSetup(ctx), [ctx]);
  const s = useSession(setup.key);
  const [k, setK] = useState(0);
  const [fixSeen, setFixSeen] = useState(false);
  const firstDone = s.runs.some((r) => r.round === setup.first.round);
  if (!firstDone) {
    return (
      <div className="rt-card more">
        <div className="ee-title rt-title">🗣 {setup.m333 ? '정확하게 말하기 날' : '이야기 다시 말하기 — 2·3회차'}</div>
        <p className="rt-note">위의 1회차를 먼저 말해 주세요.</p>
      </div>
    );
  }
  const showFix = !fixSeen && k === 0 && (s.caf === 'pending' || (!!s.caf && typeof s.caf === 'object' && !!s.caf.fix));
  const allDone = k >= setup.more.length;
  const round = setup.more[k];
  const guideOf = (r: RetellRound) => (setup.m333 ? RETELL_GUIDES.m333 : r.round === 3 ? RETELL_GUIDES.round3 : RETELL_GUIDES.round2);
  return (
    <div className="rt-card more" data-k={k}>
      <div className="ee-title rt-title">🗣 {setup.m333 ? '정확하게 말하기 날 · 30초×3' : '이야기 다시 말하기 — 2·3회차'}</div>
      {showFix ? (
        <FixStep caf={s.caf} listener={setup.more[0]?.listener || LISTENERS[1]} onNext={() => setFixSeen(true)} />
      ) : !allDone && round ? (
        <>
          <RetellRunner
            key={k}
            ctx={ctx}
            setup={setup}
            round={round}
            guide={guideOf(round)}
            onDone={(r) => {
              sessionOf(setup.key).runs.push(r);
              notify();
            }}
          />
          <div className="rt-row">
            {s.runs.length > k + 1 && (
              <button type="button" className="btn primary rt-next" onClick={() => setK((x) => x + 1)}>
                {k + 1 < setup.more.length ? '다음 회차 ▶' : '비교 보기 ▶'}
              </button>
            )}
            {round.round === 3 && s.runs.length <= k + 1 && (
              <button type="button" className="btn ghost rt-skip" onClick={() => setK(setup.more.length)}>
                3회차 건너뛰기
              </button>
            )}
          </div>
        </>
      ) : (
        <WpmCompare runs={s.runs} />
      )}
    </div>
  );
}

export const RETELL_CARD = registerEndingCard({
  id: 'retell',
  order: 10,
  basic: true,
  when: () => on(),
  Component: RetellCardBasic,
});

export const RETELL_MORE_CARD = registerEndingCard({
  id: 'retell-more',
  order: 30,
  basic: false,
  when: (ctx) => on() && retellSetup(ctx).more.length > 0,
  Component: RetellCardMore,
});
