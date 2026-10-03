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
  let missionDone = false;
  let enabled = false;
  let focus = false;
  try {
    const cache = await caches.open('reminder-meta');
    const res = await cache.match('reminder-due');
    if (res) count = parseInt(await res.text(), 10) || 0;
    const mres = await cache.match('reminder-mission-done');
    if (mres) missionDone = (await mres.text()) === '1';
    const eres = await cache.match('reminder-enabled');
    // 옛 버전이 미러링한 캐시(켜짐 값 없음)는 켜진 것으로 본다 — 끄면 앱이 '0'으로 덮어쓴다
    enabled = eres ? (await eres.text()) === '1' : !!res;
    const fres = await cache.match('reminder-focus');
    if (fres) focus = (await fres.text()) === '1';
  } catch (e) {
    /* Cache 접근 실패 — 알리지 않는다 */
    return;
  }
  // 알림을 껐거나(또는 데이터를 지웠거나) 할 일이 없으면 알리지 않는다.
  if (!enabled) return;
  if (count <= 0 && missionDone) return;
  let body;
  if (focus) {
    body = !missionDone ? '오늘의 드라마 한 편(5분)이 기다려요 — 태오 이야기 이어 보기!' : `지난 화 표현 ${count}개를 떠올릴 시간이에요. 다음 화 첫머리에서 물어볼게요!`;
  } else if (!missionDone && count > 0) {
    body = `오늘의 비즈니스 미션이 아직 남았어요 · 복습 카드도 ${count}개 대기 중! 15분이면 충분해요.`;
  } else if (!missionDone) {
    body = '오늘의 비즈니스 미션이 아직 남았어요. 15분이면 충분해요!';
  } else {
    body = `복습할 카드 ${count}개가 기다리고 있어요. 지금 복습하고 연속 학습을 이어가세요!`;
  }
  await self.registration.showNotification('🔥 오늘의 영어', {
    body,
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
