// 앱 셸만 캐싱한다. 미팅 대화·번역은 절대 캐싱하지 않는다(민감 정보).
const SHELL = 'mc-shell-v4';   // v2.3: 오버레이 인터뷰 모드(S/M/L·투명도·복원) — 구 캐시 교체
const ASSETS = ['/app.html', '/app.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname === '/health') {
    return;                                  // API는 캐싱하지 않고 네트워크로만
  }
  // 셸은 network-first — 서버가 살아있으면 항상 최신, 죽었으면 캐시로 버틴다
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(SHELL).then(c => c.put(e.request, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then(r => r || Response.error()))
  );
});
