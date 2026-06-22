'use client';

import { useState } from 'react';

export type Mode =
  | 'master'
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
  | 'phrasebook';

const PRIMARY_TABS: { mode: Mode; icon: string; label: string }[] = [
  { mode: 'master', icon: '🏠', label: '홈' },
  { mode: 'study', icon: '📖', label: '레슨' },
  { mode: 'drill', icon: '🔁', label: '드릴' },
  { mode: 'talk', icon: '🗣', label: '회화' },
];

const MORE_TABS: { mode: Mode; icon: string; label: string; desc: string }[] = [
  { mode: 'video', icon: '🎬', label: '영상', desc: '레슨 영상으로 듣기 연습' },
  { mode: 'review', icon: '📝', label: '복습', desc: '틀린 문장 간격 반복' },
  { mode: 'progress', icon: '📊', label: '진도', desc: 'CEFR · GSE 학습 현황' },
  { mode: 'features', icon: '🧰', label: '기능', desc: '학습 도구 모음' },
];

export default function NavBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_TABS.some((t) => t.mode === mode);

  return (
    <>
      {moreOpen && (
        <div className="more-sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="more-sheet-handle" />
            <div className="feat-grid">
              {MORE_TABS.map((t) => (
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
          </div>
        </div>
      )}

      <nav className="mode-tabs">
        {PRIMARY_TABS.map((t) => (
          <button
            key={t.mode}
            className={`mode-tab${mode === t.mode ? ' active' : ''}`}
            onClick={() => onChange(t.mode)}
          >
            <span className="ic">{t.icon}</span>
            {t.label}
          </button>
        ))}
        <button
          className={`mode-tab${moreActive ? ' active' : ''}`}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className="ic">{moreActive ? MORE_TABS.find((t) => t.mode === mode)?.icon : '⋯'}</span>
          더보기
        </button>
      </nav>
    </>
  );
}
