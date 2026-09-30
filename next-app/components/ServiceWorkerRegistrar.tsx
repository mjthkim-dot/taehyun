'use client';

/**
 * 서비스워커 등록 — next-pwa 5.6의 자동 등록은 Pages Router(_app) 전제라
 * App Router에서는 실행되지 않는다. 그래서 sw.js는 생성·서빙되는데 **아무도
 * 등록하지 않아** 오프라인 캐싱과 복습 알림(periodicsync)이 통째로 죽어 있었다.
 * 여기서 직접 등록해 되살린다.
 *
 * basePath가 /app이므로 스크립트는 /app/sw.js, 스코프는 /app/ 이다.
 * 등록은 첫 페인트를 방해하지 않도록 load 이후로 미룬다.
 */
import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // 개발 모드에서는 next-pwa가 sw.js를 만들지 않으므로 등록하지 않는다.
    if (process.env.NODE_ENV === 'development') return;

    let cancelled = false;
    const register = () => {
      if (cancelled) return;
      // 스코프는 '/app'(끝 슬래시 없음) — 사용자가 접속하는 /app 페이지 자체를
      // 포함해야 SW가 그 페이지를 제어한다. 상위 스코프 허용은 응답 헤더가 담당한다.
      navigator.serviceWorker.register('/app/sw.js', { scope: '/app' }).catch(() => {
        /* 등록 실패(구형 브라우저·사설 모드 등) — 앱은 온라인으로 그대로 동작한다 */
      });
      // 첫 방문 세션의 문서·스크립트는 서비스 워커가 켜지기 전에 받아서 어디에도 캐시되지 않았다 —
      // 그래서 설치한 날 한 번 쓰고 다음에 오프라인으로 열면 앱 대신 '오프라인' 안내만 떴다
      // (감사 v1.31 견고성 #4). 워커가 준비되면 지금 문서와 이미 받은 스크립트를 캐시에 넣어 둔다.
      void navigator.serviceWorker.ready
        .then(async () => {
          if (typeof caches === 'undefined') return;
          const pages = await caches.open('app-pages');
          if (!(await pages.match('/app'))) await pages.add('/app').catch(() => undefined);
          // 1.30까지 쓰던 'start-url' 캐시는 이제 규칙이 없다 — /app이 app-pages에 들어간 뒤 치운다
          if (await pages.match('/app')) await caches.delete('start-url').catch(() => undefined);
          const assets = await caches.open('app-assets');
          const urls = performance
            .getEntriesByType('resource')
            .map((e) => e.name)
            .filter((u) => /\/app\/_next\/static\/.+\.(js|css)$/.test(u));
          // 이미 어느 캐시에든(프리캐시는 ?__WB_REVISION__ 꼬리표가 붙는다) 있으면 건너뛴다 — 두 번 받지 않게
          await Promise.all(urls.map((u) => caches.match(u, { ignoreSearch: true }).then((m) => (m ? undefined : assets.add(u))).catch(() => undefined)));
        })
        .catch(() => undefined);
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
