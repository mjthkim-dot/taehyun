'use client';

import { episodesBySeason } from '../data/curriculum';
import { useProgress } from '../lib/progress';

export default function EpisodesScreen({ onOpen }: { onOpen: (episodeId: string) => void }) {
  const progress = useProgress();
  const seasons = [...episodesBySeason().entries()];

  return (
    <div className="screen-enter">
      {seasons.map(([season, episodes]) => (
        <div key={season}>
          <div className="season-label">SEASON {season}</div>
          {episodes.map((ep) => {
            const done = ep.scenes.filter((s) => progress.completedScenes[s.id]).length;
            const allDone = done === ep.scenes.length;
            return (
              <button key={ep.id} className="episode-card" onClick={() => onOpen(ep.id)}>
                <div className={`episode-badge${allDone ? ' done' : ''}`}>
                  {allDone ? '✓' : ep.code.slice(3)}
                </div>
                <div>
                  <div className="title-en">{ep.titleEn}</div>
                  <div className="title-kr">
                    {ep.code} · {ep.titleKr}
                  </div>
                  <span className="theme">{ep.theme}</span>
                </div>
                <div className="progress-dots" aria-label={`${done}/${ep.scenes.length} 장면 완료`}>
                  {ep.scenes.map((s) => (
                    <i
                      key={s.id}
                      className={`progress-dot${progress.completedScenes[s.id] ? ' done' : ''}`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
