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
  title: 'Preply English Coach',
  description: 'AI 영어 회화 코치 — 오프라인 학습 지원 PWA',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'EnglishCoach' },
};

export const viewport: Viewport = {
  themeColor: '#ff5a36',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>{children}</body>
    </html>
  );
}
