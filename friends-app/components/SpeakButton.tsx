'use client';

import { useEffect, useState } from 'react';
import { speak, stopSpeaking, ttsSupported } from '../lib/speech';
import { SpeakerIcon } from './Icon';

/**
 * 문장 듣기 버튼 — 재생 중이면 활성 스타일. slow가 켜지면 0.75배속.
 * 컴포넌트가 사라질 때 재생을 멈춰 다른 화면으로 소리가 새지 않게 한다.
 */
export default function SpeakButton({
  text,
  slow = false,
  className = '',
}: {
  text: string;
  slow?: boolean;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => stopSpeaking, []);

  async function play() {
    if (!ttsSupported()) return;
    setPlaying(true);
    await speak(text, slow ? 0.75 : 0.95);
    setPlaying(false);
  }

  return (
    <button
      className={`icon-btn${playing ? ' active' : ''} ${className}`}
      onClick={play}
      aria-label={`듣기: ${text}`}
      title={slow ? '천천히 듣기' : '듣기'}
    >
      <SpeakerIcon />
    </button>
  );
}
