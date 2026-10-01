'use client';

/**
 * 단어 '예문 말하기' 문항(M8) — 상자 2·4 복습에서 한국어 뜻 + 예문 번역을 보고 영어 예문을 말한다.
 *
 * 집중 모드에서 시간을 가장 많이 쓰는 단어 탭이 지금까지 발화 0이었다 — 고르기만 하면 상자가
 * 올라가니 "아는데 입에서 안 나오는" 단어가 그대로 마스터로 넘어갔다. 여기서는 소리를 내야 넘어간다.
 *
 * 흐름: 카드가 뜨면 🎙 자동 녹음(무음 1.5초면 끝, 최대 10초) → 받아쓰기 → lib/words.speakScore
 * (alignedScore ≥60, 표제어 포함 +10) → 통과면 원어민 발음을 들려주고 다음 / 실패면 영어 예문을
 * 펼치고 '한 번 더' 1회 → 2차도 실패면 '다음'(오답으로 채점). 영어는 실패 전엔 보여 주지 않는다 —
 * 보고 읽으면 '말하기'가 아니라 '읽기'가 된다.
 *
 * 받아쓰기 경로: 키가 있으면 Whisper(힌트는 고유명사만·temperature 0·detail none — 단어 문항엔
 * 품질 게이트용 세그먼트까진 필요 없다), 없으면 브라우저 인식(listenOnce). 둘 다 없거나 도중에
 * 실패하면 '🗣 소리 내어 말했어요 ✓' 자기확인으로 넘어간다 — 키 없는 기기에서도 막히지 않는다.
 *
 * 채점·상자 이동은 하지 않는다(WordsScreen이 onGrade로 gradeWord·재출제를 처리). 여기서는 시도
 * 로그(logAttempt src 'words')·발화 카운터(bumpSpoken)·'오늘 말한 단어'(va_words_spoken)만 남긴다.
 * WordsScreen에서 dynamic()으로 불린다 — 받아쓰기·비교 재생 코드가 단어 탭 첫 청크에 들어가지 않게.
 */
import { useEffect, useRef, useState } from 'react';
import { speakText, stopSpeaking } from '../SpeakButton';
import VoiceCompare from '../MyVoice';
import { haptic } from '../../lib/haptics';
import { displayDiff, type AlignedWord } from '../../lib/align';
import { recordAndTranscribe, STT_PROPER_NOUNS, whisperAvailable } from '../../lib/stt';
import { browserSttAvailable, listenOnce } from '../../lib/browserStt';
import { blockingReason, gateMessage } from '../../lib/sttQuality';
import { logAttempt, type AttemptQuality } from '../../lib/reviewEngine';
import { bumpSpoken } from '../../lib/state';
import { bumpWordsSpoken, speakScore, wordsSpokenToday, WORDS_SPEAK_GOAL, type SpeakQuizResult, type Word } from '../../lib/words';

/** 말하기 문항 녹음 창 — 한 문장이면 충분하다(무음 1.5초·최대 10초) */
export const SPEAK_SILENCE_MS = 1500;
export const SPEAK_MAX_MS = 10000;
/** 원어민 재생이 끝났다는 신호가 안 오는 기기(iOS not-allowed 등)에서도 넘어가게 하는 안전장치 */
const ADVANCE_FALLBACK_MS = 4000;

type Phase = 'idle' | 'rec' | 'wait' | 'pass' | 'fail' | 'done';
type Mode = 'whisper' | 'browser' | 'self';

export interface SpeakQuizProps {
  word: Word;
  /** 세션 안 재출제(상자는 움직이지 않는다 — 표시만) */
  retry?: boolean;
  /** 결과가 확정됐을 때 한 번 — 통과(자기확인 포함) 또는 2차 실패 */
  onGrade: (ok: boolean, r: SpeakQuizResult) => void;
  /** 다음 문항으로(통과: 원어민 재생 뒤 저절로, 실패: '다음' 버튼) */
  onNext: () => void;
}

function pickMode(): Mode {
  if (whisperAvailable()) return 'whisper';
  if (browserSttAvailable()) return 'browser';
  return 'self';
}

export default function SpeakQuiz({ word, retry, onGrade, onNext }: SpeakQuizProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [said, setSaid] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [diff, setDiff] = useState<AlignedWord[] | null>(null);
  const [tries, setTries] = useState(0);
  const [clip, setClip] = useState<Blob | null>(null);
  const [msg, setMsg] = useState('');
  const [spoken, setSpoken] = useState(() => wordsSpokenToday());
  /** 받아쓰기가 막혔을 때(소리 없음 2회·오류·경로 없음) 자기확인 버튼을 연다 */
  const [selfOk, setSelfOk] = useState(false);
  const [mode] = useState<Mode>(pickMode);
  const stopRec = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  /** 비동기 흐름이 늘 최신 콜백을 부르게(렌더마다 갱신) */
  const cb = useRef({ onGrade, onNext });
  cb.current = { onGrade, onNext };
  /** 발화 카운터는 문항당 한 번 */
  const counted = useRef(false);
  const emptyN = useRef(0);
  const triesRef = useRef(0);
  const advanceT = useRef<number | null>(null);
  /** 녹음 세대 — '모르겠어요'로 끊은 녹음의 늦은 결과가 화면을 되돌리지 않게 */
  const gen = useRef(0);

  useEffect(() => {
    alive.current = true;
    // 카드가 뜨면 바로 녹음 — 버튼을 한 번 더 누르게 하면 '말하기'가 아니라 '버튼 누르기'가 된다
    const t = mode === 'self' ? null : window.setTimeout(() => void record(), 350);
    if (mode === 'self') {
      setSelfOk(true);
      setMsg('이 기기에선 받아쓰기를 쓸 수 없어요 — 소리 내어 말한 뒤 ✓를 눌러 주세요.');
    }
    return () => {
      alive.current = false;
      if (t) clearTimeout(t);
      if (advanceT.current) clearTimeout(advanceT.current);
      stopRec.current?.();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function countOnce() {
    if (counted.current) return;
    counted.current = true;
    bumpSpoken();
    setSpoken(bumpWordsSpoken());
  }

  /** 원어민 발음을 들려준 뒤 다음으로 — onend가 안 오는 기기는 시간 안전장치로 */
  function playThenNext() {
    let fired = false;
    const go = () => {
      if (fired || !alive.current) return;
      fired = true;
      if (advanceT.current) clearTimeout(advanceT.current);
      cb.current.onNext();
    };
    advanceT.current = window.setTimeout(go, ADVANCE_FALLBACK_MS);
    stopSpeaking();
    speakText(word.ex, 'en-US', 0.95, () => {
      advanceT.current = window.setTimeout(go, 600);
    });
  }

  function scored(text: string, extra: { durationMs?: number; latencyMs?: number; quality?: AttemptQuality }) {
    const t = triesRef.current + 1;
    triesRef.current = t;
    const s = speakScore(word, text);
    logAttempt({ t: Date.now(), en: word.ex, score: s.score, latencyMs: extra.latencyMs, durationMs: extra.durationMs, src: 'words', quality: extra.quality ?? 'ok' });
    countOnce();
    setSaid(text);
    setScore(s.score);
    // 화면엔 원문 토큰(대소문자·문장부호 그대로) — 정규화된 소문자 단어를 보여 주면 예문이 달라 보인다
    setDiff(displayDiff(word.ex, s.diff));
    setTries(t);
    setMsg('');
    const r: SpeakQuizResult = { w: word.w, ex: word.ex, said: text, score: s.score, tries: t };
    if (s.pass) {
      haptic('success');
      setPhase('pass');
      cb.current.onGrade(true, r);
      playThenNext();
      return;
    }
    haptic('error');
    if (t >= 2) {
      setPhase('done');
      cb.current.onGrade(false, r);
    } else {
      setPhase('fail');
    }
  }

  async function record() {
    if (!alive.current || mode === 'self') return;
    if (phase === 'rec') {
      stopRec.current?.();
      return;
    }
    stopSpeaking();
    setPhase('rec');
    setMsg('');
    const g = ++gen.current;
    const stale = () => !alive.current || g !== gen.current;
    try {
      let text = '';
      let durationMs: number | undefined;
      let latencyMs: number | undefined;
      let quality: AttemptQuality = 'ok';
      if (mode === 'whisper') {
        const r = await recordAndTranscribe({
          // 힌트는 고유명사만 — 예문을 힌트로 주면 틀리게 말해도 맞게 받아써 점수가 부푼다(M0 정책)
          prompt: STT_PROPER_NOUNS,
          silenceMs: SPEAK_SILENCE_MS,
          maxMs: SPEAK_MAX_MS,
          detail: 'none',
          temperature: 0,
          registerStop: (f) => (stopRec.current = f),
          onState: (st) => {
            if (st === 'transcribing' && alive.current) setPhase('wait');
          },
        });
        stopRec.current = null;
        if (stale()) return;
        const block = blockingReason(r);
        if (block) {
          // 서버 바쁨·되울림 등 — 시도로 세지 않고 다시
          setMsg(gateMessage(block));
          setPhase('idle');
          if (block === 'busy') setSelfOk(true);
          return;
        }
        text = (r.text || '').trim();
        durationMs = r.durationMs;
        latencyMs = r.voiceOnsetMs;
        quality = r.quality?.reason ?? 'ok';
        if (r.audio) setClip(r.audio);
      } else {
        text = (await listenOnce({ lang: 'en-US', maxMs: SPEAK_MAX_MS, registerStop: (f) => (stopRec.current = f) })).trim();
        stopRec.current = null;
        if (stale()) return;
      }
      if (!text) {
        emptyN.current += 1;
        setMsg(emptyN.current >= 2 ? '소리가 계속 안 잡혀요 — 마이크를 확인하거나, 말한 뒤 ✓로 넘어가도 돼요.' : '소리가 안 잡혔어요 — 한 번 더 🎙');
        if (emptyN.current >= 2) setSelfOk(true);
        setPhase('idle');
        return;
      }
      scored(text, { durationMs, latencyMs, quality });
    } catch {
      stopRec.current = null;
      if (stale()) return;
      setMsg('받아쓰기를 못 했어요(마이크 권한을 확인해 주세요) — 말한 뒤 ✓로 넘어가도 돼요.');
      setSelfOk(true);
      setPhase('idle');
    }
  }

  /** 자기확인 — 받아쓰기가 없는 기기·막힌 상황. 말한 것으로 세고 통과 처리(원어민 발음을 들려준 뒤 다음) */
  function selfConfirm() {
    if (phase === 'rec' || phase === 'wait' || phase === 'pass') return;
    const t = triesRef.current + 1;
    triesRef.current = t;
    countOnce();
    setTries(t);
    setMsg('좋아요 — 소리 내어 말한 단어로 셌어요.');
    setPhase('pass');
    haptic('success');
    cb.current.onGrade(true, { w: word.w, ex: word.ex, said: '', score: null, tries: t });
    playThenNext();
  }

  /** '모르겠어요' — 1차 시도를 포기하고 영어를 본다(2차는 보고 따라 말해도 된다) */
  function giveUp() {
    if (phase !== 'idle' && phase !== 'rec') return;
    gen.current++;
    stopRec.current?.();
    stopRec.current = null;
    const t = triesRef.current + 1;
    triesRef.current = t;
    setTries(t);
    setSaid('');
    setScore(null);
    setDiff(null);
    setMsg('');
    if (t >= 2) {
      setPhase('done');
      cb.current.onGrade(false, { w: word.w, ex: word.ex, said: '', score: 0, tries: t });
    } else setPhase('fail');
  }

  function hear() {
    stopSpeaking();
    speakText(word.ex, 'en-US', 0.95);
  }

  const revealed = phase === 'fail' || phase === 'done' || phase === 'pass' || mode === 'self';
  const busy = phase === 'rec' || phase === 'wait';
  const status =
    phase === 'pass' ? `통과 — ${score === null ? '말했어요' : `${score}점`}. 원어민 발음을 들려드려요.` : phase === 'fail' ? `아직이에요 — ${score ?? 0}점. 영어 예문을 보고 한 번 더 말해 보세요.` : phase === 'done' ? `오답 — ${score ?? 0}점. 다음으로 넘어가요.` : phase === 'rec' ? '듣고 있어요. 영어로 말해 보세요.' : phase === 'wait' ? '받아 적는 중' : '';

  return (
    <div className={`wq-speak${retry ? ' retry' : ''}`} data-phase={phase}>
      <div className="wq-speak-head">
        <span className="wq-speak-goal" aria-label={`오늘 말한 단어 ${spoken} / ${WORDS_SPEAK_GOAL}`}>
          🗣 오늘 말한 단어 {spoken}/{WORDS_SPEAK_GOAL}
        </span>
        {tries > 0 && <span className="wq-speak-tries">시도 {Math.min(tries, 2)}/2</span>}
      </div>

      <div className="wd-q wq-speak-card">
        <span className="wq-speak-kr">{word.kr}</span>
        <span className="wq-speak-exkr">{word.exKr}</span>
        {revealed ? (
          <span className={`wq-speak-ex${phase === 'pass' ? ' pass' : ''}`} lang="en">
            {diff ? diff.map((d, i) => (
              <span key={i} className={d.ok ? 'ok' : 'miss'}>
                {d.w}{' '}
              </span>
            )) : word.ex}
          </span>
        ) : (
          <span className="wq-speak-hint">영어로 말해 보세요 — 핵심은 <b>{word.w}</b></span>
        )}
      </div>

      {said && (
        <p className="wq-speak-said">
          “{said}” · <b>{score}점</b>
        </p>
      )}

      <div className="wq-speak-actions">
        {mode !== 'self' && (phase === 'idle' || busy) && (
          <button type="button" className={`wq-speak-mic${phase === 'rec' ? ' on' : ''}`} onClick={() => void record()} disabled={phase === 'wait'} aria-label={phase === 'rec' ? '말하기 끝' : '말하기 시작'}>
            {phase === 'rec' ? '⏹' : phase === 'wait' ? '…' : '🎙'}
          </button>
        )}
        {phase === 'fail' && (
          <>
            <button type="button" className="btn wq-speak-hear" onClick={hear}>
              🔊 듣기
            </button>
            <button type="button" className="btn primary wq-speak-again" onClick={() => void record()}>
              🎙 한 번 더
            </button>
          </>
        )}
        {phase === 'done' && (
          <>
            <button type="button" className="btn wq-speak-hear" onClick={hear}>
              🔊 듣기
            </button>
            <button type="button" className="btn primary wq-speak-next" onClick={() => cb.current.onNext()}>
              다음 →
            </button>
          </>
        )}
        {phase === 'pass' && <span className="wq-speak-pass">✓ 잘했어요 — 원어민 발음</span>}
      </div>

      {(phase === 'idle' || phase === 'rec') && mode !== 'self' && (
        <button type="button" className="wq-speak-skip" onClick={giveUp}>
          모르겠어요 — 영어 보기
        </button>
      )}
      {selfOk && (phase === 'idle' || phase === 'fail') && (
        <button type="button" className="btn wq-speak-self" onClick={selfConfirm}>
          🗣 소리 내어 말했어요 ✓
        </button>
      )}
      {msg && <p className="wq-speak-msg">{msg}</p>}
      {(phase === 'fail' || phase === 'done') && <VoiceCompare sentence={word.ex} clip={clip} />}
      <p className="sr-only" role="status">
        {status}
      </p>
    </div>
  );
}
