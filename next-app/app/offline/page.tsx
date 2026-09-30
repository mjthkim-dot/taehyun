/**
 * 오프라인 폴백 페이지 (next-pwa fallbacks.document).
 * 네트워크가 없고 캐시도 없는 라우트 진입 시 표시된다.
 */
export default function OfflinePage() {
  return (
    <main style={{ maxWidth: 480, margin: '15vh auto', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h1>📡 오프라인 상태</h1>
      <p>인터넷 연결이 없고, 이 화면은 아직 기기에 받아 두지 못했어요. 학습 기록은 기기에 그대로 있으니 인터넷에 연결되면 다시 열어 주세요.</p>
      {/* basePath(/app)를 직접 적는다 — '/'는 같은 도메인의 옛 앱으로 간다 */}
      <a href="/app">← 앱 다시 열기</a>
    </main>
  );
}
