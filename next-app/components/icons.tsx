/**
 * Calm Premium 미니 아이콘 셋 — 버튼·라벨 속 3D 이모지(🔊📌✅ 등)를 대체하는
 * 라인 SVG. currentColor를 따르므로 어디에 넣어도 톤이 맞는다.
 */
const S = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function SpeakerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size} aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 6a9 9 0 0 1 0 12" />
    </svg>
  );
}

export function PinIcon({ size = 15 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size} aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 7 3 3H7l3-3-1-7z" />
    </svg>
  );
}

export function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size} aria-hidden="true">
      <path d="M6 4l14 8-14 8V4z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function StopIcon({ size = 14 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size} aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size} aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" stroke="none" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
    </svg>
  );
}

export function SendIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size} aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" fill="currentColor" stroke="none" opacity="0.9" />
    </svg>
  );
}
