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
import { loadLessons, useLessons } from '../lib/lessonData';
import { loadStories, useStories } from '../lib/storyData';

/**
 * 레슨 데이터 게이트 — lessons.json(199KB)은 화면 코드와 분리된 비동기 청크다.
 * 데이터를 쓰는 화면(레슨·드릴·회화·쉐도잉·숙제·진도)은 이 게이트 아래에서만
 * 렌더되므로, 화면 안에서는 lessonsNow()가 동기로 안전하다. 유휴 프리로드가
 * 먼저 도착해 있으면 게이트는 한 프레임도 보이지 않는다.
 */
function LessonsGate({ children }: { children: ReactNode }) {
  const data = useLessons();
  return data ? <>{children}</> : <ScreenLoading />;
}

/** 패턴 스토리 게이트 — 세션·리콜 러시·오디오·성장 화면이 이 아래에서 렌더된다. */
function StoriesGate({ children }: { children: ReactNode }) {
  const data = useStories();
  return data ? <>{children}</> : <ScreenLoading />;
}

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
const LadderScreen = dynamic(() => import('../components/LadderScreen'), { ssr: false, loading: ScreenLoading });
const MaturityScreen = dynamic(() => import('../components/MaturityScreen'), { ssr: false, loading: ScreenLoading });
const SessionScreen = dynamic(() => import('../components/SessionScreen'), { ssr: false, loading: ScreenLoading });
const WeeklyTestScreen = dynamic(() => import('../components/WeeklyTestScreen'), { ssr: false, loading: ScreenLoading });
const AudioLoopScreen = dynamic(() => import('../components/AudioLoopScreen'), { ssr: false, loading: ScreenLoading });
const RecallRushScreen = dynamic(() => import('../components/RecallRushScreen'), { ssr: false, loading: ScreenLoading });
const PreplyScreen = dynamic(() => import('../components/PreplyScreen'), { ssr: false, loading: ScreenLoading });
const MinutesScreen = dynamic(() => import('../components/MinutesScreen'), { ssr: false, loading: ScreenLoading });
const CourseScreen = dynamic(() => import('../components/CourseScreen'), { ssr: false, loading: ScreenLoading });
const CareerScreen = dynamic(() => import('../components/CareerScreen'), { ssr: false, loading: ScreenLoading });
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
  study: { title: '레슨', render: (c) => <LessonsGate><StudyScreen lessonId={c.lessonId} onSelectLesson={c.setLessonId} /></LessonsGate> },
  drill: { title: '드릴', render: (c) => <LessonsGate><DrillScreen lessonId={c.lessonId} auto={c.autoDrill} /></LessonsGate> },
  talk: { title: '회화', render: (c) => <LessonsGate><TalkScreen lessonId={c.lessonId} /></LessonsGate> },
  review: { title: '복습', render: () => <ReviewScreen /> },
  progress: { title: '진도', render: (c) => <LessonsGate><ProgressScreen onNavigate={c.setMode} onSelectLesson={c.setLessonId} /></LessonsGate> },
  features: { title: '기능', render: (c) => <FeaturesScreen onNavigate={c.setMode} /> },
  video: { title: '영상', render: () => <VideoScreen /> },
  flashcards: { title: '암기 카드', render: (c) => <FlashcardsScreen onExit={() => c.setMode('review')} /> },
  homework: { title: '숙제 도우미', render: (c) => <LessonsGate><HomeworkScreen lessonId={c.lessonId} /></LessonsGate> },
  placement: { title: 'CEFR 배치고사', render: (c) => <PlacementScreen onDone={() => c.setMode('master')} /> },
  phrasebook: { title: '내 표현장', render: () => <PhrasebookScreen /> },
  askhistory: { title: '내 질문 기록', render: () => <AskHistoryScreen /> },
  shadowing: { title: '쉐도잉', render: (c) => <LessonsGate><ShadowingScreen lessonId={c.lessonId} /></LessonsGate> },
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
  ladder: { title: '원어민 사다리', render: () => <LadderScreen /> },
  growth: { title: '성장', render: (c) => <StoriesGate><MaturityScreen onNavigate={c.setMode} /></StoriesGate> },
  session: { title: '오늘 세션', render: (c) => <StoriesGate><SessionScreen onNavigate={c.setMode} /></StoriesGate> },
  weeklytest: { title: '주간 말하기 시험', render: (c) => <WeeklyTestScreen onNavigate={c.setMode} /> },
  audio: { title: '오디오 모드', render: () => <StoriesGate><AudioLoopScreen /></StoriesGate> },
  recallrush: { title: '리콜 러시', render: (c) => <StoriesGate><RecallRushScreen onNavigate={c.setMode} /></StoriesGate> },
  preply: { title: '수업 노트', render: (c) => <PreplyScreen onNavigate={c.setMode} /> },
  minutes: { title: '실전 영어', render: (c) => <MinutesScreen onNavigate={c.setMode} /> },
  course: { title: '실전 코스', render: (c) => <CourseScreen onNavigate={c.setMode} /> },
  career: { title: '커리어 영어', render: (c) => <CareerScreen onNavigate={c.setMode} /> },
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
   * 기본 회차는 **정하지 않는다**(0으로 둔다).
   *
   * 처음엔 마운트 직후 lib/lessons를 비동기로 불러 id를 채웠는데, 그 import 하나가
   * 레슨 본문 199KB를 홈에서 그대로 내려받게 만들었다 — 지연 로딩으로 옮겨도 홈에서
   * 받으면 아무 이득이 없다.
   *
   * 레슨을 쓰는 화면들(레슨·회화·드릴·쉐도잉·숙제)은 모두 id를 못 찾으면 최신 회차로
   * 떨어지도록 이미 되어 있고, 그 화면들은 어차피 레슨 데이터를 자기 청크로 받는다.
   * 그러니 홈은 아무것도 모른 채 있어도 된다.
   */
  const [lessonId, setLessonId] = useState<number>(0);
  const [streak, setStreak] = useState<number | null>(null);
  // 홈의 "⚡ 오늘의 훈련"으로 들어왔을 때만 true — 드릴 큐에 오늘 복습할 SRS 문장을 섞는다.
  const [autoDrill, setAutoDrill] = useState(false);
  // 첫 실행이면 온보딩을 먼저 띄운다(마운트 후 판단 — SSR 하이드레이션 불일치 방지)
  const [onboarding, setOnboarding] = useState(false);
  useEffect(() => setOnboarding(needsOnboarding()), []);

  /**
   * 유휴 시간 프리페치 — 화면 지연 로딩의 대가(첫 탭 전환 0.7~1.3초)를 지운다.
   *
   * 화면을 지연 로딩으로 쪼갠 뒤(v0.84) 첫 진입은 빨라졌지만, 각 탭의 첫 방문이
   * 그 화면 청크를 받는 시간만큼 늦어졌다(측정: 레슨 699ms · 진도 1.3s · 복습 1.1s).
   * 홈이 그려지고 브라우저가 한가해진 뒤 자주 가는 화면을 미리 받아두면 둘 다
   * 얻는다 — 첫 페인트는 가볍게, 탭 전환은 즉시. webpack이 모듈을 공유하므로
   * 여기서의 import()가 dynamic()이 쓸 청크를 그대로 데운다.
   */
  useEffect(() => {
    // 2단계 프리로드 — 1단계(빨리): 데이터(레슨·스토리)와 첫 탭이 될 확률이 높은
    // 레슨 화면. "첫 탭 클릭"이 공통 청크 다운로드를 무는 것이 탭 전환 지연의
    // 남은 근원이라, 데이터+첫 화면만큼은 훨씬 이른 유휴 시점에 데운다.
    const warmFast = () => {
      void loadLessons();
      void loadStories(); // 홈 세션 CTA도 이걸 기다린다 — 가장 먼저
      void import('../components/StudyScreen');
    };
    // 2단계(나중): 나머지 자주 가는 화면들
    const warmRest = () => {
      void import('../components/DrillScreen');
      void import('../components/TalkScreen');
      void import('../components/ReviewScreen');
      void import('../components/ProgressScreen');
    };
    type Ric = (cb: () => void, opts?: { timeout: number }) => number;
    const w = window as unknown as { requestIdleCallback?: Ric; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      // timeout은 "바쁘더라도 강제 발화"다 — 1.2s로 두면 첫 로드(하이드레이션)
      // 도중에 발화해 199KB 레슨 청크가 LCP와 대역폭을 다퉜다(Lighthouse 검출).
      // LCP 창(느린 4G ~3.6s)을 지나서 데워도 실사용 탭 전환에는 충분히 이르다.
      const a = w.requestIdleCallback(warmFast, { timeout: 4000 });
      const b = w.requestIdleCallback(warmRest, { timeout: 7000 });
      return () => {
        w.cancelIdleCallback?.(a);
        w.cancelIdleCallback?.(b);
      };
    }
    const t1 = window.setTimeout(warmFast, 3000);
    const t2 = window.setTimeout(warmRest, 6000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

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
