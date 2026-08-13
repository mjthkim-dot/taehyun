'use client';

/**
 * 홈(master) 화면 — voice-assistant/index.html 의 renderMaster() / dailyGoalRing() 포팅.
 * 배치고사/숙제 도우미/암기 카드/표현장은 아직 next-app에 없어 기능(features) 탭으로 이동시킨다.
 */
import { useEffect, useState } from 'react';
import { APP_NAME_KO, APP_TAGLINE_KO } from '../lib/brand';
import { getProfile, calcStreak, todayCount, spokenToday, dueWeak, groqKey, isPlaced, getPhrases, DAILY_GOAL, dailyGoal, SERVER_GROQ_SENTINEL, hasServerGroqKey, clearGroqKey } from '../lib/state';
import { validateGroqKey } from '../lib/groq';
import DailyMissionCard from './DailyMissionCard';
import DailyQuests from './DailyQuests';
import { consumeFreezesForGaps, getFreezeCount } from '../lib/habits';
import CurriculumPath from './CurriculumPath';
import StreakFlame from './StreakFlame';
import { computeMaturity, type MaturityState } from '../lib/maturity';
import { pickTodayPattern, sessionDoneToday } from '../lib/session';
import { loadStories } from '../lib/storyData';
import { weeklyTestDue } from '../lib/weeklyTest';
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
  const [state, setState] = useState<{ done: boolean; patternEn: string; isReview: boolean } | null>(null);
  useEffect(() => {
    // 스토리는 비동기 청크 — 홈 번들에 40편을 정적으로 싣지 않기 위한 대가로,
    // CTA의 패턴 미리보기만 로드 후 채운다(캐시되면 즉시).
    let alive = true;
    void loadStories().then(() => {
      if (!alive) return;
      const mx = computeMaturity();
      const picked = pickTodayPattern(mx.stage.n);
      setState({ done: sessionDoneToday(), patternEn: picked?.pattern.en || '', isReview: picked?.isReview ?? false });
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
            : `약 10분 · ${state.isReview ? '복습' : '오늘의 패턴'}: ${state.patternEn}`}
        </span>
      </span>
      <span className="session-cta-arrow">→</span>
    </button>
  );
}

/** 홈의 컴팩트 성장 카드 — 성숙도 단계와 다음 승급 진행도를 한 줄로. 탭하면 성장 화면. */
function GrowthCard({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [mx, setMx] = useState<MaturityState | null>(null);
  useEffect(() => setMx(computeMaturity()), []);
  if (!mx) return null;
  const pct = Math.round(mx.progress * 100);
  return (
    <button type="button" className="growth-card" onClick={() => onNavigate('growth')}>
      <span className="growth-stage">{mx.stage.n}</span>
      <span className="growth-body">
        <span className="growth-name">
          성숙도 {mx.stage.n} · {mx.stage.name}
          <i className="growth-motto">“{mx.stage.motto}”</i>
        </span>
        <span className="growth-bar"><i style={{ width: `${pct}%` }} /></span>
      </span>
      <span className="growth-pct">{mx.stage.next ? `${pct}%` : 'MAX'}</span>
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
  }, []);
  if (!ready) return null;
  const freeze = getFreezeCount();

  const prof = getProfile();
  const streak = calcStreak();
  const done = todayCount();
  const spoken = spokenToday();
  const dueCount = dueWeak().length;
  const phraseCount = getPhrases().length;
  // 스픽 벤치마크: '공부 횟수'가 아니라 '소리 내어 말한 문장 수'를 오늘의 1급 지표로.
  const goal = dailyGoal();
  const goalPct = Math.min(spoken / goal, 1);
  const goalReached = spoken >= goal;
  const R = 26;
  const C = 2 * Math.PI * R;
  const off = C * (1 - goalPct);

  function goToUnit(lessonId: number) {
    onSelectLesson(lessonId);
    onNavigate('study');
  }

  return (
    <div className="study-screen">
      <div className="home-hero">
        <div className="home-hero-avatar">EC</div>
        {/* 히어로에서 스트릭 배지를 뺐다 — 헤더(🔥n)와 아래 목표 카드에 이미 두 번
            나오는데, 좁은 화면에서 이 박스가 제목 폭을 잡아먹어 "AI 스|피킹"처럼
            어절이 잘리는 원인이었다. 제목은 브랜드명만, 부제에 한 줄로 모은다. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="home-hero-title">{APP_NAME_KO}</div>
          <div className="home-hero-sub">
            {APP_TAGLINE_KO} · CEFR <b>{prof.cefr}</b> (GSE {prof.gse})
          </div>
        </div>
      </div>

      {frozenFilled > 0 && (
        <div className="freeze-note">
          ❄️ 스트릭 프리즈가 {frozenFilled}일을 지켜줬어요 — 연속 {streak}일이 그대로 이어집니다. (남은 프리즈 {freeze})
        </div>
      )}

      {/* 불꽃 히어로 — 발화가 불을 붙인다(스픽 벤치마크). tick으로 미션·연습의
          발화가 즉시 반영돼, 목표에 닿는 순간 이 자리에서 점화된다. */}
      {/* 코스 중심 홈 — 고민 없이 누르는 오늘의 한 버튼이 맨 위 */}
      <SessionCta onNavigate={onNavigate} />

      {/* 주간 측정 리추얼 — 7일에 한 번만 등장 */}
      <WeeklyTestBanner onNavigate={onNavigate} />

      <StreakFlame refreshKey={tick} />

      {/* 성숙도 커리큘럼 — 원어민스러움 단계와 자동 승급 진행도 */}
      <GrowthCard onNavigate={onNavigate} />

      {/* 오늘 할 딱 한 가지 — 앱을 열면 바로 이걸 하면 된다 */}
      <DailyMissionCard onNavigate={onNavigate} onProgress={() => setTick((t) => t + 1)} />

      {/* 데일리 퀘스트 — 오늘 할 일 3개와 XP */}
      <DailyQuests refreshKey={tick} />

      {/* 오늘의 지표 — 화면의 시각적 앵커. 링은 얇게, 숫자는 크게(스튜디오 타이포) */}
      <div className={`stat-hero${goalReached ? ' reached' : ''}`}>
        <div className="stat-hero-ring">
          <svg width="72" height="72" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={R} fill="none" stroke="var(--surface2)" strokeWidth="4" />
            <circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              stroke={goalReached ? 'var(--green)' : 'var(--primary)'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C.toFixed(1)}
              strokeDashoffset={off.toFixed(1)}
              transform="rotate(-90 32 32)"
              style={{ transition: 'stroke-dashoffset 0.5s' }}
            />
            {/* 링 안 숫자는 뺐다 — 옆의 큰 숫자와 중복이라 링은 순수 그래픽으로 둔다 */}
            {goalReached && (
              <text x="32" y="38" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--green)">
                ✓
              </text>
            )}
          </svg>
        </div>
        <div className="stat-hero-body">
          <div className="stat-hero-label">{goalReached ? '오늘 목표 달성' : '오늘 말한 문장'}</div>
          <div className="stat-hero-num">
            <b>{spoken}</b>
            <span>/ {goal}</span>
          </div>
          <div className="stat-hero-sub">
            연습 {done}회 · 🔥 {streak}일 연속{freeze > 0 ? ` · ❄️ ${freeze}` : ''}
          </div>
        </div>
      </div>

      {streak > 0 && done === 0 && (
        <div className="notice warn">
          <div className="notice-ic">🔥</div>
          <div className="notice-body">
            <div className="notice-title">{streak}일 연속 학습이 오늘 끊길 수 있어요</div>
            <div className="notice-desc">단 1문장만 연습해도 스트릭이 이어집니다.</div>
          </div>
          <button className="btn ghost-accent compact notice-action" onClick={() => onNavigate('drill')}>
            시작
          </button>
        </div>
      )}

      {keyHealed && (
        <div className="freeze-note">
          이 기기에 저장돼 있던 만료된 Groq 키를 정리했어요 — 이제 서버에 등록된 키로 AI 회화·음성이 동작합니다.
        </div>
      )}

      {keyInvalid && (
        <div className="notice danger block">
          <div className="notice-title">등록된 Groq 키가 더 이상 유효하지 않아요</div>
          <div className="notice-desc">
            키가 만료되거나 폐기되면 AI 회화·음성이 조용히 실패합니다. console.groq.com에서 새 키를 발급한 뒤 기능 탭 → AI 키 등록에서 다시 등록해 주세요.
          </div>
          <button className="btn ghost-accent compact" style={{ marginTop: 11 }} onClick={() => onNavigate('apikey')}>
            새 키 등록하러 가기 →
          </button>
        </div>
      )}

      {!groqKey() && (
        <div className="notice danger">
          <div className="notice-ic">🔑</div>
          <div className="notice-body">
            <div className="notice-title">AI 강사 연결이 필요해요</div>
            <div className="notice-desc">무료 Groq 키를 등록하면 AI 회화·번역·피드백이 모두 켜집니다.</div>
          </div>
          <button className="btn ghost-accent compact notice-action" onClick={() => onNavigate('apikey')}>
            키 등록
          </button>
        </div>
      )}

      {!isPlaced() && (
        <div className="notice accent block">
          <div className="notice-title">먼저 내 레벨을 진단해 보세요</div>
          <div className="notice-desc">18문항 배치고사로 A1~C2 레벨을 파악하고, 말하기·듣기·읽기·쓰기 시작점을 자동으로 맞춥니다.</div>
          <button className="btn ghost-accent compact" style={{ marginTop: 11 }} onClick={() => onNavigate('features')}>
            배치고사 보러 가기 →
          </button>
        </div>
      )}

      {/* 화면의 유일한 채워진 CTA — 나머지 보조 행동은 모두 ghost로 내린다 */}
      <div style={{ marginBottom: 14 }}>
        <button className="start-drill-btn" onClick={onStartToday}>
          오늘의 훈련 시작{dueCount ? ` — 복습 ${Math.min(dueCount, 5)}문항 포함` : ' (랜덤 10문항)'}
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => onNavigate('features')}>
            숙제 도우미
          </button>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => onNavigate('features')}>
            암기 카드{dueCount ? ` (${dueCount})` : ''}
          </button>
        </div>
        <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => onNavigate('features')}>
          4대 영역 훈련 (듣기·읽기·쓰기·어휘) →
        </button>
        <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => onNavigate('features')}>
          내 표현장 ({phraseCount})
        </button>
      </div>

      <div style={{ fontSize: '0.82rem', fontWeight: 800, margin: '2px 2px 8px', color: 'var(--text-muted)' }}>
        학습 경로 — 다음 한 걸음이 항상 보이게
      </div>

      <CurriculumPath onSelectUnit={goToUnit} />
    </div>
  );
}
