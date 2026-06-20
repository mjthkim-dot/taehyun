'use client';

/** 아직 React로 이전되지 않은 탭을 위한 안내 플레이스홀더 */
export default function ComingSoon({ label }: { label: string }) {
  return (
    <div className="study-card coming-soon">
      <h3>🚧 {label} — 마이그레이션 진행 중</h3>
      <p className="muted">
        이 탭은 아직 React 버전으로 옮기지 않았습니다. 기존 기능은{' '}
        <a href="/voice-assistant/index.html">기존 앱</a>에서 계속 사용할 수 있어요.
      </p>
    </div>
  );
}
