'use client';

/**
 * 홈(master) 화면 — voice-assistant/index.html 의 renderMaster() / dailyGoalRing() 포팅.
 * 배치고사/숙제 도우미/암기 카드/표현장은 아직 next-app에 없어 기능(features) 탭으로 이동시킨다.
 */
import { useEffect, useState } from 'react';
import { MASTER_CURRICULUM } from '../lib/curriculum';
import { getProfile, calcStreak, todayCount, dueWeak, getLessonStats, groqKey, isPlaced, getPhrases, DAILY_GOAL } from '../lib/state';
import DailyMissionCard from './DailyMissionCard';
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
  // 미션 완료 등으로 진행 데이터가 바뀌면 스트릭·목표 링을 그 자리에서 다시 계산한다.
  const [, setTick] = useState(0);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  const prof = getProfile();
  const streak = calcStreak();
  const done = todayCount();
  const dueCount = dueWeak().length;
  const stats = getLessonStats();
  const phraseCount = getPhrases().length;
  const goalPct = Math.min(done / DAILY_GOAL, 1);
  const goalReached = done >= DAILY_GOAL;
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
        <div className="home-hero-avatar">🦉</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="home-hero-title">PREPLY AI 스피킹 코치</div>
          <div className="home-hero-sub">
            CEFR <b style={{ color: 'white' }}>{prof.cefr}</b> (GSE {prof.gse}) 진행 중
          </div>
        </div>
        <div className="home-hero-streak">
          <div className="n">🔥{streak}</div>
          <div className="l">일 연속</div>
        </div>
      </div>

      {/* 오늘 할 딱 한 가지 — 앱을 열면 바로 이걸 하면 된다 */}
      <DailyMissionCard onNavigate={onNavigate} onProgress={() => setTick((t) => t + 1)} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 14 }}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ flex: '0 0 auto' }}>
          <circle cx="32" cy="32" r={R} fill="none" stroke="var(--surface2)" strokeWidth="7" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke={goalReached ? 'var(--green)' : 'var(--primary)'}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={C.toFixed(1)}
            strokeDashoffset={off.toFixed(1)}
            transform="rotate(-90 32 32)"
            style={{ transition: 'stroke-dashoffset 0.5s' }}
          />
          <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--text)">
            {goalReached ? '✓' : done}
          </text>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.86rem', fontWeight: 800 }}>{goalReached ? '🎉 오늘 목표 달성!' : '🎯 오늘의 목표'}</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
            오늘 <b style={{ color: 'var(--text)' }}>{done}</b> / {DAILY_GOAL}문장 연습 · 🔥 {streak}일 연속
          </div>
        </div>
      </div>

      {streak > 0 && done === 0 && (
        <div style={{ background: 'linear-gradient(135deg,rgba(194,117,12,0.16),rgba(194,117,12,0.04))', border: '1px solid var(--yellow)', borderRadius: 14, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>🔥</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800 }}>{streak}일 연속 학습이 오늘 끊길 수 있어요</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>단 1문장만 연습해도 스트릭이 이어집니다. 지금 바로 시작해요!</div>
          </div>
          <button className="btn primary" style={{ flexShrink: 0, fontSize: '0.78rem', padding: '7px 12px' }} onClick={() => onNavigate('drill')}>
            ▶ 시작
          </button>
        </div>
      )}

      {!groqKey() && (
        <div style={{ background: 'linear-gradient(135deg,rgba(224,56,58,0.12),rgba(224,56,58,0.04))', border: '1px solid rgba(224,56,58,0.45)', borderRadius: 14, padding: '13px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>🔑</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, marginBottom: 2 }}>AI 강사 연결이 필요해요</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              무료 Groq 키를 등록하면 AI 회화·번역·피드백이 모두 활성화됩니다. (ChatGPT/Gemini급 · 무료)
            </div>
          </div>
          <button className="btn primary" style={{ flexShrink: 0, fontSize: '0.78rem', padding: '7px 12px' }} onClick={() => onNavigate('talk')}>
            ⚙️ 키 등록
          </button>
        </div>
      )}

      {!isPlaced() && (
        <div style={{ background: 'linear-gradient(135deg,rgba(255,90,54,0.14),rgba(255,90,54,0.04))', border: '1px solid var(--primary)', borderRadius: 14, padding: '15px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: 4 }}>🧭 먼저 내 레벨을 진단해 보세요</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
            18문항 배치고사로 A1~C2 레벨을 파악하고, 말하기·듣기·읽기·쓰기 시작점을 자동으로 맞춥니다.
          </div>
          <button className="start-drill-btn" onClick={() => onNavigate('features')}>
            🧭 배치고사 보러 가기 →
          </button>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <button className="start-drill-btn" onClick={onStartToday}>
          ⚡ 오늘의 훈련 시작{dueCount ? ` — 복습 ${Math.min(dueCount, 5)}문항 포함` : ' (랜덤 10문항)'}
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn" style={{ flex: 1, background: 'linear-gradient(135deg,rgba(26,143,92,0.16),rgba(26,143,92,0.05))', borderColor: 'rgba(26,143,92,0.5)' }} onClick={() => onNavigate('features')}>
            📚 숙제 도우미
          </button>
          <button className="btn" style={{ flex: 1, background: 'linear-gradient(135deg,rgba(194,117,12,0.16),rgba(194,117,12,0.05))', borderColor: 'rgba(194,117,12,0.5)' }} onClick={() => onNavigate('features')}>
            🃏 암기 카드{dueCount ? ` (${dueCount})` : ''}
          </button>
        </div>
        <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => onNavigate('features')}>
          🎓 4대 영역 훈련 (듣기·읽기·쓰기·어휘) →
        </button>
        <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => onNavigate('features')}>
          📌 내 표현장 ({phraseCount})
        </button>
      </div>

      <div style={{ fontSize: '0.82rem', fontWeight: 800, margin: '2px 2px 8px', color: 'var(--text-muted)' }}>
        📚 레벨별 커리큘럼 (원하면 여기서도 학습)
      </div>

      {MASTER_CURRICULUM.map((lvl) => {
        const isDone = lvl.status === 'done';
        const isCurr = lvl.status === 'current';
        return (
          <div className={`level-card${isCurr ? ' current' : ''}`} key={lvl.level}>
            <div className="level-head">
              <span className={`level-badge${isDone ? ' done' : !isCurr ? ' future' : ''}`}>
                {isDone ? '✓ 기초' : isCurr ? '▶ 진행중' : '🔜 도전'}
              </span>
              <span className="level-name">{lvl.name}</span>
              <span className="level-cefr">{lvl.cefr}</span>
            </div>
            <div className="level-goal">{lvl.goal}</div>
            {lvl.units.map((u) => {
              const s = stats[u.lessonId];
              const pct = s?.attempts ? Math.round((s.correct / s.attempts) * 100) : 0;
              const icon = s?.attempts ? (pct >= 80 ? '✅' : '📖') : '⬜';
              return (
                <div className="unit-row" key={u.lessonId}>
                  <div className="unit-status">{icon}</div>
                  <div className="unit-info">
                    <div className="unit-title">{u.title}</div>
                    <div className="unit-sub">{u.sub}</div>
                    {!!s?.attempts && (
                      <div style={{ height: 3, background: 'var(--surface2)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? 'var(--green)' : 'var(--primary)', borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                  <button className="unit-go" onClick={() => goToUnit(u.lessonId)}>
                    {isDone ? '복습' : '시작'}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
