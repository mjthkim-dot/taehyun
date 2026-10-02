'use client';

/**
 * 리액션 턴(M6) — 3번째 내 턴 직전, 인물이 근황을 두 문장으로 말한다. 두 문장 사이 2.0초 창에
 * 짧은 한마디(Okay. / Really? / Oh no.)를 던지는 연습. 한국인 학습자의 mhm/uh 편중을 말로 된 리액션으로,
 * 못 알아들었을 때의 생존 청크(Sorry? / Say that again?)를 매일 쓰게 한다.
 *
 * 흐름: 첫 문장 재생 → 끝나고 REACTION_LEAD_MS 뒤 🎙 2.0초(echo 게이트: 직전 TTS 텍스트) → 판정
 *   · 뱅크 매칭 ✓ (clarify면 인물이 첫 문장을 0.8×로 한 번 더) · um/uh만이면 팁 · 그 밖·무응답은 무벌점
 *   → 둘째 문장 재생 → onDone. 힌트 칩 3개는 expectedFns/pickReactionHints(대사 성격에 맞는 기능).
 * TTS onend가 오지 않는 기기(iOS 등)에서 멈추지 않도록 길이 추정 + 여유 시간 안전 타이머를 둔다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { speakText, stopSpeaking } from '../SpeakButton';
import { BACKCHANNEL_TIP, CLARIFY_RATE, judgeReaction, REACTION_LEAD_MS, REACTION_WINDOW_MS, type ReactionVerdict } from '../../lib/fixGate';
import { pickReactionHints, REACTION_FN_LABEL, type ReactionLevel } from '../../lib/reactions';
import { recAvailable, recOnce } from '../../lib/dtalkRec';
import { bumpSpoken } from '../../lib/state';
import { markInteraction } from '../../lib/dayGovernor';
import { withIGa } from '../../lib/drama';

export interface ReactionTurnProps {
  first: string;
  rest: string;
  /** 화면 문구용 한국어 이름(castNameKo — 준·다이앤) — 조사는 withIGa로 받침에 맞춘다 */
  partnerName: string;
  voice: string;
  rate: number;
  level: ReactionLevel;
  onDone: (v: ReactionVerdict) => void;
}

type Phase = 'speak1' | 'window' | 'wait' | 'clarify' | 'speak2';

/** onend가 안 와도 넘어가는 안전 시간 — 단어당 0.45초/배속 + 2.5초 */
const safetyMs = (text: string, rate: number) => 2500 + (text.split(/\s+/).length * 450) / Math.max(0.5, rate);

export default function ReactionTurn({ first, rest, partnerName, voice, rate, level, onDone }: ReactionTurnProps) {
  const [phase, setPhase] = useState<Phase>('speak1');
  const [verdict, setVerdict] = useState<ReactionVerdict | null>(null);
  const [said, setSaid] = useState('');
  const alive = useRef(true);
  const stop = useRef<(() => void) | null>(null);
  const hints = useMemo(() => pickReactionHints(`${first} ${rest}`, 3, level), [first, rest, level]);

  /** 한 번만 이어지는 재생 — onend 또는 안전 타이머 중 먼저 오는 쪽 */
  function play(text: string, r: number, then: () => void) {
    let fired = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      if (fired || !alive.current) return;
      fired = true;
      if (t) clearTimeout(t);
      then();
    };
    t = setTimeout(go, safetyMs(text, r));
    stopSpeaking();
    speakText(text, 'en-US', r, go, voice);
  }

  function finish(v: ReactionVerdict) {
    play(rest, rate, () => onDone(v));
  }

  async function listen() {
    if (!alive.current) return;
    if (!recAvailable()) {
      setPhase('speak2');
      finish({ kind: 'empty' });
      return;
    }
    setPhase('window');
    let v: ReactionVerdict = { kind: 'empty' };
    try {
      const r = await recOnce({
        language: 'en',
        maxMs: REACTION_WINDOW_MS,
        silenceMs: 700,
        // 리액션은 인물 말과 다른 말 — 스피커 누출을 echo 게이트로 거른다
        lastTtsText: first,
        registerStop: (f) => (stop.current = f),
        onState: (s) => s === 'transcribing' && alive.current && setPhase('wait'),
      });
      stop.current = null;
      if (!alive.current) return;
      if (!r.block) {
        setSaid(r.text);
        v = judgeReaction(r.text);
      }
    } catch {
      stop.current = null;
      if (!alive.current) return;
    }
    setVerdict(v);
    if (v.kind === 'match') {
      bumpSpoken();
      markInteraction();
    }
    if (v.kind === 'match' && v.clarify) {
      // 못 들었다고 했으니 인물이 첫 문장을 천천히 다시 — 그다음 둘째 문장
      setPhase('clarify');
      play(first, rate * CLARIFY_RATE, () => {
        setPhase('speak2');
        finish(v);
      });
      return;
    }
    setPhase('speak2');
    finish(v);
  }

  useEffect(() => {
    alive.current = true;
    play(first, rate, () => setTimeout(() => void listen(), REACTION_LEAD_MS));
    return () => {
      alive.current = false;
      stop.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fgate-rt" data-phase={phase} role="group" aria-label="리액션 한마디">
      {phase === 'speak1' && <p className="fgate-rt-status">🔊 {withIGa(partnerName)} 근황을 말하는 중… 중간에 짧게 한마디!</p>}
      {(phase === 'window' || phase === 'wait') && (
        <>
          <p className="fgate-rt-cue" role="status">
            {phase === 'window' ? '🎙 짧게 한마디! 못 들었으면 Sorry?' : '…'}
          </p>
          <div className="fgate-rt-hints" aria-label="리액션 예시">
            {hints.map((h) => (
              <span key={h.id} className="fgate-rt-hint" lang="en" title={`${REACTION_FN_LABEL[h.fn]} — ${h.kr}`}>
                {h.en}
              </span>
            ))}
          </div>
        </>
      )}
      {verdict && (
        <p className={`fgate-rt-verdict${verdict.kind === 'match' ? ' ok' : ''}`} role="status">
          {verdict.kind === 'match'
            ? verdict.clarify
              ? `✓ “${said || verdict.en}” — ${withIGa(partnerName)} 천천히 다시 말해요`
              : `✓ “${said || verdict.en}” 좋은 리액션!`
            : verdict.kind === 'backchannel'
              ? `💡 ${BACKCHANNEL_TIP}`
              : verdict.kind === 'miss'
                ? `“${said}” — 다음엔 짧게: ${hints[0]?.en ?? 'Really?'}`
                : `괜찮아요 — 다음엔 ${hints[0]?.en ?? 'Okay.'}처럼 한마디!`}
        </p>
      )}
    </div>
  );
}
