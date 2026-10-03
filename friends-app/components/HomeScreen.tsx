'use client';

import { useMemo } from 'react';
import { EPISODES, TOTAL_SCENES, TOTAL_EXPRESSIONS, expressionOfTheDay } from '../data/curriculum';
import { useProgress, calcStreak, dueExpressionIds, todayKey } from '../lib/progress';
import SpeakButton from './SpeakButton';
import { CoffeeIcon } from './Icon';

export default function HomeScreen({
  onOpenEpisode,
  onGoReview,
  onGoQuiz,
}: {
  onOpenEpisode: (episodeId: string) => void;
  onGoReview: () => void;
  onGoQuiz: () => void;
}) {
  const progress = useProgress();
  // "오늘의 표현"은 하루 동안 고정 — 렌더마다 다시 뽑을 필요가 없다.
  const today = useMemo(() => expressionOfTheDay(new Date()), []);

  const doneScenes = Object.keys(progress.completedScenes).length;
  const due = dueExpressionIds(progress).length;
  const streak = calcStreak(progress.studyDays);

  // 이어서 학습할 에피소드 — 완료하지 않은 장면이 남은 첫 회차.
  const nextEpisode =
    EPISODES.find((ep) => ep.scenes.some((s) => !progress.completedScenes[s.id])) ?? EPISODES[0];
  const started = doneScenes > 0;

  return (
    <div className="screen-enter">
      <div className="home-hero">
        <div className="eyebrow">Friends English</div>
        <h1>
          프렌즈로 배우는
          <br />
          진짜 미국 영어
        </h1>
        <p>회차별 명장면 속 표현을 듣고, 말하고, 내 것으로.</p>
        <button className="btn" onClick={() => onOpenEpisode(nextEpisode.id)}>
          <CoffeeIcon />
          {started ? `이어서 학습 — ${nextEpisode.code}` : '첫 에피소드 시작하기'}
        </button>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="num">{streak}</div>
          <div className="label">연속 학습일</div>
        </div>
        <div className="stat-card">
          <div className="num">
            {doneScenes}
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/{TOTAL_SCENES}</span>
          </div>
          <div className="label">완료한 장면</div>
        </div>
        <div className="stat-card">
          <div className="num">{due}</div>
          <div className="label">오늘의 복습</div>
        </div>
      </div>

      <TodayPlan
        progress={progress}
        due={due}
        onLesson={() => onOpenEpisode(nextEpisode.id)}
        onReview={onGoReview}
        onQuiz={onGoQuiz}
      />

      <div className="section-title">오늘의 표현</div>
      <div className="card today-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div className="today-phrase">{today.expression.phrase}</div>
            <div className="today-meaning">{today.expression.meaningKr}</div>
          </div>
          <SpeakButton text={today.expression.phrase} />
        </div>
        <div className="today-episode">
          {today.episode.code} · {today.scene.titleKr}
        </div>
      </div>

      <p className="legal-note">
        본 앱은 학습 목적의 비공식 팬 자료입니다. 원작 대본을 수록하지 않으며, 모든 연습 대화는
        장면에서 유래한 표현을 익히기 위해 새로 쓴 창작 대화입니다. FRIENDS™는 Warner Bros.의
        상표이며 본 앱과 무관합니다. 전체 표현 {TOTAL_EXPRESSIONS}개 · 에피소드 {EPISODES.length}편 수록.
      </p>
    </div>
  );
}

/** 오늘의 플랜 — 장면 1 · 복습 비우기 · 퀴즈 1회, 완료 여부를 체크리스트로 보여 준다. */
function TodayPlan({
  progress,
  due,
  onLesson,
  onReview,
  onQuiz,
}: {
  progress: ReturnType<typeof useProgress>;
  due: number;
  onLesson: () => void;
  onReview: () => void;
  onQuiz: () => void;
}) {
  const today = progress.daily[todayKey()] ?? { scenes: 0, reviews: 0, quizzes: 0 };
  const items: { label: string; sub: string; done: boolean; onGo: () => void }[] = [
    {
      label: '장면 1개 학습',
      sub: today.scenes > 0 ? `오늘 ${today.scenes}개 완료` : '표현 → 대화 → 드릴 → 딕테이션',
      done: today.scenes > 0,
      onGo: onLesson,
    },
    {
      label: '복습 카드 비우기',
      sub: due > 0 ? `${due}장 대기 중` : today.reviews > 0 ? `오늘 ${today.reviews}장 복습` : '오늘은 복습 카드가 없어요',
      done: due === 0,
      onGo: onReview,
    },
    {
      label: '퀴즈 풀기',
      sub: today.quizzes > 0 ? `오늘 ${today.quizzes}문항 풀이` : '읽기·듣기·빈칸 섞어서 8문항',
      done: today.quizzes >= 8,
      onGo: onQuiz,
    },
  ];
  const doneCount = items.filter((i) => i.done).length;

  return (
    <>
      <div className="section-title">
        오늘의 플랜
        <span className="muted num" style={{ fontSize: 12 }}>
          {doneCount}/{items.length} 완료
        </span>
      </div>
      <div className="card" style={{ padding: '6px 18px' }}>
        {items.map((item) => (
          <button key={item.label} className="plan-row" onClick={item.onGo}>
            <span className={`plan-check${item.done ? ' done' : ''}`}>{item.done ? '✓' : ''}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{item.label}</span>
              <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 1 }}>
                {item.sub}
              </span>
            </span>
            <span className="muted" aria-hidden>
              →
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
