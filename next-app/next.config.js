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
  // 시작 주소(/app) 전용 규칙을 끈다 — next-pwa 기본값은 '/app'에 제한 시간 없는 NetworkFirst를
  // 다른 규칙보다 앞에 붙여서, 신호가 약한 곳(연결은 되지만 느린 터널·혼잡 LTE)에선 캐시에 앱이
  // 있어도 네트워크가 답할 때까지(실측 10초+) 흰 화면이었다. 이제 '/app'도 아래 app-pages 규칙
  // (2초 넘으면 캐시)으로 처리된다(감사 v1.31 성능 #0).
  dynamicStartUrl: false,
  cacheStartUrl: false,
  // 콘텐츠 해시가 이미 URL에 있는 파일은 리비전을 고정한다 — 빌드 ID를 리비전으로 쓰면 배포마다
  // 바뀌지 않은 react-dom 등 ~720KB를 다시 받았다(성능 #1)
  manifestTransforms: [
    async (entries) => ({
      manifest: entries.map((e) => (/\/_next\/static\/(chunks|css|media)\/.*[.-][0-9a-f]{8,}\.(js|css|woff2)$/.test(e.url) ? { ...e, revision: 'immutable' } : e)),
      warnings: [],
    }),
  ],
  // app-build-manifest.json은 프로덕션에서 서빙되지 않는데 프리캐시 목록에 들어간다
  // — 같은 이유로 설치를 깨뜨리므로 제외한다.
  //
  // 지연 로딩 청크(숫자.해시.js)도 제외한다. 이것을 빼기 전에는 서비스워커가 첫
  // 방문에 **JS 청크 45개를 전부** 내려받았다. 화면을 지연 로딩으로 쪼개 놓아도
  // SW가 뒤에서 전부 받아버리니 첫 진입은 하나도 빨라지지 않았다(측정에서 확인).
  // 앱 셸(page·framework·main·공통 청크)만 미리 받고, 나머지는 그 화면에 처음
  // 들어갈 때 런타임 캐싱(StaleWhileRevalidate)이 받아서 캐시한다 — 한 번 본
  // 화면은 그다음부터 오프라인에서도 열린다.
  //
  // 이름 규칙으로 갈린다: 앱 셸은 `117-be4b….js`(하이픈), 지연 청크는
  // `126.56d3….js`(점). 파일명이 이렇게 다른 것은 webpack의 규칙이다.
  //
  // 글꼴 서브셋(92개·2.96MB)도 프리캐시에서 뺀다 — 홈이 실제로 쓰는 건 9개뿐이다. 쓴 서브셋만
  // 아래 런타임 규칙(font → app-assets)이 캐시한다. App Router는 Pages Router 런타임
  // (framework·main·polyfills·pages/*)을 요청하지 않으므로 그것도 뺀다(성능 #1: 첫 방문 3.3MB → ~0.3MB).
  buildExcludes: [
    /app-build-manifest\.json$/,
    /chunks\/\d+\.[0-9a-f]+\.js$/,
    /media\/.*\.woff2$/,
    /chunks\/(framework|main|polyfills)-[0-9a-f]+\.js$/,
    /chunks\/pages\//,
  ],
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
        networkTimeoutSeconds: 2,
        expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // JS·CSS 등 앱 자원 — 프리캐시에서 빠진 청크까지 받아둔다
      urlPattern: ({ request }) => ['script', 'style', 'font'].includes(request.destination),
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'app-assets', expiration: { maxEntries: 200 } },
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
    // 빌드 식별(배포 커밋) — 새 버전 배너가 '정말 다른 빌드'일 때만 뜨게 비교한다
    NEXT_PUBLIC_COMMIT: process.env.VERCEL_GIT_COMMIT_SHA || '',
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
