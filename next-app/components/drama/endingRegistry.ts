/**
 * 엔딩 카드 레지스트리(M2) — 엔딩 화면 '이해도' 아래에 붙는 카드들을 한 곳에서 등록·정렬한다.
 *
 * 왜: 이후 모듈(M3 회상·M5 리텔·M7 디코더·M9 HVPT·M10 D+7·M11 시즌)이 저마다 DramaScreen 엔딩을
 * 편집하면 같은 줄에서 충돌한다. 대신 각 카드 파일(components/drama/cards/*.tsx)이
 *   registerEndingCard({ id, order, basic, when, Component })
 * 를 export(모듈 로드 시 등록)하고, EndingExtras는 import 목록 + 정렬 + 'basic 3장 / 조금 더 ▾' 렌더만 한다.
 *
 * 순서(통합 원칙): 이해도 → 재소환 2(M2, 플레이어 안) → 리텔 1회차(M5, order 10) → 회상 3(M3, order 20)
 *   ‖ 조금 더 ▾: 리텔 2·3회차(M5, 30) → 회상 +3(M3, 40) → 소리 카드 1장(M7/M9, 50) → 오늘 질문(M5, 60)
 *   → D+7(M10, 70)/시즌(M11, 80) → '오늘은 여기까지'.
 * dayState(M4)는 아직 없다 — when()의 ctx는 열린 모양({ep, dateKey, keyless, ...})이라 M4가 필드를 더하면 된다.
 */
import type { ComponentType } from 'react';
import type { Episode } from '../../lib/drama';

export interface EndingCtx {
  ep: Episode;
  /** YYYY-MM-DD */
  dateKey: string;
  /** 키 없음(whisper·Web Speech 둘 다 없음) */
  keyless: boolean;
  /** M2 역할극 집계(플레이어가 넘긴다) */
  speak?: { spoken: number; passed: number; lapsesTop: { key: string; count: number }[]; disputed: number; skipped: number };
  /** M4 dayState 등 — 모듈이 자유롭게 더한다 */
  [k: string]: unknown;
}

export interface EndingCard {
  id: string;
  /** 작을수록 앞 */
  order: number;
  /** 기본 노출(최대 3장) — 아니면 '조금 더 ▾' 안 */
  basic: boolean;
  when: (ctx: EndingCtx, ep: Episode) => boolean;
  Component: ComponentType<{ ctx: EndingCtx }>;
}

/** 기본 노출 상한 */
export const BASIC_MAX = 3;

const registry: EndingCard[] = [];

/** 등록(같은 id는 덮어쓴다 — HMR·중복 import에 안전). 등록한 카드를 돌려준다. */
export function registerEndingCard(card: EndingCard): EndingCard {
  const k = registry.findIndex((c) => c.id === card.id);
  if (k >= 0) registry[k] = card;
  else registry.push(card);
  return card;
}

/** 등록된 전부(order 순, 같으면 id 순) */
export function endingCards(): EndingCard[] {
  return [...registry].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** 테스트·재초기화용 */
export function clearEndingCards(): void {
  registry.length = 0;
}

/**
 * 지금 보여 줄 카드를 기본/접힘으로 나눈다(순수 함수).
 * when()이 false인 카드는 뺀다. basic 카드는 order 순으로 최대 basicMax장까지만 기본에, 넘치면 접힘으로.
 */
export function splitEndingCards(cards: EndingCard[], ctx: EndingCtx, basicMax = BASIC_MAX): { basic: EndingCard[]; more: EndingCard[] } {
  const sorted = [...cards].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const basic: EndingCard[] = [];
  const more: EndingCard[] = [];
  for (const c of sorted) {
    let on = false;
    try {
      on = !!c.when(ctx, ctx.ep);
    } catch {
      on = false; // 카드 하나의 조건 오류가 엔딩을 막지 않는다
    }
    if (!on) continue;
    if (c.basic && basic.length < basicMax) basic.push(c);
    else more.push(c);
  }
  return { basic, more };
}
