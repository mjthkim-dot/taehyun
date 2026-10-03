'use client';

/**
 * 홈의 '오늘의 문법' 카드 + 업데이트 안내.
 * 문법 시뮬레이션이 레슨 안(2단계)이나 더보기 속에만 있으면 홈에선 "달라진 게 없어" 보인다
 * (실제 피드백). 홈에서 바로 보이고 한 번에 들어가게 한다.
 */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import { pickTodayGrammar, grammarProgress, type GrammarUnit } from '../lib/grammar';
import { overall } from '../lib/cefrGrowth';
import { setUnitHandoff } from '../lib/ontology/handoff';

export default function GrammarTodayCard({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [u, setU] = useState<GrammarUnit | null>(null);
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => {
    const unit = pickTodayGrammar(overall().level);
    setU(unit);
    setBest(grammarProgress()[unit.id]?.best ?? null);
  }, []);
  if (!u) return <div className="study-card gm-today" style={{ minHeight: 150 }} aria-hidden="true" />;
  return (
    <section className="study-card gm-today" aria-label="오늘의 문법">
      <div className="pg-kicker">
        오늘의 문법 · {u.level} · {u.point}
      </div>
      <h3 className="gm-today-title">{u.title}</h3>
      <p className="muted gm-today-scene">{u.scene}</p>
      <div className="gm-today-steps">이해 → 고르기 → 만들기 → 실전 대화 · 약 8분{best !== null ? ` · 최고 ${best}점` : ''}</div>
      <button
        type="button"
        className="btn gm-today-go"
        onClick={() => {
          setUnitHandoff({ source: 'grammar', key: u.id });
          onNavigate('grammar');
        }}
      >
        문법 시뮬레이션 시작
      </button>
    </section>
  );
}

