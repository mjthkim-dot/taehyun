'use client';

/**
 * 회화 종료 화면의 미니 사다리(M6, 화·금만) — 이번 대화에서 내가 한 가장 긴 영어 문장 1개를
 * nativeLadder 3단(기본 → 자연스럽게 → 원어민)으로 다시 쓰고, 단마다 듣고 따라 말해 80점이면 다음 단이 열린다.
 * LadderScreen의 단 잠금 UI(ld-rung)를 그대로 쓰되 SpeakingPractice 대신 가벼운 🎙 한 번(dtalkRec).
 * 생성은 캐시 우선(같은 문장 재방문은 AI 0회, 캐시 60). 완주하면 markLadderDone + 원어민 단을 회상 큐로.
 * 사다리 생성이 실패하면 조용히 접는다(회화 완료는 이미 기록됐다).
 */
import { useEffect, useRef, useState } from 'react';
import { speakText, stopSpeaking } from '../SpeakButton';
import { generateLadder, getCachedLadder, markLadderDone, type Ladder } from '../../lib/nativeLadder';
import { alignedScore } from '../../lib/align';
import { LADDER_PASS } from '../../lib/fixGate';
import { recAvailable, recOnce } from '../../lib/dtalkRec';
import { gateMessage } from '../../lib/sttQuality';
import { logAttempt } from '../../lib/reviewEngine';
import { addWeakItem, bumpSpoken } from '../../lib/state';
import { markInteraction } from '../../lib/dayGovernor';
import type { Cefr } from '../../lib/lessons';

export interface LadderMiniProps {
  seed: string;
  level: Cefr;
  epNo: number;
  /** 인물 이름 — '이 말, 마야처럼 하면?' */
  partnerName: string;
  voice: string;
  rate: number;
}

export default function LadderMini({ seed, level, epNo, partnerName, voice, rate }: LadderMiniProps) {
  const [ladder, setLadder] = useState<Ladder | null>(() => getCachedLadder(seed));
  const [state, setState] = useState<'loading' | 'ready' | 'fail'>(() => (getCachedLadder(seed) ? 'ready' : 'loading'));
  const [idx, setIdx] = useState(0);
  const [rec, setRec] = useState<'idle' | 'rec' | 'wait'>('idle');
  const [last, setLast] = useState<{ score: number; said: string } | null>(null);
  const [msg, setMsg] = useState('');
  const stop = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const canRec = recAvailable();

  useEffect(() => {
    alive.current = true;
    if (!ladder) {
      void generateLadder(seed, level).then((l) => {
        if (!alive.current) return;
        if (l) {
          setLadder(l);
          setState('ready');
        } else setState('fail');
      });
    }
    return () => {
      alive.current = false;
      stop.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'fail') return null;
  if (state === 'loading' || !ladder) {
    return (
      <div className="fgate-ladder" role="status">
        <div className="dr-sec">이 말, {partnerName}처럼 하면?</div>
        <p className="muted">내 문장으로 사다리를 만드는 중…</p>
      </div>
    );
  }

  const done = idx >= ladder.rungs.length;
  const hear = (en: string) => {
    stopSpeaking();
    speakText(en, 'en-US', rate, undefined, voice);
  };

  function next() {
    setLast(null);
    setMsg('');
    const n = idx + 1;
    setIdx(n);
    if (n >= ladder!.rungs.length) {
      markLadderDone(seed);
      markInteraction();
      const top = ladder!.rungs[ladder!.rungs.length - 1];
      // 원어민 단은 내일 '말로 떠올리기'로 다시
      addWeakItem({ en: top.en, kr: top.kr, cat: '드라마', lesson: `drama:${epNo}` }, 1);
    }
  }

  async function say(en: string) {
    if (rec === 'rec') {
      stop.current?.();
      return;
    }
    stopSpeaking();
    setMsg('');
    setRec('rec');
    try {
      const r = await recOnce({ language: 'en', maxMs: 15000, silenceMs: 1500, temperature: 0, registerStop: (f) => (stop.current = f), onState: (s) => s === 'transcribing' && alive.current && setRec('wait') });
      stop.current = null;
      if (!alive.current) return;
      setRec('idle');
      if (r.block || !r.text) {
        setMsg(r.block ? gateMessage(r.block) : '소리가 안 잡혔어요. 한 번 더 말해 볼까요?');
        return;
      }
      const score = alignedScore(en, r.text).score;
      logAttempt({ t: Date.now(), en, score, src: 'ladder', durationMs: r.durationMs, quality: 'ok' });
      bumpSpoken();
      setLast({ score, said: r.text });
    } catch {
      stop.current = null;
      if (!alive.current) return;
      setRec('idle');
      setMsg('녹음에 실패했어요. 들어 보고 넘어가도 괜찮아요.');
    }
  }

  return (
    <div className="fgate-ladder">
      <div className="dr-sec">이 말, {partnerName}처럼 하면?</div>
      <p className="fgate-ladder-seed muted">
        내 말: “{ladder.seed}” {done ? '· 🏁 3단 완주!' : `· ${idx + 1}/${ladder.rungs.length}단`}
      </p>
      {ladder.rungs.map((r, i) => {
        const st = i < idx ? 'done' : i === idx ? 'active' : 'locked';
        return (
          <div key={i} className={`ld-rung ${st}`}>
            <div className="ld-rung-top">
              <span className={`ld-level ld-level-${i}`}>
                {st === 'done' ? '✓ ' : st === 'locked' ? '🔒 ' : ''}
                {r.level}
              </span>
            </div>
            {st === 'done' && <div className="ld-rung-en muted">{r.en}</div>}
            {st === 'active' && (
              <>
                <button type="button" className="fgate-better" onClick={() => hear(r.en)}>
                  <b lang="en">🔊 {r.en}</b>
                  <span>{r.kr}</span>
                  <em>{r.note}</em>
                </button>
                <div className="fgate-row">
                  {canRec && (
                    <button type="button" className={`fgate-mic${rec === 'rec' ? ' on' : ''}`} disabled={rec === 'wait'} onClick={() => void say(r.en)}>
                      {rec === 'rec' ? '⏹ 끝' : rec === 'wait' ? '…' : '🎙 따라 말하기'}
                    </button>
                  )}
                  {last && last.score >= LADDER_PASS ? (
                    <button type="button" className="fgate-next" onClick={next}>
                      {last.score}점 ✓ {i >= ladder.rungs.length - 1 ? '완주하기' : '다음 단 열기'}
                    </button>
                  ) : (
                    <button type="button" className="fgate-skip" onClick={next}>
                      이 단 건너뛰기
                    </button>
                  )}
                </div>
                {last && last.score < LADDER_PASS && (
                  <p className="fgate-msg" role="status">
                    “{last.said}” — {last.score}점 · {LADDER_PASS}점이면 다음 단이 열려요
                  </p>
                )}
                {msg && (
                  <p className="fgate-msg" role="status">
                    {msg}
                  </p>
                )}
              </>
            )}
            {st === 'locked' && <div className="ld-rung-hidden muted">이전 단을 통과하면 열려요</div>}
          </div>
        );
      })}
    </div>
  );
}
