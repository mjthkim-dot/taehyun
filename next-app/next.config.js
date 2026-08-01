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
  // 오프라인 진입 시 보여줄 폴백 문서. basePath(/app)를 붙이지 않으면 프리캐시가
  // 404가 되고, 워크박스는 프리캐시 항목 하나만 실패해도 **설치 전체를 실패**시킨다
  // (그래서 sw.js는 생성되는데 끝내 활성화되지 않았다).
  fallbacks: {
    document: '/app/offline',
  },
  // app-build-manifest.json은 프로덕션에서 서빙되지 않는데 프리캐시 목록에 들어간다
  // — 같은 이유로 설치를 깨뜨리므로 제외한다.
  buildExcludes: [/app-build-manifest\.json$/],
  // 네트워크 우선 + 캐시 폴백: 레슨(문장 세트) API 응답을 런타임 캐싱한다.
  //
  // 주의: runtimeCaching을 직접 지정하면 next-pwa의 기본 규칙이 **통째로 대체**된다.
  // 그래서 HTML 문서가 캐시되지 않아 오프라인에서 앱 대신 폴백 페이지만 떴다.
  // 이 앱은 학습 데이터가 전부 기기에 있으므로 오프라인에서도 온전히 동작해야 한다.
  runtimeCaching: [
    {
      // 앱 문서(HTML) — 네트워크 우선, 끊기면 마지막으로 성공한 화면을 그대로 쓴다
      urlPattern: ({ request }) => request.destination === 'document',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'app-pages',
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // JS·CSS 등 앱 자원 — 프리캐시에서 빠진 청크까지 받아둔다
      urlPattern: ({ request }) => ['script', 'style', 'font'].includes(request.destination),
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'app-assets', expiration: { maxEntries: 128 } },
    },
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
  // 메인 도메인(voice-assistant)의 /app 하위 경로로 rewrite 프록시되므로,
  // 이 앱이 생성하는 모든 정적 자원/링크 경로 앞에 /app 을 붙인다.
  basePath: '/app',
  // No-key UX (Phase 3): 서버 환경변수 GROQ_API_KEY가 설정돼 있으면 빌드 시점에
  // 이 사실만(키 값 자체는 절대 노출하지 않음) 클라이언트 번들에 굽는다.
  // 이렇게 하면 태현 본인 배포에서는 앱이 Groq 키 등록 UI를 아예 보여주지 않는다.
  env: {
    NEXT_PUBLIC_GROQ_SERVER: process.env.GROQ_API_KEY ? '1' : '',
  },
  // 서비스워커 스코프 확장.
  // 스크립트가 /app/sw.js라 기본 최대 스코프는 /app/ 인데, 사용자가 실제로 접속하는
  // 주소는 끝 슬래시가 없는 /app 이라 그 페이지가 스코프 밖이 된다(= SW가 영원히
  // 페이지를 제어하지 못함). Service-Worker-Allowed로 상위 스코프를 허용해 /app 자체도
  // 포함시킨다.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [{ key: 'Service-Worker-Allowed', value: '/' }],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
