/**
 * 커스텀 서비스워커 코드 — next-pwa가 자동 생성 SW에 importScripts로 합친다.
 * 복습 리마인더의 "앱이 닫혀 있을 때" 경로를 담당한다:
 *  - periodicsync('daily-review'): 지원 브라우저(설치된 PWA)에서 하루 주기로 깨어나,
 *    클라이언트가 Cache에 미러링해 둔 복습 카드 개수를 읽어 0보다 크면 알림을 띄운다.
 *  - notificationclick: 알림을 누르면 앱(/app)을 포커스하거나 새로 연다.
 */

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-review') {
    event.waitUntil(showDailyReview());
  }
});

async function showDailyReview() {
  let count = 0;
  try {
    const cache = await caches.open('reminder-meta');
    const res = await cache.match('reminder-due');
    if (res) count = parseInt(await res.text(), 10) || 0;
  } catch (e) {
    /* Cache 접근 실패 — 개수 미상 */
  }
  if (count <= 0) return; // 복습할 게 없으면 알리지 않는다
  await self.registration.showNotification('🔥 오늘의 복습', {
    body: `복습할 카드 ${count}개가 기다리고 있어요. 지금 복습하고 연속 학습을 이어가세요!`,
    icon: '/app/icons/icon-192.png',
    badge: '/app/icons/icon-192.png',
    tag: 'daily-review',
    data: { url: '/app' },
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/app';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/app') && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
