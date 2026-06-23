'use client';

/**
 * 앱 셸 — 기존 voice-assistant/index.html 의 8탭 하단 네비게이션을 React로 재구성.
 * 레이아웃 개편: 하단 탭을 4개 핵심 탭 + "더보기" 시트로 단순화하고,
 * 헤더는 화면별 타이틀 + 연속학습일 칩을 보여주는 동적 앱바로 바꿨다.
 */
import { useEffect, useState } from 'react';
import NavBar, { type Mode } from '../components/NavBar';
import MasterScreen from '../components/MasterScreen';
import StudyScreen, { defaultLesson } from '../components/StudyScreen';
import DrillScreen from '../components/DrillScreen';
import TalkScreen from '../components/TalkScreen';
import ReviewScreen from '../components/ReviewScreen';
import ProgressScreen from '../components/ProgressScreen';
import FeaturesScreen from '../components/FeaturesScreen';
import VideoScreen from '../components/VideoScreen';
import FlashcardsScreen from '../components/FlashcardsScreen';
import HomeworkScreen from '../components/HomeworkScreen';
import PlacementScreen from '../components/PlacementScreen';
import PhrasebookScreen from '../components/PhrasebookScreen';
import ListeningScreen from '../components/ListeningScreen';
import ReadingScreen from '../components/ReadingScreen';
import WritingScreen from '../components/WritingScreen';
import ComingSoon from '../components/ComingSoon';
import ThemeToggle from '../components/ThemeToggle';
import { calcStreak } from '../lib/state';
import { APP_VERSION } from '../lib/version';

const TAB_TITLE: Record<Mode, string> = {
  master: '홈',
  study: '레슨',
  drill: '드릴',
  talk: '회화',
  video: '영상',
  review: '복습',
  progress: '진도',
  features: '기능',
  flashcards: '암기 카드',
  placement: 'CEFR 배치고사',
  listening: '듣기',
  reading: '읽기',
  writing: '쓰기',
  homework: '숙제 도우미',
  phrasebook: '내 표현장',
};

export default function Page() {
  const [mode, setMode] = useState<Mode>('study');
  const [lessonId, setLessonId] = useState<number>(defaultLesson().id);
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => setStreak(calcStreak()), [mode]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <span className="app-header-brand">🗣️</span>
          <h1>{TAB_TITLE[mode]}</h1>
          <span className="app-version" title="앱 버전 (배포 갱신 확인용)">
            v{APP_VERSION}
          </span>
        </div>
        <div className="app-header-actions">
          {streak !== null && (
            <div className="streak-chip" title="연속 학습일">
              🔥 {streak}
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="app-content" key={mode}>
        {mode === 'master' && (
          <MasterScreen
            onSelectLesson={setLessonId}
            onNavigate={setMode}
          />
        )}
        {mode === 'study' && <StudyScreen lessonId={lessonId} onSelectLesson={setLessonId} />}
        {mode === 'drill' && <DrillScreen lessonId={lessonId} />}
        {mode === 'talk' && <TalkScreen lessonId={lessonId} />}
        {mode === 'review' && <ReviewScreen />}
        {mode === 'progress' && <ProgressScreen />}
        {mode === 'features' && <FeaturesScreen onNavigate={setMode} />}
        {mode === 'video' && <VideoScreen />}
        {mode === 'flashcards' && <FlashcardsScreen onExit={() => setMode('review')} />}
        {mode === 'homework' && <HomeworkScreen lessonId={lessonId} />}
        {mode === 'placement' && <PlacementScreen onDone={() => setMode('master')} />}
        {mode === 'phrasebook' && <PhrasebookScreen />}
        {mode === 'listening' && <ListeningScreen />}
        {mode === 'reading' && <ReadingScreen />}
        {mode === 'writing' && <WritingScreen />}
        {mode !== 'master' &&
          mode !== 'study' &&
          mode !== 'drill' &&
          mode !== 'talk' &&
          mode !== 'review' &&
          mode !== 'progress' &&
          mode !== 'features' &&
          mode !== 'video' &&
          mode !== 'flashcards' &&
          mode !== 'homework' &&
          mode !== 'placement' &&
          mode !== 'phrasebook' &&
          mode !== 'listening' &&
          mode !== 'reading' &&
          mode !== 'writing' && <ComingSoon label={TAB_TITLE[mode]} />}
      </div>

      <NavBar mode={mode} onChange={setMode} />
    </main>
  );
}
