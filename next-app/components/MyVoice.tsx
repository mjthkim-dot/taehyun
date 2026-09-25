'use client';

/**
 * 내 발음 다시 듣기 — 방금 녹음한 소리를 원어민 음성과 번갈아 들어 본다.
 *
 * 발음 교정에서 가장 확실하게 듣는 방법은 자기 소리를 듣는 것이다. "work가 walk로
 * 들렸어요"라는 진단을 읽는 것보다, 두 소리를 붙여서 들으면 차이가 훨씬 빨리 잡힌다.
 * 녹음은 Whisper 인식을 위해 이미 하고 있었고 지금까지는 텍스트만 뽑고 버렸다 —
 * 그 소리를 그대로 되살린다.
 *
 * 객체 URL 수명 관리가 이 파일의 실질적인 일이다. createObjectURL은 명시적으로
 * 해제하지 않으면 blob이 탭이 닫힐 때까지 메모리에 남는다. 드릴처럼 문장을 수십 번
 * 반복하는 화면에서는 그게 곧바로 누수라, 새 녹음이 오거나 화면을 떠날 때 반드시
 * 이전 URL을 revoke한다.
 */
import { useEffect, useRef, useState } from 'react';
import { speakText, stopSpeaking } from './SpeakButton';
import { useSlowRate } from './SpeechRate';

/** 내 발음 재생용 오디오 하나를 공유한다(여러 개가 겹쳐 울리지 않게). */
let sharedClip: HTMLAudioElement | null = null;

export function stopMyVoice() {
  sharedClip?.pause();
}

/** blob → 객체 URL. blob이 바뀌거나 화면을 떠나면 이전 URL을 해제한다. */
function useClipUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevRef.current) {
      URL.revokeObjectURL(prevRef.current);
      prevRef.current = null;
    }
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    prevRef.current = next;
    setUrl(next);
    return () => {
      if (prevRef.current) {
        URL.revokeObjectURL(prevRef.current);
        prevRef.current = null;
      }
    };
  }, [blob]);

  return url;
}

/**
 * 원어민 ↔ 내 발음 비교 줄.
 * 녹음이 없으면(권한 거부·내장 인식 폴백 등) 아무것도 그리지 않는다 —
 * 눌리지 않는 버튼을 남겨 두면 고장으로 보인다.
 */
export default function VoiceCompare({
  sentence,
  clip,
  lang = 'en-US',
}: {
  sentence: string;
  clip: Blob | null;
  lang?: string;
}) {
  const url = useClipUrl(clip);
  const rate = useSlowRate();
  const [playing, setPlaying] = useState<'none' | 'native' | 'mine'>('none');

  useEffect(() => () => stopMyVoice(), []);

  if (!url || !sentence) return null;

  function playNative() {
    stopMyVoice();
    setPlaying('native');
    speakText(sentence, lang, rate);
    // 재생 종료 시점을 정확히 알기 어려운 경로(TTS 프록시·음성합성)라
    // 강조 표시는 잠시 뒤 스스로 풀리게 둔다
    window.setTimeout(() => setPlaying((p) => (p === 'native' ? 'none' : p)), 2500);
  }

  function playMine() {
    stopSpeaking();
    stopMyVoice();
    if (!sharedClip) sharedClip = new Audio();
    sharedClip.src = url!;
    sharedClip.onended = () => setPlaying('none');
    sharedClip.onerror = () => setPlaying('none');
    setPlaying('mine');
    sharedClip.play().catch(() => setPlaying('none'));
  }

  return (
    <div className="vcmp">
      <div className="vcmp-label">번갈아 들어보기</div>
      <div className="vcmp-row">
        <button type="button" className={`vcmp-btn${playing === 'native' ? ' on' : ''}`} onClick={playNative}>
          🔊 원어민
        </button>
        <button type="button" className={`vcmp-btn${playing === 'mine' ? ' on' : ''}`} onClick={playMine}>
          🎤 내 발음
        </button>
      </div>
    </div>
  );
}
