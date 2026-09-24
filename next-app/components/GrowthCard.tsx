'use client';

/** 원어민 표현 단계(성숙도) 카드 — CEFR 리포트 안에서 보조 지표로 보여준다. */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import { computeMaturity, type MaturityState } from '../lib/maturity';

export default function GrowthCard({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [mx, setMx] = useState<MaturityState | null>(null);
  useEffect(() => setMx(computeMaturity()), []);
  if (!mx) return null;
  const pct = Math.round(mx.progress * 100);
  return (
    <button type="button" className="growth-card" onClick={() => onNavigate('growth')}>
      <span className="growth-stage">{mx.stage.n}</span>
      <span className="growth-body">
        <span className="growth-name">
          성숙도 {mx.stage.n} · {mx.stage.name}
          <i className="growth-motto">“{mx.stage.motto}”</i>
        </span>
        <span className="growth-bar"><i style={{ width: `${pct}%` }} /></span>
      </span>
      <span className="growth-pct">{mx.stage.next ? `${pct}%` : 'MAX'}</span>
    </button>
  );
}
