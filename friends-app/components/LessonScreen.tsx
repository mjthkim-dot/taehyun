'use client';

/**
 * 에피소드 학습 화면 — 장면(상황) 단위로 진행한다.
 * 흐름: 상황 브리핑 → 표현 카드 → 대화 롤플레이 → 장면 완료 체크.
 */
import { useState } from 'react';
import { findEpisode } from '../data/curriculum';
import { useProgress, completeScene } from '../lib/progress';
import ExpressionCard from './ExpressionCard';
import DialoguePractice from './DialoguePractice';
import PatternDrill from './PatternDrill';
import DictationCard from './DictationCard';
import { CheckIcon } from './Icon';

export default function LessonScreen({
  episodeId,
  onBack,
  onQuiz,
}: {
  episodeId: string;
  onBack: () => void;
  onQuiz: (episodeId: string) => void;
}) {
  const episode = findEpisode(episodeId);
  const progress = useProgress();
  const [sceneIdx, setSceneIdx] = useState(() => {
    // 진입 시 아직 완료하지 않은 첫 장면으로 — 이어 학습 경험.
    const idx = episode?.scenes.findIndex((s) => !progress.completedScenes[s.id]) ?? 0;
    return idx < 0 ? 0 : idx;
  });

  if (!episode) {
    return (
      <div className="empty-state">
        <div className="emoji">🛋️</div>
        <p>에피소드를 찾을 수 없어요.</p>
        <button className="btn btn-soft" onClick={onBack}>
          목록으로
        </button>
      </div>
    );
  }

  const scene = episode.scenes[sceneIdx];
  const sceneDone = Boolean(progress.completedScenes[scene.id]);
  const allDone = episode.scenes.every((s) => progress.completedScenes[s.id]);
  const lastScene = sceneIdx === episode.scenes.length - 1;

  function markDone() {
    completeScene(
      scene.id,
      scene.expressions.map((e) => e.id),
    );
  }

  return (
    <div className="screen-enter">
      <div className="lesson-header">
        <button className="back-btn" onClick={onBack} aria-label="에피소드 목록으로">
          ←
        </button>
        <div>
          <div className="code">
            {episode.code} · {episode.titleKr}
          </div>
          <h2>{episode.titleEn}</h2>
        </div>
      </div>

      <div className="scene-tabs">
        {episode.scenes.map((s, i) => (
          <button
            key={s.id}
            className={`chip${i === sceneIdx ? ' active' : ''}`}
            onClick={() => setSceneIdx(i)}
          >
            {progress.completedScenes[s.id] ? '✓ ' : ''}장면 {i + 1}
          </button>
        ))}
      </div>

      <div className="scene-context">
        <div className="location">📍 {scene.location}</div>
        <b>{scene.titleKr}</b>
        <br />
        {scene.contextKr}
        <a
          className="btn btn-ghost btn-sm video-link"
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(scene.videoQuery)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          🎬 유튜브에서 원장면 보기
        </a>
      </div>

      <div className="section-title">핵심 표현 {scene.expressions.length}개</div>
      {scene.expressions.map((e) => (
        <ExpressionCard key={e.id} expression={e} />
      ))}

      <div className="section-title">상황 대화 연습</div>
      <DialoguePractice
        // key로 장면 전환 시 롤플레이 상태(점수·배역)를 리셋한다.
        key={scene.id}
        dialogue={scene.dialogue}
      />

      <div className="section-title">스피킹 드릴 — 상황만 보고 말하기</div>
      <PatternDrill key={`drill-${scene.id}`} drills={scene.drills} />

      <div className="section-title">딕테이션 — 듣고 받아쓰기</div>
      <DictationCard key={`dict-${scene.id}`} dialogue={scene.dialogue} />

      <div className="lesson-cta">
        {!sceneDone ? (
          <button className="btn btn-primary btn-block" onClick={markDone}>
            <CheckIcon />
            장면 학습 완료
          </button>
        ) : !lastScene ? (
          <button className="btn btn-primary btn-block" onClick={() => setSceneIdx(sceneIdx + 1)}>
            다음 장면으로 →
          </button>
        ) : (
          <>
            <div
              style={{
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--green)',
              }}
            >
              🎉 {allDone ? '이 에피소드를 모두 마쳤어요!' : '이 장면을 완료했어요!'}
            </div>
            <button className="btn btn-primary btn-block" onClick={() => onQuiz(episode.id)}>
              이 회차 퀴즈로 마무리하기
            </button>
            <button className="btn btn-ghost btn-block" onClick={onBack}>
              에피소드 목록으로
            </button>
          </>
        )}
      </div>
    </div>
  );
}
