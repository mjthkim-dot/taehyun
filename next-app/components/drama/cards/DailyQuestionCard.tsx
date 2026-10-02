'use client';

/**
 * 오늘 질문 1개(M5, '조금 더 ▾' order 60) — 월·수·금만. 아는 대사가 아닌 '즉흥 발화' 20초 1번으로 전이 병목을 건드린다.
 *
 * 질문은 AI 없이 규칙으로 만든다(lib/retell.dailyQuestionFor — 원고의 cliff/recap + 템플릿 6개). 질문 영어는 보여 주고
 * 인물 목소리로 들을 수도 있다(이해가 아니라 대답이 과제라서). 키 있음: 받아써서 단어 수·WPM·시작까지 걸린 시간,
 * 키 없음(전사 불가): recordOnly — 말한 시간·시작까지 걸린 시간 + '내 소리 ▶'만.
 * 기록: logAttempt(src 'daily-q', 채점된 것만) · putRecording(kind 'daily-q', 최근 3개 보존) · bumpSpoken(1) · addMinutes('fluency').
 * 플래그 retell off면 리텔과 함께 숨는다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { registerEndingCard, type EndingCtx } from '../endingRegistry';
import { voiceOf } from '../../../lib/drama';
import { isOn } from '../../../lib/flags';
import { markInteraction, setStrand } from '../../../lib/dayGovernor';
import { dailyQScore, dailyQuestionFor, LISTENERS, type DailyQuestion } from '../../../lib/retell';
import { recordAndTranscribe, createUnlockedAudioContext, STT_PROPER_NOUNS, type SttResult } from '../../../lib/stt';
import { gateMessage } from '../../../lib/sttQuality';
import { countWords } from '../../../lib/fluency';
import { logAttempt } from '../../../lib/reviewEngine';
import { putRecording } from '../../../lib/storage';
import { bumpSpoken } from '../../../lib/state';
import { addMinutes } from '../../../lib/timeBudget';
import { speakText, stopSpeaking } from '../../SpeakButton';
import { ClipButton, RecBar, blockOf, freePath } from './RetellCard';

const whoOf = (no: number) => LISTENERS[no % LISTENERS.length];

export function questionOf(ctx: EndingCtx): DailyQuestion | null {
  const ep = ctx.ep;
  // 1화처럼 recap이 빈 화는 예고(cliff)로 대신한다 — '()'만 남지 않게
  return dailyQuestionFor({ no: ep.no, cliff: ep.cliff || '', recap: ep.recap || ep.cliff || '' }, ctx.dateKey, whoOf(ep.no));
}

interface Out {
  words: number;
  wpm: number;
  durationMs: number;
  latencyMs?: number;
  text: string;
  audio?: Blob;
  keyless: boolean;
}

function DailyQuestionView({ ctx }: { ctx: EndingCtx }) {
  const q = useMemo(() => questionOf(ctx), [ctx]);
  const path = useMemo(freePath, []);
  const [phase, setPhase] = useState<'idle' | 'rec' | 'wait' | 'gate' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [msg, setMsg] = useState('');
  const [out, setOut] = useState<Out | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current?.();
    };
  }, []);
  if (!q) return null;
  const who = whoOf(ctx.ep.no);

  function record(o: Out) {
    if (!o.keyless)
      logAttempt({ t: Date.now(), en: q!.en, score: dailyQScore(o.words), src: 'daily-q', latencyMs: o.latencyMs, durationMs: o.durationMs, wpm: o.wpm, quality: 'ok' });
    bumpSpoken(1, o.keyless ? 'self' : 'scored');
    addMinutes('fluency', Math.max(0.1, Math.round((o.durationMs / 60000) * 10) / 10));
    if (o.audio) void putRecording({ kind: 'daily-q', blob: o.audio, mime: o.audio.type || 'audio/webm', durationMs: o.durationMs, question: q!.en, en: o.text || undefined, epNo: ctx.ep.no, wpm: o.keyless ? undefined : o.wpm });
  }

  async function start() {
    setMsg('');
    if (path === 'none') {
      const o: Out = { words: 0, wpm: 0, durationMs: q!.sec * 1000, text: '', keyless: true };
      record(o);
      setOut(o);
      setPhase('done');
      return;
    }
    const audioCtx = createUnlockedAudioContext();
    stopSpeaking();
    setElapsed(0);
    setPhase('rec');
    try {
      // 리텔·오늘 질문은 '유창성' 갈래 — 하루 조절기(M4)가 이 시간을 fluency로 센다      setStrand('fluency');      markInteraction();
      const res: SttResult = await recordAndTranscribe({
        prompt: STT_PROPER_NOUNS,
        language: 'en',
        silenceMs: 0,
        maxMs: q!.sec * 1000,
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
        if (path === 'whisper') logAttempt({ t: Date.now(), en: q!.en, score: 0, src: 'daily-q', latencyMs: res.voiceOnsetMs, quality: block });
        setMsg(gateMessage(block));
        setPhase('gate');
        return;
      }
      const durationMs = res.durationMs || 0;
      const text = (res.text || '').trim();
      const n = path === 'whisper' ? res.words?.length || countWords(text) : 0;
      const o: Out = {
        words: n,
        wpm: path === 'whisper' ? Math.round(res.fluency?.wpm ?? (durationMs > 0 ? (n / durationMs) * 60000 : 0)) : 0,
        durationMs,
        latencyMs: res.voiceOnsetMs,
        text,
        audio: res.audio,
        keyless: path !== 'whisper',
      };
      record(o);
      setOut(o);
      setPhase('done');
    } catch {
      stop.current = null;
      if (!alive.current) return;
      setMsg('마이크를 열지 못했어요 — 권한을 확인하고 다시 눌러 주세요.');
      setPhase('gate');
    }
  }

  const s1 = (ms?: number) => (typeof ms === 'number' ? `${(ms / 1000).toFixed(1)}초` : '–');
  return (
    <div className="rt-card rt-dq" data-phase={phase} data-path={path}>
      <div className="ee-title rt-title">❓ 오늘 질문 1개 — {q.sec}초</div>
      <p className="rt-dq-en" lang="en">
        {q.en}
        <button type="button" className="mini-btn rt-dq-play" aria-label="질문 듣기" onClick={() => speakText(q.en, 'en-US', 0.95, undefined, voiceOf(who.id))}>
          🔊
        </button>
      </p>
      <p className="rt-dq-kr">{q.kr}</p>
      {(phase === 'idle' || phase === 'gate') && (
        <>
          {msg && (
            <p className="dr-msg rt-gate" role="status">
              {msg}
            </p>
          )}
          <p className="rt-note">정답은 없어요. 준비 없이 바로, 아는 단어로 끝까지.</p>
          <button type="button" className="btn primary rt-start" onClick={() => void start()}>
            {phase === 'gate' ? '🎙 다시 말하기' : path === 'none' ? '🗣 소리 내어 말했어요' : `🎙 시작 · ${q.sec}초`}
          </button>
        </>
      )}
      {phase === 'rec' && <RecBar elapsed={elapsed} sec={q.sec} level={level} onStop={() => stop.current?.()} />}
      {phase === 'wait' && (
        <p className="rt-status" role="status">
          … 받아쓰는 중
        </p>
      )}
      {phase === 'done' && out && (
        <div className={`rt-result${out.keyless ? ' keyless' : ''}`} role="status">
          {!out.keyless && out.text && (
            <p className="rt-said" lang="en">
              {out.text}
            </p>
          )}
          <div className="rt-chips">
            {!out.keyless && <span className="rt-chip stat">단어 {out.words}</span>}
            {!out.keyless && <span className="rt-chip stat">WPM {out.wpm}</span>}
            <span className="rt-chip stat">말한 시간 {s1(out.durationMs)}</span>
            <span className="rt-chip stat">시작까지 {s1(out.latencyMs)}</span>
          </div>
          <ClipButton clip={out.audio} />
        </div>
      )}
    </div>
  );
}

export const DAILY_QUESTION_CARD = registerEndingCard({
  id: 'daily-q',
  order: 60,
  basic: false,
  when: (ctx) => {
    try {
      return isOn('retell') && !!questionOf(ctx);
    } catch {
      return false;
    }
  },
  Component: DailyQuestionView,
});
