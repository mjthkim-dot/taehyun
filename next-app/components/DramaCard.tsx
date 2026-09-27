'use client';

/** 홈의 '오늘의 에피소드' — 드라마 레슨으로 들어가는 단 하나의 버튼 */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import { castOf, episodeByNo, nextEpisodeNo, requestDramaAutoplay, SERIES, watchedToday, type Episode } from '../lib/drama';

export default function DramaCard({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [st, setSt] = useState<{ no: number; ep?: Episode; prev?: Episode; today: boolean } | null>(null);
  useEffect(() => {
    const no = nextEpisodeNo();
    setSt({ no, ep: episodeByNo(no), prev: episodeByNo(no - 1), today: watchedToday() });
  }, []);
  if (!st) return <div className="study-card dr-card" style={{ minHeight: 200 }} aria-hidden="true" />;
  const go = () => {
    requestDramaAutoplay();
    onNavigate('drama');
  };
  const faces = ['taeo', 'maya', 'jun', 'diane', 'grant'].map((id) => castOf(id).icon);
  return (
    <section className="study-card dr-card" data-tilt aria-label="오늘의 에피소드">
      <div className="dr-card-faces" aria-hidden="true">
        {faces.map((f, i) => (
          <span key={i}>{f}</span>
        ))}
      </div>
      <div className="pg-kicker">
        {st.today ? '오늘 에피소드 완료 ✓' : '오늘의 에피소드'} · {SERIES}
      </div>
      <h2 className="dr-card-title">
        EP {st.no} {st.ep ? `· ${st.ep.titleKr}` : '· 새 이야기'}
      </h2>
      <p className="dr-card-hook">{st.prev ? `지난 이야기: ${st.prev.cliff}` : '서울의 글로벌 스타트업에 첫 출근하는 태오. 그런데 엘리베이터가 멈췄다.'}</p>
      <button type="button" className="btn primary dr-go" onClick={go}>
        {st.today ? `EP ${st.no} 미리 보기` : `EP ${st.no} 보기 · 약 5분`}
      </button>
    </section>
  );
}
