'use client';

/**
 * 복습 리마인더 스케줄러 — 전역에 한 번 마운트해, 앱이 열려 있는 동안 1분마다
 * (그리고 앱이 다시 보일 때마다) 알림 조건을 확인한다. 실제 표시 여부는
 * maybeFireReminder가 판단한다(시간·하루 1회·복습 카드 유무).
 */
import { useEffect } from 'react';
import { getReminderSettings, maybeFireReminder, notifPermission, registerPeriodicReminder } from '../lib/reminders';

export default function ReminderScheduler() {
  useEffect(() => {
    let alive = true;
    const check = () => {
      if (alive) maybeFireReminder().catch(() => {});
    };
    check(); // 앱 진입 시 1회
    // 백그라운드 주기 동기화(periodic sync)는 브라우저가 임의로 해제할 수 있어,
    // 설정을 켠 사용자는 앱을 열 때마다 재등록해 둔다(멱등 — 중복 등록돼도 무해).
    if (getReminderSettings().enabled && notifPermission() === 'granted') {
      registerPeriodicReminder();
    }
    const timer = setInterval(check, 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
