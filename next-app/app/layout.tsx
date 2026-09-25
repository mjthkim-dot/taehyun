import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './globals.css';

/**
 * Pretendard — 한국어 UI 표준 가변 폰트.
 * 통짜 2MB woff2(next/font localFont)는 느린 4G 시뮬레이션에서 총 전송량을
 * 지배해 LCP를 12초대로 끌었다(Lighthouse 검출). 공식 동적 서브셋(유니코드
 * 범위별 분할)으로 바꾸면 화면에 실제로 쓰인 글자 범위만 내려온다(수백 KB).
 * 폰트 패밀리 변수(--font-pretendard)는 globals.css에서 정의한다.
 */

export const metadata: Metadata = {
  title: 'My English Coach',
  description: 'AI 영어 회화 코치 — 오프라인 학습 지원 PWA',
  // basePath(/app) 아래에서 서빙된다 — 상대경로 'manifest.json'은 문서 URL이
  // /app(슬래시 없음)일 때 루트(/manifest.json)로 풀려 404가 났다(Lighthouse 검출)
  manifest: '/app/manifest.json',
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
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
