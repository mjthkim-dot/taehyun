'use client';

// 시트·예산 바 스타일(.dg-*) — 홈 첫 로딩의 CSS 예산 밖. 이 파일은 홈에서 dynamic()으로만 받는다(길게 누를 때)
import '../app/screens.css';

/**
 * 하루 모드 시트(M4) — 홈 DramaCard를 길게 누르거나(또는 '⋯' 버튼) 열린다. 버튼 2개: [오늘은 5분만] [조용히 모드].
 * 이미 모드를 골랐으면 '원래대로' 1개가 더 붙는다. 짧은 날은 주 2회까지 — 넘으면 바꾸지 않고 안내만.
 * 복귀 첫날은 고르지 않아도 저절로(홈 배너 homeLite.bannerFor).
 *
 * 같은 파일의 DayBudgetBar는 플레이어 상단 예산 바('12:40 / 15:00') + 캡(20분)·모드 예산 도달 토스트 —
 * DramaScreen이 정적으로 import한다(드라마 화면 청크).
 */
import { useEffect, useRef, useState } from 'react';
import { DAY_GOV_EVENT, dayState, fmtClock, setDayMode, SHORT_WEEKLY_MAX, startDayTracking, tickDayNow, type DayState } from '../lib/dayGovernor';
import { spokenToday } from '../lib/state';

export default function DayModeSheet({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const [st, setSt] = useState<DayState>(() => dayState());
  const [msg, setMsg] = useState('');
  const first = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const pick = (m: 'short' | 'quiet' | 'normal') => {
    const r = setDayMode(m);
    if (!r.ok) {
      setMsg(r.reason === 'weekly' ? `'오늘은 5분만'은 한 주에 ${SHORT_WEEKLY_MAX}번까지예요 — 이번 주는 다 썼어요. 조용히 모드나 보통 분량으로 가요.` : '하루 분량 조절이 꺼져 있어요(백업 → 고급 ▾에서 켤 수 있어요).');
      return;
    }
    setSt(dayState());
    onChanged?.();
    onClose();
  };
  const chosen = st.mode === 'short' || st.mode === 'quiet';
  return (
    <div className="dg-sheet-overlay" onClick={onClose}>
      <div className="dg-sheet" role="dialog" aria-modal="true" aria-label="오늘 분량 고르기" onClick={(e) => e.stopPropagation()}>
        <div className="dg-sheet-title">오늘은 어떻게 할까요?</div>
        <button ref={first} type="button" className={`dg-opt${st.mode === 'short' ? ' on' : ''}`} onClick={() => pick('short')} aria-pressed={st.mode === 'short'}>
          <b>⏱ 오늘은 5분만</b>
          <span>역할극 3줄 + 회상 3개 + 리텔 1번 — 목표 절반이면 불꽃이 켜져요 (이번 주 {st.shortLeft}번 남음)</span>
        </button>
        <button type="button" className={`dg-opt${st.mode === 'quiet' ? ' on' : ''}`} onClick={() => pick('quiet')} aria-pressed={st.mode === 'quiet'}>
          <b>🤫 조용히 모드</b>
          <span>소리 못 내는 곳 — 듣고 입모양으로만 따라 해요. 저녁에 소리 내어 보충하면 불꽃이 활활</span>
        </button>
        {chosen && (
          <button type="button" className="dg-opt dg-opt-reset" onClick={() => pick('normal')}>
            <b>↩ 원래 분량으로</b>
          </button>
        )}
        {msg && (
          <p className="dg-sheet-msg" role="alert">
            {msg}
          </p>
        )}
        <button type="button" className="dg-sheet-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

/**
 * 플레이어 상단 예산 바 — 오늘 쓴 시간 / 모드 예산(보통 15분). 20분(캡)에 닿으면 '오늘은 여기까지 — 발화 n문장' 토스트,
 * 짧은 날·조용히·복귀는 그 모드 예산에 닿을 때 한 번 토스트. 플래그 off면 그리지 않는다.
 */
export function DayBudgetBar() {
  const [st, setSt] = useState<DayState>(() => dayState());
  const [toast, setToast] = useState('');
  useEffect(() => {
    startDayTracking();
    let hide: ReturnType<typeof setTimeout> | null = null;
    const show = (text: string) => {
      setToast(text);
      if (hide) clearTimeout(hide);
      hide = setTimeout(() => setToast(''), 6000);
    };
    const on = (e: Event) => {
      const d = ((e as CustomEvent).detail || {}) as { capped?: boolean; budget?: boolean; adapt?: boolean };
      const next = dayState();
      setSt(next);
      if (d.capped) show(`오늘은 여기까지 — 발화 ${Math.floor(spokenToday())}문장. 목표는 지금 수로 확정했어요`);
      else if (d.budget && next.mode !== 'normal') show(next.mode === 'short' ? '5분 다 됐어요 — 여기서 멈춰도 불꽃은 켜져요' : '오늘 분량 끝 — 여기서 멈춰도 충분해요');
      else if (d.adapt) show('오늘은 어려운 날이에요 — 속도를 낮추고 목표를 줄였어요');
    };
    window.addEventListener(DAY_GOV_EVENT, on);
    const t = setInterval(tickDayNow, 1000);
    return () => {
      window.removeEventListener(DAY_GOV_EVENT, on);
      clearInterval(t);
      if (hide) clearTimeout(hide);
    };
  }, []);
  if (!st.enabled) return null;
  const pct = Math.min(100, Math.round((st.elapsedMs / st.budgetMs) * 100));
  const over = st.elapsedMs >= st.budgetMs;
  const label = `오늘 ${fmtClock(st.elapsedMs)} / ${fmtClock(st.budgetMs)}`;
  return (
    <>
      <div className={`dg-bar${over ? ' over' : ''}${st.capped ? ' capped' : ''}`} data-mode={st.mode} aria-label={`오늘 학습 시간 ${label}`}>
        <span className="dg-bar-track" aria-hidden="true">
          <span className="dg-bar-fill" style={{ width: `${pct}%` }} />
        </span>
        <span className="dg-bar-txt">
          {st.mode === 'short' ? '⏱ ' : st.mode === 'quiet' ? '🤫 ' : st.mode === 'return' ? '🌱 ' : ''}
          {fmtClock(st.elapsedMs)} / {fmtClock(st.budgetMs)}
          {st.adapt ? ' · 천천히' : ''}
        </span>
      </div>
      {toast && (
        <div className="dg-toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
