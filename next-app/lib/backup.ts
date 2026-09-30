'use client';

/**
 * 학습 데이터 백업·복원 — 모든 진도가 localStorage에만 있어서 브라우저 데이터
 * 삭제·기기 변경 시 통째로 사라진다. va_* 키 전체(+테마)를 JSON 파일 하나로
 * 내보내고, 그 파일로 다른 기기/브라우저에서 그대로 복원할 수 있게 한다.
 *
 * 보안: Groq API 키(va_groq_key)는 백업 파일에 넣지 않는다 — 백업 파일은
 * 메신저·클라우드로 옮겨지기 쉬운데 거기 비밀키가 섞여 있으면 안 된다.
 * 복원 시에도 같은 이유로 이 키는 받아들이지 않는다.
 */

import { sanitizeStorage } from './sanitize';

const BACKUP_APP = 'my-english-coach';
/** 리브랜딩 이전 버전이 만든 백업 파일도 계속 복원할 수 있게 허용하는 앱 식별자들. */
const LEGACY_BACKUP_APPS = new Set(['preply-english-coach']);
const BACKUP_FORMAT = 1;
/** 백업에서 제외할 키 — 비밀키/일회성 상태. */
const EXCLUDED_KEYS = new Set(['va_groq_key']);
/** va_* 외에 추가로 백업할 키. */
const EXTRA_KEYS = ['theme'];

export interface BackupFile {
  app: string;
  format: number;
  exportedAt: string;
  data: Record<string, string>;
}

function collectKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('va_') && !EXCLUDED_KEYS.has(k)) keys.push(k);
  }
  for (const k of EXTRA_KEYS) {
    if (localStorage.getItem(k) != null) keys.push(k);
  }
  return keys;
}

/** 현재 학습 데이터를 백업 객체로 만든다(값은 localStorage 원문 그대로). */
export function buildBackup(): BackupFile {
  const data: Record<string, string> = {};
  for (const k of collectKeys()) {
    const v = localStorage.getItem(k);
    if (v != null) data[k] = v;
  }
  // 집중 모드(기본값)는 저장된 적이 없을 수 있다 — 명시해 두지 않으면 복원 경로에서 켠
  // '모든 기능' 모드가 그대로 남아 복잡한 화면으로 바뀐다(감사 v1.31 견고성 #1)
  if (!data.va_mode) data.va_mode = JSON.stringify('focus');
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), data };
}

/** 백업 JSON을 파일로 다운로드한다. */
/** 마지막으로 백업 파일을 받은 시각 — 홈의 '기록 보관' 권유에 쓴다 */
export const BACKUP_AT_KEY = 'va_backup_at';

/** 백업 당시 본 화 수 — 그 뒤로 7화를 더 보면 다시 권한다 */
export const BACKUP_EPS_KEY = 'va_backup_eps';

function markBackedUp() {
  try {
    localStorage.setItem(BACKUP_AT_KEY, JSON.stringify(Date.now()));
    const d = JSON.parse(localStorage.getItem('va_drama') || '{}');
    const n = d && typeof d.done === 'object' && d.done ? Object.keys(d.done).length : 0;
    localStorage.setItem(BACKUP_EPS_KEY, JSON.stringify(n));
  } catch {
    /* 무시 */
  }
}

export function downloadBackup() {
  // 받은 시각을 먼저 기록해 파일에도 담는다(복원한 기기도 '최근에 백업했다'로 안다)
  markBackedUp();
  const backup = buildBackup();
  const date = backup.exportedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `english-coach-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 클릭이 처리된 뒤 해제(사파리에서 즉시 해제하면 다운로드가 빈 파일이 되는 경우가 있다).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface RestoreResult {
  ok: boolean;
  /** 복원된 키 개수(성공 시). */
  restored: number;
  /** 사용자에게 보여줄 메시지. */
  message: string;
}

/**
 * 백업 JSON 텍스트를 검증하고 localStorage에 복원한다.
 * 파일에 있는 키만 덮어쓰고, 파일에 없는 기존 키는 그대로 둔다.
 */
export function restoreBackup(text: string): RestoreResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, restored: 0, message: '올바른 백업 파일이 아니에요 (JSON 형식이 아님).' };
  }
  const b = parsed as Partial<BackupFile>;
  const appOk = b?.app === BACKUP_APP || (typeof b?.app === 'string' && LEGACY_BACKUP_APPS.has(b.app));
  if (!appOk || typeof b?.data !== 'object' || b.data == null) {
    return { ok: false, restored: 0, message: '이 앱의 백업 파일이 아니에요.' };
  }
  if (typeof b.format === 'number' && b.format > BACKUP_FORMAT) {
    return { ok: false, restored: 0, message: '더 새로운 버전의 앱에서 만든 백업이에요. 앱을 업데이트한 뒤 다시 시도해주세요.' };
  }
  let restored = 0;
  for (const [k, v] of Object.entries(b.data)) {
    // 허용된 키만 복원 — 백업 파일을 통해 임의 키/비밀키가 심기지 않게 한다.
    const allowed = (k.startsWith('va_') && /^va_[a-z0-9_]+$/.test(k) && !EXCLUDED_KEYS.has(k)) || EXTRA_KEYS.includes(k);
    if (!allowed || typeof v !== 'string') continue;
    // 학습 값은 JSON이어야 한다 — 읽을 수 없는 값은 들이지 않는다(홈이 깨지는 원인)
    if (k.startsWith('va_')) {
      try {
        JSON.parse(v);
      } catch {
        continue;
      }
    }
    try {
      localStorage.setItem(k, v);
      restored++;
    } catch {
      /* 저장 공간 부족 — 해당 키만 건너뛴다 */
    }
  }
  if (!restored) return { ok: false, restored: 0, message: '복원할 데이터가 없어요.' };
  // 1.30 이전 백업: 모드가 저장된 적이 없다 = 집중 모드였다(전체 모드는 늘 'full'이 저장됨)
  if (!('va_mode' in b.data)) localStorage.setItem('va_mode', JSON.stringify('focus'));
  // 1.30 이전 백업엔 드라마 이전 표시가 없다 — 옛 AI 4~7화 기록이 돌아왔을 수 있으니 이전을 다시 돌린다
  if (!('va_drama_migrated' in b.data)) localStorage.removeItem('va_drama_migrated');
  // 이 사람은 백업 파일을 갖고 있다
  markBackedUp();
  // 들어온 값의 모양을 한 번 점검(빈 칸·어긋난 항목 정리)
  try {
    sanitizeStorage();
  } catch {
    /* 점검 실패는 복원을 막지 않는다 */
  }
  return { ok: true, restored, message: `${restored}개 항목을 복원했어요. 잠시 후 앱을 다시 열어요.` };
}

/**
 * 모든 학습 데이터 즉시 삭제 — 개인정보처리방침의 "이용자 삭제권"을 실제로
 * 이행하는 장치. va_* 전체(API 키 포함)와 테마, 레슨 캐시(IndexedDB)를 지운다.
 */
export function eraseAllData() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('va_') || EXTRA_KEYS.includes(k))) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  // 백그라운드 알림·캐시도 함께 — 데이터를 지웠는데 매일 알림이 오면 안 된다
  // (알림 모듈은 미션 데이터를 안고 있어 오류 화면·홈 번들에 넣지 않으려고 지연 로딩)
  void import('./reminders').then((m) => m.unregisterPeriodicReminder()).catch(() => undefined);
  try {
    if (typeof caches !== 'undefined') void caches.delete('app-pages');
  } catch {
    /* 무시 */
  }
  try {
    indexedDB.deleteDatabase('preply-english-coach'); // 내부 레슨 캐시(구 식별자 유지분)
  } catch {
    /* IndexedDB 미지원 — 무시 */
  }
  return keys.length;
}

/** 백업/복원 화면에 보여줄 현재 데이터 요약. */
export function dataSummary() {
  const count = (key: string) => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(v) ? v.length : 0;
    } catch {
      return 0;
    }
  };
  const keys = (key: string) => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || '{}');
      return v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).length : 0;
    } catch {
      return 0;
    }
  };
  const dramaDone = (() => {
    try {
      const v = JSON.parse(localStorage.getItem('va_drama') || '{}');
      return v && typeof v.done === 'object' && v.done ? Object.keys(v.done).length : 0;
    } catch {
      return 0;
    }
  })();
  return {
    episodes: dramaDone,
    words: keys('va_words'),
    grammar: keys('va_grammar'),
    phrases: count('va_phrases'),
    weak: count('va_weak'),
    askHistory: count('va_ask_history'),
    days: count('va_days'),
    sessions: count('va_sessions'),
    chatLogs: count('va_chat_logs'),
  };
}
