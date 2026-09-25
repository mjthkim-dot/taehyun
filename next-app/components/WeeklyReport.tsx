'use client';

/**
 * 주간 리포트 카드 — 진도 화면 맨 위에 놓아 "이번 주 나"를 먼저 보여준다.
 * 숫자만 나열하지 않고 총평 한 줄 + 다음 행동(복습·이어갈 유닛)까지 연결한다.
 */
import { useEffect, useState } from 'react';
import { buildWeeklyReport, type WeeklyReport as Report } from '../lib/weeklyReport';
import type { Mode } from './NavBar';
import dynamic from 'next/dynamic';

/** 발음 훈련(최소대립쌍 49쌍)은 진단이 뜬 뒤에야 필요하다 — 첫 진입 번들에서 뺀다.
 *  dynamic()의 옵션은 인라인 리터럴이어야 한다(변수로 빼면 Next가 빌드에서 거부). */
const PronDrillCard = dynamic(() => import('./PronDrillCard'), { ssr: false });

export default function WeeklyReport({ onNavigate, onSelectLesson }: { onNavigate?: (m: Mode) => void; onSelectLesson?: (id: number) => void }) {
  const [r, setR] = useState<Report | null>(null);
  useEffect(() => setR(buildWeeklyReport()), []);
  if (!r) return null;

  const max = Math.max(1, ...r.daily.map((d) => d.count));
  const cafUp = r.caf.now != null && r.caf.before != null && r.caf.now > r.caf.before;
  const cafDown = r.caf.now != null && r.caf.before != null && r.caf.now < r.caf.before;

  return (
    <div className="study-card wr">
      <h3>이번 주 리포트</h3>
      <div className="wr-headline">{r.headline}</div>

      <div className="wr-stats">
        <div className="wr-stat">
          <b>{r.spoken}</b>
          <span>말한 문장</span>
          {r.spokenDelta !== 0 && (
            <i className={r.spokenDelta > 0 ? 'up' : 'down'}>
              {r.spokenDelta > 0 ? '▲' : '▼'} {Math.abs(r.spokenDelta)}
            </i>
          )}
        </div>
        <div className="wr-stat">
          <b>{r.activeDays}</b>
          <span>학습일 / 7</span>
        </div>
        <div className="wr-stat">
          <b>{r.xp}</b>
          <span>획득 XP</span>
        </div>
      </div>

      <div className="wr-bars" aria-label="요일별 말한 문장 수">
        {r.daily.map((d, i) => (
          <div className={`wr-bar${d.today ? ' today' : ''}`} key={i} title={`${d.label} ${d.count}문장`}>
            <i style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }} />
            <span>{d.label}</span>
          </div>
        ))}
      </div>

      {r.caf.sessions > 0 && (
        <div className="wr-row">
          <span className="wr-row-label">말하기 지표(CAF)</span>
          <span className="wr-row-value">
            {r.caf.now ?? '—'}
            {r.caf.before != null && (
              <i className={cafUp ? 'up' : cafDown ? 'down' : ''}>
                {cafUp ? ' ▲' : cafDown ? ' ▼' : ' –'} 이전 {r.caf.before}
              </i>
            )}
          </span>
        </div>
      )}

      {r.weakTop.length > 0 && (
        <div className="wr-block">
          <div className="wr-block-title">이번 주 가장 자주 틀린 표현</div>
          {r.weakTop.map((w) => (
            <div className="wr-weak" key={w.en}>
              <div className="wr-weak-en">{w.en}</div>
              <div className="wr-weak-meta">
                {w.kr && <span>{w.kr}</span>}
                <b>{w.lapses}회 실패</b>
              </div>
            </div>
          ))}
          {onNavigate && (
            <button className="btn ghost-accent wr-cta" onClick={() => onNavigate('review')}>
              {r.dueCount > 0 ? `복습 ${r.dueCount}개 지금 하기 →` : '복습하러 가기 →'}
            </button>
          )}
        </div>
      )}

      {r.pronTop.length > 0 && (
        <div className="wr-block">
          <div className="wr-block-title">이번 주 반복된 발음</div>
          {r.pronTop.map((p) => (
            <div className="wr-pron" key={p.key}>
              <div className="wr-pron-top">
                <span className="pron-chip">{p.label}</span>
                <b>{p.count}회</b>
              </div>
              <div className="pron-tip">{p.tip}</div>
              <PronDrillCard lapseKey={p.key} label={p.label} onNavigate={onNavigate} />
            </div>
          ))}
        </div>
      )}

      {r.nextUnits.length > 0 && (
        <div className="wr-block">
          <div className="wr-block-title">다음에 이어갈 유닛</div>
          {r.nextUnits.map((u) => (
            <button
              className="wr-next"
              key={u.lessonId}
              onClick={() => {
                onSelectLesson?.(u.lessonId);
                onNavigate?.('study');
              }}
            >
              <span className="wr-next-title">{u.title}</span>
              <span className="wr-next-sub">{u.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
