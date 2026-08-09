'use client';

/**
 * 복습 화면 — Leitner 플래시카드.
 * 큐 = 오늘 복습 예정(SRS due) + 저장(북마크)했지만 아직 SRS에 없는 표현.
 * 카드를 뒤집어 뜻을 확인하고 "기억나요/가물가물"으로 다음 간격을 정한다.
 */
import { useMemo, useState } from 'react';
import { findExpression } from '../data/curriculum';
import { useProgress, dueExpressionIds, recordReview } from '../lib/progress';
import SpeakButton from './SpeakButton';

export default function ReviewScreen() {
  const progress = useProgress();
  // 세션 시작 시점의 큐를 고정한다 — 복습 중 due가 갱신되며 카드가 사라지는 혼란 방지.
  const [queue] = useState<string[]>(() => {
    const due = dueExpressionIds(progress);
    const savedOnly = progress.saved.filter((id) => !progress.srs[id]);
    return [...new Set([...due, ...savedOnly])];
  });
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  const current = useMemo(() => {
    const id = queue[pos];
    return id ? findExpression(id) : undefined;
  }, [queue, pos]);

  if (queue.length === 0) {
    return (
      <div className="empty-state screen-enter">
        <div className="emoji">☕</div>
        <p>
          오늘 복습할 카드가 없어요.
          <br />
          에피소드를 학습하거나 퀴즈를 풀면
          <br />
          복습 카드가 쌓여요.
        </p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="empty-state screen-enter">
        <div className="emoji">🎉</div>
        <p>
          오늘 복습 {doneCount}장 완료!
          <br />
          기억은 반복에서 나와요. 내일 또 만나요.
        </p>
      </div>
    );
  }

  function grade(remembered: boolean) {
    recordReview(current!.expression.id, remembered);
    setDoneCount((n) => n + 1);
    setFlipped(false);
    setPos((p) => p + 1);
  }

  const { expression, episode, scene } = current;

  return (
    <div className="screen-enter">
      <div className="muted num" style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
        {pos + 1} / {queue.length}
      </div>

      <button
        className="flashcard"
        style={{ width: '100%' }}
        onClick={() => setFlipped(!flipped)}
        aria-label={flipped ? '카드 앞면 보기' : '카드 뒤집어 뜻 보기'}
      >
        {!flipped ? (
          <>
            <div className="phrase">{expression.phrase}</div>
            <div className="hint">탭해서 뜻 확인</div>
          </>
        ) : (
          <>
            <div className="meaning">{expression.meaningKr}</div>
            <div className="hint">
              {episode.code} · {scene.titleKr}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}>
              {expression.exampleEn}
              <br />
              {expression.exampleKr}
            </div>
          </>
        )}
      </button>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        <SpeakButton text={expression.phrase} />
      </div>

      {flipped && (
        <div className="review-actions">
          <button className="btn btn-forgot" onClick={() => grade(false)}>
            가물가물 🙈
          </button>
          <button className="btn btn-got" onClick={() => grade(true)}>
            기억나요 ✅
          </button>
        </div>
      )}
    </div>
  );
}
