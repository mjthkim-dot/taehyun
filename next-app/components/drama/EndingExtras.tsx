'use client';

/**
 * 엔딩 추가 카드(M2) — 레지스트리(endingRegistry)에 등록된 카드를 '기본 3장 / 조금 더 ▾' 로 그린다.
 * 이 파일은 import 목록(./cards) + 정렬 + 접힘 렌더만 한다. 카드 내용은 각 카드 파일의 몫.
 * 카드가 하나도 없으면 아무것도 그리지 않는다(지금 상태).
 */
import { useMemo, useState } from 'react';
import './cards';
import { endingCards, splitEndingCards, type EndingCtx } from './endingRegistry';

export default function EndingExtras({ ctx }: { ctx: EndingCtx }) {
  const { basic, more } = useMemo(() => splitEndingCards(endingCards(), ctx), [ctx]);
  const [open, setOpen] = useState(false);
  if (!basic.length && !more.length) return null;
  return (
    <div className="ee-root">
      {basic.map((c) => (
        <section key={c.id} className="ee-card" data-card={c.id}>
          <c.Component ctx={ctx} />
        </section>
      ))}
      {more.length > 0 && (
        <div className="ee-more">
          <button type="button" className="ee-more-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? '접기 ▴' : `조금 더 ▾ (${more.length})`}
          </button>
          {open &&
            more.map((c) => (
              <section key={c.id} className="ee-card" data-card={c.id}>
                <c.Component ctx={ctx} />
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
