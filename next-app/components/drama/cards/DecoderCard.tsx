'use client';

/**
 * 소리 디코더 카드(M7, '조금 더 ▾' order 50) — 진단 상위 축이 없는 평일의 소리 카드 1장.
 *
 * 하루 한 항목(decoderOfDay — 안 본 것 우선): going to → gonna 같은 '원어민이 실제로 내는 소리'를
 *   ① 같은 예문을 또박또박(0.75×) → 자연스럽게(1.0×, 축약·플랩은 구어 표기로 합성) 두 번 듣고
 *   ② 예문 하나를 듣고 '들린 대로 고르기' 2지선다(원형 표기 vs 원어민 소리 표기 — 어느 쪽을 틀었는지는 날짜 시드)
 *   ③ 키 있음(Whisper): 따라 말하기 1회 — 원형·구어형 중 가까운 쪽 alignedScore ≥ 70 또는 전사에 축약 표기
 *      (matchesReduced)가 찍히면 통과, logAttempt(src 'sound').
 *      키 없음: '흘려 말했어요 ✓' 자기확인(지표 집계 제외 — 시도 로그에 남기지 않는다, 비평 (2)-6).
 * 통과하면 markDecoderSeen → 내일은 다음 항목. 하루 조절기 갈래는 'form'(형식 초점).
 * 어느 카드를 띄울지는 lib/soundCardPick(HVPT와 하루 1장) — 플래그 decoder off면 숨김.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { registerEndingCard, type EndingCtx } from '../endingRegistry';
import { decoderOfDay, decoderSeen, kindLabel, markDecoderSeen, matchesReduced, spokenLine, type DecoderItem } from '../../../lib/connectedSpeech';
import { soundCardFor } from '../../../lib/soundCardPick';
import { daySeed } from '../../../lib/dates';
import { markInteraction, setStrand } from '../../../lib/dayGovernor';
import { recordAndTranscribe, createUnlockedAudioContext, whisperAvailable } from '../../../lib/stt';
import { gateMessage } from '../../../lib/sttQuality';
import { sttErrorMessage } from '../../../lib/sttErrors';
import { alignedScore } from '../../../lib/align';
import { logAttempt } from '../../../lib/reviewEngine';
import { bumpSpoken } from '../../../lib/state';
import { speakText, stopSpeaking } from '../../SpeakButton';
import { blockOf, ClipButton } from './RetellCard';

/** 디코더 듣기 목소리 — 한 목소리로 두 버전을 비교해야 '속도·소리'만 다르게 들린다 */
const VOICE = 'hannah';
const CAREFUL_RATE = 0.75;
const PASS = 70;

/** 자연스러운 쪽 합성 문장 — 축약·플랩은 구어 표기('gonna', 'wadder')가 소리를 분명히 만들고,
 *  약형·연음('n·c'n·anapple)은 철자를 바꾸면 합성기가 엉뚱하게 읽으므로 원문을 보통 속도로. */
export function naturalText(item: DecoderItem): string {
  if (item.kind === 'contraction' || item.kind === 'flap') return spokenLine(item.example.en) ?? item.example.en;
  return item.example.en;
}

/** 화면에 보이는 원어민 소리 표기(구간을 구어 표기로 바꾼 예문) */
const spokenOf = (item: DecoderItem) => spokenLine(item.example.en) ?? item.example.en;

type Version = 'careful' | 'natural';
type Phase = 'listen' | 'quiz' | 'say' | 'rec' | 'wait' | 'done';

function play(item: DecoderItem, v: Version, onend?: () => void) {
  stopSpeaking();
  if (v === 'careful') speakText(item.example.en, 'en-US', CAREFUL_RATE, onend, VOICE, { tagless: true });
  else speakText(naturalText(item), 'en-US', 1, onend, VOICE, { tagless: true });
}

function DecoderView({ ctx }: { ctx: EndingCtx }) {
  // 마운트 때 한 번 — 통과해 seen이 바뀌어도 카드 항목은 그대로
  const item = useMemo(() => decoderOfDay(ctx.dateKey, decoderSeen()), [ctx.dateKey]);
  const seed = useMemo(() => daySeed(ctx.dateKey), [ctx.dateKey]);
  // 퀴즈에서 들려줄 쪽·보기 순서(날짜 시드 — 새로고침해도 같은 문제)
  const played: Version = seed % 2 === 0 ? 'natural' : 'careful';
  const naturalFirst = (seed >> 1) % 2 === 0;
  const keyed = useMemo(() => {
    try {
      return whisperAvailable();
    } catch {
      return false;
    }
  }, []);
  const [phase, setPhase] = useState<Phase>('listen');
  const [pick, setPick] = useState<Version | null>(null);
  const [msg, setMsg] = useState('');
  const [said, setSaid] = useState<{ text: string; score: number; reduced: boolean; clip?: Blob } | null>(null);
  const [passed, setPassed] = useState<'scored' | 'self' | null>(null);
  /** 받아쓰기가 막힌 횟수(게이트·오류) — 2번이면 자기확인 출구를 연다(키가 있어도 막다른 길이 되지 않게) */
  const [fails, setFails] = useState(0);
  const stop = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current?.();
    };
  }, []);

  const spoken = spokenOf(item);
  const correct = pick === played;

  function listenBoth() {
    setStrand('form');
    markInteraction();
    // 또박또박 → 자연스럽게(이어서). 끝 신호를 못 받는 환경(합성 실패)에서도 화면은 바로 다음 단계로 간다.
    play(item, 'careful', () => play(item, 'natural'));
    if (phase === 'listen') setPhase('quiz');
  }

  function choose(v: Version) {
    markInteraction();
    setPick(v);
    if (v === played) setPhase('say');
  }

  function finish(kind: 'scored' | 'self') {
    markDecoderSeen(item.id);
    setPassed(kind);
    setPhase('done');
  }

  async function record() {
    setMsg('');
    const audioCtx = createUnlockedAudioContext();
    stopSpeaking();
    setPhase('rec');
    try {
      setStrand('form');
      // 프롬프트 비움(M0) — 문장을 주면 Whisper가 원형 철자로 끌려가 축약 표기가 사라진다
      const res = await recordAndTranscribe({
        language: 'en',
        silenceMs: 1500,
        maxMs: 10000,
        detail: 'segments',
        temperature: 0,
        audioCtx,
        registerStop: (f) => (stop.current = f),
        onState: (s) => s === 'transcribing' && alive.current && setPhase('wait'),
      });
      stop.current = null;
      if (!alive.current) return;
      const block = blockOf(res, 'whisper');
      if (block) {
        logAttempt({ t: Date.now(), en: item.example.en, score: 0, src: 'sound', patternKey: item.id, quality: block });
        setMsg(gateMessage(block));
        setFails((f) => f + 1);
        setPhase('say');
        return;
      }
      const text = (res.text || '').trim();
      const score = Math.max(alignedScore(item.example.en, text).score, alignedScore(spoken, text).score);
      const reduced = matchesReduced(text, item);
      logAttempt({ t: Date.now(), en: item.example.en, score, src: 'sound', patternKey: item.id, latencyMs: res.voiceOnsetMs, durationMs: res.durationMs, quality: 'ok' });
      bumpSpoken(1, 'scored');
      setSaid({ text, score, reduced, clip: res.audio });
      if (score >= PASS || reduced) finish('scored');
      else setPhase('say');
    } catch (e) {
      stop.current = null;
      if (!alive.current) return;
      // 마이크 거부·마이크 없음·오프라인·키 오류·서버 바쁨을 구분해 안내(예전엔 전부 '마이크를 열지 못했어요')
      setMsg(sttErrorMessage(e));
      setFails((f) => f + 1);
      setPhase('say');
    }
  }

  const selfBtn = (
    <button
      type="button"
      className={`btn${keyed ? '' : ' primary'} sd-self`}
      onClick={() => {
        markInteraction();
        bumpSpoken(1, 'self');
        finish('self');
      }}
    >
      🗣 흘려 말했어요 ✓
    </button>
  );
  const options: Version[] = naturalFirst ? ['natural', 'careful'] : ['careful', 'natural'];
  const textOf = (v: Version) => (v === 'careful' ? item.example.en : spoken);
  return (
    <div className="sd-card" data-phase={phase} data-id={item.id} data-say={spoken} data-path={keyed ? 'whisper' : 'self'}>
      <div className="ee-title sd-title">
        🔊 오늘의 소리: <span lang="en">{item.written}</span> → <b lang="en">{item.spoken}</b>
      </div>
      <p className="sd-meta">
        <span className="sd-kind">{kindLabel(item.kind)}</span> <span className="sd-kr">‘{item.kr}’처럼 들려요</span>
      </p>
      <p className="sd-tip">{item.tip}</p>

      <div className="sd-ex">
        <p className="sd-ex-en" lang="en">
          {item.example.en}
        </p>
        <p className="sd-ex-kr">{item.example.kr}</p>
        <div className="sd-listen">
          <button type="button" className="btn primary sd-both" onClick={listenBoth}>
            ▶ 두 번 듣기 (또박또박 → 자연스럽게)
          </button>
          <button type="button" className="mini-btn sd-one" data-v="careful" onClick={() => play(item, 'careful')}>
            🐢 또박또박
          </button>
          <button type="button" className="mini-btn sd-one" data-v="natural" onClick={() => play(item, 'natural')}>
            🗣 자연스럽게
          </button>
        </div>
      </div>

      {phase !== 'listen' && (
        <div className="sd-quiz" data-played={played}>
          <div className="sd-q">
            <span>예문을 듣고 들린 대로 고르세요</span>
            <button type="button" className="mini-btn sd-q-play" aria-label="문제 듣기" onClick={() => play(item, played)}>
              ▶ 문제 듣기
            </button>
          </div>
          <div className="sd-opts" role="group" aria-label="들린 대로 고르기">
            {options.map((v) => {
              const state = pick === v ? (v === played ? ' ok' : ' bad') : '';
              return (
                <button
                  key={v}
                  type="button"
                  className={`sd-opt${state}`}
                  data-v={v}
                  lang="en"
                  disabled={correct}
                  aria-pressed={pick === v}
                  onClick={() => choose(v)}
                >
                  {textOf(v)}
                </button>
              );
            })}
          </div>
          {pick && (
            <p className={`sd-fb${correct ? ' ok' : ''}`} role="status">
              {correct
                ? played === 'natural'
                  ? `✓ 맞아요 — ${item.written}가 ‘${item.spoken}’로 들렸죠.`
                  : `✓ 맞아요 — 또박또박 ${item.written}였어요.`
                : '✗ 다시 한 번 들어 보세요 — ▶ 문제 듣기'}
            </p>
          )}
        </div>
      )}

      {(phase === 'say' || phase === 'rec' || phase === 'wait') && (
        <div className="sd-say">
          <p className="sd-say-hint">
            이제 흘려서 따라 말해 보세요: <b lang="en">{spoken}</b>
          </p>
          {msg && (
            <p className="dr-msg sd-gate" role="status">
              {msg}
            </p>
          )}
          {said && phase === 'say' && (
            <p className="sd-said" role="status">
              <span lang="en">{said.text || '…'}</span> · {said.score}점 — 한 번 더 들어 보고 다시 해 봐요.
            </p>
          )}
          {keyed ? (
            phase === 'say' ? (
              <button type="button" className="btn primary sd-rec" onClick={() => void record()}>
                🎙 따라 말하기
              </button>
            ) : (
              <p className="sd-status" role="status">
                {phase === 'rec' ? (
                  <button type="button" className="btn sd-stop" onClick={() => stop.current?.()}>
                    ⏹ 다 말했어요
                  </button>
                ) : (
                  '… 받아쓰는 중'
                )}
              </p>
            )
          ) : (
            selfBtn
          )}
          {keyed && phase === 'say' && fails >= 2 && selfBtn}
        </div>
      )}

      {phase === 'done' && (
        <div className="sd-done" role="status">
          <p className="sd-pass">
            {passed === 'self'
              ? `✓ 오늘의 소리 ‘${item.spoken}’ 완료 — 내일은 다음 소리예요.`
              : said?.reduced
                ? `✓ ‘${item.spoken}’가 들렸어요!`
                : `✓ 또렷하게 따라 말했어요 (${said?.score ?? 0}점)`}
          </p>
          {said && (
            <p className="sd-said" lang="en">
              {said.text}
            </p>
          )}
          <ClipButton clip={said?.clip} />
        </div>
      )}
    </div>
  );
}

export const DECODER_CARD = registerEndingCard({
  id: 'sound-decoder',
  order: 50,
  basic: false,
  when: (ctx) => {
    try {
      return soundCardFor(ctx) === 'decoder';
    } catch {
      return false;
    }
  },
  Component: DecoderView,
});
