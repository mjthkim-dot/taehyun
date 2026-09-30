/**
 * 홈이 첫 화면에서 알아야 하는 몇 가지 — 무거운 모듈을 끌어오지 않고 localStorage만 읽는다.
 *
 * 감사(v1.30)에서 드러난 문제: 홈이 lib/program(→ 온톨로지 그래프 → 실전 코스·커리어·미션·
 * 스크립트 원고)과 lib/drama(드라마 원고), GrammarToday(문법 원고 57KB)를 정적으로 import해
 * 홈 첫 청크가 448KB까지 커졌다. 홈에 필요한 건 "코스를 시작했나 / 드라마를 몇 화 봤나 /
 * 오늘 봤나" 같은 한두 값뿐이라, 그 값만 여기서 직접 읽는다.
 */
import { load, store } from './state';
import { todayKey } from './dates';

/** 12주 프로그램 시작/초기화 이벤트(홈 구성이 바뀜) */
export const PROGRAM_EVENT = 'va:program';

export function programStarted(): boolean {
  const p = load<{ startedAt?: string } | null>('va_program', null);
  return !!(p && p.startedAt);
}

interface DramaProgressLite {
  done?: Record<string, string>;
}

function dramaDone(): Record<string, string> {
  const p = load<DramaProgressLite>('va_drama', {});
  return p && typeof p.done === 'object' && p.done ? p.done : {};
}

export function dramaWatchedCount(): number {
  return Object.keys(dramaDone()).length;
}

export function dramaWatchedToday(): boolean {
  return Object.values(dramaDone()).includes(todayKey());
}

/** 홈 → 드라마 화면으로 갈 때 허브를 건너뛰고 바로 재생하라는 표시(1분 유효) */
export const DRAMA_AUTOPLAY_KEY = 'va_drama_autoplay';
export function requestDramaAutoplay() {
  store(DRAMA_AUTOPLAY_KEY, Date.now());
}
