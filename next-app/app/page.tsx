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
import dynamic from 'next/dynamic';

/**
 * 화면 지연 로딩 — 홈만 보려는 사람이 앱 전체를 내려받을 이유가 없다.
 *
 * 예전에는 38개 화면을 전부 정적 import해 하나의 page 청크(760KB)로 묶였고,
 * 모바일에서 첫 진입에 메인 스레드가 6초 가까이 막혔다. 각 화면은 탭을 누른
 * 뒤에야 필요하므로 그때 받아온다. 홈 경로에 필요한 것(셸·홈 화면·알림)만
 * 정적으로 남긴다.
 *
 * ssr: false — 모두 localStorage를 읽는 클라이언트 화면이라 서버에서 그릴 것이 없다.
 */
// 화면을 불러오는 동안 자리를 잡아 두는 조각(레이아웃이 튀지 않게).
// dynamic()의 옵션은 반드시 **인라인 리터럴**이어야 한다 — 변수로 빼면 Next가
// 빌드 단계에서 거부한다. 그래서 옵션은 매번 적고 이 컴포넌트만 공유한다.
function ScreenLoading() {
  return <div className="screen-loading" aria-label="불러오는 중" />;
}
const DrillScreen = dynamic(() => import('../components/DrillScreen'), { ssr: false, loading: ScreenLoading });
const TalkScreen = dynamic(() => import('../components/TalkScreen'), { ssr: false, loading: ScreenLoading });
const ReviewScreen = dynamic(() => import('../components/ReviewScreen'), { ssr: false, loading: ScreenLoading });
const ProgressScreen = dynamic(() => import('../components/ProgressScreen'), { ssr: false, loading: ScreenLoading });
const FeaturesScreen = dynamic(() => import('../components/FeaturesScreen'), { ssr: false, loading: ScreenLoading });
const VideoScreen = dynamic(() => import('../components/VideoScreen'), { ssr: false, loading: ScreenLoading });
const FlashcardsScreen = dynamic(() => import('../components/FlashcardsScreen'), { ssr: false, loading: ScreenLoading });
const HomeworkScreen = dynamic(() => import('../components/HomeworkScreen'), { ssr: false, loading: ScreenLoading });
const PlacementScreen = dynamic(() => import('../components/PlacementScreen'), { ssr: false, loading: ScreenLoading });
const PhrasebookScreen = dynamic(() => import('../components/PhrasebookScreen'), { ssr: false, loading: ScreenLoading });
const AskHistoryScreen = dynamic(() => import('../components/AskHistoryScreen'), { ssr: false, loading: ScreenLoading });
const ShadowingScreen = dynamic(() => import('../components/ShadowingScreen'), { ssr: false, loading: ScreenLoading });
const RemindersScreen = dynamic(() => import('../components/RemindersScreen'), { ssr: false, loading: ScreenLoading });
const BackupScreen = dynamic(() => import('../components/BackupScreen'), { ssr: false, loading: ScreenLoading });
const LegalScreen = dynamic(() => import('../components/LegalScreen'), { ssr: false, loading: ScreenLoading });
const AudioCheckScreen = dynamic(() => import('../components/AudioCheckScreen'), { ssr: false, loading: ScreenLoading });
const ApiKeyScreen = dynamic(() => import('../components/ApiKeyScreen'), { ssr: false, loading: ScreenLoading });
const VocabScreen = dynamic(() => import('../components/VocabScreen'), { ssr: false, loading: ScreenLoading });
const MeetingScreen = dynamic(() => import('../components/MeetingScreen'), { ssr: false, loading: ScreenLoading });
const PitchScreen = dynamic(() => import('../components/PitchScreen'), { ssr: false, loading: ScreenLoading });
const ScriptsScreen = dynamic(() => import('../components/ScriptsScreen'), { ssr: false, loading: ScreenLoading });
const ListeningScreen = dynamic(() => import('../components/ListeningScreen'), { ssr: false, loading: ScreenLoading });
const ReadingScreen = dynamic(() => import('../components/ReadingScreen'), { ssr: false, loading: ScreenLoading });
const WritingScreen = dynamic(() => import('../components/WritingScreen'), { ssr: false, loading: ScreenLoading });
const BusinessScreen = dynamic(() => import('../components/BusinessScreen'), { ssr: false, loading: ScreenLoading });

import MasterScreen from '../components/MasterScreen';
const StudyScreen = dynamic(() => import('../components/StudyScreen'), { ssr: false, loading: ScreenLoading });
import ReminderScheduler from '../components/ReminderScheduler';
import ThemeToggle from '../components/ThemeToggle';
import UpdatePrompt from '../components/UpdatePrompt';
import AskWidget from '../components/AskWidget';
import Onboarding, { needsOnboarding } from '../components/Onboarding';
import ServiceWorkerRegistrar from '../components/ServiceWorkerRegistrar';
import { ErrorBoundary, StorageFullBanner } from '../components/AppErrorBoundary';
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
  meeting: { title: '미팅 준비 · 회고', render: (c) => <MeetingScreen onNavigate={c.setMode} /> },
  pitch: { title: '2분 피치 훈련', render: (c) => <PitchScreen onNavigate={c.setMode} /> },
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
  /**
   * 기본 회차 — 알아내려면 레슨 데이터(371KB)가 필요하다. 홈 첫 페인트를 그것 때문에
   * 막을 이유가 없어서, 0으로 시작하고 마운트 뒤에 비동기로 채운다.
   * 그 사이 레슨 화면이 열려도 id를 못 찾으면 마지막 회차로 떨어지므로 안전하다.
   */
  const [lessonId, setLessonId] = useState<number>(0);
  useEffect(() => {
    let alive = true;
    import('../lib/lessons')
      .then((m) => {
        if (!alive) return;
        const l = m.LESSONS.filter((x) => !x.preview).slice(-1)[0] ?? m.LESSONS[0];
        if (l) setLessonId((cur) => (cur === 0 ? l.id : cur));
      })
      .catch(() => {
        /* 데이터를 못 받아도 레슨 화면이 스스로 최신 회차로 떨어진다 */
      });
    return () => {
      alive = false;
    };
  }, []);
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
        {/* 화면 단위로 감싼다 — 한 화면이 죽어도 셸(탭·헤더)은 살아 있어야 돌아갈 수 있다.
            key={mode}라 화면을 옮기면 경계도 함께 초기화된다. */}
        <ErrorBoundary onReset={() => setMode('master')}>{screen.render(ctx)}</ErrorBoundary>
      </div>

      <NavBar mode={mode} onChange={setMode} />
      <StorageFullBanner />
      <ServiceWorkerRegistrar />
      <UpdatePrompt />
      <AskWidget />
      <ReminderScheduler />
    </main>
  );
}
