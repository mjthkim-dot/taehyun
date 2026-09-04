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
