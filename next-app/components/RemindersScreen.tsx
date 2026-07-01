'use client';

/**
 * 복습 리마인더 설정 — 알림 켜기(권한 요청), 매일 알림 시간, 테스트 알림.
 * 별도 푸시 서버 없이 동작하므로, 어떤 상황에서 알림이 오는지 솔직하게 안내한다.
 */
import { useEffect, useState } from 'react';
import {
  getReminderSettings,
  saveReminderSettings,
  notifSupported,
  notifPermission,
  requestNotifPermission,
  registerPeriodicReminder,
  showTestReminder,
  dueReviewCount,
  type ReminderSettings,
} from '../lib/reminders';

export default function RemindersScreen() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>({ enabled: false, hour: 20, minute: 0 });
  const [perm, setPerm] = useState<NotificationPermission>('default');
  const [due, setDue] = useState(0);

  useEffect(() => {
    setSettings(getReminderSettings());
    setPerm(notifPermission());
    setDue(dueReviewCount());
    setReady(true);
  }, []);

  if (!ready) return null;

  const supported = notifSupported();

  function persist(next: ReminderSettings) {
    setSettings(next);
    saveReminderSettings(next);
  }

  async function toggleEnabled() {
    if (!settings.enabled) {
      // 켤 때 권한이 없으면 먼저 요청
      let p = notifPermission();
      if (p !== 'granted') {
        p = await requestNotifPermission();
        setPerm(p);
      }
      if (p !== 'granted') {
        persist({ ...settings, enabled: false });
        return;
      }
      persist({ ...settings, enabled: true });
      registerPeriodicReminder();
    } else {
      persist({ ...settings, enabled: false });
    }
  }

  function setTime(value: string) {
    const [h, m] = value.split(':').map((n) => parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    persist({ ...settings, hour: h, minute: m });
  }

  const timeStr = `${String(settings.hour).padStart(2, '0')}:${String(settings.minute).padStart(2, '0')}`;
  const blocked = perm === 'denied';

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>🔔 복습 알림</h3>

        {!supported && (
          <div className="rem-note warn">이 브라우저는 알림을 지원하지 않아요. (Chrome/Edge, 또는 홈 화면에 추가한 앱에서 사용해 주세요.)</div>
        )}

        {supported && blocked && (
          <div className="rem-note warn">
            브라우저에서 이 사이트의 알림이 <b>차단</b>되어 있어요. 주소창의 자물쇠 아이콘 → 알림 허용으로 바꾼 뒤 다시 시도해 주세요.
          </div>
        )}

        <div className="rem-row">
          <div className="rem-row-main">
            <div className="rem-row-title">매일 복습 알림</div>
            <div className="rem-row-sub">정한 시간에 복습할 카드가 있으면 알려드려요.</div>
          </div>
          <button
            type="button"
            className={`rem-switch${settings.enabled ? ' on' : ''}`}
            onClick={toggleEnabled}
            disabled={!supported || blocked}
            aria-pressed={settings.enabled}
          >
            <span className="rem-switch-knob" />
          </button>
        </div>

        <div className={`rem-row${settings.enabled ? '' : ' rem-disabled'}`}>
          <div className="rem-row-main">
            <div className="rem-row-title">알림 시간</div>
            <div className="rem-row-sub">현재 복습 대기 {due}개</div>
          </div>
          <input
            className="rem-time"
            type="time"
            value={timeStr}
            onChange={(e) => setTime(e.target.value)}
            disabled={!settings.enabled}
          />
        </div>

        <button type="button" className="btn primary rem-test" onClick={showTestReminder} disabled={!supported || perm !== 'granted'}>
          🔔 지금 테스트 알림 보내기
        </button>

        <div className="rem-help">
          <div className="rem-help-title">알림은 이렇게 동작해요</div>
          <ul>
            <li>앱을 홈 화면에 추가(설치)하면 알림이 가장 잘 도착해요.</li>
            <li>앱이 열려 있는 동안에는 정한 시간에 바로 알려드려요.</li>
            <li>지원 기기에서는 앱이 닫혀 있어도 하루 한 번 알림을 시도해요.</li>
            <li>복습할 카드가 없는 날에는 알림을 보내지 않아요.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
