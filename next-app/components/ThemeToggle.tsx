'use client';

/**
 * 라이트/다크 테마 토글 — 헤더에 들어가는 작은 알약 버튼.
 * 실제 색 전환은 <html data-theme="..."> 속성으로 이뤄지고(globals.css가 토큰을 덮어씀),
 * 선택값은 localStorage('theme')에 저장된다. 최초 렌더 전 색을 맞추는 일(FOUC 방지)은
 * layout.tsx 의 인라인 스크립트가 담당하므로, 여기서는 현재 상태를 읽어 토글만 한다.
 */
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const THEME_COLOR: Record<Theme, string> = { light: '#fafaf8', dark: '#0a0c0e' };

export default function ThemeToggle() {
  // 기본은 Dark Studio — layout.tsx의 인라인 스크립트와 초기값을 맞춘다.
  const [theme, setTheme] = useState<Theme>('dark');

  // 마운트 시 인라인 스크립트가 설정해 둔 실제 테마를 읽어 버튼 아이콘을 맞춘다.
  useEffect(() => {
    const cur = document.documentElement.getAttribute('data-theme');
    setTheme(cur === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* 프라이빗 모드 등 — 무시 */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[next]);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      title={theme === 'dark' ? '라이트 모드로' : '다크 모드로'}
      aria-label="라이트/다크 테마 전환"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
