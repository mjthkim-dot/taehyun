import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

/** Pretendard 가변 폰트 자체 호스팅 — 외부 요청 없이 일관된 한글 타이포. */
const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  display: 'swap',
  weight: '45 920',
  variable: '--font-pretendard',
});

export const metadata: Metadata = {
  title: '프렌즈 잉글리시 — The One Where You Speak English',
  description:
    '미드 프렌즈의 명장면 속 실생활 영어를 회차별 상황 시나리오로 배우는 학습 앱. 표현 카드, 롤플레이 말하기, 퀴즈, 복습까지.',
  manifest: './manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#6b3fa0',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>{children}</body>
    </html>
  );
}
