'use client';

/**
 * 복습 리마인더 — 매일 정한 시간에 "오늘 복습할 카드 N개" 알림을 띄워 재방문을
 * 유도한다. 별도 푸시 서버 없이 동작한다:
 *  - 앱(또는 설치된 PWA)이 열려 있는 동안: 1분마다 시간을 확인해 조건이 맞으면 알림.
 *  - 앱이 닫혀 있을 때: 지원 브라우저(설치된 PWA)에서 Periodic Background Sync로
 *    서비스워커가 깨어나 알림을 띄운다(best-effort). 지원 안 하면 조용히 무시.
 *
 * 하루 한 번만, 그리고 실제로 복습할 카드가 있을 때만 알림을 보낸다.
 */
import { dueWeak, load, store } from './state';
import { isMissionDoneToday } from './dailyMission';

export interface ReminderSettings {
  enabled: boolean;
  hour: number; // 0-23
  minute: number; // 0-59
}

const SETTINGS_KEY = 'va_reminder';
const FIRED_KEY = 'va_reminder_fired'; // 마지막으로 알림을 보낸 날짜(YYYY-MM-DD)
const DEFAULT: ReminderSettings = { enabled: false, hour: 20, minute: 0 };

export function getReminderSettings(): ReminderSettings {
  const s = load<Partial<ReminderSettings> | null>(SETTINGS_KEY, null);
  if (!s) return { ...DEFAULT };
  return {
    enabled: !!s.enabled,
    hour: typeof s.hour === 'number' ? s.hour : DEFAULT.hour,
    minute: typeof s.minute === 'number' ? s.minute : DEFAULT.minute,
  };
}

export function saveReminderSettings(s: ReminderSettings) {
  store(SETTINGS_KEY, s);
}

export function notifSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notifPermission(): NotificationPermission {
  return notifSupported() ? Notification.permission : 'denied';
}

export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (!notifSupported()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return notifPermission();
  }
}

export function dueReviewCount(): number {
  try {
    return dueWeak().length;
  } catch {
    return 0;
  }
}

export function reminderTitle(): string {
  return '🔥 오늘의 영어';
}

/** 미션 완료 여부 + 복습 카드 수에 따라 가장 와닿는 문구를 고른다. */
export function reminderBody(count: number, missionDone: boolean): string {
  if (!missionDone && count > 0) {
    return `오늘의 비즈니스 미션이 아직 남았어요 · 복습 카드도 ${count}개 대기 중! 15분이면 충분해요.`;
  }
  if (!missionDone) {
    return '오늘의 비즈니스 미션이 아직 남았어요. 15분이면 충분해요!';
  }
  return `복습할 카드 ${count}개가 기다리고 있어요. 지금 복습하고 연속 학습을 이어가세요!`;
}

function todayKey(now: Date): string {
  // 로컬 타임존 기준 날짜 — 사용자가 보는 시계와 일치해야 하루 1회 판정이 맞다.
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 지금 알림을 보낼지 결정하는 순수 함수 — 부수효과 없이 테스트 가능.
 * 시간이 됐고, 오늘 아직 안 보냈고, "할 일이 남아 있을 때"만 true.
 * 할 일 = 오늘 미션 미완료 또는 복습 카드 대기. 미션도 끝냈고 카드도 없으면
 * 보내지 않는다(스팸 방지).
 */
export function shouldFire(args: {
  enabled: boolean;
  permission: NotificationPermission;
  hour: number;
  minute: number;
  firedDate: string;
  count: number;
  missionDone: boolean;
  now: Date;
}): boolean {
  if (!args.enabled) return false;
  if (args.permission !== 'granted') return false;
  if (args.count <= 0 && args.missionDone) return false;
  const target = new Date(args.now);
  target.setHours(args.hour, args.minute, 0, 0);
  if (args.now.getTime() < target.getTime()) return false;
  if (args.firedDate === todayKey(args.now)) return false;
  return true;
}

/** 알림 표시 — 설치된 PWA에서도 뜨도록 서비스워커 등록을 우선 사용하고, 없으면 폴백. */
async function showNotification(title: string, body: string) {
  const opts: NotificationOptions & { tag?: string } = {
    body,
    icon: '/app/icons/icon-192.png',
    badge: '/app/icons/icon-192.png',
    tag: 'daily-review', // 같은 태그는 덮어써서 알림이 쌓이지 않게
    data: { url: '/app' },
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
      return;
    }
  } catch {
    /* 폴백으로 진행 */
  }
  try {
    new Notification(title, opts);
  } catch {
    /* 표시 실패 — 무시 */
  }
}

/** 스케줄러가 주기적으로 호출 — 조건이 맞으면 알림을 띄우고 오늘 보냄으로 기록. */
export async function maybeFireReminder(now = new Date()): Promise<boolean> {
  const s = getReminderSettings();
  const count = dueReviewCount();
  const missionDone = isMissionDoneToday();
  mirrorReminderMeta(count, missionDone); // 서비스워커(백그라운드)가 읽을 수 있게 미러링
  if (
    !shouldFire({
      enabled: s.enabled,
      permission: notifPermission(),
      hour: s.hour,
      minute: s.minute,
      firedDate: load<string>(FIRED_KEY, ''),
      count,
      missionDone,
      now,
    })
  ) {
    return false;
  }
  await showNotification(reminderTitle(), reminderBody(count, missionDone));
  store(FIRED_KEY, todayKey(now));
  return true;
}

/** "지금 테스트" 버튼 — 조건과 무관하게 즉시 알림을 한 번 띄운다(포그라운드). */
export async function showTestReminder(): Promise<void> {
  const count = dueReviewCount();
  const missionDone = isMissionDoneToday();
  await showNotification(
    reminderTitle(),
    count > 0 || !missionDone ? reminderBody(count, missionDone) : '알림이 이렇게 표시됩니다. 매일 이 시간에 오늘의 미션과 복습을 알려드릴게요!'
  );
}

/** 서비스워커가 백그라운드에서 복습 개수·미션 완료 여부를 알 수 있도록 Cache에 미러링한다. */
export function mirrorReminderMeta(count: number, missionDone: boolean) {
  if (typeof caches === 'undefined') return;
  caches
    .open('reminder-meta')
    .then((c) => {
      c.put('reminder-due', new Response(String(count))).catch(() => {});
      c.put('reminder-mission-done', new Response(missionDone ? '1' : '0')).catch(() => {});
    })
    .catch(() => {});
}

/** 지원 브라우저(설치된 PWA)에서 하루 주기 백그라운드 동기화를 등록한다(best-effort). */
export async function registerPeriodicReminder() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
    };
    if (!reg.periodicSync) return;
    // 권한 조회(지원 안 하면 throw) 후 등록
    const status = await (navigator.permissions as Permissions & {
      query: (d: { name: string }) => Promise<PermissionStatus>;
    }).query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return;
    await reg.periodicSync.register('daily-review', { minInterval: 12 * 60 * 60 * 1000 });
  } catch {
    /* 미지원/실패 — 앱이 열려 있을 때의 스케줄러가 대신 처리 */
  }
}
