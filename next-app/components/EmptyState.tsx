'use client';

/**
 * 빈 상태 일러스트 — "아직 데이터 없음"을 밋밋한 한 줄 대신 친근한 그림 + 안내로 보여준다.
 * 라인 SVG라 currentColor/토큰을 따라 라이트·다크에 자동 대응한다.
 */
type Art = 'phrasebook' | 'review' | 'inbox';

function Illustration({ art }: { art: Art }) {
  const common = {
    width: 96,
    height: 96,
    viewBox: '0 0 96 96',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (art === 'phrasebook') {
    return (
      <svg {...common}>
        <rect x="22" y="20" width="44" height="56" rx="6" />
        <path d="M44 20v26l8-6 8 6V20" opacity="0.55" />
        <path d="M30 58h20M30 66h14" opacity="0.5" />
      </svg>
    );
  }
  if (art === 'review') {
    return (
      <svg {...common}>
        <rect x="18" y="24" width="46" height="34" rx="6" />
        <rect x="30" y="36" width="46" height="34" rx="6" opacity="0.55" />
        <path d="M44 53l6 6 11-12" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M20 40 30 22h36l10 18v28a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6Z" />
      <path d="M20 40h16l4 8h16l4-8h16" opacity="0.6" />
    </svg>
  );
}

export default function EmptyState({
  art = 'inbox',
  title,
  children,
}: {
  art?: Art;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-art">
        <Illustration art={art} />
      </div>
      <div className="empty-title">{title}</div>
      {children && <div className="empty-desc">{children}</div>}
    </div>
  );
}
