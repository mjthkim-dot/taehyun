'use client';

/**
 * D+1 vs D+7(M10, 엔딩 '조금 더 ▾' order 70) — 시작 후 1·4·7일째 엔딩에 같은 EP1 태오 대사 한 문장을 다시 녹음한다.
 *
 * 왜: 첫 7일은 키가 없으면 점수가 0개다. 그래도 '일주일 만에 소리가 달라졌다'는 걸 귀로 확인하면 버틴다.
 * 문장(D7_SENTENCE)은 r-l·th·v-b·받침(final-consonant)을 한 줄에 담은 ≤9단어 원고 대사로 고정했다.
 * 녹음은 키와 무관하게 recordOnly(전사 0) — 비교는 소리로만. putRecording(kind 'd7', 최신 3개 영구) + va_growth.d7Pair.
 * D+7에는 저장해 둔 D+1 녹음과 '태오 ▶'를 나란히(3클립). 플래그 growth off면 숨는다.
 */
import { useEffect, useRef, useState } from 'react';
import { registerEndingCard, type EndingCtx } from '../endingRegistry';
import { voiceOf } from '../../../lib/drama';
import { isOn } from '../../../lib/flags';
import { BASELINE_GUIDES, D7_SENTENCE, D7_SENTENCE_KR, d7Stage } from '../../../lib/baseline';
import { d7Pair, recPath, setD7Recording } from '../../../lib/growthArchive';
import { daysSinceStart } from '../../../lib/retell';
import { shiftKey } from '../../../lib/dates';
import { recordAndTranscribe, createUnlockedAudioContext } from '../../../lib/stt';
import { listRecordings, putRecording } from '../../../lib/storage';
import { bumpSpoken } from '../../../lib/state';
import { addMinutes } from '../../../lib/timeBudget';
import { speakText, stopSpeaking } from '../../SpeakButton';
import { sttErrorMessage } from '../../../lib/sttErrors';
import { FAILS_SELF_AT } from './RetellCard';
import { ClipRow } from '../../progress/GaBits';

/** 오늘이 D+1·D+4·D+7 중 며칠째인가(아니면 null) */
export function d7StageFor(dateKey: string): 1 | 4 | 7 | null {
  const d = daysSinceStart(dateKey);
  return d7Stage(shiftKey(dateKey, -d), dateKey);
}

/** 이 단계(D+1·4·7)에 이미 저장한 녹음 id — 단계당 1회만 녹음한다(같은 날 엔딩을 또 봐도 다시 쌓지 않게) */
export function d7SavedId(stage: 1 | 4 | 7 | null): string | undefined {
  if (!stage) return undefined;
  const p = d7Pair();
  return p && p.en === D7_SENTENCE ? p[`d${stage}Id`] : undefined;
}

function D7View({ ctx }: { ctx: EndingCtx }) {
  const stage = d7StageFor(ctx.dateKey);
  const [savedId] = useState(() => d7SavedId(stage));
  const [phase, setPhase] = useState<'idle' | 'rec' | 'done' | 'gate'>(savedId ? 'done' : 'idle');
  const [mine, setMine] = useState<Blob | null>(null);
  const [fails, setFails] = useState(0);
  const [d1, setD1] = useState<Blob | null>(null);
  const [msg, setMsg] = useState('');
  const stop = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const path = recPath();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current?.();
    };
  }, []);

  // 이 단계 녹음이 이미 있으면 그걸 보여 준다(없어졌으면 다시 녹음할 수 있게)
  useEffect(() => {
    if (!savedId) return;
    let on = true;
    void listRecordings('d7').then((all) => {
      if (!on) return;
      const b = all.find((r) => r.id === savedId)?.blob;
      if (b) setMine(b);
      else setPhase('idle');
    });
    return () => {
      on = false;
    };
  }, [savedId]);

  // D+7: D+1 녹음 꺼내기
  useEffect(() => {
    if (stage !== 7) return;
    const id = d7Pair()?.d1Id;
    if (!id) return;
    let on = true;
    void listRecordings('d7').then((all) => on && setD1(all.find((r) => r.id === id)?.blob || null));
    return () => {
      on = false;
    };
  }, [stage]);

  if (!stage) return null;

  async function start() {
    setMsg('');
    const audioCtx = createUnlockedAudioContext();
    stopSpeaking();
    setPhase('rec');
    try {
      const res = await recordAndTranscribe({ recordOnly: true, silenceMs: 1500, maxMs: 8000, audioCtx, registerStop: (f) => (stop.current = f) });
      stop.current = null;
      if (!alive.current) return;
      if (!res.audio) {
        setMsg('소리가 잡히지 않았어요 — 다시 눌러 주세요.');
        setFails((n) => n + 1);
        setPhase('gate');
        return;
      }
      const id = await putRecording({ kind: 'd7', blob: res.audio, mime: res.audio.type || 'audio/webm', durationMs: res.durationMs || 0, en: D7_SENTENCE, epNo: 1 });
      if (id) setD7Recording(stage!, D7_SENTENCE, id);
      bumpSpoken(1, 'self');
      addMinutes('output', Math.max(0.1, Math.round(((res.durationMs || 0) / 60000) * 10) / 10));
      if (!alive.current) return;
      setMine(res.audio);
      setPhase('done');
    } catch (e) {
      stop.current = null;
      if (!alive.current) return;
      setMsg(sttErrorMessage(e));
      setFails((n) => n + 1);
      setPhase('gate');
    }
  }

  /** 녹음이 거듭 실패 — 소리 내어 말한 것으로(자기확인 발화) 넘어간다. 비교 녹음은 남지 않는다 */
  function selfPass() {
    bumpSpoken(1, 'self');
    setPhase('done');
  }

  const taeo = voiceOf('taeo');
  return (
    <div className="ga-d7" data-stage={stage} data-phase={phase}>
      <div className="ee-title ga-title">{stage === 7 ? `🎧 ${BASELINE_GUIDES.d7}` : `🎙 D+${stage} 같은 문장 녹음 — D+7에 비교해요`}</div>
      <p className="ga-q" lang="en">
        {D7_SENTENCE}
        <button type="button" className="mini-btn ga-q-play" aria-label="태오 대사 듣기" onClick={() => speakText(D7_SENTENCE, 'en-US', 0.95, undefined, taeo)}>
          🔊
        </button>
      </p>
      <p className="ga-q-kr">{D7_SENTENCE_KR}</p>
      {(phase === 'idle' || phase === 'gate') && (
        <>
          {msg && (
            <p className="ga-msg" role="status">
              {msg}
            </p>
          )}
          {path === 'none' ? (
            <p className="ga-note">이 기기는 녹음을 쓸 수 없어요.</p>
          ) : (
            <button type="button" className="btn primary ga-start" onClick={() => void start()}>
              🎙 한 번 말하기
            </button>
          )}
          {phase === 'gate' && fails >= FAILS_SELF_AT && (
            <button type="button" className="btn ghost ga-self" onClick={selfPass}>
              🗣 소리 내어 말했어요 — 넘어가기
            </button>
          )}
        </>
      )}
      {phase === 'rec' && (
        <div className="ga-rec-row">
          <span className="ga-time">🎙 듣고 있어요…</span>
          <button type="button" className="btn ghost ga-stop" onClick={() => stop.current?.()}>
            ⏹ 끝
          </button>
        </div>
      )}
      {phase === 'done' && (
        <div className="ga-result" role="status">
          <p className="ga-saved">{mine || savedId ? `✓ D+${stage} 녹음 저장` : '✓ 소리 내어 말했어요 — 비교 녹음은 다음에'}</p>
          <ClipRow
            items={[
              ...(stage === 7 ? [{ label: 'D+1 나 ▶', clip: d1 }] : []),
              { label: `D+${stage} 나 ▶`, clip: mine },
              { label: '태오 ▶', say: D7_SENTENCE, voice: taeo },
            ]}
          />
          {stage === 7 && !d1 && <p className="ga-note">D+1 녹음이 없어서 오늘 소리만 들려드려요.</p>}
        </div>
      )}
    </div>
  );
}

export const D7_CARD = registerEndingCard({
  id: 'd7',
  order: 70,
  basic: false,
  when: (ctx) => {
    try {
      return isOn('growth') && d7StageFor(ctx.dateKey) != null;
    } catch {
      return false;
    }
  },
  Component: D7View,
});
