'use client';

/**
 * 원어민 사다리 화면 — 한 문장을 [기본 → 자연스럽게 → 원어민] 3단으로 올린다.
 * 각 단은 말하기(정확도 80점 이상)로 통과해야 다음 단이 열리고, 위 단의 문장은
 * 통과 전까지 가려 둔다(먼저 읽어버리면 "떠올려 말하기"가 안 된다).
 * 완주하면 원어민 단 표현이 표현장과 복습 큐에 들어가 SRS로 굳는다.
 */
import { useEffect, useRef, useState } from 'react';
import { addPhrase, addWeakItem, getPhrases, getProfile, groqKey, markPracticedToday } from '../lib/state';
import { generateLadder, ladderDoneCount, markLadderDone, takeLadderSeed, type Ladder } from '../lib/nativeLadder';
import { ladderStyleHint, markPatternDone } from '../lib/maturity';
import { GroqError } from '../lib/groq';
import { AI_FAIL_KO } from '../lib/aiGuard';
import { useLessonStore } from '../store/useLessonStore';
import SpeakingPractice from './SpeakingPractice';
import { speakText } from './SpeakButton';
import { SpeakerIcon } from './icons';
import { Confetti } from './Fx';

const PASS_SCORE = 80;

export default function LadderScreen() {
  const [seed, setSeed] = useState('');
  const [ladder, setLadder] = useState<Ladder | null>(null);
  const [rungIdx, setRungIdx] = useState(0);
  const [passed, setPassed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doneCount, setDoneCount] = useState(0);

  const accuracyScore = useLessonStore((s) => s.accuracyScore);
  const clearAttempt = useLessonStore((s) => s.clearAttempt);
  /** 성장 화면에서 넘어온 커리큘럼 패턴 — 완주 시 정착으로 기록한다 */
  const patternKeyRef = useRef<string | null>(null);

  useEffect(() => setDoneCount(ladderDoneCount()), [finished]);

  // 성장 화면 → 사다리 핸드오프(one-shot): 패턴 예문이 시드로 오면 곧장 시작
  useEffect(() => {
    const seed = takeLadderSeed();
    if (seed) {
      patternKeyRef.current = seed.patternKey || null;
      void climb(seed.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 단이 바뀌면 이전 단의 점수를 지운다 — 안 지우면 이전 단의 80점이
  // 새 단을 즉시 통과시켜 버린다.
  useEffect(() => {
    clearAttempt();
    setPassed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rungIdx, ladder?.seed]);

  // 현재 단 통과 감지
  useEffect(() => {
    if (ladder && !finished && accuracyScore >= PASS_SCORE) setPassed(true);
  }, [accuracyScore, ladder, finished]);

  async function climb(text: string) {
    const s = text.trim();
    if (!s || loading) return;
    if (!groqKey()) {
      setError('⚡ 사다리 생성은 Groq 키 연결 후 가능해요 (회화 탭에서 등록).');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const l = await generateLadder(s, getProfile().cefr || 'A2', ladderStyleHint());
      if (!l) {
        setError(AI_FAIL_KO);
        return;
      }
      setLadder(l);
      setRungIdx(0);
      setFinished(false);
    } catch (e) {
      setError(e instanceof GroqError ? e.message : AI_FAIL_KO);
    } finally {
      setLoading(false);
    }
  }

  function nextRung() {
    if (!ladder) return;
    if (rungIdx >= ladder.rungs.length - 1) {
      // 완주 — 원어민 단을 표현장·복습 큐로 (SRS가 이 표현을 굳혀 준다)
      const top = ladder.rungs[ladder.rungs.length - 1];
      addPhrase({ en: top.en, kr: top.kr, lesson: 'ladder' });
      addWeakItem({ en: top.en, kr: top.kr, lesson: 'ladder', cat: '원어민' });
      markLadderDone(ladder.seed);
      // 커리큘럼 패턴에서 시작한 사다리면 그 패턴을 정착으로 기록 — 자동 승급의 재료
      if (patternKeyRef.current) {
        markPatternDone(patternKeyRef.current);
        patternKeyRef.current = null;
      }
      markPracticedToday();
      setFinished(true);
    } else {
      setRungIdx((i) => i + 1);
    }
  }

  function reset() {
    setLadder(null);
    setSeed('');
    setRungIdx(0);
    setPassed(false);
    setFinished(false);
    setError('');
  }

  /* ── 시작 화면: 문장 고르기 ── */
  if (!ladder) {
    const recents = getPhrases().slice(-5).reverse();
    return (
      <div className="study-screen">
        <div className="study-card">
          <h3>🪜 원어민 사다리</h3>
          <p className="muted" style={{ fontSize: '0.82rem', lineHeight: 1.65, marginBottom: 12 }}>
            한 문장을 <b>기본 → 자연스럽게 → 원어민</b> 3단계로 올려가며 말합니다. 각 단계를
            정확도 {PASS_SCORE}점 이상으로 통과해야 다음 단계가 열리고, 완주한 원어민 표현은
            표현장과 복습 큐에 저장돼요.
            {doneCount > 0 && <> · 지금까지 <b>{doneCount}개</b> 완주</>}
          </p>
          <textarea
            className="ld-seed-input"
            rows={2}
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="영어 문장, 또는 하고 싶은 말을 한국어로 적어도 돼요"
          />
          <button className="start-drill-btn ld-gen-btn" disabled={loading || !seed.trim()} onClick={() => climb(seed)}>
            {loading ? '사다리 만드는 중…' : '사다리 오르기 시작'}
          </button>
          {error && <p className="warn" style={{ marginTop: 10 }}>{error}</p>}

          {recents.length > 0 && (
            <>
              <div className="mt-sec" style={{ marginTop: 16 }}>표현장에서 바로 올리기</div>
              {recents.map((p) => (
                <button key={p.en} type="button" className="ld-pick" disabled={loading} onClick={() => climb(p.en)}>
                  <span className="ld-pick-en">{p.en}</span>
                  {p.kr && <span className="ld-pick-kr">{p.kr}</span>}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── 완주 화면 ── */
  if (finished) {
    const top = ladder.rungs[ladder.rungs.length - 1];
    return (
      <div className="study-screen">
        <div className="study-card ld-finish" style={{ textAlign: 'center', position: 'relative' }}>
          <Confetti burstId={1} />
          <div style={{ fontSize: '2rem' }}>🪜</div>
          <h3 style={{ margin: '6px 0' }}>사다리 완주!</h3>
          <p className="ld-finish-en">
            {top.en}{' '}
            <button type="button" className="speak-mini" onClick={() => speakText(top.en, 'en-US')}><SpeakerIcon /></button>
          </p>
          <p className="muted" style={{ fontSize: '0.8rem' }}>{top.kr}</p>
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 8 }}>
            원어민 표현이 표현장과 복습 큐에 저장됐어요 — 간격 반복으로 굳혀집니다.
          </p>
          <button className="start-drill-btn" style={{ marginTop: 14 }} onClick={reset}>
            다른 문장 올리기
          </button>
        </div>
      </div>
    );
  }

  /* ── 사다리 오르기 ── */
  const cur = ladder.rungs[rungIdx];
  return (
    <div className="study-screen ld-screen">
      <div className="ld-head muted">
        “{ladder.seed}” · {rungIdx + 1}/{ladder.rungs.length}단
      </div>

      {ladder.rungs.map((r, i) => {
        const state = i < rungIdx ? 'done' : i === rungIdx ? 'active' : 'locked';
        return (
          <div key={i} className={`ld-rung ${state}`}>
            <div className="ld-rung-top">
              <span className={`ld-level ld-level-${i}`}>{state === 'done' ? '✓ ' : state === 'locked' ? '🔒 ' : ''}{r.level}</span>
            </div>
            {state === 'done' && (
              <div className="ld-rung-en muted">{r.en}</div>
            )}
            {state === 'active' && (
              <>
                <div className="ld-note">{r.note}</div>
                <SpeakingPractice key={`${ladder.seed}:${i}`} sentence={r.en} prompt={r.kr} />
                {passed ? (
                  <button type="button" className="start-drill-btn ld-next" onClick={nextRung}>
                    {rungIdx >= ladder.rungs.length - 1 ? '🏁 완주하기' : '다음 단계 열기 →'}
                  </button>
                ) : (
                  <div className="ld-hint muted">정확도 {PASS_SCORE}점 이상이면 다음 단계가 열려요</div>
                )}
                <button type="button" className="mini-btn ld-skip" onClick={nextRung}>
                  이 단계 건너뛰기
                </button>
              </>
            )}
            {state === 'locked' && (
              <div className="ld-rung-hidden muted">이전 단계를 통과하면 열려요</div>
            )}
          </div>
        );
      })}

      <button type="button" className="mini-btn" style={{ marginTop: 4 }} onClick={reset}>
        ← 다른 문장으로
      </button>
    </div>
  );
}
