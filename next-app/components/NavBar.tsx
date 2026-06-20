'use client';

export type Mode = 'master' | 'study' | 'drill' | 'talk' | 'video' | 'review' | 'progress' | 'features';

const TABS: { mode: Mode; icon: string; label: string }[] = [
  { mode: 'master', icon: '🏠', label: '홈' },
  { mode: 'study', icon: '📖', label: '레슨' },
  { mode: 'drill', icon: '🔁', label: '드릴' },
  { mode: 'talk', icon: '🗣', label: '회화' },
  { mode: 'video', icon: '🎬', label: '영상' },
  { mode: 'review', icon: '📝', label: '복습' },
  { mode: 'progress', icon: '📊', label: '진도' },
  { mode: 'features', icon: '🧰', label: '기능' },
];

export default function NavBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <nav className="mode-tabs">
      {TABS.map((t) => (
        <button
          key={t.mode}
          className={`mode-tab${mode === t.mode ? ' active' : ''}`}
          onClick={() => onChange(t.mode)}
        >
          <span className="ic">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
