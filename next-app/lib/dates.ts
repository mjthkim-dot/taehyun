/**
 * 날짜 키 — 앱 전체가 "오늘"을 같은 방식으로 세게 하는 단 하나의 정의.
 *
 * 코드 리뷰(2026-09)에서 드러난 결함: 같은 뜻의 헬퍼가 9곳에 따로 있었고,
 * 그중 state.ts·program.ts는 `toISOString()`(UTC), 나머지 7곳은 로컬 날짜를 썼다.
 * 한국(UTC+9)에서는 00:00~09:00 사이에 두 체계의 "오늘"이 다르다 —
 * 아침 7시에 말한 문장은 UTC로는 어제(va_spoken)에 쌓였다가 9시에 0으로 보이고,
 * 학습일(va_days, 스트릭)은 UTC로, 미션·세션 완료는 로컬로 기록돼 서로 어긋났다.
 *
 * 규칙: 사용자가 보는 시계(로컬)가 기준이다. 하루 1회 판정·스트릭·목표 링은
 * 전부 이 파일의 todayKey()로만 센다. 저장 형식은 YYYY-MM-DD 그대로라
 * 기존 데이터와 호환된다(경계 시각의 귀속만 바뀐다).
 */

/** Date → YYYY-MM-DD (로컬 타임존) */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 오늘 (로컬) */
export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

/** 두 날짜 키 사이의 달력일 차이(to - from). ms 반올림이 아니라 날짜만 비교한다. */
export function daysBetween(fromKey: string, toKey: string): number {
  const a = Date.parse(`${fromKey}T00:00:00Z`);
  const b = Date.parse(`${toKey}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/** 날짜 키에서 n일 이동 */
export function shiftKey(key: string, days: number): string {
  const t = Date.parse(`${key}T00:00:00Z`);
  if (Number.isNaN(t)) return key;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

/** 날짜 시드 — 하루 단위 로테이션용 정수(같은 날엔 같은 값) */
export function daySeed(key: string = todayKey()): number {
  return Number(key.replace(/-/g, '')) || 0;
}
