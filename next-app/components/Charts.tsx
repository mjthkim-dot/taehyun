'use client';

/**
 * 진도/리포트용 경량 SVG 차트 모음 — 외부 차트 라이브러리 없이 토큰 색을 그대로 쓴다.
 * - CountUp: 숫자가 0에서 목표값까지 차오르는 애니메이션
 * - RadarChart: CAF(복잡도·정확도·유창성) 3축 삼각 레이더
 * - GaugeRing: GSE 위치를 도넛 게이지로
 * 모두 prefers-reduced-motion 을 존중한다.
 */
import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 0 → value 카운트업. suffix 예: '%' */
export function CountUp({
  value,
  suffix = '',
  duration = 900,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const [n, setN] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    if (prefersReducedMotion()) {
      setN(value);
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);
  return (
    <>
      {n}
      {suffix}
    </>
  );
}

/** CAF 3축 레이더(삼각형). 값은 0~100. */
export function RadarChart({
  values,
  size = 168,
}: {
  values: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  // 위 → 우하 → 좌하 (3축)
  const angles = [-90, 30, 150].map((d) => (d * Math.PI) / 180);

  const pt = (value: number, angle: number) => {
    const r = (radius * Math.max(0, Math.min(100, value))) / 100;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };
  const vertex = (angle: number, r = radius) => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;

  const dataPoly = values.map((v, i) => pt(v.value, angles[i]).join(',')).join(' ');
  const gridPoly = (scale: number) => angles.map((a) => vertex(a, radius * scale).join(',')).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="radar-svg">
      {/* 그리드 삼각형 */}
      {[0.33, 0.66, 1].map((s) => (
        <polygon key={s} points={gridPoly(s)} fill="none" stroke="var(--border)" strokeWidth={1} />
      ))}
      {/* 축선 */}
      {angles.map((a, i) => {
        const [x, y] = vertex(a);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth={1} />;
      })}
      {/* 데이터 면 */}
      <polygon
        points={dataPoly}
        fill="rgba(255,90,54,0.18)"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinejoin="round"
        className="radar-area"
      />
      {/* 꼭짓점 + 라벨 */}
      {values.map((v, i) => {
        const [px, py] = pt(v.value, angles[i]);
        const [lx, ly] = vertex(angles[i], radius + 16);
        return (
          <g key={v.label}>
            <circle cx={px} cy={py} r={3.5} fill={v.color} />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fontWeight="700"
              fill="var(--text-muted)"
            >
              {v.label} {v.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** GSE 위치 도넛 게이지. pct 0~100, 가운데에 children(보통 GSE 숫자). */
export function GaugeRing({
  pct,
  size = 116,
  stroke = 11,
  children,
  label,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const [draw, setDraw] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setDraw(clamped);
      return;
    }
    const id = requestAnimationFrame(() => setDraw(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div className="gauge-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - draw / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="gauge-center">
        <div className="gauge-val">{children}</div>
        {label && <div className="gauge-label">{label}</div>}
      </div>
    </div>
  );
}
