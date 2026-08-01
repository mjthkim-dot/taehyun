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
import type { Mode } from './NavBar';

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
