'use client';

/** 진도 화면 — 전체/회차별 진행률, 퀴즈 성적, 스트릭, 진도 초기화. */
import { useState } from 'react';
import { EPISODES, TOTAL_SCENES, TOTAL_EXPRESSIONS } from '../data/curriculum';
import { useProgress, calcStreak, resetProgress } from '../lib/progress';

export default function ProgressScreen() {
  const progress = useProgress();
  const [confirming, setConfirming] = useState(false);

  const doneScenes = Object.keys(progress.completedScenes).length;
  const scenePct = Math.round((doneScenes / TOTAL_SCENES) * 100);
  const learned = Object.keys(progress.srs).length;
  const streak = calcStreak(progress.studyDays);

  const quizEntries = Object.values(progress.quiz);
  const quizRight = quizEntries.reduce((n, q) => n + q.right, 0);
  const quizTotal = quizEntries.reduce((n, q) => n + q.right + q.wrong, 0);
  const quizPct = quizTotal === 0 ? null : Math.round((quizRight / quizTotal) * 100);

  return (
    <div className="screen-enter">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <b style={{ fontSize: 15 }}>전체 학습 진행률</b>
          <span className="num" style={{ fontWeight: 800, color: 'var(--purple)' }}>
            {scenePct}%
          </span>
        </div>
        <div className="bar-track" style={{ marginTop: 10 }}>
          <div className="bar-fill" style={{ width: `${scenePct}%` }} />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {TOTAL_SCENES}개 장면 중 {doneScenes}개 완료 · 전체 표현 {TOTAL_EXPRESSIONS}개 중{' '}
          {learned}개 학습
        </p>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="num">{streak}</div>
          <div className="label">연속 학습일</div>
        </div>
        <div className="stat-card">
          <div className="num">{progress.studyDays.length}</div>
          <div className="label">총 학습일</div>
        </div>
        <div className="stat-card">
          <div className="num">{quizPct === null ? '–' : `${quizPct}%`}</div>
          <div className="label">퀴즈 정답률</div>
        </div>
      </div>

      <div className="section-title">회차별 진행</div>
      <div className="card">
        {EPISODES.map((ep) => {
          const done = ep.scenes.filter((s) => progress.completedScenes[s.id]).length;
          const pct = Math.round((done / ep.scenes.length) * 100);
          return (
            <div key={ep.id} className="episode-progress-row">
              <span className="code num">{ep.code}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="num" style={{ fontWeight: 700, width: 40, textAlign: 'right' }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="section-title">데이터</div>
      <div className="card">
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          모든 진도는 이 기기 브라우저(localStorage)에만 저장돼요. 서버로 전송되지 않아요.
        </p>
        {!confirming ? (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12, color: 'var(--red)' }}
            onClick={() => setConfirming(true)}
          >
            진도 전체 초기화…
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="btn btn-sm"
              style={{ background: 'var(--red)', color: '#fff' }}
              onClick={() => {
                resetProgress();
                setConfirming(false);
              }}
            >
              정말 초기화
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
