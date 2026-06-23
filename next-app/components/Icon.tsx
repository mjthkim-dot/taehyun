'use client';

/**
 * 라인 SVG 아이콘 세트 — 하단 네비게이션처럼 "시스템 UI" 느낌이 중요한 곳에서
 * 이모지 대신 쓴다. stroke=currentColor 라 글자색을 따라가 라이트/다크·활성 상태에
 * 자동으로 맞춰지고, 플랫폼마다 다른 이모지 렌더링 편차도 없앤다.
 */
export type IconName = 'home' | 'lesson' | 'drill' | 'talk' | 'more';

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </>
  ),
  lesson: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5Z" />
    </>
  ),
  drill: (
    <>
      <path d="M17 3.5 21 7l-4 3.5" />
      <path d="M21 7H8a4 4 0 0 0-4 4v1" />
      <path d="M7 20.5 3 17l4-3.5" />
      <path d="M3 17h13a4 4 0 0 0 4-4v-1" />
    </>
  ),
  talk: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4Z" />
      <path d="M8.5 9h7M8.5 12h4" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
};

export default function Icon({
  name,
  size = 24,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
