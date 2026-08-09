'use client';

import { useMemo } from 'react';
import { EPISODES, TOTAL_SCENES, TOTAL_EXPRESSIONS, expressionOfTheDay } from '../data/curriculum';
import { useProgress, calcStreak, dueExpressionIds } from '../lib/progress';
import SpeakButton from './SpeakButton';
import { CoffeeIcon } from './Icon';

export default function HomeScreen({
  onOpenEpisode,
  onGoReview,
}: {
  onOpenEpisode: (episodeId: string) => void;
  onGoReview: () => void;
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

      {due > 0 && (
        <>
          <div className="section-title">복습이 기다리고 있어요</div>
          <div className="card">
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              배운 표현 <b>{due}개</b>가 복습 예정일이 됐어요. 5분이면 충분해요!
            </p>
            <button className="btn btn-soft btn-block" style={{ marginTop: 12 }} onClick={onGoReview}>
              플래시카드 복습 시작
            </button>
          </div>
        </>
      )}

      <p className="legal-note">
        본 앱은 학습 목적의 비공식 팬 자료입니다. 원작 대본을 수록하지 않으며, 모든 연습 대화는
        장면에서 유래한 표현을 익히기 위해 새로 쓴 창작 대화입니다. FRIENDS™는 Warner Bros.의
        상표이며 본 앱과 무관합니다. 전체 표현 {TOTAL_EXPRESSIONS}개 · 에피소드 {EPISODES.length}편 수록.
      </p>
    </div>
  );
}
