'use client';

/**
 * 포인터 3D 틸트 — 마우스를 올리면 카드가 커서 쪽으로 살짝 기운다(최대 5°).
 *
 * 이벤트 위임 하나로 [data-tilt] 요소 전부를 처리한다(요소마다 리스너를 달지 않는다).
 * 터치 기기에서는 스크롤 제스처와 싸우지 않도록 끄고(:active 키 트래블이 대신한다),
 * prefers-reduced-motion이면 아예 붙지 않는다. 값은 CSS 변수(--rx/--ry)로만 넘겨
 * 레이아웃을 건드리지 않는다(합성 레이어만 움직인다).
 */
import { useEffect } from 'react';

const MAX_DEG = 5;

export default function DepthFX() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;
    let active: HTMLElement | null = null;
    let raf = 0;
    const reset = (el: HTMLElement) => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.classList.remove('tilting');
    };
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-tilt]') as HTMLElement | null;
      if (active && active !== el) reset(active);
      active = el;
      if (!el) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.classList.add('tilting');
        el.style.setProperty('--ry', `${(x * MAX_DEG * 2).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * MAX_DEG * 2).toFixed(2)}deg`);
      });
    };
    const onLeave = () => {
      if (active) reset(active);
      active = null;
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }, []);
  return null;
}
