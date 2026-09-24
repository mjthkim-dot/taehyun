/**
 * 유닛 핸드오프 — "이 유닛을 열어라"를 화면에 넘기는 통로.
 *
 * 프로그램 카드·학습 지도가 유닛을 고르면 여기 적어두고 화면으로 이동한다.
 * 화면은 마운트 시 take로 한 번 꺼내 그 유닛을 펼친다(꺼내면 지워진다 — 다음
 * 방문 때 다시 열리지 않게). 기존 setDrillQueue/takeDrillQueue와 같은 관례.
 */
import { load, store } from '../state';
import type { UnitRef } from './schema';

const KEY = 'va_unit_handoff';

export function setUnitHandoff(ref: UnitRef) {
  store(KEY, { ...ref, t: Date.now() });
}

/** 출처가 맞을 때만 꺼낸다(다른 화면의 핸드오프를 실수로 소비하지 않게) */
export function takeUnitHandoff(source: UnitRef['source']): UnitRef | null {
  const h = load<(UnitRef & { t: number }) | null>(KEY, null);
  if (!h || h.source !== source) return null;
  // 10분 지난 핸드오프는 버린다(다른 경로로 들어왔는데 옛 유닛이 펼쳐지지 않게)
  if (Date.now() - (h.t || 0) > 10 * 60_000) {
    store(KEY, null);
    return null;
  }
  store(KEY, null);
  return { source: h.source, key: h.key, track: h.track };
}
