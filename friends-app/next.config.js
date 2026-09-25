/**
 * 완전 정적 앱 — 서버 코드가 전혀 없다(모든 학습 데이터가 번들에 포함,
 * 진도는 localStorage). output:'export'로 순수 정적 사이트를 만들어
 * 어떤 정적 호스팅(Vercel, GitHub Pages, S3…)에도 그대로 올릴 수 있게 한다.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // 정적 export에는 이미지 최적화 서버가 없다.
  images: { unoptimized: true },
  // 하위 경로 배포 지원 — GitHub Pages(https://<owner>.github.io/<repo>/)처럼
  // 루트가 아닌 경로에 올릴 때 BASE_PATH=/<repo>로 빌드한다. 로컬/루트 배포는 빈 값.
  basePath: process.env.BASE_PATH || '',
};

module.exports = nextConfig;
