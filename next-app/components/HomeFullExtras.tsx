'use client';

/**
 * 전체 모드 홈의 부가 카드 — 오늘 세션 CTA와 주간 말하기 시험 배너.
 * 성장 단계(maturity)·패턴 세션·주간 시험 데이터를 끌어오므로 홈 첫 청크에 두지 않고
 * 전체 모드에서만 불러온다(집중 모드 홈 청크 절감, 감사 v1.31 성능 #5).
 */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import { computeMaturity } from '../lib/maturity';
import { pickTodayPattern, sessionDoneToday } from '../lib/session';
import { loadStories } from '../lib/storyData';
import { weeklyTestDue } from '../lib/weeklyTest';

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



export default function HomeFullExtras({ onNavigate, showSession }: { onNavigate: (m: Mode) => void; showSession: boolean }) {
  return (
    <>
      {showSession && <SessionCta onNavigate={onNavigate} />}
      <WeeklyTestBanner onNavigate={onNavigate} />
    </>
  );
}
