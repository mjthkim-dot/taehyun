'use client';

/**
 * 앱 셸 — 4개 핵심 탭 + "더보기" 시트 하단 네비게이션, 화면별 타이틀 헤더.
 *
 * 구조: 모든 화면을 SCREENS 레지스트리 한 곳에 등록한다(제목 + 렌더 함수).
 * 새 화면 추가는 ① NavBar의 Mode에 이름 추가 ② 여기 SCREENS에 한 항목 추가 —
 * 두 곳이면 끝난다. Record<Mode, …> 타입이라 Mode에만 추가하고 레지스트리에
 * 빠뜨리면 컴파일 에러로 바로 잡힌다(예전의 18줄짜리 mode !== … 제외 체인 대체).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
const ImmersionScreen = dynamic(() => import('../components/ImmersionScreen'), { ssr: false, loading: ScreenLoading });
const InterviewScreen = dynamic(() => import('../components/InterviewScreen'), { ssr: false, loading: ScreenLoading });
const FeedbackScreen = dynamic(() => import('../components/FeedbackScreen'), { ssr: false, loading: ScreenLoading });
const BusinessScreen = dynamic(() => import('../components/BusinessScreen'), { ssr: false, loading: ScreenLoading });

import MasterScreen from '../components/MasterScreen';
const StudyScreen = dynamic(() => import('../components/StudyScreen'), { ssr: false, loading: ScreenLoading });
const ProgramScreen = dynamic(() => import('../components/ProgramScreen'), { ssr: false, loading: ScreenLoading });
const DramaScreen = dynamic(() => import('../components/DramaScreen'), { ssr: false, loading: ScreenLoading });
const DramaTalkScreen = dynamic(() => import('../components/DramaTalkScreen'), { ssr: false, loading: ScreenLoading });
const GrammarScreen = dynamic(() => import('../components/GrammarScreen'), { ssr: false, loading: ScreenLoading });
const CefrScreen = dynamic(() => import('../components/CefrScreen'), { ssr: false, loading: ScreenLoading });
const WordsScreen = dynamic(() => import('../components/WordsScreen'), { ssr: false, loading: ScreenLoading });
const KnowledgeMapScreen = dynamic(() => import('../components/KnowledgeMapScreen'), { ssr: false, loading: ScreenLoading });
// 첫 화면에 꼭 필요하지 않은 셸 조각(알림 스케줄러·질문 위젯·첫 실행 온보딩)은 지연 로딩 — 홈 첫 청크 절감(감사 v1.31 G29)
const ReminderScheduler = dynamic(() => import('../components/ReminderScheduler'), { ssr: false });
import ThemeToggle from '../components/ThemeToggle';
import UpdatePrompt from '../components/UpdatePrompt';
import DepthFX from '../components/DepthFX';
const AskWidget = dynamic(() => import('../components/AskWidget'), { ssr: false });
const Onboarding = dynamic(() => import('../components/Onboarding'), { ssr: false, loading: ScreenLoading });
/** 첫 실행인가 — 온보딩 모듈을 끌어오지 않고 값만 읽는다 */
const needsOnboarding = () => typeof window !== 'undefined' && !load<boolean>('va_onboarded', false);
import ServiceWorkerRegistrar from '../components/ServiceWorkerRegistrar';
import { ErrorBoundary, StorageFullBanner } from '../components/AppErrorBoundary';
import { BACK_EVENT, calcStreak, load, NAVIGATE_EVENT, PRACTICED_EVENT } from '../lib/state';
import { isFocusMode } from '../lib/focus';
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
  program: { title: '12주 프로그램', render: (c) => <ProgramScreen onNavigate={c.setMode} /> },
  words: { title: '단어', render: () => <WordsScreen /> },
  grammar: { title: '문법 시뮬레이션', render: () => <GrammarScreen /> },
  drama: { title: '드라마 레슨', render: (c) => <DramaScreen onNavigate={c.setMode} /> },
  dtalk: { title: '회화', render: (c) => <DramaTalkScreen onNavigate={c.setMode} /> },
  cefr: { title: 'CEFR 리포트', render: (c) => <CefrScreen onNavigate={c.setMode} onSelectLesson={c.setLessonId} /> },
  map: { title: '학습 지도', render: (c) => <LessonsGate><KnowledgeMapScreen onNavigate={c.setMode} onSelectLesson={c.setLessonId} /></LessonsGate> },
  study: { title: '레슨', render: (c) => <LessonsGate><StudyScreen lessonId={c.lessonId} onSelectLesson={c.setLessonId} /></LessonsGate> },
  drill: { title: '드릴', render: (c) => <LessonsGate><DrillScreen lessonId={c.lessonId} auto={c.autoDrill} /></LessonsGate> },
  talk: { title: '회화', render: (c) => <LessonsGate><TalkScreen lessonId={c.lessonId} /></LessonsGate> },
  review: { title: '복습', render: () => <ReviewScreen /> },
  // 진도는 레슨 데이터를 펼칠 때만 받는다(집중 모드는 드라마 중심 — 오프라인에서도 열리게)
  progress: { title: '진도', render: (c) => <ProgressScreen onNavigate={c.setMode} onSelectLesson={c.setLessonId} /> },
  features: { title: '기능', render: (c) => <FeaturesScreen onNavigate={c.setMode} /> },
  video: { title: '영상', render: () => <VideoScreen /> },
  flashcards: { title: '암기 카드', render: (c) => <FlashcardsScreen onExit={() => c.setMode('review')} /> },
  homework: { title: '숙제 도우미', render: (c) => <LessonsGate><HomeworkScreen lessonId={c.lessonId} /></LessonsGate> },
  placement: { title: 'CEFR 배치고사', render: (c) => <PlacementScreen onDone={() => c.setMode('master')} onNavigate={c.setMode} /> },
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
  immersion: { title: '몰입 스토리', render: () => <ImmersionScreen /> },
  interview: { title: '면접 시뮬레이션', render: (c) => <InterviewScreen onNavigate={c.setMode} /> },
  feedback: { title: '피드백', render: () => <FeedbackScreen /> },
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
  const [boundaryKey, setBoundaryKey] = useState(0);
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
    // 집중 모드(기본)는 드라마·단어·회화·문법·CEFR·진도만 쓴다 — 쓰지도 않는 레슨(199KB)·드릴을
    // 받느라 데이터를 쓰던 것을 멈추고, 대신 이 화면들을 데워 서비스 워커 캐시에 넣는다.
    // 그래야 지하철(오프라인)에서도 드라마가 열린다(감사 v1.31 견고성 #2: 'Loading chunk failed').
    const focus = isFocusMode();
    const warmFast = () => {
      if (focus) {
        void import('../components/DramaScreen');
        void import('../components/WordsScreen');
        void import('../components/DramaTalkScreen');
        return;
      }
      void loadLessons();
      void loadStories(); // 홈 세션 CTA도 이걸 기다린다 — 가장 먼저
      void import('../components/StudyScreen');
    };
    // 2단계(나중): 나머지 자주 가는 화면들. FeaturesScreen은 모든 도구의 관문이라
    // 함께 데운다(실측: 미프리로드 시 첫 진입 +0.5초가 이후 모든 도구 진입에 얹힘).
    const warmRest = () => {
      if (focus) {
        void import('../components/GrammarScreen');
        void import('../components/CefrScreen');
        void import('../components/ProgressScreen');
        void import('../components/BackupScreen');
        return;
      }
      void import('../components/DrillScreen');
      void import('../components/TalkScreen');
      void import('../components/ReviewScreen');
      void import('../components/ProgressScreen');
      void import('../components/FeaturesScreen');
    };
    // 오프라인으로 열렸다면 연결되는 순간 한 번 데운다(그래야 다음 오프라인 때 화면이 열린다)
    const onOnline = () => {
      warmFast();
      warmRest();
    };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) window.addEventListener('online', onOnline, { once: true });
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
        window.removeEventListener('online', onOnline);
      };
    }
    const t1 = window.setTimeout(warmFast, 3000);
    const t2 = window.setTimeout(warmRest, 6000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  /**
   * 화면 전환을 브라우저 기록에 남긴다 — 설치형 앱(PWA)에서 휴대폰 '뒤로'를 누르면
   * 앱이 닫히던 문제(감사 v1.31 모바일 #1). 이제 이전 화면으로 한 단계씩 돌아간다.
   */
  const modeRef = useRef<Mode>('master');
  // 진입 모션은 첫 화면 전환 뒤부터(첫 로드의 LCP를 투명하게 가리지 않게)
  const [animOn, setAnimOn] = useState(false);
  function go(m: Mode) {
    setAnimOn(true);
    if (m !== modeRef.current) {
      try {
        // Next 라우터가 기록 칸에 넣어 둔 내부 상태(__NA 등)는 그대로 두고 우리 값만 얹는다 —
        // 통째로 덮으면 Next가 popstate에서 페이지를 새로고침한다(감사 v1.31 비평 #0)
        window.history.pushState({ ...(window.history.state || {}), mode: m, sub: undefined }, '');
      } catch {
        /* 기록 API가 없는 환경 */
      }
    }
    modeRef.current = m;
    setModeRaw(m);
  }
  useEffect(() => {
    try {
      if (!window.history.state?.mode) window.history.replaceState({ ...(window.history.state || {}), mode: 'master' }, '');
    } catch {
      /* 무시 */
    }
    const on = (e: PopStateEvent) => {
      const st = e.state as { mode?: string; sub?: string } | null;
      if (!st || !st.mode) return; // 우리가 만든 기록이 아니면 Next에 맡긴다
      // Next 라우터는 같은 주소의 popstate에도 트리를 복원하며 이 페이지를 다시 마운트한다(모드가 '홈'으로
      // 초기화됨). 우리 기록 항목은 여기서 끝낸다 — capture 단계라 Next의 리스너보다 먼저 온다.
      e.stopImmediatePropagation();
      const m = st.mode as Mode;
      const next = m in SCREENS ? m : 'master';
      modeRef.current = next;
      setAutoDrill(false);
      setModeRaw(next);
      // 화면 안의 단계(드라마 재생 → 목록 등)는 각 화면이 이 이벤트로 처리한다
      window.dispatchEvent(new CustomEvent(BACK_EVENT, { detail: st }));
    };
    window.addEventListener('popstate', on, true);
    return () => window.removeEventListener('popstate', on, true);
  }, []);

  function setMode(m: Mode) {
    setAutoDrill(false);
    go(m);
  }

  function startTodayDrill() {
    setAutoDrill(true);
    go('drill');
  }

  useEffect(() => setStreak(calcStreak()), [mode]);
  // 드라마 엔딩처럼 화면이 그대로인 채 학습일이 기록돼도 🔥가 바로 오르게
  // 배너·오류 화면이 보내는 화면 이동 요청(예: 저장 공간 가득 → 백업 화면)
  useEffect(() => {
    const on = (e: Event) => {
      const m = (e as CustomEvent).detail as Mode;
      if (m && m in SCREENS) setMode(m);
    };
    window.addEventListener(NAVIGATE_EVENT, on);
    return () => window.removeEventListener(NAVIGATE_EVENT, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 불꽃이 오르는 순간을 잠깐 강조한다(보상감 — 움직임 줄이기 설정이면 CSS가 끈다)
  const [streakBump, setStreakBump] = useState(false);
  const streakRef = useRef<number | null>(null);
  streakRef.current = streak;
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      const next = calcStreak();
      const prev = streakRef.current;
      if (prev !== null && next > prev) {
        setStreakBump(true);
        if (t) clearTimeout(t);
        t = setTimeout(() => setStreakBump(false), 1200);
      }
      setStreak(next);
    };
    window.addEventListener(PRACTICED_EVENT, on);
    return () => {
      window.removeEventListener(PRACTICED_EVENT, on);
      if (t) clearTimeout(t);
    };
  }, []);

  const screen = SCREENS[mode];
  const ctx: ScreenCtx = { lessonId, autoDrill, setLessonId, setMode, startTodayDrill };

  if (onboarding) {
    return (
      <Onboarding
        onDone={() => setOnboarding(false)}
        onPlacement={() => {
          setOnboarding(false);
          go('placement');
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <DepthFX />
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
            <div className={`streak-chip${streakBump ? ' bump' : ''}`} title="연속 학습일" aria-live="polite">
              🔥 {streak}
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="app-content" key={mode} data-anim={animOn ? '' : undefined}>
        {/* 화면 단위로 감싼다 — 한 화면이 죽어도 셸(탭·헤더)은 살아 있어야 돌아갈 수 있다.
            key={mode}라 화면을 옮기면 경계도 함께 초기화된다. */}
        <ErrorBoundary
          key={`${mode}-${boundaryKey}`}
          onReset={() => {
            // 홈에서 난 오류도 복구되게 — 같은 화면이어도 새로 마운트한다
            setBoundaryKey((k) => k + 1);
            setMode('master');
          }}
        >
          {screen.render(ctx)}
        </ErrorBoundary>
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
