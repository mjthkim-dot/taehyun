'use client';

/**
 * TTS 저하 칩(M1) — 신경망 음성이 한도(429)·네트워크로 막혀 기기 음성으로 내려가 있는 동안
 * 드라마·회화 화면 상단에 작게 보인다('🔈 지금은 기기 음성으로'). 다시 합성에 성공하면 사라진다.
 * 학습을 막지 않는다 — 안내만 하고 아무것도 요구하지 않는다.
 */
import { useEffect, useState } from 'react';
import { isTtsDegraded, TTS_DEGRADED_EVENT, TTS_RESTORED_EVENT } from './SpeakButton';

export default function TtsDegradedChip() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(isTtsDegraded());
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener(TTS_DEGRADED_EVENT, up);
    window.addEventListener(TTS_RESTORED_EVENT, down);
    return () => {
      window.removeEventListener(TTS_DEGRADED_EVENT, up);
      window.removeEventListener(TTS_RESTORED_EVENT, down);
    };
  }, []);
  if (!on) return null;
  return (
    <div className="tts-chip" role="status">
      🔈 지금은 기기 음성으로
    </div>
  );
}
