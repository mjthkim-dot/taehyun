'use client';

/**
 * 불꽃 히어로 — 홈 최상단의 리텐션 장치(스픽 벤치마크).
 *
 * 세 가지 상태를 한눈에 보여준다:
 *   꺼짐(회색) → 불씨(연습했지만 발화 목표 전, 깜빡임) → 점화(발화 목표 달성, 활활)
 * 그리고 이번 주 7칸 불꽃 달력 — "이번 주 구멍"이 보이는 것만으로 오늘 학습
 * 확률이 올라간다.
 *
 * 발화 수가 목표에 닿는 **그 순간** 점화 애니메이션과 함께 상태가 바뀌고,
 * 마일스톤(3·7·30일…)에 처음 닿은 날은 오버레이로 한 번 축하한다.
 * refreshKey로 미션·드릴에서의 발화가 즉시 반영된다.
 */
import { useEffect, useRef, useState } from 'react';
import { flameState, milestoneMessage, takeMilestoneCelebration, weekFlames, type FlameState, type WeekDay } from '../lib/streak';
import { getFreezeCount } from '../lib/habits';
import { haptic } from '../lib/haptics';
import { Confetti } from './Fx';

function Flame({ level, size = 64 }: { level: FlameState['level']; size?: number }) {
  // SVG 불꽃 — 이모지는 색·발광을 못 바꾼다. 상태별로 채움과 글로우가 달라진다.
  const palette =
    level === 'lit'
      ? { outer: 'url(#flame-g)', inner: '#ffd66b', glow: 'flame-glow' }
      : level === 'ember'
        ? { outer: 'url(#flame-e)', inner: 'var(--surface2)', glow: '' }
        : { outer: 'var(--surface2)', inner: 'var(--surface)', glow: '' };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={`flame ${level} ${palette.glow}`} aria-hidden="true">
      <defs>
        <linearGradient id="flame-g" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff8a3d" />
          <stop offset="60%" stopColor="#ff5f2e" />
          <stop offset="100%" stopColor="#ffb14d" />
        </linearGradient>
        {/* 불씨(ember) — 아직 타오르진 않았지만 바닥이 벌겋게 달아 있는 잉걸불 */}
        <linearGradient id="flame-e" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#e0641f" />
          <stop offset="55%" stopColor="#d98a26" />
          <stop offset="100%" stopColor="#f5b544" />
        </linearGradient>
      </defs>
      <path
        d="M24 4c1 7-3 10-6 14-3 4-5 8-4 13 1.5 7 7.5 11 10 11s8.5-4 10-11c1-5-1-9-4-13-3-4-7-7-6-14z"
        fill={palette.outer}
        stroke={level === 'off' ? 'var(--border-strong)' : 'none'}
        strokeWidth="1.5"
      />
      <path d="M24 24c.5 3.5-1.5 5-3 7-1.5 2-2.5 4-2 6.5.8 3.5 3.8 5.5 5 5.5s4.2-2 5-5.5c.5-2.5-.5-4.5-2-6.5-1.5-2-3.5-3.5-3-7z" fill={palette.inner} />
    </svg>
  );
}

export default function StreakFlame({ refreshKey = 0 }: { refreshKey?: number }) {
  const [st, setSt] = useState<FlameState | null>(null);
  const [week, setWeek] = useState<WeekDay[]>([]);
  const [freeze, setFreeze] = useState(0);
  const [ignited, setIgnited] = useState(false);
  const [milestone, setMilestone] = useState<number | null>(null);
  const prevLevel = useRef<FlameState['level'] | null>(null);

  useEffect(() => {
    const next = flameState();
    setSt(next);
    setWeek(weekFlames());
    setFreeze(getFreezeCount());
    // 발화 목표에 '지금' 닿은 순간만 점화 연출 — 이미 켜진 채 열면 조용히 켜져 있다
    if (prevLevel.current && prevLevel.current !== 'lit' && next.level === 'lit') {
      setIgnited(true);
      haptic('success');
      window.setTimeout(() => setIgnited(false), 1600);
    }
    prevLevel.current = next.level;
    const m = takeMilestoneCelebration();
    if (m) setMilestone(m);
  }, [refreshKey]);

  if (!st) return null;

  const statusLine =
    st.level === 'lit'
      ? st.nextMilestone
        ? `오늘 불꽃 완성! 다음 마일스톤까지 ${st.nextMilestone - st.streak}일`
        : '오늘 불꽃 완성!'
      : st.level === 'ember'
        ? `${st.goal - st.spoken}문장만 더 말하면 불이 붙어요`
        : st.streak > 0
          ? `오늘 ${st.goal}문장을 말하면 ${st.streak + 1}일째 불꽃이 이어져요`
          : `오늘 ${st.goal}문장을 말하고 첫 불꽃을 켜보세요`;

  return (
    <div className={`streak-hero${ignited ? ' ignite' : ''}`} data-level={st.level}>
      <div className="streak-main">
        <Flame level={st.level} />
        <div className="streak-info">
          <div className="streak-count">
            {st.streak}
            <span>일 연속</span>
          </div>
          <div className="streak-status">{statusLine}</div>
          {/* 발화 진행 — 불을 붙이는 연료가 무엇인지 명확하게 */}
          <div className="streak-fuel" role="progressbar" aria-valuenow={st.spoken} aria-valuemax={st.goal} aria-label="오늘 발화 진행">
            <div className="streak-fuel-fill" style={{ width: `${Math.min(100, (st.spoken / st.goal) * 100)}%` }} />
          </div>
          <div className="streak-fuel-label">
            오늘 발화 {st.spoken}/{st.goal}문장{freeze > 0 ? ` · ❄️ ${freeze}` : ''}
          </div>
        </div>
      </div>

      <div className="streak-week" aria-label="이번 주 불꽃">
        {week.map((d, i) => (
          <div className={`streak-day ${d.state}`} key={i}>
            <span className="streak-day-dot">
              {d.state === 'lit' && <Flame level="lit" size={16} />}
              {d.state === 'frozen' && '❄️'}
              {d.state === 'today' && <Flame level={st.level} size={16} />}
            </span>
            <span className="streak-day-label">{d.label}</span>
          </div>
        ))}
      </div>

      {milestone && (
        <div className="milestone-overlay" role="dialog" aria-label="스트릭 마일스톤">
          <div className="milestone-card">
            <div className="milestone-flame">
              <Confetti burstId={milestone} />
              <Flame level="lit" size={88} />
            </div>
            <div className="milestone-days">{milestone}일 연속</div>
            <div className="milestone-msg">{milestoneMessage(milestone)}</div>
            <button className="btn primary" onClick={() => setMilestone(null)}>
              계속하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
