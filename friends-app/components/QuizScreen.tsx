'use client';

/**
 * 퀴즈 화면 — 회차 선택(또는 전체 랜덤) → 8문항 → 결과.
 * 정답/오답은 SRS에 반영되어 복습 큐로 이어진다.
 */
import { useState } from 'react';
import { EPISODES } from '../data/curriculum';
import { buildQuiz, type QuizQuestion } from '../lib/quiz';
import { recordQuizAnswer } from '../lib/progress';

type Phase = 'pick' | 'playing' | 'result';

export default function QuizScreen({
  initialEpisodeId,
  onDone,
}: {
  /** 레슨 화면에서 "이 회차 퀴즈"로 진입할 때 설정된다. */
  initialEpisodeId?: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(initialEpisodeId ? 'playing' : 'pick');
  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    initialEpisodeId ? buildQuiz({ episodeId: initialEpisodeId }) : [],
  );
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [rightCount, setRightCount] = useState(0);

  function start(episodeId?: string) {
    setQuestions(buildQuiz({ episodeId }));
    setIdx(0);
    setPicked(null);
    setRightCount(0);
    setPhase('playing');
  }

  if (phase === 'pick') {
    return (
      <div className="screen-enter">
        <div className="section-title">어떤 퀴즈를 풀까요?</div>
        <button className="btn btn-primary btn-block" onClick={() => start()}>
          전체 표현 랜덤 퀴즈
        </button>
        <div className="section-title">회차별 퀴즈</div>
        {EPISODES.map((ep) => (
          <button key={ep.id} className="episode-card" onClick={() => start(ep.id)}>
            <div className="episode-badge">{ep.code.slice(3)}</div>
            <div>
              <div className="title-en">{ep.titleEn}</div>
              <div className="title-kr">
                {ep.code} · {ep.theme}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  if (phase === 'result') {
    const pct = Math.round((rightCount / questions.length) * 100);
    return (
      <div className="screen-enter quiz-result">
        <div className="big num">
          {rightCount}/{questions.length}
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 4px' }}>
          {pct === 100
            ? '완벽해요! 트랜스폰스터도 맞힐 기세! 🏆'
            : pct >= 70
              ? '훌륭해요! 조금만 더 하면 만점!'
              : '틀린 표현은 복습 카드로 다시 만나요.'}
        </p>
        <p className="muted" style={{ fontSize: 13 }}>
          결과가 복습 일정에 반영됐어요.
        </p>
        <div className="lesson-cta">
          <button className="btn btn-primary btn-block" onClick={() => setPhase('pick')}>
            다른 퀴즈 풀기
          </button>
          <button className="btn btn-ghost btn-block" onClick={onDone}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const answered = picked !== null;

  function choose(i: number) {
    if (answered) return;
    setPicked(i);
    const correct = i === q.answerIndex;
    if (correct) setRightCount((n) => n + 1);
    recordQuizAnswer(q.expressionId, correct);
  }

  function next() {
    if (idx + 1 >= questions.length) setPhase('result');
    else {
      setIdx(idx + 1);
      setPicked(null);
    }
  }

  return (
    <div className="screen-enter">
      <div className="quiz-progress" aria-label={`${idx + 1} / ${questions.length} 문항`}>
        {questions.map((_, i) => (
          <i key={i} className={i < idx ? 'done' : i === idx ? 'current' : ''} />
        ))}
      </div>

      <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
        {q.type === 'meaning' ? '이 표현의 뜻은?' : '상황에 맞는 표현은?'}
      </div>
      <div className="quiz-prompt">{q.prompt}</div>

      {q.choices.map((choice, i) => {
        let cls = 'quiz-choice';
        if (answered) {
          if (i === q.answerIndex) cls += ' correct';
          else if (i === picked) cls += ' wrong';
        }
        return (
          <button key={i} className={cls} onClick={() => choose(i)} disabled={answered}>
            {choice}
          </button>
        );
      })}

      {answered && (
        <>
          <div className="quiz-explanation">{q.explanation}</div>
          <button className="btn btn-primary btn-block" onClick={next}>
            {idx + 1 >= questions.length ? '결과 보기' : '다음 문제'}
          </button>
        </>
      )}
    </div>
  );
}
