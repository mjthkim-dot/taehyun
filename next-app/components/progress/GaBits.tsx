'use client';

/**
 * 성장 아카이브(M10) 공용 조각 — 녹음 ▶ 버튼 줄(A/B·3클립), 녹음 진행 막대.
 *
 * 엔딩 리텔 카드(RetellCard)의 ClipButton·RecBar와 같은 역할이지만 그 파일은 원고(lib/drama)를 끌고 와서
 * 배치 화면·진도 화면 청크에 넣을 수 없다 — 원고 없는 작은 판을 따로 둔다.
 * 재생은 한 개의 Audio를 공유한다(여러 녹음이 겹쳐 울리지 않게). 객체 URL은 바뀌거나 떠날 때 해제한다.
 */
import { useEffect, useRef, useState } from 'react';
import { speakText, stopSpeaking } from '../SpeakButton';

/** 태오 목소리(lib/drama VOICE.taeo와 같은 값) — 원고 청크를 끌어오지 않으려고 상수로 둔다 */
export const TAEO_VOICE = 'austin';

let shared: HTMLAudioElement | null = null;
export function stopClips() {
  shared?.pause();
}

export interface ClipItem {
  label: string;
  /** 내 녹음 */
  clip?: Blob | null;
  /** 원어민(인물) 문장 — clip 대신 TTS로 */
  say?: string;
  voice?: string;
  /** 스크린리더용 이름(라벨이 ▶뿐일 때) */
  aria?: string;
}

/** 버튼 한 줄 — 녹음이 없는 항목은 그리지 않는다(눌리지 않는 버튼은 고장으로 보인다) */
export function ClipRow({ items, title }: { items: ClipItem[]; title?: string }) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [on, setOn] = useState(-1);
  const clips = items.map((i) => i.clip || null);
  const sig = clips.map((c) => (c ? `${c.size}:${c.type}` : '-')).join('|');
  const keep = useRef<Blob[]>([]);
  useEffect(() => {
    const us = clips.map((c) => (c ? URL.createObjectURL(c) : null));
    keep.current = clips.filter((c): c is Blob => !!c);
    setUrls(us);
    return () => {
      shared?.pause();
      for (const u of us) if (u) URL.revokeObjectURL(u);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  useEffect(() => () => stopClips(), []);

  const visible = items.map((it, i) => ({ it, i })).filter(({ it, i }) => !!it.say || !!urls[i]);
  if (!visible.length) return null;

  function play(i: number) {
    const it = items[i];
    stopSpeaking();
    stopClips();
    setOn(i);
    if (it.say) {
      speakText(it.say, 'en-US', 0.95, () => setOn((p) => (p === i ? -1 : p)), it.voice);
      window.setTimeout(() => setOn((p) => (p === i ? -1 : p)), 3000);
      return;
    }
    const u = urls[i];
    if (!u) return;
    if (!shared) shared = new Audio();
    shared.src = u;
    shared.onended = () => setOn(-1);
    shared.onerror = () => setOn(-1);
    shared.play().catch(() => setOn(-1));
  }

  return (
    <div className="ga-ab">
      {title && <div className="ga-ab-title">{title}</div>}
      <div className="ga-ab-row">
        {visible.map(({ it, i }) => (
          <button key={i} type="button" aria-label={it.aria} className={`ga-clip${on === i ? ' on' : ''}${it.say ? ' native' : ''}`} onClick={() => play(i)}>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 녹음 중 막대 — 남은 시간·입력 레벨·끝 버튼 */
export function RecMeter({ elapsed, sec, level, onStop }: { elapsed: number; sec: number; level: number; onStop: () => void }) {
  const left = Math.max(0, Math.ceil(sec - elapsed / 1000));
  return (
    <div className="ga-rec">
      <div className="ga-bar" role="progressbar" aria-valuemin={0} aria-valuemax={sec} aria-valuenow={Math.min(sec, Math.round(elapsed / 1000))} aria-label="남은 시간">
        <span style={{ transform: `scaleX(${Math.min(1, elapsed / (sec * 1000))})` }} />
      </div>
      <div className="ga-rec-row">
        <span className="ga-time">
          🎙 {Math.min(sec, Math.floor(elapsed / 1000))} / {sec}초 · 남은 {left}초
        </span>
        <span className="ga-level" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, level))})` }} />
        </span>
        <button type="button" className="btn ghost ga-stop" onClick={onStop}>
          ⏹ 끝
        </button>
      </div>
    </div>
  );
}

/** 녹음 경로 — 키 있음(전사) / 녹음만 / 마이크 없음 */
export type RecPath = 'whisper' | 'record' | 'none';
