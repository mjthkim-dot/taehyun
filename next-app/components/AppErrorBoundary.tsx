'use client';

/**
 * 화면 오류 방어막 — 한 화면의 렌더 오류가 앱 전체를 백지로 만들지 않게 한다.
 *
 * 지금까지는 어느 컴포넌트든 렌더 중 예외가 나면 React가 트리 전체를 언마운트해
 * 흰 화면만 남았다. 학습 데이터는 기기에 안전하지만, 사용자 입장에서는 "앱이
 * 망가졌다"로 보이고 복구 방법도 없다. 여기서 잡아 **되돌아갈 길**을 준다.
 *
 * 저장 용량 초과도 같이 알린다 — 조용히 저장이 멈추면 학습 기록이 사라지는데
 * 사용자는 그 사실조차 모른다.
 */
import { Component, useEffect, useState, type ReactNode } from 'react';
import { STORAGE_FULL_EVENT } from '../lib/state';

interface Props {
  children: ReactNode;
  /** 복구 시 호출 — 보통 홈으로 되돌린다 */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="err-screen">
        <div className="err-card">
          <div className="err-title">이 화면을 여는 중 문제가 생겼어요</div>
          <div className="err-desc">
            학습 기록은 이 기기에 그대로 안전합니다. 홈으로 돌아가면 계속 사용할 수 있어요.
          </div>
          <div className="err-detail">{this.state.error.message}</div>
          <button
            className="btn primary err-btn"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }
}

/** 저장 용량이 가득 찼을 때 띄우는 배너 — 조용한 데이터 유실을 막는다. */
export function StorageFullBanner() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(true);
    window.addEventListener(STORAGE_FULL_EVENT, on);
    return () => window.removeEventListener(STORAGE_FULL_EVENT, on);
  }, []);
  if (!full) return null;
  return (
    <div className="storage-full">
      저장 공간이 가득 차 최근 기록이 저장되지 않았어요. 기능 탭 → 백업·복원에서 내보낸 뒤 정리해 주세요.
      <button onClick={() => setFull(false)} aria-label="닫기">
        닫기
      </button>
    </div>
  );
}
