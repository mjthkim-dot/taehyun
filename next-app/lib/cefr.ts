/**
 * CEFR·GSE 표와 순수 헬퍼 — **레슨 데이터에 의존하지 않는 부분**만 모았다.
 *
 * 원래 이 상수들은 lib/lessons.ts에 함께 있었다. 그런데 lessons.ts는 첫 줄에서
 * data/lessons.json(371KB)을 정적 import한다. lib/state.ts가 CEFR 상수 몇 개를
 * 쓰려고 lessons.ts를 부르는 순간 그 371KB가 함께 끌려오고, state는 사실상 모든
 * 화면이 부르므로 **결국 앱 전체가 전 레슨 본문을 안고 시작**했다.
 *
 * 실제로 첫 진입이 느렸던 가장 큰 이유가 이것이다(page 청크 760KB, 모바일에서
 * 메인 스레드 6초 블로킹). 상수와 데이터를 갈라 두면 사슬이 끊긴다.
 *
 * lessons.ts는 하위 호환을 위해 여기서 다시 내보낸다 — 기존 import 경로는 그대로
 * 동작한다.
 */

export const CEFR_GSE: Record<string, { min: number; max: number }> = {
  A1: { min: 10, max: 22 },
  A2: { min: 22, max: 36 },
  B1: { min: 36, max: 52 },
  B2: { min: 52, max: 64 },
  C1: { min: 64, max: 76 },
  C2: { min: 76, max: 90 },
};

export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Cefr = (typeof CEFR_ORDER)[number];

export const CEFR_NEXT: Record<Cefr, Cefr> = {
  A1: 'A2', A2: 'B1', B1: 'B2', B2: 'C1', C1: 'C2', C2: 'C2',
};

export const SCAFFOLD_BY_CEFR: Record<Cefr, number> = {
  A1: 1.0, A2: 1.0, B1: 0.65, B2: 0.4, C1: 0.2, C2: 0.08,
};

/** CEFR → GSE 중앙값 */
export function gseMid(cefr: Cefr): number {
  const g = CEFR_GSE[cefr] || CEFR_GSE.A2;
  return Math.round((g.min + g.max) / 2);
}

export function gseToCefr(gse: number): Cefr {
  for (const c of CEFR_ORDER) if (gse <= CEFR_GSE[c].max) return c;
  return 'C2';
}

export function scaffoldFor(cefr: Cefr): number {
  return SCAFFOLD_BY_CEFR[cefr] ?? 1.0;
}

/* ── 레슨 메타 헬퍼 — 배열(lessons.json)을 건드리지 않는 순수 함수 ──
 * lessons.ts에 있던 것을 옮겨 왔다: 이 함수들 때문에 199KB 데이터가 소비처
 * 번들에 끌려 들어가는 것을 막는다. 구조적 타입이라 순환 import도 없다. */

/** 레슨의 CEFR — master 유닛은 자기 레벨, 그 외는 A2 기본 */
export function cefrOf(lesson: { master?: string } | null | undefined): Cefr {
  return ((lesson && (lesson.master as Cefr)) || 'A2');
}

/** 레슨 목록에 붙는 짧은 라벨 */
export function lessonLabel(l: { library?: boolean; category?: string; master?: string; preview?: boolean; id: number }): string {
  if (l.library) return `📚 ${l.category || '시나리오'}`;
  if (l.master) return `🗺 ${l.master}`;
  if (l.preview) return `🔮 선행 ${l.id - 100}`;
  return `${l.id}회차`;
}
