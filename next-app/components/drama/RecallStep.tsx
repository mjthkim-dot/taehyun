'use client';

/**
 * 말로 떠올리기(M3) — 회상을 '고르기'(재인)에서 '한국어만 보고 말하기'(인출)로.
 *
 *   한국어 한 줄이 뜨는 순간 🎙 자동 녹음(카운트다운 없음 — 개시 지연은 재기만 한다, silenceMs 1.5초·최대 10초·detail 'words')
 *   → 정렬 채점(alignedScore) → 초록/빨강 단어 diff → 정답은 그 표현을 말한 인물 목소리(voiceOf(who))로
 *   → 틀렸으면(again) 곧바로 '따라 말해요' 1회(역할극 RoleStep의 축약판 — 듣고 바로 녹음, 결과 한 줄).
 *   · 60점 미만 첫 시도는 정답을 보여 주지 않고 한 번 더 떠올리게 한다. 두 번째도 못 떠올리면 그때만 보기 3개(힌트) —
 *     힌트로 맞히면 hard(간격이 크게 늘지 않게), 틀리면 again.
 *   · box 0(처음 묻는 카드)·플래그 off는 호출부(DramaScreen)가 예전 3지선다를 그대로 쓴다. 이 컴포넌트의 choice는
 *     키도 Web Speech도 없는 기기(iOS PWA)의 경로: 고르기 + 녹음 A/B('내 소리 ▶ / 인물 ▶', 자기확인 발화).
 *   · 거머리 카드(4번 이상 잊음): 따라 말하기를 끝부터 쌓기(lib/drama.recallStages ← roleStep.buildupStages)로 나누고,
 *     최소대립쌍 1쌍을 접어서 붙인다(펼치면 두 단어를 번갈아 듣기).
 * 기록: gradeRecall(간격 반복) · logAttempt(src 'recall', latencyMs = voiceOnsetMs) · recordRecallSpeak(1차 통과·지연, 60일) ·
 *       bumpSpoken(채점 1.0 / 자기확인 0.5 — 키 없는 구간 1.0).
 * lastTtsText는 넘기지 않는다 — 정답을 들려준 뒤 따라 말하는 경로라 '직전 TTS와 일치'가 정상이다.
 */
import { useEffect, useRef, useState } from 'react';
import VoiceCompare from '../MyVoice';
import { speakText, stopSpeaking } from '../SpeakButton';
import { castNameKo, gradeRecall, recallNext, recallStages, recallUiMode, recordRecallSpeak, voiceOf, type RecallItem } from '../../lib/drama';
import { alignedScore, displayDiff, type AlignedWord } from '../../lib/align';
import { recordAndTranscribe, STT_PROPER_NOUNS, whisperAvailable, micAvailable, type SttResult } from '../../lib/stt';
import { blockingReason, gateMessage } from '../../lib/sttQuality';
import { browserSttAvailable, listenOnce } from '../../lib/browserStt';
import { logAttempt } from '../../lib/reviewEngine';
import { bumpSpoken, topPronLapses, type FlashGrade } from '../../lib/state';
import { diagnose } from '../../lib/pronunciation';
import { hasDrill, pairsFor, type MinimalPair } from '../../lib/minimalPairs';
import { sttPath, type SttPath } from '../../lib/roleStep';
import { haptic } from '../../lib/haptics';

/** 회상 녹음 파라미터(명세 고정) */
export const RECALL_SILENCE_MS = 1500;
export const RECALL_MAX_MS = 10000;
const PASS = 60;

export interface RecallResult {
  en: string;
  kr: string;
  who: string;
  grade: FlashGrade;
  /** 떠올렸나(good·hard) */
  good: boolean;
  /** 1차 시도 점수(choice는 맞히면 100) */
  firstScore: number;
  /** 보기 힌트를 봤나 */
  hinted: boolean;
  mode: 'speak' | 'choice';
  path: SttPath;
  latencyMs?: number;
}

type Phase = 'rec' | 'wait' | 'gate' | 'again' | 'hint' | 'choice' | 'result' | 'follow' | 'followWait' | 'done';

interface Heard {
  said: string;
  score: number;
  diff: AlignedWord[];
  audio?: Blob;
}

const lineMs = (en: string) => en.split(/\s+/).length * 380 + 700;

/** 소리 구분 1쌍 — 이번 발화의 혼동축 → 없으면 최근 7일 상위 축 → 없으면 null */
function pairFor(en: string, said: string): MinimalPair | null {
  try {
    const keys = [...(said ? diagnose(en, said).map((i) => i.key) : []), ...topPronLapses(7, 3).map((l) => l.key)];
    const k = keys.find((x) => hasDrill(x));
    return k ? pairsFor(k)[0] || null : null;
  } catch {
    return null;
  }
}

export default function RecallStep({
  item,
  rate = 0.95,
  mute = false,
  review = false,
  noSrs = false,
  onDone,
}: {
  item: RecallItem;
  /** 정답 재생 속도(Player의 속도 × 기본 배속) */
  rate?: number;
  mute?: boolean;
  /** 표현 복습 세션인가(문구만 다르다) */
  review?: boolean;
  /** 간격 반복에 매기지 않는 연습(엔딩 카드의 기한 전 표현) — 등급은 화면에만 */
  noSrs?: boolean;
  onDone: (r: RecallResult) => void;
}) {
  const path: SttPath = sttPath({ whisper: whisperAvailable(), webSpeech: browserSttAvailable() });
  // 키도 Web Speech도 없으면(iOS PWA) 말로 떠올려도 채점할 수 없다 — 고르기 + 녹음 A/B
  const choiceOnly = recallUiMode(item.mode, path) === 'choice';
  const who = item.who || 'taeo';
  const name = castNameKo(who);
  const stages = recallStages(item.en, !!item.leech);
  const [phase, setPhase] = useState<Phase>(choiceOnly ? 'choice' : 'rec');
  const [msg, setMsg] = useState('');
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState<Heard | null>(null);
  const [grade, setGrade] = useState<FlashGrade | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [follow, setFollow] = useState<Heard | null>(null);
  const [stage, setStage] = useState(0);
  const [mine, setMine] = useState<Blob | null>(null);
  const [selfRec, setSelfRec] = useState(false);
  const [pair, setPair] = useState<MinimalPair | null>(null);
  const tries = useRef(0);
  const first = useRef<{ score: number; latencyMs?: number } | null>(null);
  const hinted = useRef(false);
  const alive = useRef(true);
  const stopRec = useRef<(() => void) | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finished = useRef(false);
  /** 게이트(소리 없음 등)에 걸린 게 따라 말하기였나 — 🎙 다시 누르면 같은 단계로 */
  const followGate = useRef(false);

  /** 등급 — noSrs면 저장하지 않고 같은 규칙으로만 매긴다 */
  const gradeOf = (score: boolean | number, hint = false): FlashGrade => {
    if (!noSrs) return gradeRecall(item.en, score, { hinted: hint });
    const ok = typeof score === 'boolean' ? score : score >= PASS;
    return !ok ? 'again' : hint ? 'hard' : 'good';
  };

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => alive.current && fn(), ms);
    timers.current.push(t);
  };

  useEffect(() => {
    alive.current = true;
    if (!choiceOnly) void listen('recall');
    return () => {
      alive.current = false;
      for (const t of timers.current) clearTimeout(t);
      stopRec.current?.();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 정답을 인물 목소리로 — 다 들으면 then(음소거면 읽을 시간만큼) */
  function playAnswer(text: string, then?: () => void) {
    if (mute) {
      if (then) later(then, lineMs(text));
      return;
    }
    stopSpeaking();
    let done = false;
    const go = () => {
      if (done || !alive.current) return;
      done = true;
      then?.();
    };
    speakText(text, 'en-US', rate, go, voiceOf(who));
    later(go, lineMs(text) * 2 + 3000);
  }

  /** 녹음 → 전사. kind: recall(떠올리기) | follow(따라 말하기) */
  async function listen(kind: 'recall' | 'follow') {
    if (!alive.current) return;
    setMsg('');
    setLevel(0);
    if (!micAvailable() && path !== 'webspeech') {
      // 마이크가 없다 — 막히지 않게 고르기로
      setMsg('마이크를 쓸 수 없어요 — 보기에서 골라 주세요.');
      hinted.current = kind === 'recall' && tries.current > 0;
      setPhase(kind === 'recall' ? 'choice' : 'done');
      return;
    }
    setPhase(kind === 'recall' ? 'rec' : 'follow');
    stopSpeaking();
    const target = kind === 'follow' ? stages[stage] : item.en;
    try {
      let res: SttResult;
      if (path === 'webspeech') {
        const text = await listenOnce({ lang: 'en-US', maxMs: RECALL_MAX_MS, registerStop: (f) => (stopRec.current = f) });
        res = { text, via: 'webspeech', reason: text ? 'ok' : 'silent' };
      } else {
        res = await recordAndTranscribe({
          prompt: STT_PROPER_NOUNS, // 고유명사만 — 목표 문장을 넣으면 점수가 부푼다
          language: 'en',
          silenceMs: RECALL_SILENCE_MS,
          maxMs: RECALL_MAX_MS,
          detail: 'words',
          temperature: 0,
          targetEn: target,
          registerStop: (f) => (stopRec.current = f),
          onLevel: (v) => alive.current && setLevel(Math.min(1, v * 8)),
          onState: (s) => {
            if (s === 'transcribing') setPhase(kind === 'recall' ? 'wait' : 'followWait');
          },
        });
      }
      stopRec.current = null;
      if (!alive.current) return;
      const said = (res.text || '').trim();
      const block = res.reason === 'busy' ? 'busy' : !said ? (res.reason === 'no-audio' || res.reason === 'silent' ? 'silent' : 'unclear') : path === 'whisper' ? blockingReason(res) : null;
      if (block) {
        // 채점까지 못 간 시도도 사유와 함께 남긴다(시도 수에는 넣지 않는다)
        logAttempt({ t: Date.now(), en: target, score: 0, src: 'recall', latencyMs: res.voiceOnsetMs, quality: block === 'busy' ? 'busy' : block === 'silent' ? 'silent' : block === 'echo' ? 'echo' : 'unclear' });
        setMsg(gateMessage(block));
        followGate.current = kind === 'follow';
        setPhase('gate');
        return;
      }
      const { score, diff } = alignedScore(target, said);
      bumpSpoken(); // 채점된 발화 1.0
      logAttempt({
        t: Date.now(),
        en: target,
        score,
        src: kind === 'recall' ? 'recall' : 'recall-follow',
        latencyMs: res.voiceOnsetMs,
        durationMs: res.durationMs,
        wpm: res.fluency?.wpm,
        pauseCount: res.pauses?.length,
        clausePauses: res.fluency?.clauseInternalPauses,
        quality: 'ok',
      });
      const h: Heard = { said, score, diff, audio: res.audio };
      if (kind === 'follow') {
        setFollow(h);
        haptic(score >= PASS ? 'success' : 'error');
        setPhase('done');
        return;
      }
      tries.current += 1;
      if (tries.current === 1) {
        first.current = { score, latencyMs: res.voiceOnsetMs };
        recordRecallSpeak(score >= PASS, res.voiceOnsetMs);
      }
      setHeard(h);
      if (item.leech || score < PASS) setPair(pairFor(item.en, said));
      const step = recallNext(tries.current, score);
      if (step === 'good') {
        haptic('success');
        settle(gradeOf(score));
        return;
      }
      haptic('error');
      if (step === 'retry') {
        // 첫 실패 — 정답은 아직 보여 주지 않고 한 번 더 떠올린다
        setPhase('again');
        later(() => void listen('recall'), 1200);
        return;
      }
      // 두 번째 실패 — 이제 보기 3개(힌트)
      hinted.current = true;
      setPhase('hint');
    } catch {
      stopRec.current = null;
      if (!alive.current) return;
      // 권한 거부 등 — 막히지 않게 고르기(떠올리기) / 결과로(따라 말하기)
      if (kind === 'recall') {
        setMsg('마이크를 열지 못했어요 — 보기에서 골라 주세요.');
        hinted.current = tries.current > 0;
        setPhase('choice');
      } else setPhase('done');
    }
  }

  /** 등급이 정해졌다 — 정답을 인물 목소리로 들려주고, again이면 곧바로 따라 말하기 */
  function settle(g: FlashGrade) {
    setGrade(g);
    setPhase('result');
    const canFollow = g === 'again' && path !== 'self' && micAvailable();
    playAnswer(item.en, canFollow ? () => later(() => void listen('follow'), 300) : undefined);
  }

  /** 보기 고르기(힌트·키 없는 기기·마이크 거부) */
  function choose(k: number) {
    setPicked(k);
    const ok = k === item.a;
    haptic(ok ? 'success' : 'error');
    if (first.current === null) first.current = { score: ok ? 100 : 0 };
    settle(gradeOf(ok, hinted.current));
  }

  /** 키 없는 기기 — 소리 내어 말해 보고 내 소리와 인물 소리를 번갈아 듣기(전사 없음, 자기확인 발화) */
  async function recordSelf() {
    if (selfRec) return;
    setSelfRec(true);
    stopSpeaking();
    try {
      const res = await recordAndTranscribe({ language: 'en', silenceMs: RECALL_SILENCE_MS, maxMs: RECALL_MAX_MS, recordOnly: true, registerStop: (f) => (stopRec.current = f), onLevel: (v) => alive.current && setLevel(Math.min(1, v * 8)) });
      stopRec.current = null;
      if (!alive.current) return;
      if (res.audio) {
        setMine(res.audio);
        bumpSpoken(undefined, 'self');
      }
    } catch {
      setMsg('마이크를 쓸 수 없어요 — 소리 내어 말해 보는 것만으로 충분해요.');
    } finally {
      if (alive.current) setSelfRec(false);
    }
  }

  function finish() {
    if (finished.current || !grade) return;
    finished.current = true;
    stopRec.current?.();
    stopSpeaking();
    onDone({
      en: item.en,
      kr: item.kr,
      who,
      grade,
      good: grade !== 'again',
      firstScore: first.current?.score ?? 0,
      hinted: hinted.current,
      mode: choiceOnly ? 'choice' : 'speak',
      path,
      latencyMs: first.current?.latencyMs,
    });
  }

  const ask = review ? `🧠 “${item.kr}” — 영어로 말해 보세요` : `🧠 지난 화: “${item.kr}” — 영어로 말해 보세요`;
  const askChoice = review ? `🧠 “${item.kr}” — 영어로는?` : `🧠 지난 화: “${item.kr}” — 영어로는?`;
  const good = grade === 'hard' || grade === 'good';
  const labels = { native: `${name} ▶`, mine: '내 소리 ▶', title: '번갈아 들어보기' };
  const opts = item.opts || [];

  return (
    <div className={`dr-act rc-root${item.leech ? ' rc-leech' : ''}`} data-phase={phase} data-mode={choiceOnly ? 'choice' : 'speak'} data-path={path}>
      <div className="dr-ask rc-ask">{phase === 'choice' || phase === 'hint' || (choiceOnly && grade) ? askChoice : ask}</div>

      {(phase === 'rec' || phase === 'wait' || phase === 'again') && (
        <div className="rc-box">
          <div className="rs-level rc-level" aria-hidden="true">
            <span style={{ transform: `scaleX(${phase === 'rec' ? level : 0})` }} />
          </div>
          <p className="rc-status" role="status">
            {phase === 'wait' ? '… 듣고 있어요' : phase === 'again' ? '아직이에요 — 한 번 더 떠올려 볼까요? 🎙' : '🎙 바로 말해 보세요 — 말이 끝나면 저절로 멈춰요'}
          </p>
          {phase === 'rec' && (
            <button type="button" className="dr-mic on rc-mic" onClick={() => stopRec.current?.()} aria-label="말하기 끝">
              ⏹
            </button>
          )}
        </div>
      )}

      {phase === 'gate' && (
        <div className="rc-box">
          {msg && (
            <p className="dr-msg rc-gate" role="status">
              {msg}
            </p>
          )}
          <button type="button" className="dr-mic rc-mic" onClick={() => void listen(followGate.current ? 'follow' : 'recall')} aria-label="다시 말하기">
            🎙
          </button>
          {!followGate.current && (
            <button
              type="button"
              className="dr-skip rc-to-choice"
              onClick={() => {
                hinted.current = tries.current > 0;
                setPhase('choice');
              }}
            >
              보기에서 고를게요
            </button>
          )}
        </div>
      )}

      {(phase === 'hint' || phase === 'choice') && (
        <div className="rc-opts">
          {phase === 'hint' && <p className="rc-hint">힌트 — 셋 중에 있어요</p>}
          {msg && phase === 'choice' && <p className="dr-msg">{msg}</p>}
          {opts.map((o, k) => (
            <button key={k} type="button" className="wd-opt dr-opt rc-opt" onClick={() => choose(k)}>
              {o}
            </button>
          ))}
        </div>
      )}

      {grade && phase !== 'hint' && phase !== 'choice' && (
        <div className={`rc-result${good ? ' ok' : ''}`}>
          {heard && heard.diff.length > 0 && !choiceOnly ? (
            <>
              <div className="rc-score" aria-label={`점수 ${heard.score}점`}>
                {good ? (hinted.current ? '힌트로 떠올렸어요' : '떠올렸어요!') : '다시 볼게요'} · <b>{heard.score}점</b>
              </div>
              <p className="rs-diff rc-diff" lang="en">
                {/* 단어 사이 공백을 글자로 둔다 — 복사·스크린리더가 문장 그대로 읽게 */}
                {displayDiff(item.en, heard.diff).map((d, k) => (
                  <span key={k}>
                    {k > 0 && ' '}
                    <span className={d.ok ? 'rs-w ok' : 'rs-w bad'}>{d.w}</span>
                  </span>
                ))}
              </p>
              {heard.said && <p className="rs-said">내가 한 말: “{heard.said}”</p>}
            </>
          ) : (
            <>
              <div className="rc-score">{good ? (hinted.current ? '힌트로 떠올렸어요' : '기억하고 있네요!') : picked !== null ? '다시 볼게요' : '정답'}</div>
              <p className="rs-en rc-en" lang="en">
                {item.en}
              </p>
            </>
          )}
          <p className="rs-kr">{item.kr}</p>
          <button type="button" className="rc-replay" onClick={() => playAnswer(item.en)}>
            🔊 {name}의 목소리로 다시 듣기
          </button>
          {heard?.audio && !choiceOnly && <VoiceCompare sentence={item.en} clip={heard.audio} labels={labels} voice={voiceOf(who)} rate={rate} />}

          {/* again — 곧바로 따라 말하기 1회(거머리 카드는 끝부터 쌓기) */}
          {grade === 'again' && !choiceOnly && (phase === 'result' || phase === 'follow' || phase === 'followWait' || phase === 'done') && (
            <div className="rc-follow">
              <p className="rc-follow-ask">
                🗣 따라 말해요{stages.length > 1 ? ` · 끝부터 쌓기 ${stage + 1}/${stages.length}` : ''}
                {stages.length > 1 && <span className="rc-stage-en" lang="en"> — “{stages[stage]}”</span>}
              </p>
              {(phase === 'follow' || phase === 'followWait') && (
                <>
                  <div className="rs-level rc-level" aria-hidden="true">
                    <span style={{ transform: `scaleX(${phase === 'follow' ? level : 0})` }} />
                  </div>
                  <p className="rc-status" role="status">
                    {phase === 'followWait' ? '… 듣고 있어요' : '🎙 지금 따라 말하세요'}
                  </p>
                </>
              )}
              {phase === 'result' && <p className="rc-status">🔊 {name}의 목소리를 듣고 바로 따라 말해요</p>}
              {follow && phase === 'done' && (
                <p className={`rc-follow-res${follow.score >= PASS ? ' ok' : ''}`}>
                  따라 말하기 {follow.score}점 {follow.score >= PASS ? '✓' : '— 내일 다시 물어볼게요'}
                </p>
              )}
              {phase === 'done' && follow && stage + 1 < stages.length && (
                <button
                  type="button"
                  className="btn ghost rc-next-stage"
                  onClick={() => {
                    setFollow(null);
                    setStage((s) => s + 1);
                    playAnswer(stages[stage + 1], () => later(() => void listen('follow'), 300));
                    setPhase('result');
                  }}
                >
                  다음 구간 ▶
                </button>
              )}
            </div>
          )}

          {/* 키 없는 기기 — 녹음 A/B(내 소리 ▶ / 인물 ▶) */}
          {choiceOnly && path === 'self' && (
            <div className="rc-ab">
              {!mine ? (
                <button type="button" className="btn ghost rc-ab-rec" onClick={() => void recordSelf()} disabled={selfRec}>
                  {selfRec ? '🎙 말하는 중… (멈추면 저절로 끝나요)' : '🎙 소리 내어 말해 보기'}
                </button>
              ) : (
                <VoiceCompare sentence={item.en} clip={mine} labels={labels} voice={voiceOf(who)} rate={rate} />
              )}
              {msg && <p className="dr-msg">{msg}</p>}
            </div>
          )}

          {pair && (item.leech || grade === 'again') && (
            <details className="rc-pair">
              <summary>🔈 소리 구분 한 쌍 ▾</summary>
              <div className="rc-pair-row">
                <button type="button" className="mini-btn rc-pair-btn" onClick={() => speakText(pair.a, 'en-US', 0.8)} lang="en">
                  {pair.a} <small>{pair.aKr}</small>
                </button>
                <button type="button" className="mini-btn rc-pair-btn" onClick={() => speakText(pair.b, 'en-US', 0.8)} lang="en">
                  {pair.b} <small>{pair.bKr}</small>
                </button>
              </div>
            </details>
          )}

          {phase !== 'follow' && phase !== 'followWait' && (
            <div className="dr-row rc-row">
              <button type="button" className="btn primary rc-next" onClick={finish}>
                다음 ▶
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
