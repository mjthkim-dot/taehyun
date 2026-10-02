'use client';

/**
 * 엔딩 회상 카드(M3) — 화를 마친 자리에서 '한국어만 보고 말로 떠올리기' 3개(기본, order 20) + '조금 더 ▾' 안에 3개(order 40).
 *
 * 문항: 지금 기한이 된 드라마 표현(reviewItems, speak 모드) 중 엔딩 직전 재소환(M2)·첫머리 회상에서 이미 말한 문장은 뺀다.
 * 모자라면 이번 화의 오늘의 표현으로 채운다 — 이건 아직 기한 전이라 간격 반복에 매기지 않는 연습(noSrs)이다.
 * 엔딩이 뜨자마자 마이크가 열리면 놀란다 — '🎙 시작'을 눌러야 첫 문항이 자동 녹음된다(그다음부터는 바로).
 * 플래그 speakRecall off면 카드 자체가 없다(예전 엔딩 그대로).
 */
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { registerEndingCard, type EndingCtx } from '../endingRegistry';
import { reviewItems, normEn, whoOf, type RecallItem } from '../../../lib/drama';
import { isOn } from '../../../lib/flags';
import type { RecallResult } from '../RecallStep';

const RecallStep = dynamic(() => import('../RecallStep'), { ssr: false, loading: () => <div className="dr-act rc-loading">🎙 준비 중…</div> });

/** 기본 카드 문항 수 · '조금 더'에 붙는 수 */
export const RECALL_CARD_BASIC = 3;
export const RECALL_CARD_MORE = 3;

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** 엔딩 회상 문항(최대 6) — 같은 엔딩 안에서 두 카드가 같은 목록을 나눠 쓰게 화·날짜별로 한 번만 만든다 */
let memo: { key: string; items: (RecallItem & { noSrs?: boolean })[] } | null = null;
export function endingRecallItems(ctx: EndingCtx): (RecallItem & { noSrs?: boolean })[] {
  const skip = new Set([...strs(ctx.inlineEns), ...strs(ctx.recallEns)].map(normEn));
  const key = `${ctx.ep.no}|${ctx.dateKey}|${[...skip].join('/')}`;
  if (memo && memo.key === key) return memo.items;
  const total = RECALL_CARD_BASIC + RECALL_CARD_MORE;
  const due = reviewItems(total + skip.size, { mode: 'speak' }).filter((r) => !skip.has(normEn(r.en)));
  const out: (RecallItem & { noSrs?: boolean })[] = due.slice(0, total);
  // 모자라면 이번 화 오늘의 표현(기한 전 — 연습만, 간격 반복엔 매기지 않는다)
  for (const l of ctx.ep.learn) {
    if (out.length >= total) break;
    if (skip.has(normEn(l.en)) || out.some((x) => normEn(x.en) === normEn(l.en))) continue;
    out.push({ en: l.en, kr: l.kr, opts: [], a: 0, mode: 'speak', who: whoOf(l.en), noSrs: true });
  }
  memo = { key, items: out };
  return out;
}

function RecallSet({ items, title }: { items: (RecallItem & { noSrs?: boolean })[]; title: string }) {
  const [started, setStarted] = useState(false);
  const [k, setK] = useState(0);
  const [res, setRes] = useState<RecallResult[]>([]);
  const done = k >= items.length;
  const ok = res.filter((r) => r.good).length;
  return (
    <div className="rc-card">
      <div className="ee-title rc-card-title">
        🧠 {title} <span className="rc-card-n">{Math.min(k, items.length)}/{items.length}</span>
      </div>
      {!started ? (
        <>
          <p className="muted rc-card-desc">한국어만 보고 바로 영어로 말해요 — 카운트다운 없이 곧장 마이크가 열려요.</p>
          <button type="button" className="btn primary rc-card-start" onClick={() => setStarted(true)}>
            🎙 시작
          </button>
        </>
      ) : done ? (
        <p className="rc-card-sum" role="status">
          {items.length}개 중 {ok}개 떠올렸어요{ok === items.length ? ' 👏' : ' — 못 떠올린 건 내일 다시 물어볼게요'}
        </p>
      ) : (
        <RecallStep
          key={k}
          item={items[k]}
          review
          noSrs={!!items[k].noSrs}
          onDone={(r) => {
            setRes((x) => [...x, r]);
            setK((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function RecallCardBasic({ ctx }: { ctx: EndingCtx }) {
  const items = useMemo(() => endingRecallItems(ctx).slice(0, RECALL_CARD_BASIC), [ctx]);
  return <RecallSet items={items} title="말로 떠올리기" />;
}

function RecallCardMore({ ctx }: { ctx: EndingCtx }) {
  const items = useMemo(() => endingRecallItems(ctx).slice(RECALL_CARD_BASIC, RECALL_CARD_BASIC + RECALL_CARD_MORE), [ctx]);
  return <RecallSet items={items} title="말로 떠올리기 +3" />;
}

const on = () => {
  try {
    return isOn('speakRecall');
  } catch {
    return false;
  }
};

export const RECALL_CARD = registerEndingCard({
  id: 'recall',
  order: 20,
  basic: true,
  when: (ctx) => on() && endingRecallItems(ctx).length > 0,
  Component: RecallCardBasic,
});

export const RECALL_CARD_MORE_CARD = registerEndingCard({
  id: 'recall-more',
  order: 40,
  basic: false,
  when: (ctx) => on() && endingRecallItems(ctx).length > RECALL_CARD_BASIC,
  Component: RecallCardMore,
});
