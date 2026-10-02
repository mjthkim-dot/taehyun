'use client';

/** 업데이트 안내 — 버전이 바뀌면 홈 맨 위에 한 번. 신규 사용자에겐 띄우지 않는다. */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import { load, store } from '../lib/state';
import { requestDramaAutoplay, dramaWatchedCount, dramaPlan, requestDrama } from '../lib/homeLite';
import { primeAudio } from './SpeakButton';

const SEEN_KEY = 'va_seen_whatsnew';
/**
 * 이 공지 — 본 기록은 버전이 아니라 공지 id로 남긴다(예전엔 버전이 오를 때마다 같은 카드가 다시 떴다).
 * 새로 알릴 게 생길 때만 id를 바꾼다.
 */
const WHATS_NEW = {
  id: 'speak-2026-10',
  title: '이제 드라마에서 직접 말해요',
  body: '태오가 되어 대사를 말하고, 배운 문장을 말로 떠올려요. 화가 끝나면 줄거리를 다시 말하고, 회화에서 고친 문장은 따라 말해요. 소리 카드와 하루 말하기 목표도 생겼어요.',
};

/** 처음 온 사람에겐 '새로 생긴 것'이 의미 없다 — 시작 가이드와 경쟁하지 않게 */
function isReturning(): boolean {
  return load<string[]>('va_days', []).length > 0 || !!load<unknown>('va_placed', null);
}

export default function WhatsNew({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  // 첫 렌더에서 바로 결정한다 — 효과에서 켜면 한 프레임 뒤 187px 카드가 끼어들어 아래 카드가 밀렸다(CLS)
  const [show, setShow] = useState(() => load<string>(SEEN_KEY, '') !== WHATS_NEW.id && isReturning());
  useEffect(() => {
    if (load<string>(SEEN_KEY, '') !== WHATS_NEW.id && !isReturning()) store(SEEN_KEY, WHATS_NEW.id);
  }, []);
  if (!show) return null;
  const close = () => {
    store(SEEN_KEY, WHATS_NEW.id);
    setShow(false);
  };
  return (
    <section className="wn-card" aria-labelledby="wn-title">
      <div className="wn-top">
        <span className="wn-badge">새 기능</span>
        <b id="wn-title">{WHATS_NEW.title}</b>
      </div>
      <p>{WHATS_NEW.body}</p>
      <div className="wn-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            close();
            primeAudio();
            // 새로 생긴 건 드라마 안의 말하기 — 오늘의 추천대로 — 오늘 이미 봤거나 키 없이 다 봤으면 다음 화가 아니라 복습(하루 한 편)
            const plan = dramaPlan();
            if (plan.kind === 'review') requestDrama({ kind: 'review' });
            else if (plan.kind === 'replay' && plan.replayNo) requestDrama({ kind: 'replay', no: plan.replayNo, subsOff: true });
            else requestDramaAutoplay();
            onNavigate('drama');
          }}
        >
          {dramaWatchedCount() > 0 ? (dramaPlan().kind === 'next' ? '오늘의 에피소드 보기' : '오늘의 복습 하기') : '드라마 1화 보기'}
        </button>
        <button type="button" className="btn ghost" onClick={close}>
          닫기
        </button>
      </div>
    </section>
  );
}
