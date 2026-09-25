'use client';

/**
 * 홈(master) 화면 — voice-assistant/index.html 의 renderMaster() / dailyGoalRing() 포팅.
 * 배치고사/숙제 도우미/암기 카드/표현장은 아직 next-app에 없어 기능(features) 탭으로 이동시킨다.
 */
import { useEffect, useState } from 'react';
import { calcStreak, dueWeak, groqKey, SERVER_GROQ_SENTINEL, hasServerGroqKey, clearGroqKey } from '../lib/state';
import { validateGroqKey } from '../lib/groq';
const DailyMissionCard = dynamic(() => import('./DailyMissionCard'), {
  ssr: false,
  // 자리표시자 — 지연 로딩으로 카드가 늦게 떠도 아래 콘텐츠가 튀지 않게(CLS 0 유지)
  loading: () => <div className="mission-card" style={{ minHeight: 420 }} aria-hidden="true" />,
});
import dynamic from 'next/dynamic';
// 뷰포트 아래(스크롤 후) 컴포넌트는 하이드레이션 임계 경로에서 뺀다 —
// 홈 첫 페인트~상호작용 사이 시간(LCP)을 줄이는 Lighthouse 대응.
// 이어서 하기 — 기능 그리드에 묻힌 핵심 기능을 진행 상태와 함께 홈에 노출.
// 코스 데이터(JSON)를 끌고 오므로 반드시 지연 청크로(홈 첫 페인트 보호).
const HomeShortcuts = dynamic(() => import('./HomeShortcuts'), {
  ssr: false,
  loading: () => <div className="hs-wrap" style={{ minHeight: 132 }} aria-hidden="true" />,
});
import { consumeFreezesForGaps, getFreezeCount } from '../lib/habits';
const CurriculumPath = dynamic(() => import('./CurriculumPath'), { ssr: false });
import StreakFlame from './StreakFlame';
import { computeMaturity } from '../lib/maturity';
import { pickTodayPattern, sessionDoneToday } from '../lib/session';
import { loadStories } from '../lib/storyData';
import { weeklyTestDue } from '../lib/weeklyTest';
import { programState, PROGRAM_EVENT } from '../lib/program';
import { isFocusMode, setFocusMode, FOCUS_EVENT } from '../lib/focus';
import FocusGuide from './FocusGuide';
import { GrammarTodayCard, WhatsNew } from './GrammarToday';
import { isPlaced } from '../lib/state';
// 12주 프로그램 — 홈의 첫 카드. 서약 폼과 오늘 4블록을 모두 품어 무겁기에 지연 청크로.
// CEFR 히어로 — 홈의 주인공(레벨·다음 레벨 조건). 첫 화면이라 자리표시자로 CLS를 막는다.
const CefrHero = dynamic(() => import('./CefrHero'), {
  ssr: false,
  loading: () => <div className="study-card cf-hero" style={{ minHeight: 260 }} aria-hidden="true" />,
});
const ProgramCard = dynamic(() => import('./ProgramCard'), {
  ssr: false,
  loading: () => <div className="pg-card" style={{ minHeight: 200 }} aria-hidden="true" />,
});
import type { Mode } from './NavBar';

/** 주간 말하기 시험 배너 — 때가 됐을 때만 조용히 나타난다(매일 조르지 않는다). */
function WeeklyTestBanner({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [due, setDue] = useState(false);
  useEffect(() => setDue(weeklyTestDue()), []);
  if (!due) return null;
  return (
    <button type="button" className="wt-banner" onClick={() => onNavigate('weeklytest')}>
      📣 주간 말하기 시험 — 이번 주 패턴으로 1분, 지난주의 나와 비교해요 →
    </button>
  );
}

/** 홈의 주인공 — "오늘 세션 시작" 버튼 하나. 무엇을 할지 고르지 않게 한다. */
function SessionCta({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [state, setState] = useState<{ done: boolean; patternEn: string; patternKr: string; isReview: boolean } | null>(null);
  useEffect(() => {
    // 스토리는 비동기 청크 — 홈 번들에 40편을 정적으로 싣지 않기 위한 대가로,
    // CTA의 패턴 미리보기만 로드 후 채운다(캐시되면 즉시).
    let alive = true;
    void loadStories().then(() => {
      if (!alive) return;
      const mx = computeMaturity();
      const picked = pickTodayPattern(mx.stage.n);
      setState({ done: sessionDoneToday(), patternEn: picked?.pattern.en || '', patternKr: picked?.pattern.kr || '', isReview: picked?.isReview ?? false });
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!state) return null;
  return (
    <button type="button" className={`session-cta${state.done ? ' done' : ''}`} onClick={() => onNavigate('session')}>
      <span className="session-cta-main">
        <span className="session-cta-title">
          {state.done ? '오늘 세션 완주 ✓' : '▶ 오늘 세션 시작'}
        </span>
        <span className="session-cta-sub">
          {state.done
            ? '한 번 더 돌면 복습이 깊어져요'
            : // 뜻을 함께 — 영어 스템만 보이면 "무슨 뜻인지 모르는 버튼"이 된다
              `약 10분 · ${state.isReview ? '복습' : '오늘의 패턴'}: ${state.patternEn}${state.patternKr ? ` — ${state.patternKr}` : ''}`}
        </span>
      </span>
      <span className="session-cta-arrow">→</span>
    </button>
  );
}


export default function MasterScreen({
  onSelectLesson,
  onNavigate,
  onStartToday,
}: {
  onSelectLesson: (lessonId: number) => void;
  onNavigate: (mode: Mode) => void;
  onStartToday: () => void;
}) {
  const [ready, setReady] = useState(false);
  // 미션 완료 등으로 진행 데이터가 바뀌면 스트릭·목표 링·퀘스트를 그 자리에서 다시 계산한다.
  const [tick, setTick] = useState(0);
  // 앱을 연 시점에 공백일을 프리즈로 메워 스트릭을 보호하고, 메웠으면 배너로 알린다.
  const [frozenFilled, setFrozenFilled] = useState(0);
  // 등록된 키가 Groq에서 거부되는 상태(만료·폐기)를 홈에서 바로 알린다 —
  // 무효 키의 '조용한 401'이 음성 무음 사고의 최종 원인이었다. 세션당 1회만 검증.
  const [keyInvalid, setKeyInvalid] = useState(false);
  // 서버 키가 있는 배포에서 기기의 만료된 키를 자동 정리했을 때 알리는 안내(경고 아님).
  const [keyHealed, setKeyHealed] = useState(false);
  useEffect(() => {
    // 프로그램을 시작/초기화하면 홈 구성이 바뀐다(세션 CTA 노출 여부) — 즉시 반영
    const onProg = () => setTick((t) => t + 1);
    window.addEventListener(PROGRAM_EVENT, onProg);
    window.addEventListener(FOCUS_EVENT, onProg);
    setFrozenFilled(consumeFreezesForGaps().length);
    setReady(true);
    const k = groqKey();
    if (k && k !== SERVER_GROQ_SENTINEL && sessionStorage.getItem('va_key_checked') !== k) {
      validateGroqKey(k).then((valid) => {
        sessionStorage.setItem('va_key_checked', k);
        if (valid !== false) return;
        // 기기 키가 거부됐다. 서버 키가 있는 배포라면 기기 키는 없어도 되는 fallback이므로,
        // 사용자에게 숙제를 주지 않고 조용히 지워 서버 키 경로로 되돌린다.
        if (hasServerGroqKey()) {
          clearGroqKey();
          setKeyHealed(true);
        } else {
          setKeyInvalid(true);
        }
      });
    }
    return () => {
      window.removeEventListener(PROGRAM_EVENT, onProg);
      window.removeEventListener(FOCUS_EVENT, onProg);
    };
  }, []);
  if (!ready) {
    // SSR/하이드레이션 전 첫 페인트 — null을 돌려주면 JS가 다 내려와 실행될 때까지
    // 화면에 의미 있는 콘텐츠가 없어 LCP가 13초까지 밀렸다(Lighthouse 검출).
    // 정적 히어로를 서버 HTML에 실어 LCP를 첫 페인트(~1.5s)에 고정한다.
    // 클래스는 실제 홈 히어로와 동일 — 마운트 후 교체돼도 레이아웃이 튀지 않는다.
    return (
      <div className="study-screen">
        <header className="home-hero">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="home-hero-sub">&nbsp;</div>
            <div className="home-hero-title">오늘의 학습</div>
          </div>
        </header>
        {/* LCP 앵커 — 첫 페인트에 의미 있는 큰 텍스트를 고정한다(Lighthouse) */}
        <p className="hm-lcp">
          CEFR 레벨을 기준으로, 매일 한 레슨씩 — 복습하고, 문법을 실전 상황에서 익히고, 소리 내어 말하고,
          실제 업무 상황에 써봅니다. 오늘의 레슨을 불러오고 있어요.
        </p>
      </div>
    );
  }
  const freeze = getFreezeCount();

  // 프로그램 진행 중이면 홈의 주도권은 프로그램 카드에 있다(중복 CTA 억제)
  const onProgram = !!programState();
  const streak = calcStreak();
  const dueCount = dueWeak().length;
  // 스픽 벤치마크: '공부 횟수'가 아니라 '소리 내어 말한 문장 수'를 오늘의 1급 지표로.

  function goToUnit(lessonId: number) {
    onSelectLesson(lessonId);
    onNavigate('study');
  }

  const focus = isFocusMode();
  const prog = programState();
  const guide = { placed: isPlaced(), started: !!prog, firstLessonDone: !!prog && prog.days.length > 0 };
  const now = new Date();
  const dateLine = `${now.getMonth() + 1}월 ${now.getDate()}일 ${'일월화수목금토'[now.getDay()]}요일`;

  return (
    <div className={`study-screen home-v4${focus ? " focus" : ""}`}>
      <header className="home-hero">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="home-hero-sub">{dateLine}</div>
          <div className="home-hero-title">오늘의 학습</div>
        </div>
      </header>

      {/* 시스템 상태 — 있을 때만, 맨 위에 짧게 */}
      {keyInvalid && (
        <div className="notice danger block">
          <div className="notice-title">AI 키가 만료됐어요</div>
          <div className="notice-desc">새 키를 등록하면 AI 회화·음성이 다시 켜집니다.</div>
          <button className="btn ghost-accent compact" style={{ marginTop: 11 }} onClick={() => onNavigate('apikey')}>
            키 다시 등록
          </button>
        </div>
      )}
      {!groqKey() && (
        <div className="notice danger">
          <div className="notice-body">
            <div className="notice-title">AI 튜터 연결이 필요해요</div>
            <div className="notice-desc">무료 키 하나로 AI 회화·피드백이 켜집니다.</div>
          </div>
          <button className="btn ghost-accent compact notice-action" onClick={() => onNavigate('apikey')}>
            연결
          </button>
        </div>
      )}
      {keyHealed && <div className="freeze-note">만료된 기기 키를 정리하고 서버 키로 전환했어요.</div>}
      {frozenFilled > 0 && (
        <div className="freeze-note">
          ❄️ 스트릭 프리즈가 {frozenFilled}일을 지켜줬어요 — 연속 {streak}일 유지 (남은 프리즈 {freeze})
        </div>
      )}

      <WhatsNew onNavigate={onNavigate} />

      {focus ? (
        <>
          <FocusGuide state={guide} onNavigate={onNavigate} />
          {guide.placed && <CefrHero onNavigate={onNavigate} onSelectLesson={onSelectLesson} />}
          {guide.placed && <ProgramCard onNavigate={onNavigate} />}
          {guide.placed && !guide.started && <GrammarTodayCard onNavigate={onNavigate} />}
          {guide.started && (
            <>
              <h2 className="hm-sec">오늘 기록</h2>
              <StreakFlame refreshKey={tick} />
            </>
          )}
          <div className="fg-foot">
            <p className="muted">
              집중 모드 — 매일 <b>오늘의 레슨</b> 하나만 하면 됩니다. 단어 복습과 문법 시뮬레이션이 레슨 안에 들어 있어요.
            </p>
            <button type="button" className="btn ghost fg-all" onClick={() => setFocusMode(false)}>
              모든 기능 보기
            </button>
          </div>
        </>
      ) : (
        <>
      {/* ① 목표 — 내 CEFR 레벨 */}
      <CefrHero onNavigate={onNavigate} onSelectLesson={onSelectLesson} />

      {/* ② 오늘의 레슨 — 화면의 주 행동 */}
      <ProgramCard onNavigate={onNavigate} />
      {!onProgram && <SessionCta onNavigate={onNavigate} />}
      <WeeklyTestBanner onNavigate={onNavigate} />

      {/* 오늘의 문법 — 새 콘텐츠를 홈에서 바로 */}
      <h2 className="hm-sec">오늘의 문법</h2>
      <GrammarTodayCard onNavigate={onNavigate} />

      {/* ③ 오늘 기록 — 발화·스트릭 한 곳에 */}
      <h2 className="hm-sec">오늘 기록</h2>
      <StreakFlame refreshKey={tick} />

      {/* ④ 오늘의 실전 상황(카드가 자체 제목을 가진다) */}
      <h2 className="hm-sec">실전 상황</h2>
      <DailyMissionCard onNavigate={onNavigate} onProgress={() => setTick((t) => t + 1)} />

      {/* ⑤ 이어서 하기 */}
      <HomeShortcuts onNavigate={onNavigate} />

      {/* ⑥ 레벨별 레슨 코스 */}
      <h2 className="hm-sec">레벨별 레슨</h2>
      <CurriculumPath onSelectUnit={goToUnit} />

      {/* ⑦ 자유 연습 */}
      <h2 className="hm-sec">자유 연습</h2>
      <div className="hm-free">
        <button className="start-drill-btn" onClick={onStartToday}>
          빠른 드릴 {dueCount ? `· 복습 ${Math.min(dueCount, 5)}문항 포함` : '· 10문항'}
        </button>
        <button className="btn ghost" onClick={() => onNavigate('features')}>
          전체 학습 도구
        </button>
        <button className="btn ghost" onClick={() => setFocusMode(true)}>
          집중 모드로 돌아가기
        </button>
      </div>
        </>
      )}
    </div>
  );
}
