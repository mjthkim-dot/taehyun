/**
 * 엔딩 '조금 더 ▾' 소리 카드 1장 고르기(M7 디코더 · M9 HVPT 공통).
 *
 * 통합 원칙의 요일 규칙 2종 중 하나 — '평일 소리 카드 1장':
 *   · 주말(토·일)은 소리 카드 없음(토요일은 교차 리텔의 날, 일요일은 쉬는 날).
 *   · 진단 상위 축(역할극·회상 전사에서 쌓인 va_pron 중 HVPT 자료가 있는 축)이 있고 Groq 키가 있으면 HVPT.
 *     HVPT는 Orpheus 6목소리가 있어야 '고변이'가 성립한다 — 키 없는 기기(iOS 영어 음성 1~2개)에선 숨긴다.
 *   · 아니면 디코더(키 없이도 동작).
 *   · 플래그(hvpt/decoder)를 끄면 그 카드는 후보에서 빠진다 — hvpt를 끄면 디코더로 내려간다.
 * 두 카드의 when()이 같은 함수를 부르므로 같은 날 두 장이 함께 뜨는 일이 없다.
 *
 * 순수 판정(pickSoundCard·hvptAxisFor)과 저장값을 읽는 래퍼(soundCardFor·diagnosedAxes)를 나눠
 * 단위 테스트가 저장소 없이 규칙만 볼 수 있게 했다.
 */
import { groqKey, topPronLapses } from './state';
import { isOn } from './flags';
import { WEEK_PLAN, axisMastered, hasHvpt } from './soundTrack';

export type SoundCard = 'hvpt' | 'decoder';

/** 진단 축으로 인정하는 최소 횟수(최근 14일) — 한 번 어긋난 건 인식 오류일 수도 있다 */
export const AXIS_MIN_COUNT = 2;
/** 진단을 보는 기간(일) */
export const AXIS_DAYS = 14;

export interface SoundPickInput {
  /** YYYY-MM-DD(엔딩 ctx.dateKey) */
  dateKey: string;
  /** Groq 키(Orpheus TTS) 있음 */
  hasKey: boolean;
  /** 진단 상위 축 — HVPT 자료가 있는 것만, 많은 순 */
  topAxes: string[];
  decoderOn: boolean;
  hvptOn: boolean;
}

/** 월~금인가 — 날짜 키를 로컬 날짜로 읽는다(시간대 때문에 UTC 파싱을 쓰지 않는다) */
export function isWeekday(dateKey: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey || '');
  if (!m) return false;
  const dow = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
  return dow >= 1 && dow <= 5;
}

/** 오늘의 소리 카드(없으면 null) — 순수 함수 */
export function pickSoundCard(i: SoundPickInput): SoundCard | null {
  if (!isWeekday(i.dateKey)) return null;
  if (i.hvptOn && i.hasKey && i.topAxes.length > 0) return 'hvpt';
  return i.decoderOn ? 'decoder' : null;
}

/**
 * HVPT로 훈련할 축 — 진단 상위 축을 앞당기고(M9 '앞당김'), 그다음 이번 주 계획 축, 그 뒤 주차 순서대로.
 * 익힌 축(axisMastered: 최근 10회 중 8회)은 건너뛴다 = '다음 축'. 전부 익혔으면 맨 앞 후보로 복습.
 */
export function hvptAxisFor(
  week: number,
  topAxes: string[],
  mastered: (axis: string) => boolean = axisMastered,
  has: (axis: string) => boolean = hasHvpt
): string | null {
  const n = WEEK_PLAN.length;
  const w = Math.min(n, Math.max(1, Math.round(week) || 1));
  const order: string[] = [...topAxes];
  for (let k = 0; k < n; k++) order.push(...WEEK_PLAN[(w - 1 + k) % n].axes);
  const cands = [...new Set(order)].filter((a) => has(a));
  if (!cands.length) return null;
  return cands.find((a) => !mastered(a)) ?? cands[0];
}

/** 최근 14일 진단 상위 축(2회 이상·HVPT 자료 있음, 많은 순, 최대 3) */
export function diagnosedAxes(): string[] {
  try {
    return topPronLapses(AXIS_DAYS, 6)
      .filter((r) => r.count >= AXIS_MIN_COUNT && hasHvpt(r.key))
      .slice(0, 3)
      .map((r) => r.key);
  } catch {
    return [];
  }
}

/** 엔딩 카드 when()이 부른다 — 저장값(키·진단·플래그)을 읽어 pickSoundCard로 */
export function soundCardFor(ctx: { dateKey: string }): SoundCard | null {
  return pickSoundCard({
    dateKey: ctx.dateKey,
    hasKey: !!groqKey(),
    topAxes: diagnosedAxes(),
    decoderOn: isOn('decoder'),
    hvptOn: isOn('hvpt'),
  });
}
