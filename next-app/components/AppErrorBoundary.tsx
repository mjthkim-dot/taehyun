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
import { NAVIGATE_EVENT, STORAGE_FULL_EVENT } from '../lib/state';
import { sanitizeStorage } from '../lib/sanitize';
import { downloadBackup, eraseAllData } from '../lib/backup';

interface Props {
  children: ReactNode;
  /** 복구 시 호출 — 보통 홈으로 되돌리고 화면을 새로 그린다 */
  onReset?: () => void;
}

interface State {
  error: Error | null;
  /** 이번 오류에서 저장값 자동 점검을 이미 했는가(무한 재시도 방지) */
  healed: boolean;
  repaired: number | null;
}

/** 화면 코드(청크)를 못 받아 난 오류 — 오프라인이거나 새 배포 직후 */
export function isChunkError(e: Error | null): boolean {
  return !!e && (e.name === 'ChunkLoadError' || /Loading (CSS )?chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(e.message || ''));
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, healed: false, repaired: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  private onOnline = () => {
    // 인터넷이 돌아오면 화면을 다시 받아 본다(청크 오류일 때)
    if (this.state.error && isChunkError(this.state.error)) this.setState({ error: null, healed: false });
  };
  componentDidMount() {
    window.addEventListener('online', this.onOnline);
  }
  componentWillUnmount() {
    window.removeEventListener('online', this.onOnline);
  }

  componentDidCatch(error: Error) {
    // 저장값이 어긋나 난 오류면 스스로 고친다 — 한 번 점검해 고친 게 있으면 바로 다시 그려 본다.
    // (예전엔 손상된 값 하나로 홈이 열 때마다 깨졌고 '홈으로'도 새로고침도 소용이 없었다)
    if (this.state.healed || isChunkError(error)) return;
    let n = 0;
    try {
      n = sanitizeStorage();
    } catch {
      n = 0;
    }
    if (n > 0) this.setState({ error: null, healed: true, repaired: n });
    else this.setState({ healed: true });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = isChunkError(this.state.error);
    if (chunk) {
      return (
        <div className="err-screen">
          <div className="err-card" role="alert">
            <div className="err-title">인터넷에 연결되면 열 수 있어요</div>
            <div className="err-desc">이 화면은 아직 기기에 받아 두지 못했어요. 학습 기록은 그대로 안전합니다.</div>
            {typeof navigator !== 'undefined' && navigator.onLine === false && <div className="err-desc">아직 오프라인이에요 — 연결되면 저절로 다시 열어 볼게요.</div>}
            <button
              className="btn primary err-btn"
              onClick={() => {
                if (typeof navigator === 'undefined' || navigator.onLine) window.location.reload();
              }}
            >
              다시 시도
            </button>
            <button
              className="btn ghost err-btn"
              onClick={() => {
                this.setState({ error: null, healed: false });
                this.props.onReset?.();
              }}
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="err-screen">
        <div className="err-card" role="alert">
          <div className="err-title">이 화면을 여는 중 문제가 생겼어요</div>
          <div className="err-desc">
            학습 기록은 이 기기에 그대로 안전합니다. 홈으로 돌아가거나, 저장된 값을 점검해 고칠 수 있어요.
          </div>
          <div className="err-detail">{this.state.error.message}</div>
          <button
            className="btn primary err-btn"
            onClick={() => {
              this.setState({ error: null, healed: false });
              this.props.onReset?.();
            }}
          >
            홈으로 돌아가기
          </button>
          <button
            className="btn ghost err-btn"
            onClick={() => {
              try {
                sanitizeStorage();
              } catch {
                /* 무시 */
              }
              window.location.reload();
            }}
          >
            데이터 점검 후 다시 열기
          </button>
          <button className="btn ghost err-btn" onClick={() => downloadBackup()}>
            학습 기록 파일로 받기(백업)
          </button>
          {/* 마지막 수단 — 그래도 안 되면 기록을 비우고 새로 시작(먼저 백업을 권한다) */}
          <button
            className="err-link"
            onClick={() => {
              if (!window.confirm('이 기기의 학습 기록을 모두 지우고 처음부터 시작할까요? 먼저 위 버튼으로 백업 파일을 받아 두세요.')) return;
              eraseAllData();
              window.location.reload();
            }}
          >
            그래도 안 되면: 모든 기록 지우고 새로 시작
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
      저장 공간이 가득 차 최근 기록이 저장되지 않았어요. 기록을 파일로 받아 두세요.
      <button
        onClick={() => {
          setFull(false);
          window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: 'backup' }));
        }}
      >
        백업하러 가기
      </button>
      <button onClick={() => setFull(false)} aria-label="닫기">
        닫기
      </button>
    </div>
  );
}
