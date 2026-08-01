'use client';

/**
 * 앱 셸 — 4개 핵심 탭 + "더보기" 시트 하단 네비게이션, 화면별 타이틀 헤더.
 *
 * 구조: 모든 화면을 SCREENS 레지스트리 한 곳에 등록한다(제목 + 렌더 함수).
 * 새 화면 추가는 ① NavBar의 Mode에 이름 추가 ② 여기 SCREENS에 한 항목 추가 —
 * 두 곳이면 끝난다. Record<Mode, …> 타입이라 Mode에만 추가하고 레지스트리에
 * 빠뜨리면 컴파일 에러로 바로 잡힌다(예전의 18줄짜리 mode !== … 제외 체인 대체).
 */
import { useEffect, useState, type ReactNode } from 'react';
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
import AskHistoryScreen from '../components/AskHistoryScreen';
import ShadowingScreen from '../components/ShadowingScreen';
import RemindersScreen from '../components/RemindersScreen';
import ReminderScheduler from '../components/ReminderScheduler';
import BackupScreen from '../components/BackupScreen';
import LegalScreen from '../components/LegalScreen';
import AudioCheckScreen from '../components/AudioCheckScreen';
import ApiKeyScreen from '../components/ApiKeyScreen';
import VocabScreen from '../components/VocabScreen';
import ScriptsScreen from '../components/ScriptsScreen';
import ListeningScreen from '../components/ListeningScreen';
import ReadingScreen from '../components/ReadingScreen';
import WritingScreen from '../components/WritingScreen';
import BusinessScreen from '../components/BusinessScreen';
import ThemeToggle from '../components/ThemeToggle';
import UpdatePrompt from '../components/UpdatePrompt';
import AskWidget from '../components/AskWidget';
import Onboarding, { needsOnboarding } from '../components/Onboarding';
import { calcStreak } from '../lib/state';
import { APP_VERSION } from '../lib/version';

/** 화면 렌더 함수가 받는 앱 셸 컨텍스트. */
interface ScreenCtx {
  lessonId: number;
  autoDrill: boolean;
  setLessonId: (id: number) => void;
  setMode: (m: Mode) => void;
  startTodayDrill: () => void;
}

const SCREENS: Record<Mode, { title: string; render: (c: ScreenCtx) => ReactNode }> = {
  master: {
    title: '홈',
    render: (c) => <MasterScreen onSelectLesson={c.setLessonId} onNavigate={c.setMode} onStartToday={c.startTodayDrill} />,
  },
  study: { title: '레슨', render: (c) => <StudyScreen lessonId={c.lessonId} onSelectLesson={c.setLessonId} /> },
  drill: { title: '드릴', render: (c) => <DrillScreen lessonId={c.lessonId} auto={c.autoDrill} /> },
  talk: { title: '회화', render: (c) => <TalkScreen lessonId={c.lessonId} /> },
  review: { title: '복습', render: () => <ReviewScreen /> },
  progress: { title: '진도', render: (c) => <ProgressScreen onNavigate={c.setMode} onSelectLesson={c.setLessonId} /> },
  features: { title: '기능', render: (c) => <FeaturesScreen onNavigate={c.setMode} /> },
  video: { title: '영상', render: () => <VideoScreen /> },
  flashcards: { title: '암기 카드', render: (c) => <FlashcardsScreen onExit={() => c.setMode('review')} /> },
  homework: { title: '숙제 도우미', render: (c) => <HomeworkScreen lessonId={c.lessonId} /> },
  placement: { title: 'CEFR 배치고사', render: (c) => <PlacementScreen onDone={() => c.setMode('master')} /> },
  phrasebook: { title: '내 표현장', render: () => <PhrasebookScreen /> },
  askhistory: { title: '내 질문 기록', render: () => <AskHistoryScreen /> },
  shadowing: { title: '쉐도잉', render: (c) => <ShadowingScreen lessonId={c.lessonId} /> },
  reminders: { title: '복습 알림', render: () => <RemindersScreen /> },
  backup: { title: '백업 · 복원', render: () => <BackupScreen /> },
  legal: { title: '약관 · 개인정보', render: () => <LegalScreen /> },
  audiocheck: { title: '음성 진단', render: () => <AudioCheckScreen /> },
  apikey: { title: 'AI 키 등록', render: () => <ApiKeyScreen /> },
  vocab: { title: '직무 어휘', render: (c) => <VocabScreen onNavigate={c.setMode} /> },
  scripts: { title: '미팅 스크립트', render: (c) => <ScriptsScreen onNavigate={c.setMode} /> },
  listening: { title: '듣기', render: () => <ListeningScreen /> },
  reading: { title: '읽기', render: () => <ReadingScreen /> },
  writing: { title: '쓰기', render: () => <WritingScreen /> },
  business: {
    title: '비즈니스',
    render: (c) => (
      <BusinessScreen
        onStartTalk={(id) => {
          c.setLessonId(id);
          c.setMode('talk');
        }}
      />
    ),
  },
};

export default function Page() {
  const [mode, setModeRaw] = useState<Mode>('master');
  const [lessonId, setLessonId] = useState<number>(defaultLesson().id);
  const [streak, setStreak] = useState<number | null>(null);
  // 홈의 "⚡ 오늘의 훈련"으로 들어왔을 때만 true — 드릴 큐에 오늘 복습할 SRS 문장을 섞는다.
  const [autoDrill, setAutoDrill] = useState(false);
  // 첫 실행이면 온보딩을 먼저 띄운다(마운트 후 판단 — SSR 하이드레이션 불일치 방지)
  const [onboarding, setOnboarding] = useState(false);
  useEffect(() => setOnboarding(needsOnboarding()), []);

  function setMode(m: Mode) {
    setAutoDrill(false);
    setModeRaw(m);
  }

  function startTodayDrill() {
    setAutoDrill(true);
    setModeRaw('drill');
  }

  useEffect(() => setStreak(calcStreak()), [mode]);

  const screen = SCREENS[mode];
  const ctx: ScreenCtx = { lessonId, autoDrill, setLessonId, setMode, startTodayDrill };

  if (onboarding) {
    return (
      <Onboarding
        onDone={() => setOnboarding(false)}
        onPlacement={() => {
          setOnboarding(false);
          setModeRaw('placement');
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <span className="app-header-brand">EC</span>
          <h1>{screen.title}</h1>
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
        {screen.render(ctx)}
      </div>

      <NavBar mode={mode} onChange={setMode} />
      <UpdatePrompt />
      <AskWidget />
      <ReminderScheduler />
    </main>
  );
}
