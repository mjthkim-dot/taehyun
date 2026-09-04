'use client';

/**
 * 리콜 러시 — 밀린 패턴 리콜을 한 번에 몰아서 하는 모드.
 * 세션은 하루 1개만 리콜하므로, 며칠 쉬었다 오면 due가 쌓인다. 여기서
 * 상황 지문만 보고 연달아 떠올려 말하면 밀린 간격 반복이 한 번에 정리된다.
 */
import { useEffect, useRef, useState } from 'react';
import type { Mode } from './NavBar';
import { duePatternRecalls, gradePatternRecall, type PatternRecall } from '../lib/reviewEngine';
import { markPracticedToday } from '../lib/state';
import { useLessonStore } from '../store/useLessonStore';
import SpeakingPractice from './SpeakingPractice';
import { Confetti } from './Fx';

export default function RecallRushScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [queue] = useState<PatternRecall[]>(() => duePatternRecalls(10));
  const [idx, setIdx] = useState(0);
  const [passedCount, setPassedCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const accuracyScore = useLessonStore((s) => s.accuracyScore);
  const attempts = useLessonStore((s) => s.attempts);
  const clearAttempt = useLessonStore((s) => s.clearAttempt);
  const gradedRef = useRef(false);

  useEffect(() => {
    clearAttempt();
    gradedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  if (!queue.length) {
    return (
      <div className="study-screen">
        <div className="study-card">
          <h3>🧠 리콜 러시</h3>
          <p className="muted" style={{ fontSize: '0.82rem', lineHeight: 1.65 }}>
            지금은 밀린 리콜이 없어요 — 패턴이 due가 되면 여기 쌓입니다.
          </p>
          <button className="btn" style={{ marginTop: 10 }} onClick={() => onNavigate('growth')}>성장 화면으로</button>
        </div>
      </div>
    );
  }

  function next() {
    const cur = queue[idx];
    // 시도했을 때만 채점 — 건너뛰면 SRS는 그대로(내일 다시)
    if (attempts > 0 && !gradedRef.current) {
      gradedRef.current = true;
      gradePatternRecall(cur.pattern.key, accuracyScore);
      if (accuracyScore >= 80) setPassedCount((n) => n + 1);
    }
    if (idx >= queue.length - 1) {
      markPracticedToday();
      setFinished(true);
    } else {
      setIdx((i) => i + 1);
    }
  }

  if (finished) {
    return (
      <div className="study-screen">
        <div className="study-card" style={{ textAlign: 'center', position: 'relative' }}>
          {passedCount > 0 && <Confetti burstId={4} />}
          <div style={{ fontSize: '2rem' }}>🧠</div>
          <h3 style={{ margin: '6px 0' }}>리콜 러시 완료</h3>
          <p className="muted" style={{ fontSize: '0.84rem' }}>
            {queue.length}개 중 <b style={{ color: 'var(--green)' }}>{passedCount}개</b>를 기억에서 꺼냈어요.
            통과한 패턴은 다음 복습 간격이 길어집니다.
          </p>
          <button className="start-drill-btn" style={{ marginTop: 14 }} onClick={() => onNavigate('growth')}>성장 화면으로</button>
        </div>
      </div>
    );
  }

  const cur = queue[idx];
  return (
    <div className="study-screen">
      <div className="ss-title">🧠 리콜 러시 — {idx + 1}/{queue.length}</div>
      <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 8 }}>
        <b>{cur.pattern.en}</b> — 상황만 보고 기억에서 꺼내 보세요.
      </p>
      <SpeakingPractice
        key={cur.pattern.key}
        sentence={cur.story.speak.native.en}
        prompt={cur.story.challenge}
        hideTarget
        source="recall"
        patternKey={cur.pattern.key}
      />
      <div className="ss-nav">
        <button type="button" className="start-drill-btn" disabled={attempts === 0} onClick={next}>
          {idx >= queue.length - 1 ? '끝내기' : '다음 →'}
        </button>
        <button type="button" className="mini-btn ss-skip" onClick={next}>건너뛰기</button>
      </div>
    </div>
  );
}
