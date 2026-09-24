'use client';

import { useEffect, useState } from 'react';
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
  { title: '학습', items: MORE_GROUPS[1].items.slice(0, 1) },
];
/** 집중 모드의 하단 탭 — 드릴을 뺀 4개(홈·단어·회화·더보기) */
const FOCUS_TABS: Mode[] = ['master', 'words', 'talk'];

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
  const tabs = focus ? PRIMARY_TABS.filter((t) => FOCUS_TABS.includes(t.mode)) : PRIMARY_TABS;

  return (
    <>
      {moreOpen && (
        <div className="more-sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="more-sheet-handle" />
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

      <nav className="mode-tabs">
        {tabs.map((t) => (
          <button
            key={t.mode}
            className={`mode-tab${mode === t.mode ? ' active' : ''}`}
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
          className={`mode-tab${moreActive ? ' active' : ''}`}
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
