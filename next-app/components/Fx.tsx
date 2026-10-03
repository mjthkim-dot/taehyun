'use client';

/**
 * 이펙트 키트 — 스픽 벤치마크의 '정답 순간' 연출.
 *
 * 스픽이 발화를 많이 시키는 비결은 문장 하나를 통과할 때마다 몸으로 느껴지는
 * 보상을 주는 것이다: 컨페티가 터지고, 점수가 굴러 올라가고, 연속 정답이
 * 콤보로 쌓인다. 개별 효과는 사소하지만 합쳐지면 "한 문장만 더"를 만든다.
 *
 * 원칙:
 *   · 이펙트는 **통과의 순간**에만 — 항상 움직이는 화면은 아무것도 강조하지 못한다
 *   · 실패에는 이펙트를 쓰지 않는다(기존 score-shake로 충분) — 벌은 조용히
 *   · prefers-reduced-motion이면 전부 정지 화면으로 대체
 *   · 라이브러리 없이 DOM 파티클 + CSS만 — 번들 비용 0에 가깝게
 */
import { useEffect, useRef, useState } from 'react';

/* ── 점수 카운트업 ──
 * 0 → score로 굴러 올라가는 숫자. 결과가 '주어지는' 게 아니라 '쌓이는' 느낌을 준다. */
export function useCountUp(target: number, ms = 550): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = 0; // 다음 문장은 다시 0부터
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/* ── 컨페티 ──
 * burstId가 바뀔 때마다 한 번 터진다. 파티클 방향·색은 인덱스로 결정해
 * (Math.random 없이) 렌더마다 동일 — 테스트와 리플레이가 안정적이다. */
const CONFETTI_COLORS = ['#ff8a3d', '#ffd66b', '#2fe3a4', '#6cb2ff', '#ff6b70', '#d9a7ff'];
const PIECES = 16;

export function Confetti({ burstId }: { burstId: number }) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!burstId) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setLive(true);
    const t = window.setTimeout(() => setLive(false), 1100);
    return () => window.clearTimeout(t);
  }, [burstId]);

  if (!live) return null;
  return (
    <div className="fx-confetti" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => {
        const angle = (i / PIECES) * 2 * Math.PI;
        const dist = 60 + (i % 4) * 22;
        const style = {
          '--fx-x': `${Math.cos(angle) * dist}px`,
          '--fx-y': `${Math.sin(angle) * dist - 40}px`,
          '--fx-r': `${(i * 97) % 360}deg`,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animationDelay: `${(i % 5) * 30}ms`,
        } as React.CSSProperties;
        return <span key={`${burstId}-${i}`} className={`fx-piece${i % 3 === 0 ? ' round' : ''}`} style={style} />;
      })}
    </div>
  );
}

/* ── 플로팅 획득 표시 ──
 * "+1 문장" 같은 짧은 텍스트가 떠올랐다 사라진다. id가 바뀔 때마다 한 번. */
export function FloatUp({ id, text }: { id: number; text: string }) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!id) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setLive(true);
    const t = window.setTimeout(() => setLive(false), 1000);
    return () => window.clearTimeout(t);
  }, [id]);
  if (!live) return null;
  return (
    <span className="fx-float" key={id} aria-hidden="true">
      {text}
    </span>
  );
}

/* ── 콤보 배지 ──
 * 연속 통과 수. 2연속부터 보이고, 커질수록 뜨거워진다(색·크기). 끊기면 조용히 사라진다 —
 * "콤보가 끊겼다"는 연출은 벌이라 하지 않는다. */
export function ComboBadge({ combo }: { combo: number }) {
  if (combo < 2) return null;
  const tier = combo >= 5 ? 'hot' : combo >= 3 ? 'warm' : '';
  return (
    <span className={`fx-combo ${tier}`} key={combo}>
      {combo}연속 {combo >= 5 ? '🔥' : ''}
    </span>
  );
}
