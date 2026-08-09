'use client';

/**
 * 앱 셸 — 하단 5탭 + 레슨(에피소드 상세) 오버레이 화면.
 * 모든 상태는 클라이언트에 있고(정적 export), 학습 데이터는 번들에 포함된다.
 */
import { useState } from 'react';
import NavBar, { type Tab } from '../components/NavBar';
import HomeScreen from '../components/HomeScreen';
import EpisodesScreen from '../components/EpisodesScreen';
import LessonScreen from '../components/LessonScreen';
import QuizScreen from '../components/QuizScreen';
import ReviewScreen from '../components/ReviewScreen';
import ProgressScreen from '../components/ProgressScreen';
import { useProgress, calcStreak } from '../lib/progress';

export default function Page() {
  const [tab, setTab] = useState<Tab>('home');
  /** 열려 있는 레슨 — null이 아니면 탭 콘텐츠 대신 레슨 화면을 그린다. */
  const [lessonId, setLessonId] = useState<string | null>(null);
  /** 레슨 → 퀴즈 직행 시 그 회차만 출제하기 위한 컨텍스트. */
  const [quizEpisodeId, setQuizEpisodeId] = useState<string | undefined>(undefined);
  const progress = useProgress();
  const streak = calcStreak(progress.studyDays);

  function openEpisode(id: string) {
    setLessonId(id);
    setTab('episodes');
  }

  function startEpisodeQuiz(episodeId: string) {
    setLessonId(null);
    setQuizEpisodeId(episodeId);
    setTab('quiz');
  }

  function changeTab(t: Tab) {
    setLessonId(null);
    if (t !== 'quiz') setQuizEpisodeId(undefined);
    setTab(t);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          프렌즈 잉글리시
        </div>
        {streak > 0 && (
          <span className="header-streak num" title={`연속 ${streak}일 학습 중`}>
            🔥 {streak}일
          </span>
        )}
      </header>

      <main className="app-content">
        {lessonId ? (
          <LessonScreen
            episodeId={lessonId}
            onBack={() => setLessonId(null)}
            onQuiz={startEpisodeQuiz}
          />
        ) : tab === 'home' ? (
          <HomeScreen onOpenEpisode={openEpisode} onGoReview={() => changeTab('review')} />
        ) : tab === 'episodes' ? (
          <EpisodesScreen onOpen={openEpisode} />
        ) : tab === 'quiz' ? (
          <QuizScreen
            // key: 레슨에서 특정 회차 퀴즈로 진입할 때 상태를 새로 시작한다.
            key={quizEpisodeId ?? 'free'}
            initialEpisodeId={quizEpisodeId}
            onDone={() => changeTab('home')}
          />
        ) : tab === 'review' ? (
          <ReviewScreen />
        ) : (
          <ProgressScreen />
        )}
      </main>

      <NavBar tab={lessonId ? 'episodes' : tab} onChange={changeTab} />
    </div>
  );
}
