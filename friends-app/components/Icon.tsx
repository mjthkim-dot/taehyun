/** 인라인 SVG 아이콘 세트 — 외부 아이콘 폰트 없이 스트로크 아이콘만 쓴다. */
interface IconProps {
  size?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function HomeIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

export function TvIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="m8 2 4 4 4-4" />
    </svg>
  );
}

export function QuizIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.3a2.5 2.5 0 1 1 3.4 2.33c-.7.27-.9.87-.9 1.37v.5" />
      <circle cx="12" cy="17" r="0.3" fill="currentColor" />
    </svg>
  );
}

export function CardsIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="7" y="3" width="14" height="18" rx="2" />
      <path d="M3 7v12a2 2 0 0 0 2 2h10" />
    </svg>
  );
}

export function ChartIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-8" />
      <path d="M22 20H2" />
    </svg>
  );
}

export function PlayIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="m7 4 13 8-13 8Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SpeakerIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
    </svg>
  );
}

export function MicIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
    </svg>
  );
}

export function BookmarkIcon({ size = 18, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M6 3h12v18l-6-4-6 4Z" fill={filled ? 'currentColor' : 'none'} />
    </svg>
  );
}

export function CheckIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

export function CoffeeIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" />
      <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M8 3.5c0 1 .8 1 .8 2M12 3.5c0 1 .8 1 .8 2" />
    </svg>
  );
}
