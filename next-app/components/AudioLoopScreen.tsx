'use client';

/**
 * 오디오 모드 — 오늘의 학습 재료를 영어→한국어 뜻 순서로 이어서 읽어준다.
 * 화면을 볼 필요가 없도록 재생 흐름이 스스로 전진하고, 문장마다 감시 타이머를
 * 둬서 TTS가 조용히 죽어도(브라우저 변덕) 다음 문장으로 넘어간다.
 */
import { useEffect, useRef, useState } from 'react';
import { buildPlaylist, type AudioItem } from '../lib/audioLoop';
import { speakText, stopSpeaking } from './SpeakButton';

/** 문장 하나가 이보다 오래 걸리면 TTS가 죽은 것으로 보고 다음으로 넘어간다 */
const ITEM_WATCHDOG_MS = 20000;

export default function AudioLoopScreen() {
  const [playlist] = useState<AudioItem[]>(() => buildPlaylist());
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [withKr, setWithKr] = useState(true);
  /** 재생 속도 — 아직 귀가 안 트인 문장은 0.85×로 또렷하게 */
  const [slow, setSlow] = useState(false);
  const slowRef = useRef(false);
  slowRef.current = slow;

  // 재생 체인의 세대 토큰 — 정지/건너뛰기 후 늦게 도착한 onend가 다음 문장을
  // 이중으로 밀지 않게 한다.
  const genRef = useRef(0);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = playlist.length;

  function clearWatchdog() {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
  }

  function stop() {
    genRef.current += 1;
    clearWatchdog();
    stopSpeaking();
    setPlaying(false);
  }

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function playFrom(i: number) {
    if (!total) return;
    const gen = ++genRef.current;
    setIdx(i);
    setPlaying(true);
    const item = playlist[i];

    const advance = () => {
      if (genRef.current !== gen) return;
      clearWatchdog();
      const next = i + 1;
      if (next < total) playFrom(next);
      else if (loop) playFrom(0);
      else stop();
    };

    clearWatchdog();
    watchdogRef.current = setTimeout(advance, ITEM_WATCHDOG_MS);

    speakText(item.en, 'en-US', slowRef.current ? 0.85 : 1, () => {
      if (genRef.current !== gen) return;
      if (withKr && item.kr) speakText(item.kr, 'ko-KR', 1, advance);
      else advance();
    });
  }

  if (!total) {
    return (
      <div className="study-screen">
        <div className="study-card">
          <h3>🎧 오디오 모드</h3>
          <p className="muted" style={{ fontSize: '0.82rem', lineHeight: 1.65 }}>
            아직 들을 재료가 없어요 — 오늘 세션을 완주하고 표현이 쌓이면 여기서 이어 들을 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  const cur = playlist[Math.min(idx, total - 1)];

  return (
    <div className="study-screen">
      <div className="study-card al-card">
        <h3>🎧 오디오 모드 <span className="dash-sub">듣기만으로 오늘 복습 · {total}문장</span></h3>

        <div className="al-now">
          <span className="al-tag">{cur.tag}</span>
          <div className="al-en">{cur.en}</div>
          {cur.kr && <div className="al-kr">{cur.kr}</div>}
          <div className="al-pos">{idx + 1} / {total}</div>
        </div>

        <div className="al-controls">
          <button type="button" className="al-btn" aria-label="이전" disabled={idx === 0} onClick={() => (playing ? playFrom(idx - 1) : setIdx(idx - 1))}>⏮</button>
          <button type="button" className="al-btn al-play" aria-label={playing ? '멈추기' : '재생'} onClick={() => (playing ? stop() : playFrom(idx))}>
            {playing ? '⏸' : '▶'}
          </button>
          <button type="button" className="al-btn" aria-label="다음" disabled={idx >= total - 1 && !loop} onClick={() => (playing ? playFrom((idx + 1) % total) : setIdx(Math.min(idx + 1, total - 1)))}>⏭</button>
        </div>

        <div className="al-opts">
          <button type="button" className={`mini-btn${loop ? ' on' : ''}`} onClick={() => setLoop((v) => !v)}>
            🔁 반복 {loop ? 'ON' : 'OFF'}
          </button>
          <button type="button" className={`mini-btn${withKr ? ' on' : ''}`} onClick={() => setWithKr((v) => !v)}>
            🇰🇷 뜻 읽기 {withKr ? 'ON' : 'OFF'}
          </button>
          <button type="button" className={`mini-btn${slow ? ' on' : ''}`} onClick={() => setSlow((v) => !v)}>
            🐢 0.85×
          </button>
        </div>

        <p className="muted" style={{ fontSize: '0.72rem', marginTop: 12, lineHeight: 1.6 }}>
          화면이 꺼지면 브라우저가 소리를 멈출 수 있어요 — 이동 중에는 화면을 켠 채 주머니에 넣는 걸 추천해요.
        </p>
      </div>

      <div className="al-list">
        {playlist.map((it, i) => (
          <button type="button" key={i} className={`al-item${i === idx ? ' now' : ''}`} onClick={() => (playing ? playFrom(i) : setIdx(i))}>
            <span className="al-item-en">{it.en}</span>
            <span className="al-item-tag">{it.tag}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
