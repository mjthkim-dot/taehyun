'use client';

/** 진도 화면의 '드라마로 배운 것' — 본 화 수와 지금까지 배운 표현(눌러서 듣기) */
import { useMemo } from 'react';
import { allEpisodes, watched } from '../lib/drama';
import { load } from '../lib/state';
import { speakText, stopSpeaking } from './SpeakButton';

export default function DramaProgress() {
  const data = useMemo(() => {
    const seen = new Set(watched());
    const eps = allEpisodes().filter((e) => seen.has(e.no));
    const weak = load<{ en: string; box?: number }[]>('va_weak', []);
    const box = new Map(weak.map((w) => [w.en, w.box ?? 0]));
    const learned = eps.flatMap((e) => e.learn.map((l) => ({ ...l, no: e.no, box: box.get(l.en) ?? 0 })));
    return { count: eps.length, learned };
  }, []);
  if (!data.count) return null;
  return (
    <div className="study-card dp-card">
      <div className="pg-kicker">드라마로 배운 것</div>
      <div className="dp-head">
        <b>{data.count}화</b> 시청 · 표현 <b>{data.learned.length}개</b>
      </div>
      <ul className="dp-list">
        {data.learned.map((l, k) => (
          <li key={k}>
            <button
              type="button"
              className="dp-item"
              onClick={() => {
                stopSpeaking();
                speakText(l.en, 'en-US', 0.95);
              }}
            >
              <span className="dp-en">🔊 {l.en}</span>
              <span className="dp-kr">
                {l.kr} · EP {l.no}
                {l.box >= 3 ? ' · 기억 ✓' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
