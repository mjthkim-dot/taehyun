import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import './globals.css';

/**
 * Pretendard — 한국어 UI 표준 가변 폰트. 자체 호스팅(woff2)으로 오프라인 PWA에서도
 * 동작하고, next/font 가 빌드 시 최적화 + FOUT 방지(display: swap)를 처리한다.
 */
const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  display: 'swap',
  weight: '45 920',
  variable: '--font-pretendard',
});

export const metadata: Metadata = {
  title: 'My English Coach',
  description: 'AI 영어 회화 코치 — 오프라인 학습 지원 PWA',
  manifest: 'manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'EnglishCoach' },
};

export const viewport: Viewport = {
  themeColor: '#0a0c0e', // Dark Studio 캔버스 — 설치형 PWA 상태바까지 이어지게
};

/**
 * FOUC 방지 — 저장된(또는 시스템) 테마를 첫 페인트 전에 <html>에 반영하고
 * 상태바 색(meta theme-color)까지 맞춘다. React 하이드레이션 전에 실행돼야 하므로
 * 인라인 동기 스크립트로 둔다.
 */
/* 기본 테마는 Dark Studio — 저장된 선택이 있으면 그걸 따르고, 없으면(시스템이
   라이트라도) 다크로 시작한다. 라이트는 헤더 토글로 언제든 전환 가능. */
const NO_FLASH = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t='dark';}document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}m.setAttribute('content',t==='dark'?'#0a0c0e':'#fafaf8');}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
