/**
 * 오프라인 폴백 페이지 (next-pwa fallbacks.document).
 * 네트워크가 없고 캐시도 없는 라우트 진입 시 표시된다.
 */
export default function OfflinePage() {
  return (
    <main style={{ maxWidth: 480, margin: '15vh auto', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h1>📡 오프라인 상태</h1>
      <p>인터넷 연결이 없습니다. 이전에 학습한 문장 세트는 홈에서 계속 복습할 수 있어요.</p>
      <a href="/">← 학습 화면으로</a>
    </main>
  );
}
