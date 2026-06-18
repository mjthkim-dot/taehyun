/**
 * 프롬프트 2 — 오프라인 학습 지원 (PWA)
 *
 * next-pwa 를 적용해 서비스워커를 자동 생성하고, 정적 자원/페이지를 캐싱하여
 * 인터넷이 끊긴 상태에서도 앱이 네이티브처럼 실행되도록 한다.
 *
 *   npm i next-pwa
 *
 * 빌드 시 public/sw.js 와 workbox-*.js 가 자동 생성되므로 .gitignore 에 추가해 두는 것을 권장한다.
 */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // 개발 모드에서는 SW 캐싱이 디버깅을 방해하므로 비활성화한다.
  disable: process.env.NODE_ENV === 'development',
  // 오프라인 진입 시 보여줄 폴백 문서.
  fallbacks: {
    document: '/offline',
  },
  // 네트워크 우선 + 캐시 폴백: 레슨(문장 세트) API 응답을 런타임 캐싱한다.
  runtimeCaching: [
    {
      urlPattern: /^https?.*\/api\/lessons.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'lessons-api',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // TTS/오디오 등 정적 미디어
      urlPattern: /\.(?:mp3|wav|ogg|png|jpg|jpeg|svg|webp|woff2?)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 60 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
