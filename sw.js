/* PREPLY AI 스피킹 코치 — 서비스워커 (오프라인 학습 지원)
 * - 앱 셸(HTML/매니페스트)을 캐싱해 오프라인에서도 앱이 실행되도록 한다.
 * - 네비게이션: 네트워크 우선 → 실패 시 캐시(오프라인 복습 가능).
 * - 동일 출처 GET 정적 자원: stale-while-revalidate.
 * - 외부 CDN(모델/Groq 등)은 가로채지 않고 네트워크로 통과시킨다.
 * CACHE 버전을 올리면 이전 캐시는 activate 시 정리된다.
 */
const CACHE = 'preply-coach-v4.35';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 외부 출처(CDN/Groq/HuggingFace 등)는 그대로 네트워크로.
  if (url.origin !== self.location.origin) return;

  // 페이지 이동(HTML): 네트워크 우선, 오프라인이면 캐시 폴백.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => undefined);
          return res;
        })
        .catch(() =>
          caches.match(req).then((m) => m || caches.match('/') || caches.match('/index.html'))
        )
    );
    return;
  }

  // API 호출(/api/*)은 캐시하지 않는다.
  if (url.pathname.startsWith('/api/')) return;

  // 그 외 동일 출처 정적 자원: stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
