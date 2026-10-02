'use client';

/**
 * 소리 구분 훈련 카드(M9 HVPT, '조금 더 ▾' order 50) — 진단 상위 축이 있는 평일 + Groq 키가 있을 때의 소리 카드 1장.
 *
 * HVPT(고변이 음성 식별 훈련): 단어 하나만 다른 두 캐리어 문장(collect/correct the data) 중 하나를
 * Orpheus 6목소리로 **문항마다 목소리를 바꿔** 들려주고 2택으로 고르게 한다. 목소리가 바뀌어도
 * 같은 소리로 들리는 '범주'가 생기면 산출이 따라온다(g 0.67~0.92). 단어 단독이 아니라 문장으로
 * 합성해 TTS가 r/l·f/p를 뭉개는 위험을 줄였다(tagless — 감정 태그가 발음을 흔들지 않게).
 *   ① 식별 10문항 — 즉시 정오, recordHvpt(축별 누적 + 최근 10회 창)
 *   ② 80% 이상이면 산출 1회 — 두 문장 중 하나를 2번 녹음(프롬프트 비움) → alignedScore + diagnose 축 일치,
 *      두 번이 같은 판정일 때만 믿는다(합의). 축 어긋남 2회 합의만 addPronLapses, 엇갈리면 '확신 낮음 — 들어보기'.
 *   ③ 축 고르기는 lib/soundCardPick.hvptAxisFor — 진단 상위 축 앞당김 → 이번 주 계획 축, 익힌 축(axisMastered)은 다음 축으로.
 * 키 없음이면 카드 자체가 안 뜬다(디코더로) — soundCardFor. 합성은 하루 ≤12클립(10문항, idb 캐시 우선).
 * 기록: recordHvpt(식별) · logAttempt(src 'pron', 산출만 — 식별은 말하기 지표가 아니다) · 하루 조절기 갈래 'form'.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { registerEndingCard, type EndingCtx } from '../endingRegistry';
import { soundCardFor, diagnosedAxes, hvptAxisFor } from '../../../lib/soundCardPick';
import { KR_DROP, axisMastered, currentWeek, nextHvptItem, planFor, recordHvpt, type HvptItem } from '../../../lib/soundTrack';
import { LAPSE_TIPS, diagnose, type LapseKey } from '../../../lib/pronunciation';
import { daySeed } from '../../../lib/dates';
import { markInteraction, setStrand } from '../../../lib/dayGovernor';
import { recordAndTranscribe, createUnlockedAudioContext, whisperAvailable } from '../../../lib/stt';
import { gateMessage } from '../../../lib/sttQuality';
import { alignedScore } from '../../../lib/align';
import { logAttempt } from '../../../lib/reviewEngine';
import { addPronLapses, bumpSpoken } from '../../../lib/state';
import { speakText, stopSpeaking } from '../../SpeakButton';
import { blockOf, ClipButton } from './RetellCard';

/** Orpheus 6목소리(app/api/tts ORPHEUS_VOICES) — 문항마다 바꿔 고변이 */
export const HVPT_VOICES = ['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy'] as const;
export const HVPT_N = 10;
export const HVPT_PASS = 0.8;
const SAY_PASS = 70;

/** 정수 섞기(결정적) — nextHvptItem의 정답 쪽이 a,a,b,b 같은 규칙으로 보이지 않게 */
function mix(a: number, b: number): number {
  let h = (Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 12)) >>> 0;
}

/** 오늘의 10문항(같은 날·같은 축이면 같다) */
export function hvptQuiz(axis: string, dateKey: string, n = HVPT_N): { item: HvptItem; voice: string }[] {
  const base = daySeed(dateKey);
  const out: { item: HvptItem; voice: string }[] = [];
  for (let k = 0; k < n; k++) {
    const item = nextHvptItem(axis, mix(base, k) % 100000);
    if (!item) break;
    out.push({ item, voice: HVPT_VOICES[(base + k) % HVPT_VOICES.length] });
  }
  return out;
}

interface Take {
  text: string;
  score: number;
  /** 이 축의 어긋남이 진단됐나 */
  axisHit: boolean;
  clip?: Blob;
}
type Verdict = 'ok' | 'lapse' | 'low';

/** 2회 합의 — 둘 다 통과면 ok, 둘 다 그 축 어긋남이면 lapse, 그 밖(엇갈림·축 아닌 이유로 낮음)은 확신 낮음 */
export function consensus(a: Pick<Take, 'score' | 'axisHit'>, b: Pick<Take, 'score' | 'axisHit'>): Verdict {
  const ok = (t: Pick<Take, 'score' | 'axisHit'>) => t.score >= SAY_PASS && !t.axisHit;
  if (ok(a) && ok(b)) return 'ok';
  if (a.axisHit && b.axisHit) return 'lapse';
  return 'low';
}

type Phase = 'intro' | 'quiz' | 'result' | 'say' | 'rec' | 'wait' | 'done';

function HvptView({ ctx }: { ctx: EndingCtx }) {
  const week = useMemo(() => currentWeek(ctx.dateKey), [ctx.dateKey]);
  const plan = planFor(week);
  const axis = useMemo(() => hvptAxisFor(week, diagnosedAxes()) ?? plan.axes[0], [week, plan]);
  const quiz = useMemo(() => hvptQuiz(axis, ctx.dateKey), [axis, ctx.dateKey]);
  const label = LAPSE_TIPS[axis as LapseKey]?.label ?? axis;
  const inPlan = plan.axes.includes(axis as LapseKey);
  const hint = inPlan ? plan.krHint : LAPSE_TIPS[axis as LapseKey]?.tip ?? '';
  const drop = axis === 'final-consonant' ? KR_DROP[daySeed(ctx.dateKey) % KR_DROP.length] : null;
  const keyed = useMemo(() => {
    try {
      return whisperAvailable();
    } catch {
      return false;
    }
  }, []);

  const [phase, setPhase] = useState<Phase>('intro');
  const [k, setK] = useState(0);
  const [pick, setPick] = useState<'a' | 'b' | null>(null);
  const [right, setRight] = useState(0);
  const [mastered, setMastered] = useState(false);
  const [takes, setTakes] = useState<Take[]>([]);
  const [msg, setMsg] = useState('');
  const stop = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current?.();
    };
  }, []);

  if (!quiz.length) return null;
  const cur = quiz[Math.min(k, quiz.length - 1)];
  const total = quiz.length;
  // 산출 문장 — 첫 문항의 캐리어 두 문장 중 하나(날짜 시드)
  const sayItem = quiz[0].item;
  const sayEn = (daySeed(ctx.dateKey) >> 2) % 2 === 0 ? sayItem.a.en : sayItem.b.en;

  function playCur(idx = k) {
    const q = quiz[idx];
    if (!q) return;
    stopSpeaking();
    speakText(q.item[q.item.answer].en, 'en-US', 1, undefined, q.voice, { tagless: true });
  }

  function start() {
    setStrand('form');
    markInteraction();
    setPhase('quiz');
    playCur(0);
  }

  function answer(side: 'a' | 'b') {
    if (pick) return;
    markInteraction();
    setPick(side);
    const ok = side === cur.item.answer;
    recordHvpt(axis, ok);
    if (ok) setRight((r) => r + 1);
  }

  function next() {
    const n = k + 1;
    setPick(null);
    if (n >= total) {
      stopSpeaking();
      setMastered(axisMastered(axis));
      setPhase('result');
      return;
    }
    setK(n);
    playCur(n);
  }

  async function record() {
    setMsg('');
    const audioCtx = createUnlockedAudioContext();
    stopSpeaking();
    setPhase('rec');
    try {
      setStrand('form');
      // 프롬프트 비움 — 목표 문장을 주면 Whisper가 그쪽으로 끌려가 r/l 차이가 사라진다
      const res = await recordAndTranscribe({
        language: 'en',
        silenceMs: 1500,
        maxMs: 8000,
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
        logAttempt({ t: Date.now(), en: sayEn, score: 0, src: 'pron', patternKey: axis, quality: block });
        setMsg(gateMessage(block));
        setPhase('say');
        return;
      }
      const text = (res.text || '').trim();
      const score = alignedScore(sayEn, text).score;
      const axisHit = diagnose(sayEn, text).some((i) => i.key === axis);
      logAttempt({ t: Date.now(), en: sayEn, score, src: 'pron', patternKey: axis, latencyMs: res.voiceOnsetMs, durationMs: res.durationMs, quality: 'ok' });
      bumpSpoken(1, 'scored');
      const all = [...takes, { text, score, axisHit, clip: res.audio }];
      setTakes(all);
      if (all.length >= 2) {
        if (consensus(all[0], all[1]) === 'lapse') addPronLapses([axis]);
        setPhase('done');
      } else setPhase('say');
    } catch {
      stop.current = null;
      if (!alive.current) return;
      setMsg('마이크를 열지 못했어요 — 권한을 확인하고 다시 눌러 주세요.');
      setPhase('say');
    }
  }

  const pct = Math.round((right / total) * 100);
  const passed = right / total >= HVPT_PASS;
  const verdict = takes.length >= 2 ? consensus(takes[0], takes[1]) : null;
  return (
    <div className="hv-card" data-phase={phase} data-axis={axis}>
      <div className="ee-title hv-title">
        🎧 오늘의 소리: {label} {inPlan ? <span className="hv-week">({week}주차)</span> : <span className="hv-week">(자주 어긋난 소리)</span>}
      </div>
      {phase === 'intro' && (
        <>
          <p className="hv-hint">{hint}</p>
          {drop && (
            <p className="hv-drop">
              <b lang="en">{drop.word}</b> — ‘{drop.kr}’ ✗ · {drop.tip}
            </p>
          )}
          <p className="hv-note">여섯 목소리가 번갈아 한 문장을 읽어요. 두 문장 중 들린 쪽을 고르세요 ({total}문항, 2분).</p>
          <button type="button" className="btn primary hv-start" onClick={start}>
            ▶ 시작
          </button>
        </>
      )}

      {phase === 'quiz' && (
        <div className="hv-q" data-k={k} data-ans={cur.item.answer}>
          <div className="hv-q-top">
            <span className="hv-count">
              {k + 1} / {total}
            </span>
            <button type="button" className="mini-btn hv-replay" aria-label="다시 듣기" onClick={() => playCur()}>
              ▶ 다시 듣기
            </button>
          </div>
          <div className="hv-opts" role="group" aria-label="들린 문장 고르기">
            {(['a', 'b'] as const).map((side) => {
              const s = cur.item[side];
              const st = pick ? (side === cur.item.answer ? ' ok' : pick === side ? ' bad' : '') : '';
              return (
                <button key={side} type="button" className={`hv-opt${st}`} data-side={side} disabled={!!pick} onClick={() => answer(side)}>
                  <b lang="en">{s.word}</b>
                  <span className="hv-opt-en" lang="en">
                    {s.en}
                  </span>
                </button>
              );
            })}
          </div>
          {pick && (
            <div className="hv-fb" role="status">
              <span className={pick === cur.item.answer ? 'hv-ok' : 'hv-bad'}>
                {pick === cur.item.answer ? '✓ 맞아요' : `✗ ‘${cur.item[cur.item.answer].word}’였어요`}
              </span>
              <button type="button" className="btn primary hv-next" onClick={next}>
                {k + 1 >= total ? '결과 보기' : '다음 ▶'}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'result' && (
        <div className="hv-result" role="status">
          <p className={`hv-score${passed ? ' ok' : ''}`}>
            {right}/{total} ({pct}%) {passed ? '통과!' : '— 내일 한 번 더 들어 봐요'}
          </p>
          {mastered && <p className="hv-mastered">이 소리는 귀에 익었어요 — 다음 카드부터 다음 소리로 넘어가요.</p>}
          {passed &&
            (keyed ? (
              <button type="button" className="btn primary hv-to-say" onClick={() => setPhase('say')}>
                🎙 이제 말해 보기 (2번)
              </button>
            ) : (
              <p className="hv-note">말하기 확인은 마이크가 있는 기기에서 할 수 있어요.</p>
            ))}
        </div>
      )}

      {(phase === 'say' || phase === 'rec' || phase === 'wait') && (
        <div className="hv-say">
          <p className="hv-say-hint">
            이 문장을 말해 보세요 ({takes.length + 1}/2):
          </p>
          <p className="hv-say-en" lang="en">
            {sayEn}
            <button
              type="button"
              className="mini-btn hv-say-play"
              aria-label="문장 듣기"
              onClick={() => {
                stopSpeaking();
                speakText(sayEn, 'en-US', 0.9, undefined, quiz[0].voice, { tagless: true });
              }}
            >
              🔊
            </button>
          </p>
          {msg && (
            <p className="dr-msg hv-gate" role="status">
              {msg}
            </p>
          )}
          {phase === 'say' && (
            <button type="button" className="btn primary hv-rec" onClick={() => void record()}>
              🎙 말하기
            </button>
          )}
          {phase === 'rec' && (
            <button type="button" className="btn hv-stop" onClick={() => stop.current?.()}>
              ⏹ 다 말했어요
            </button>
          )}
          {phase === 'wait' && <p className="hv-status">… 받아쓰는 중</p>}
        </div>
      )}

      {phase === 'done' && verdict && (
        <div className="hv-done" role="status" data-verdict={verdict}>
          <p className={`hv-verdict ${verdict}`}>
            {verdict === 'ok'
              ? `✓ 두 번 다 또렷해요 (${takes[0].score}·${takes[1].score}점)`
              : verdict === 'lapse'
                ? `경향: ${label}가 2번 다 다르게 들렸어요 — 내일 이 소리를 한 번 더`
                : '확신 낮음 — 두 번이 다르게 들렸어요. 내 소리를 들어 보세요'}
          </p>
          <ul className="hv-takes">
            {takes.map((t, i) => (
              <li key={i}>
                <span lang="en">{t.text || '…'}</span> · {t.score}점 <ClipButton clip={t.clip} label={`${i + 1}번 ▶`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export const HVPT_CARD = registerEndingCard({
  id: 'sound-hvpt',
  order: 50,
  basic: false,
  when: (ctx) => {
    try {
      return soundCardFor(ctx) === 'hvpt';
    } catch {
      return false;
    }
  },
  Component: HvptView,
});
