'use client';

/** 업데이트 안내 — 버전이 바뀌면 홈 맨 위에 한 번. 신규 사용자에겐 띄우지 않는다. */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import { load, store } from '../lib/state';
import { APP_VERSION } from '../lib/version';
import { requestDramaAutoplay, dramaWatchedCount } from '../lib/homeLite';
import { primeAudio } from './SpeakButton';

const SEEN_KEY = 'va_seen_whatsnew';
/** 이 버전에서 알릴 것 — 버전이 바뀌면 다시 한 번 뜬다 */
const WHATS_NEW = {
  title: '드라마 레슨이 더 좋아졌어요',
  body: '다음 화를 시작할 때 지난 화 표현을 한 번 떠올리게 해서 배운 게 남아요. 에피소드 한 편만 봐도 오늘의 불꽃이 켜지고, 대사 순서·소리 끊김 문제도 고쳤어요.',
};

export default function WhatsNew({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (load<string>(SEEN_KEY, '') === APP_VERSION) return;
    // 처음 온 사람에겐 '새로 생긴 것'이 의미 없다 — 시작 가이드와 경쟁하지 않게 조용히 넘긴다
    const returning = load<string[]>('va_days', []).length > 0 || !!load<unknown>('va_placed', null);
    if (!returning) {
      store(SEEN_KEY, APP_VERSION);
      return;
    }
    setShow(true);
  }, []);
  if (!show) return null;
  const close = () => {
    store(SEEN_KEY, APP_VERSION);
    setShow(false);
  };
  return (
    <div className="wn-card" role="status">
      <div className="wn-top">
        <span className="wn-badge">v{APP_VERSION}</span>
        <b>{WHATS_NEW.title}</b>
      </div>
      <p>{WHATS_NEW.body}</p>
      <div className="wn-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            close();
            primeAudio();
            requestDramaAutoplay();
            onNavigate('drama');
          }}
        >
          {dramaWatchedCount() > 0 ? '오늘의 에피소드 보기' : '드라마 1화 보기'}
        </button>
        <button type="button" className="btn ghost" onClick={close}>
          닫기
        </button>
      </div>
    </div>
  );
}
