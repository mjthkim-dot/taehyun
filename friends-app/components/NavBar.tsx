'use client';

import { HomeIcon, TvIcon, QuizIcon, CardsIcon, ChartIcon } from './Icon';

export type Tab = 'home' | 'episodes' | 'quiz' | 'review' | 'progress';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: '홈', icon: <HomeIcon /> },
  { id: 'episodes', label: '에피소드', icon: <TvIcon /> },
  { id: 'quiz', label: '퀴즈', icon: <QuizIcon /> },
  { id: 'review', label: '복습', icon: <CardsIcon /> },
  { id: 'progress', label: '진도', icon: <ChartIcon /> },
];

export default function NavBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="nav-bar" aria-label="주요 화면">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`nav-item${tab === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
          aria-current={tab === t.id ? 'page' : undefined}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </nav>
  );
}
