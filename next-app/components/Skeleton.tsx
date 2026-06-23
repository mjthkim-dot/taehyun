'use client';

/**
 * 스켈레톤 로딩 — 비동기 데이터가 도착하기 전, 빈 화면 대신 콘텐츠 골격을 셔머로
 * 보여줘 체감 대기시간을 줄인다. width/height 로 한 줄짜리 바를 만들거나,
 * SkeletonCard 로 카드 한 장 분량의 자리표시를 만든다.
 */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

/** 카드 한 장 분량의 자리표시(제목 + 본문 몇 줄). */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <Skeleton width="42%" height={16} style={{ marginBottom: 14 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height={12}
          style={{ marginBottom: 9 }}
        />
      ))}
    </div>
  );
}
