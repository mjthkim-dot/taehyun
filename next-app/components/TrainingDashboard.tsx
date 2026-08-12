'use client';

/**
 * 훈련 대시보드 — 시도 로그(Phase 1)가 있어야 비로소 가능해진 화면.
 * 보여주는 것: ① 정확도 추이(14일) ② 입 트임 속도(발화 개시 지연 중앙값) 추이
 * ③ 약점 통합(발음 축 + 회화 교정) ④ 실전 사용.
 *
 * 원칙: 개시 지연은 절대 기준 없이 본인 추이만(기기 편차). 데이터가 없으면
 * 채근하지 않고 "쌓이면 보인다"고 안내한다.
 */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import { attemptStats, type DayStat } from '../lib/reviewEngine';
import { getMistakes, mistakesForDrill, patternUseTotal } from '../lib/transfer';
import { getPronLapses, setDrillQueue } from '../lib/state';
import { LAPSE_TIPS } from '../lib/pronunciation';

/** 미니 막대 차트 — 0~100 점수용. 마지막 막대(오늘)를 강조한다. */
function ScoreBars({ stats }: { stats: DayStat[] }) {
  const W = 320;
  const H = 72;
  const TOP = 14; // 점수 라벨이 카드 위로 잘리지 않게 위쪽 여백을 둔다
  const n = stats.length;
  const bw = Math.min(26, Math.max(10, Math.floor(W / Math.max(1, n)) - 6));
  return (
    <svg viewBox={`0 0 ${W} ${TOP + H + 16}`} className="dash-chart" role="img" aria-label="일별 평균 정확도">
      {stats.map((s, i) => {
        const x = (W / n) * i + (W / n - bw) / 2;
        const h = Math.max(3, (s.avgScore / 100) * H);
        const last = i === n - 1;
        return (
          <g key={s.date}>
            <rect x={x} y={TOP + H - h} width={bw} height={h} rx="4" fill={last ? 'var(--primary)' : 'var(--surface2)'} stroke={last ? 'none' : 'var(--border-strong)'} strokeWidth="1" />
            <text x={x + bw / 2} y={TOP + H - h - 4} textAnchor="middle" fontSize="9" fontWeight="700" fill={last ? 'var(--primary-dk)' : 'var(--text-muted)'}>{s.avgScore}</text>
            <text x={x + bw / 2} y={TOP + H + 12} textAnchor="middle" fontSize="8" fill="var(--text-muted)">{s.date.slice(5).replace('-', '/')}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** 미니 라인 차트 — 개시 지연(초). 낮을수록 좋으므로 아래로 갈수록 좋아진 것. */
function LatencyLine({ stats }: { stats: DayStat[] }) {
  const pts = stats.filter((s) => s.medianLatency != null);
  if (pts.length < 2) return null;
  const W = 320;
  const H = 64;
  const max = Math.max(...pts.map((p) => p.medianLatency!), 1500);
  // 표준 축: 지연(값)이 클수록 위 — 그래서 자동화될수록(지연이 줄수록) 선이 내려온다
  const xy = pts.map((p, i) => [
    (W / Math.max(1, pts.length - 1)) * i,
    6 + (1 - p.medianLatency! / max) * H * 0.85,
  ]);
  const path = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="dash-chart" role="img" aria-label="발화 개시 지연 추이">
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {xy.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === xy.length - 1 ? 4 : 2.5} fill={i === xy.length - 1 ? 'var(--primary)' : 'var(--border-strong)'} />
      ))}
      <text x={W} y={12} textAnchor="end" fontSize="10" fontWeight="800" fill="var(--primary-dk)">
        오늘 {(last.medianLatency! / 1000).toFixed(1)}초
      </text>
    </svg>
  );
}

export default function TrainingDashboard({ onNavigate, variant = 'hero' }: { onNavigate: (m: Mode) => void; variant?: 'hero' | 'cards' }) {
  const [stats, setStats] = useState<DayStat[] | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [used, setUsed] = useState(0);
  const [axes, setAxes] = useState<{ key: string; label: string; count: number }[]>([]);

  useEffect(() => {
    setStats(attemptStats(14));
    setMistakes(getMistakes().length);
    setUsed(patternUseTotal());
    // 발음 축 상위 3 — 최근 14일
    const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const agg = new Map<string, number>();
    for (const r of getPronLapses()) {
      if (r.date < since) continue;
      agg.set(r.key, (agg.get(r.key) || 0) + r.count);
    }
    setAxes(
      [...agg.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key, count]) => ({ key, label: (LAPSE_TIPS as Record<string, { label: string }>)[key]?.label || key, count }))
    );
  }, []);

  if (!stats) return null;

  const today = stats[stats.length - 1];
  const avg = stats.length ? Math.round(stats.reduce((s, d) => s + d.avgScore * d.count, 0) / Math.max(1, stats.reduce((s, d) => s + d.count, 0))) : 0;
  const totalAttempts = stats.reduce((s, d) => s + d.count, 0);
  const hasLatency = stats.some((s) => s.medianLatency != null);

  return (
    <div className={`dash dash-v-${variant}`}>
      {variant === 'hero' && totalAttempts > 0 && (
        <div className="dash-hero">
          <div className="dash-hero-item">
            <b>{totalAttempts}</b>
            <span>2주간 발화</span>
          </div>
          <div className="dash-hero-item">
            <b>{avg}<i>점</i></b>
            <span>평균 정확도</span>
          </div>
          <div className="dash-hero-item">
            <b>{today?.medianLatency != null ? `${(today.medianLatency / 1000).toFixed(1)}` : '–'}<i>{today?.medianLatency != null ? '초' : ''}</i></b>
            <span>오늘 입 트임</span>
          </div>
        </div>
      )}

      {totalAttempts === 0 ? (
        <div className="study-card">
          <h3>📈 훈련 추이</h3>
          <p className="muted" style={{ fontSize: '0.82rem', lineHeight: 1.65 }}>
            아직 기록이 없어요 — 오늘 세션과 드릴에서 말하기 시작하면, 정확도와 입 트임 속도가 날짜별로 여기 쌓입니다.
          </p>
        </div>
      ) : (
        <>
          <div className="study-card">
            <h3>📈 정확도 추이 <span className="dash-sub">일별 평균 · 최근 14일</span></h3>
            <ScoreBars stats={stats.slice(-7)} />
          </div>
          {hasLatency && (
            <div className="study-card">
              <h3>⚡ 입 트임 속도 <span className="dash-sub">말하기까지 걸린 시간 · 낮을수록 자동화</span></h3>
              <LatencyLine stats={stats} />
              <p className="muted" style={{ fontSize: '0.72rem', marginTop: 4 }}>기기·환경에 따라 다르므로 남과 비교하지 말고 내 추이만 보세요.</p>
            </div>
          )}
        </>
      )}

      {(axes.length > 0 || mistakes >= 2 || used > 0) && (
        <div className="study-card">
          <h3>🎯 약점과 실전</h3>
          {axes.length > 0 && (
            <div className="dash-axes">
              {axes.map((a) => (
                <span className="dash-axis" key={a.key}>{a.label} ×{a.count}</span>
              ))}
            </div>
          )}
          {used > 0 && <p className="dash-used">✨ 배운 패턴 실전 사용 <b>{used}회</b> — 대화에서 감지된 횟수예요.</p>}
          {mistakes >= 2 && (
            <button
              type="button"
              className="mx-practice-btn"
              style={{ marginTop: 8 }}
              onClick={() => {
                setDrillQueue({ label: '자주 틀리는 문장', items: mistakesForDrill() });
                onNavigate('drill');
              }}
            >
              🔁 회화에서 틀린 문장 {mistakes}개 — 드릴로 →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
