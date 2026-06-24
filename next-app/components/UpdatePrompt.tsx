'use client';

/**
 * 새 배포 감지 → "새 버전이 있어요" 배너. 탭하면 새로고침해 최신 버전으로 갱신한다.
 * PWA 서비스워커는 새 배포가 떠도 옛 번들을 먼저 보여주기 때문에, 새 SW가 설치/활성화되는
 * 순간을 감지해 사용자에게 한 번의 탭으로 갱신할 수 있게 안내한다. (자동 새로고침은
 * 학습/오디오 재생을 끊을 수 있어 의도적으로 '탭하면 갱신' 방식.)
 */
import { useEffect, useState } from 'react';

export default function UpdatePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // 첫 설치(이전 컨트롤러 없음)에서는 "새 버전" 배너를 띄우지 않는다.
    const hadController = !!navigator.serviceWorker.controller;
    let reg: ServiceWorkerRegistration | null = null;

    const onControllerChange = () => {
      if (hadController) setShow(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker.getRegistration().then((r) => {
      if (!r) return;
      reg = r;
      // 이미 대기 중인 새 SW가 있으면 바로 안내
      if (r.waiting && navigator.serviceWorker.controller) setShow(true);
      r.addEventListener('updatefound', () => {
        const nw = r.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) setShow(true);
        });
      });
    });

    // 앱으로 다시 돌아올 때 새 배포가 있는지 확인한다(앱을 오래 켜둔 경우 대비).
    const onVisible = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!show) return null;

  return (
    <button className="update-toast" onClick={() => window.location.reload()}>
      ✨ 새 버전이 있어요 · 탭하면 새로고침
    </button>
  );
}
