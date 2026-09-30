'use client';

import { useEffect, useRef, useState } from 'react';
import Icon, { type IconName } from './Icon';
import { haptic } from '../lib/haptics';
import { FOCUS_EVENT, isFocusMode, setFocusMode } from '../lib/focus';

export type Mode =
  | 'master'
  | 'program'
  | 'map'
  | 'words'
  | 'cefr'
  | 'grammar'
  | 'drama'
  | 'dtalk'
  | 'study'
  | 'drill'
  | 'talk'
  | 'video'
  | 'review'
  | 'progress'
  | 'features'
  | 'flashcards'
  | 'placement'
  | 'listening'
  | 'reading'
  | 'writing'
  | 'homework'
  | 'phrasebook'
  | 'askhistory'
  | 'shadowing'
  | 'reminders'
  | 'backup'
  | 'legal'
  | 'audiocheck'
  | 'apikey'
  | 'vocab'
  | 'meeting'
  | 'pitch'
  | 'scripts'
  | 'business'
  | 'ladder'
  | 'growth'
  | 'session'
  | 'weeklytest'
  | 'audio'
  | 'recallrush'
  | 'preply'
  | 'minutes'
  | 'course'
  | 'career'
  | 'immersion'
  | 'interview'
  | 'feedback';

const PRIMARY_TABS: { mode: Mode; icon: IconName; label: string }[] = [
  { mode: 'master', icon: 'home', label: '홈' },
  { mode: 'words', icon: 'words', label: '단어' },
  { mode: 'drill', icon: 'drill', label: '드릴' },
  { mode: 'talk', icon: 'talk', label: '회화' },
];

/** 더보기 — 목적별 4그룹. 평면 나열(11개)은 무엇이 어디 있는지 알기 어려웠다. */
const MORE_GROUPS: { title: string; items: { mode: Mode; icon: string; label: string; desc: string }[] }[] = [
  {
    title: '내 성장',
    items: [
      { mode: 'cefr', icon: '🎯', label: 'CEFR 리포트', desc: '레벨 · 할 수 있는 일 · 승급 조건' },
      { mode: 'progress', icon: '📊', label: '진도', desc: '학습량 · 퀘스트 · 주간 리포트' },
      { mode: 'map', icon: '🗺', label: '학습 지도', desc: '상황별 숙련도 · 다음 추천' },
    ],
  },
  {
    title: '학습',
    items: [
      { mode: 'drama', icon: '🎬', label: '드라마 레슨', desc: '하루 한 편 · 5분 에피소드' },
      { mode: 'grammar', icon: '🧠', label: '문법 시뮬레이션', desc: '레벨별 문법 · 실전 상황' },
      { mode: 'study', icon: '📚', label: '레슨', desc: '회차별 · CEFR 레벨별' },
      { mode: 'review', icon: '📝', label: '복습', desc: '틀린 문장 다시 보기' },
      { mode: 'video', icon: '🎬', label: '영상', desc: '영상으로 듣기' },
    ],
  },
  {
    title: '실전',
    items: [
      { mode: 'course', icon: '📬', label: '실전 코스', desc: '내 메일 기반 업무 대화' },
      { mode: 'interview', icon: '🎤', label: '면접', desc: 'AI 면접관 시뮬레이션' },
      { mode: 'business', icon: '💼', label: '비즈니스', desc: '회의록 · 비즈니스 회화' },
    ],
  },
  {
    title: '그 밖에',
    items: [
      { mode: 'features', icon: '🧰', label: '기능', desc: '전체 학습 도구' },
      { mode: 'feedback', icon: '💬', label: '피드백', desc: '개선 요청 남기기' },
    ],
  },
];
const MORE_TABS = MORE_GROUPS.flatMap((g) => g.items);

/** 집중 모드의 더보기 — 내 성장만. 나머지는 '모든 기능 보기'로 */
const FOCUS_GROUPS = [
  { title: '내 성장', items: MORE_GROUPS[0].items.slice(0, 2) },
  { title: '학습', items: MORE_GROUPS[1].items.slice(0, 2) },
  // 기록은 이 기기에만 있다 — 집중 모드에서도 백업·복원에 바로 갈 수 있어야 한다(감사 v1.31 견고성 #1)
  { title: '내 데이터', items: [{ mode: 'backup' as Mode, icon: '💾', label: '백업 · 복원', desc: '기록을 파일로 보관·되살리기' }] },
];
/** 집중 모드의 하단 탭 — 홈·단어·회화·더보기. 회화는 업무 미션이 아니라 '드라마 인물과 대화하기' */
const FOCUS_TAB_LIST: { mode: Mode; icon: IconName; label: string }[] = [
  PRIMARY_TABS[0],
  PRIMARY_TABS[1],
  { mode: 'dtalk', icon: 'talk', label: '회화' },
];

export default function NavBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_TABS.some((t) => t.mode === mode);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    const sync = () => setFocus(isFocusMode());
    sync();
    window.addEventListener(FOCUS_EVENT, sync);
    return () => window.removeEventListener(FOCUS_EVENT, sync);
  }, []);
  const groups = focus ? FOCUS_GROUPS : MORE_GROUPS;
  const tabs = focus ? FOCUS_TAB_LIST : PRIMARY_TABS;
  // 집중 모드에서 드라마는 '홈'의 주인공 — 더보기가 아니라 홈이 켜져 보이게(지금 어디 있는지 헷갈리지 않게)
  const activeMode: Mode = focus && mode === 'drama' ? 'master' : mode;
  // 집중 모드 더보기에 있는 화면(레벨·진도·문법·백업)이면 '더보기'가 켜진다
  const moreOn = focus ? ['cefr', 'progress', 'grammar', 'backup'].includes(mode) : moreActive;
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeSheet = () => {
    setMoreOpen(false);
    requestAnimationFrame(() => moreBtnRef.current?.focus({ preventScroll: true }));
  };
  // 더보기 시트 = 대화상자: 열면 첫 항목으로 포커스, Esc로 닫고 탭으로 포커스를 돌려준다
  useEffect(() => {
    if (!moreOpen) return;
    const first = sheetRef.current?.querySelector<HTMLElement>('.feat-card');
    first?.focus({ preventScroll: true });
    // 시트 뒤의 화면은 잠시 비활성(스크린리더·Tab이 뒤로 새지 않게)
    const behind = [document.querySelector('.app-content'), document.querySelector('.app-header')].filter(Boolean) as HTMLElement[];
    behind.forEach((el) => el.setAttribute('inert', ''));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSheet();
        return;
      }
      // 포커스 가두기 — Tab이 시트 안에서만 돈다
      if (e.key === 'Tab' && sheetRef.current) {
        const items = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        } else if (!sheetRef.current.contains(document.activeElement)) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      behind.forEach((el) => el.removeAttribute('inert'));
    };
  }, [moreOpen]);

  return (
    <>
      {moreOpen && (
        <div className="more-sheet-overlay" onClick={closeSheet}>
          <div className="more-sheet" role="dialog" aria-modal="true" aria-label="더보기" ref={sheetRef} onClick={(e) => e.stopPropagation()}>
            <div className="more-sheet-handle" />
            <button type="button" className="more-sheet-close" onClick={closeSheet} aria-label="더보기 닫기">
              ✕
            </button>
            {groups.map((g) => (
              <section key={g.title} className="more-group">
                <h3 className="more-group-title">{g.title}</h3>
                <div className="feat-grid">
                  {g.items.map((t) => (
                    <button
                      key={t.mode}
                      className="feat-card"
                      onClick={() => {
                        onChange(t.mode);
                        setMoreOpen(false);
                      }}
                    >
                      <div className="ic">{t.icon}</div>
                      <div className="lbl">{t.label}</div>
                      <div className="sub">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {focus ? (
              <button
                type="button"
                className="btn ghost more-mode"
                onClick={() => {
                  setFocusMode(false);
                  setMoreOpen(false);
                }}
              >
                모든 기능 보기 — 집중 모드 끄기
              </button>
            ) : (
              <button
                type="button"
                className="btn ghost more-mode"
                onClick={() => {
                  setFocusMode(true);
                  setMoreOpen(false);
                  onChange('master');
                }}
              >
                집중 모드 켜기 — 꼭 필요한 것만
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="mode-tabs" aria-label="주요 메뉴">
        {tabs.map((t) => (
          <button
            key={t.mode}
            className={`mode-tab${activeMode === t.mode ? ' active' : ''}`}
            aria-current={activeMode === t.mode ? 'page' : undefined}
            onClick={() => {
              haptic('tap');
              onChange(t.mode);
            }}
          >
            <span className="ic">
              <Icon name={t.icon} />
            </span>
            {t.label}
          </button>
        ))}
        <button
          ref={moreBtnRef}
          className={`mode-tab${moreOn ? ' active' : ''}`}
          aria-current={moreOn ? 'page' : undefined}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className="ic">
            <Icon name="more" />
          </span>
          더보기
        </button>
      </nav>
    </>
  );
}
