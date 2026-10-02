'use client';

/**
 * 말하기 기준선(M10) — 배치고사 결과 바로 아래 '마지막 한 단계'.
 *
 * 배치고사는 문법 객관식뿐이라 말하기 레벨을 잘못 짚는다. 그래서 첫날 자유 발화를 한 번 녹음해
 *   · 키 있음: 받아써서 WPM → speakingAdj → 말하기 배치 사전값 ±1단계(B1 상한) 보정 + 시도 로그 src 'baseline'
 *   · 키 없음: Blob·길이·발성 비율만 저장(adj 생략, pendingRetranscribe) — 키를 등록하는 순간 1회 재전사해 사후 보정
 *   · 마이크 없음: 건너뛰기만
 * 녹음은 putRecording(kind 'baseline', 영구 보존) — 30일 뒤 같은 질문과 비교하는 기준점이 된다.
 * A1은 '오늘 하루 3문장' 15초, A2+는 '요즘 일과 고객' 30초. 언제든 건너뛸 수 있다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Cefr } from '../lib/cefr';
import { todayKey } from '../lib/dates';
import { BASELINE_GUIDES, placementQuestionFor, saveBaseline, type Baseline } from '../lib/baseline';
import { finalizeBaseline, metricsFromWords, recPath, sentenceCount, voicedRatio } from '../lib/growthArchive';
import { recordAndTranscribe, createUnlockedAudioContext, STT_PROPER_NOUNS } from '../lib/stt';
import { putRecording } from '../lib/storage';
import { blockingReason, gateMessage } from '../lib/sttQuality';
import { sttErrorMessage } from '../lib/sttErrors';
import { addMinutes } from '../lib/timeBudget';
import { speakText, stopSpeaking } from './SpeakButton';
import { ClipRow, RecMeter, TAEO_VOICE } from './progress/GaBits';
import { wpmText } from '../lib/speakLabels';

type Phase = 'idle' | 'rec' | 'wait' | 'done' | 'skipped' | 'gate';

interface Out {
  keyless: boolean;
  durationMs: number;
  wpm?: number;
  words?: number;
  sentences?: number;
  text?: string;
  from: Cefr;
  to?: Cefr;
  audio?: Blob;
}

export default function BaselineStep({ level, onDone }: { level: Cefr; onDone?: (saved: boolean) => void }) {
  const q = useMemo(() => placementQuestionFor(level), [level]);
  const path = useMemo(recPath, []);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [lv, setLv] = useState(0);
  const [msg, setMsg] = useState('');
  const [out, setOut] = useState<Out | null>(null);
  const stop = useRef<(() => void) | null>(null);
  /** 채점 못 한 녹음을 다시 녹음하면 같은 칸을 덮어쓴다(영구 보존 종류라 쌓이지 않게) */
  const recId = useRef<string | undefined>(undefined);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current?.();
    };
  }, []);

  async function start() {
    setMsg('');
    const audioCtx = createUnlockedAudioContext();
    stopSpeaking();
    setElapsed(0);
    setPhase('rec');
    try {
      const res = await recordAndTranscribe({
        prompt: STT_PROPER_NOUNS,
        language: 'en',
        silenceMs: 0, // 긴 발화 — 사용자가 멈추거나 시간이 끝날 때까지
        maxMs: q.sec * 1000,
        detail: 'words',
        temperature: 0,
        recordOnly: path !== 'whisper',
        audioCtx,
        registerStop: (f) => (stop.current = f),
        onElapsed: (ms) => alive.current && setElapsed(ms),
        onLevel: (v) => alive.current && setLv(Math.min(1, v * 8)),
        onState: (s) => s === 'transcribing' && alive.current && setPhase('wait'),
      });
      stop.current = null;
      if (!alive.current) return;
      if (res.reason === 'no-audio' || !res.audio) {
        setMsg('소리가 잡히지 않았어요 — 마이크를 확인하고 다시 눌러 주세요.');
        setPhase('gate');
        return;
      }
      const durationMs = res.durationMs || 0;
      // 품질 게이트(환각·불명확·누출)에 막힌 전사로는 말하기 레벨을 보정하지 않는다 — 녹음은 남기고(키 등록 재전사와 같은 대기) 다시 녹음 안내
      const said = (res.text || '').trim();
      const block = path !== 'whisper' ? null : res.reason === 'busy' ? 'busy' : !said ? (res.reason === 'silent' ? 'silent' : 'unclear') : blockingReason(res);
      const transcribed = path === 'whisper' && !block;
      const id = await putRecording({ ...(recId.current ? { id: recId.current } : {}), kind: 'baseline', blob: res.audio, mime: res.audio.type || 'audio/webm', durationMs, question: q.en, en: transcribed ? res.text : undefined, wpm: transcribed ? Math.round(res.fluency?.wpm || 0) : undefined });
      if (id) recId.current = id;
      addMinutes('output', Math.max(0.1, Math.round((durationMs / 60000) * 10) / 10));
      const voiced = voicedRatio(durationMs, res.voiceOnsetMs, res.pauseSource === 'rms' ? res.pauses : []);
      const b: Baseline = {
        date: todayKey(),
        level,
        durationMs,
        ...(voiced != null ? { voiced } : {}),
        ...(id ? { recordingId: id } : {}),
        // 전사를 못 했으면(키 없음·서버 바쁨·안 들림) 키가 생겼을 때 다시 받아쓴다
        pendingRetranscribe: !transcribed,
      };
      if (transcribed) {
        const m = metricsFromWords(res.words, res.text, durationMs);
        const r = finalizeBaseline(b, m);
        setOut({ keyless: false, durationMs, wpm: r.b.wpm, words: m.words, sentences: sentenceCount(res.text), text: res.text, from: level, to: r.speaking, audio: res.audio });
      } else {
        saveBaseline(b);
        if (block) {
          if (!alive.current) return;
          setMsg(`${gateMessage(block)} — 녹음은 저장했어요. 다시 녹음하면 말하기 레벨을 맞출 수 있어요.`);
          setPhase('gate');
          return;
        }
        setOut({ keyless: true, durationMs, from: level, audio: res.audio });
      }
      setPhase('done');
      onDone?.(true);
    } catch (e) {
      stop.current = null;
      if (!alive.current) return;
      setMsg(sttErrorMessage(e));
      setPhase('gate');
    }
  }

  function skip() {
    stop.current?.();
    setPhase('skipped');
    onDone?.(false);
  }

  const s1 = (ms: number) => `${(ms / 1000).toFixed(1)}초`;

  return (
    <div className="study-card ga-baseline" data-phase={phase} data-path={path}>
      <div className="ga-title">🎙 말하기 기준선</div>
      {(phase === 'idle' || phase === 'gate') && (
        <>
          <p className="ga-lead">{level === 'A1' ? BASELINE_GUIDES.intro : BASELINE_GUIDES.introA2}</p>
          <p className="ga-q" lang="en">
            {q.en}
            <button type="button" className="mini-btn ga-q-play" aria-label="질문 듣기" onClick={() => speakText(q.en, 'en-US', 0.95, undefined, TAEO_VOICE)}>
              🔊
            </button>
          </p>
          <p className="ga-q-kr">{q.kr}</p>
          {msg && (
            <p className="ga-msg" role="status">
              {msg}
            </p>
          )}
          {path === 'record' && <p className="ga-note">{BASELINE_GUIDES.noKey}</p>}
          <div className="ga-actions">
            {path !== 'none' && (
              <button type="button" className="btn primary ga-start" onClick={() => void start()}>
                🎙 {phase === 'gate' ? '다시 녹음' : `녹음 시작 · ${q.sec}초`}
              </button>
            )}
            <button type="button" className="btn ghost ga-skip" onClick={skip}>
              건너뛰기
            </button>
          </div>
          {path === 'none' && <p className="ga-note">이 기기는 녹음을 쓸 수 없어요 — 건너뛰고 나중에 진도 화면에서 만들 수 있어요.</p>}
        </>
      )}
      {phase === 'rec' && <RecMeter elapsed={elapsed} sec={q.sec} level={lv} onStop={() => stop.current?.()} />}
      {phase === 'wait' && (
        <p className="ga-status" role="status">
          … 받아쓰는 중
        </p>
      )}
      {phase === 'done' && out && (
        <div className="ga-result" role="status">
          <p className="ga-saved">✓ {BASELINE_GUIDES.saved}</p>
          {!out.keyless && out.text && (
            <p className="ga-said" lang="en">
              {out.text}
            </p>
          )}
          <div className="ga-chips">
            <span className="ga-chip">말한 시간 {s1(out.durationMs)}</span>
            {!out.keyless && typeof out.wpm === 'number' && <span className="ga-chip">{wpmText(out.wpm)}</span>}
            {!out.keyless && <span className="ga-chip">단어 {out.words}</span>}
            {!out.keyless && level === 'A1' && <span className="ga-chip">{(out.sentences || 0) >= 3 ? '3문장 ✓' : `${out.sentences || 0}문장`}</span>}
          </div>
          {!out.keyless && out.to && (
            <p className="ga-adj">{out.to === out.from ? `말하기 레벨 ${out.from} 그대로` : `말하기 레벨 ${out.from} → ${out.to}로 맞췄어요`}</p>
          )}
          {out.keyless && <p className="ga-note">{BASELINE_GUIDES.noKey}</p>}
          <ClipRow items={[{ label: '내 소리 ▶', clip: out.audio }]} />
        </div>
      )}
      {phase === 'skipped' && <p className="ga-note ga-skipped">{BASELINE_GUIDES.skipped}</p>}
    </div>
  );
}
