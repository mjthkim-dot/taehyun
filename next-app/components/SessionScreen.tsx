'use client';

/**
 * 오늘의 세션 — 홈의 버튼 하나로 시작되는 10분 가이드 코스.
 * 복습 워밍업 → 패턴 스토리(장면으로 배우기) → 말하기 2단 → 실전 리콜이
 * 자동으로 이어진다. 무엇을 할지 고르는 화면이 없다는 것이 이 화면의 존재 이유.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Mode } from './NavBar';
import { computeMaturity } from '../lib/maturity';
import { markPatternDone } from '../lib/maturity';
import { markLadderDone } from '../lib/nativeLadder';
import { pickTodayPattern, sessionDoneToday, markSessionDone, warmupItems } from '../lib/session';
import { markPracticedToday } from '../lib/state';
import { useLessonStore } from '../store/useLessonStore';
import SpeakingPractice from './SpeakingPractice';
import { speakText } from './SpeakButton';
import { SpeakerIcon } from './icons';
import { Confetti } from './Fx';

type Step =
  | { type: 'warmup'; en: string; kr: string }
  | { type: 'story' }
  | { type: 'speak'; rung: 'basic' | 'native' }
  | { type: 'challenge' };

const PHASE_OF: Record<Step['type'], string> = {
  warmup: '복습',
  story: '배우기',
  speak: '말하기',
  challenge: '실전',
};
const PHASES = ['복습', '배우기', '말하기', '실전'];

export default function SessionScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  // 오늘의 재료는 마운트 시 한 번 확정한다 — 도중에 바뀌면 길이 흔들린다
  const [setup] = useState(() => {
    const mx = computeMaturity();
    const picked = pickTodayPattern(mx.stage.n);
    const warmups = warmupItems();
    const steps: Step[] = [
      ...warmups.map((w) => ({ type: 'warmup' as const, en: w.en, kr: w.kr })),
      { type: 'story' as const },
      { type: 'speak' as const, rung: 'basic' as const },
      { type: 'speak' as const, rung: 'native' as const },
      { type: 'challenge' as const },
    ];
    return { stage: mx.stage, picked, steps };
  });
  const [stepIdx, setStepIdx] = useState(0);
  const [finished, setFinished] = useState(false);
  const [spokenCount, setSpokenCount] = useState(0);

  const accuracyScore = useLessonStore((s) => s.accuracyScore);
  const attempts = useLessonStore((s) => s.attempts);
  const clearAttempt = useLessonStore((s) => s.clearAttempt);

  const step = setup.steps[Math.min(stepIdx, setup.steps.length - 1)];

  // 스텝이 바뀌면 이전 점수를 지운다 — 안 지우면 이전 스텝의 점수가 새 스텝을 통과시킨다
  useEffect(() => {
    clearAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  const phaseNow = PHASE_OF[step.type];
  const passed = accuracyScore >= 80;
  const attempted = attempts > 0;

  const speakStepsTotal = useMemo(
    () => setup.steps.filter((s) => s.type !== 'story').length,
    [setup.steps]
  );

  function next() {
    if (attempted) setSpokenCount((n) => n + 1);
    if (stepIdx >= setup.steps.length - 1) {
      // 완주 — 패턴 정착 + 사다리 완주로 기록(자동 승급의 재료)
      if (setup.picked && !setup.picked.isReview) markPatternDone(setup.picked.pattern.key);
      if (setup.picked) markLadderDone(`session:${setup.picked.pattern.key}:${new Date().toISOString().slice(0, 10)}`);
      markSessionDone();
      markPracticedToday();
      setFinished(true);
    } else {
      setStepIdx((i) => i + 1);
    }
  }

  if (!setup.picked) {
    return (
      <div className="study-screen">
        <div className="study-card">
          <p className="muted">오늘의 콘텐츠를 준비하지 못했어요 — 성장 화면에서 패턴을 직접 골라 연습해 주세요.</p>
          <button className="btn" style={{ marginTop: 10 }} onClick={() => onNavigate('growth')}>성장 화면으로</button>
        </div>
      </div>
    );
  }

  const { pattern, story, isReview } = setup.picked;

  /* ── 완주 ── */
  if (finished) {
    return (
      <div className="study-screen">
        <div className="study-card ss-finish" style={{ textAlign: 'center', position: 'relative' }}>
          <Confetti burstId={2} />
          <div style={{ fontSize: '2rem' }}>🎉</div>
          <h3 style={{ margin: '6px 0' }}>오늘 세션 완주!</h3>
          <p className="ss-finish-pattern">
            {pattern.en}
            <button type="button" className="speak-mini" style={{ marginLeft: 6 }} onClick={() => speakText(story.speak.native.en, 'en-US')}><SpeakerIcon /></button>
          </p>
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            {isReview ? '오늘은 복습 세션 — 정착한 패턴을 다시 다졌어요.' : '패턴이 정착으로 기록됐어요 — 성숙도 승급에 쌓입니다.'}
          </p>
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
            말하기 {Math.min(spokenCount, speakStepsTotal)}회 · 내일 세션에서 다음 패턴이 열려요.
          </p>
          <button className="start-drill-btn" style={{ marginTop: 14 }} onClick={() => onNavigate('master')}>홈으로</button>
          <button className="btn" style={{ marginTop: 8 }} onClick={() => onNavigate('growth')}>성장 현황 보기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="study-screen ss-screen">
      {/* 진행 스트립 — 지금 어디까지 왔는지 항상 보인다 */}
      <div className="ss-phases">
        {PHASES.map((p) => (
          <span key={p} className={`ss-phase${p === phaseNow ? ' now' : ''}`}>{p}</span>
        ))}
        <span className="ss-count">{stepIdx + 1}/{setup.steps.length}</span>
      </div>

      {/* ── 워밍업: 복습 문장 말하기 ── */}
      {step.type === 'warmup' && (
        <>
          <div className="ss-title">🔥 워밍업 — 복습 문장을 소리 내어</div>
          <SpeakingPractice key={`w${stepIdx}`} sentence={step.en} prompt={step.kr} />
        </>
      )}

      {/* ── 스토리: 장면으로 배우기 ── */}
      {step.type === 'story' && (
        <div className="ss-story">
          <div className="ss-title">{isReview ? '📖 오늘의 복습 패턴' : '📖 오늘의 패턴'}</div>
          <div className="ss-pattern-name">{pattern.en}</div>
          <p className="ss-scene">{story.scene}</p>
          <div className="ss-dialogue">
            {story.dialogue.map((l, i) => (
              <div key={i} className={`ss-line${l.mark ? ' mark' : ''}`}>
                <span className={l.sp === 'A' ? 'sp-a' : 'sp-b'}>{l.sp}</span>
                <div className="ss-line-body">
                  <div className="ss-line-en">
                    {l.en}
                    <button type="button" className="speak-mini" aria-label="듣기" onClick={() => speakText(l.en, 'en-US')}><SpeakerIcon /></button>
                  </div>
                  <div className="ss-line-kr">{l.kr}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="ss-how">
            <div className="ss-how-head">💡 이렇게 활용해요</div>
            {story.how}
          </div>
        </div>
      )}

      {/* ── 말하기 2단: 기본 → 원어민 ── */}
      {step.type === 'speak' && (
        <>
          <div className="ss-title">
            {step.rung === 'basic' ? '🗣 말하기 ① — 기본형부터' : '🗣 말하기 ② — 원어민처럼'}
          </div>
          {step.rung === 'native' && (
            <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 8 }}>같은 말을 원어민의 결로 — 방금 문장과 무엇이 다른지 느껴보세요.</p>
          )}
          <SpeakingPractice
            key={`s${stepIdx}`}
            sentence={step.rung === 'basic' ? story.speak.basic.en : story.speak.native.en}
            prompt={step.rung === 'basic' ? story.speak.basic.kr : story.speak.native.kr}
          />
        </>
      )}

      {/* ── 실전 리콜: 상황만 보고 떠올려 말하기 ── */}
      {step.type === 'challenge' && (
        <>
          <div className="ss-title">🎯 실전 — 상황만 보고 떠올려 말하기</div>
          {/* 상황 지문은 연습 카드(hideTarget의 프롬프트)가 크게 보여준다 — 중복 박스 금지 */}
          <SpeakingPractice key={`c${stepIdx}`} sentence={story.speak.native.en} prompt={story.challenge} hideTarget />
        </>
      )}

      {/* 하단 내비 — 말하기 스텝은 시도 후에, 스토리는 바로 넘어간다 */}
      <div className="ss-nav">
        {step.type === 'story' ? (
          <button type="button" className="start-drill-btn" onClick={next}>이해했어요 — 말하러 가기 →</button>
        ) : (
          <>
            <button type="button" className="start-drill-btn" disabled={!attempted} onClick={next}>
              {passed ? '✓ 좋아요 — ' : ''}{stepIdx >= setup.steps.length - 1 ? '세션 완주하기' : '다음 →'}
            </button>
            {!attempted && <div className="ss-hint muted">말하기 버튼으로 한 번 말해보면 다음으로 갈 수 있어요</div>}
            <button type="button" className="mini-btn ss-skip" onClick={next}>건너뛰기</button>
          </>
        )}
      </div>
    </div>
  );
}
