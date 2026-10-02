'use client';

/**
 * 교정 → 다시 말하기 게이트(M6) — 회화 턴에서 AI(또는 L1 규칙)가 고쳐 준 문장을
 * 인물 목소리로 들려주고, 한 번 따라 말하게 한다(recast & retry).
 *
 *  · alignedScore ≥ 60이면 '63점 ✓ 다음으로'. 미만이면 '다음에 다시 — 회상에 넣었어요'(실패해도 통과).
 *  · 기회는 1회 — 무음·에코·바쁨 같은 게이트 사유는 시도로 세지 않는다(다시 말할 수 있다).
 *  · 마이크·받아쓰기가 없으면 듣기만 하고 넘어간다(회상 큐엔 넣는다).
 * 판정·회상 등록은 lib/fixGate(gateVerdict·settleGate), 기록은 logAttempt(src 'dtalk')·bumpSpoken.
 */
import { useEffect, useRef, useState } from 'react';
import { speakText, stopSpeaking } from '../SpeakButton';
import { canTryGate, gateVerdict, settleGate, type GateResult, type TalkFix } from '../../lib/fixGate';
import { recAvailable, recOnce } from '../../lib/dtalkRec';
import { gateMessage } from '../../lib/sttQuality';
import { logAttempt } from '../../lib/reviewEngine';
import { bumpSpoken } from '../../lib/state';
import { markInteraction } from '../../lib/dayGovernor';
import { L1_LABEL } from '../../lib/speakLabels';

export interface FixGateProps {
  fix: TalkFix;
  epNo: number;
  /** 인물 목소리(voiceOf) */
  voice: string;
  rate: number;
  /** L1 간섭 칩 문구(있으면 노란 칩 1개) */
  l1Label?: string | null;
  onDone: (r: GateResult) => void;
}

export default function FixGate({ fix, epNo, voice, rate, l1Label, onDone }: FixGateProps) {
  const [st, setSt] = useState<'ready' | 'rec' | 'wait' | 'result'>('ready');
  const [msg, setMsg] = useState('');
  const [res, setRes] = useState<{ score: number; passed: boolean; queued: boolean; said: string } | null>(null);
  const tries = useRef(0);
  const stop = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const canRec = recAvailable();

  const hear = () => {
    stopSpeaking();
    speakText(fix.better, 'en-US', rate, undefined, voice);
  };

  useEffect(() => {
    alive.current = true;
    // 고친 문장을 인물 목소리로 먼저 한 번 들려준다
    hear();
    return () => {
      alive.current = false;
      stop.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function rec() {
    if (st === 'rec') {
      stop.current?.();
      return;
    }
    if (!canTryGate(tries.current)) return;
    stopSpeaking();
    setMsg('');
    setSt('rec');
    try {
      const r = await recOnce({ language: 'en', maxMs: 15000, silenceMs: 1500, temperature: 0, registerStop: (f) => (stop.current = f), onState: (s) => s === 'transcribing' && alive.current && setSt('wait') });
      stop.current = null;
      if (!alive.current) return;
      if (r.block || !r.text) {
        // 게이트 사유는 시도로 세지 않는다 — 한 번 더 말할 수 있다
        if (r.block) logAttempt({ t: Date.now(), en: fix.better, score: 0, src: 'dtalk', durationMs: r.durationMs, quality: r.block });
        setMsg(r.block ? gateMessage(r.block) : '소리가 안 잡혔어요. 한 번 더 말해 볼까요?');
        setSt('ready');
        return;
      }
      tries.current++;
      const v = gateVerdict(fix.better, r.text);
      const queued = settleGate(fix, v, epNo) === 'queued';
      logAttempt({ t: Date.now(), en: fix.better, score: v.score, src: 'dtalk', durationMs: r.durationMs, quality: 'ok' });
      bumpSpoken();
      markInteraction();
      setRes({ ...v, queued, said: r.text });
      setSt('result');
    } catch {
      stop.current = null;
      if (!alive.current) return;
      setMsg('녹음이나 받아 적기에 실패했어요. 들어 보고 넘어가도 괜찮아요.');
      setSt('ready');
    }
  }

  function skip() {
    stopSpeaking();
    // 시도하지 않고 넘어가도 고친 문장은 회상 큐로(내일 말로 떠올리기)
    settleGate(fix, { passed: false }, epNo);
    onDone({ score: null, passed: false, skipped: true });
  }

  return (
    <div className={`fgate${res ? (res.passed ? ' ok' : ' miss') : ''}`} role="group" aria-label="더 자연스럽게 따라 말하기">
      <div className="fgate-head">
        <span className="fgate-kicker">✏️ 더 자연스럽게 — 들어보고 따라 말해요</span>
        {l1Label && <span className="fgate-l1">{L1_LABEL} · {l1Label}</span>}
      </div>
      <button type="button" className="fgate-better" onClick={hear} aria-label={`다시 듣기: ${fix.better}`}>
        <b lang="en">🔊 {fix.better}</b>
        {fix.kr && <span>{fix.kr}</span>}
        <em>{fix.why}</em>
      </button>
      {st !== 'result' && (
        <div className="fgate-row">
          {canRec ? (
            <button type="button" className={`fgate-mic${st === 'rec' ? ' on' : ''}`} disabled={st === 'wait'} onClick={() => void rec()} aria-label={st === 'rec' ? '말하기 끝' : '고친 문장 따라 말하기'}>
              {st === 'rec' ? '⏹ 끝' : st === 'wait' ? '…' : '🎙 따라 말하기'}
            </button>
          ) : null}
          <button type="button" className="fgate-skip" onClick={skip}>
            {canRec ? '넘어가기' : '들었어요 — 다음으로'}
          </button>
        </div>
      )}
      {msg && (
        <p className="fgate-msg" role="status">
          {msg}
        </p>
      )}
      {res && (
        <div className="fgate-res" role="status">
          <p className="fgate-said">
            “{res.said}” — <b>{res.score}점</b>
          </p>
          <button
            type="button"
            className="fgate-next"
            onClick={() => {
              stopSpeaking();
              onDone({ score: res.score, passed: res.passed, skipped: false });
            }}
          >
            {res.passed ? `${res.score}점 ✓ 다음으로` : res.queued ? '다음에 다시 — 회상에 넣었어요 · 다음으로' : '다음에 다시 — 다음으로'}
          </button>
        </div>
      )}
    </div>
  );
}
