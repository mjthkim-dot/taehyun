'use client';

/**
 * 영상(video) 탭 — voice-assistant/index.html 의 renderVideo() 포팅.
 * v1 범위: YouTube 영상 임베드 + IFrame API로 재생 위치 추적 + 자막 자동 수집
 * (app/api/transcript) + 현재 재생 구간 자막 하이라이트 + 클릭 시 해당 구간으로 이동 +
 * 문장별 한국어 번역(Groq, 클릭 시에만 — 일괄 AI 분석/실시간 번역 모드는 추후 단계로 미룬다).
 */
import { useEffect, useRef, useState } from 'react';
import { groqComplete, GroqError } from '../lib/groq';
import { groqKey } from '../lib/state';

interface Segment {
  start: number;
  dur: number;
  text: string;
}

interface YTPlayer {
  getCurrentTime: () => number;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
}

function extractVideoId(input: string) {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const pats = [/[?&]v=([A-Za-z0-9_-]{11})/, /youtu\.be\/([A-Za-z0-9_-]{11})/, /embed\/([A-Za-z0-9_-]{11})/, /shorts\/([A-Za-z0-9_-]{11})/];
  for (const re of pats) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return '';
}

function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const w = window as unknown as { YT?: unknown; onYouTubeIframeAPIReady?: () => void };
    if (w.YT) {
      resolve();
      return;
    }
    w.onYouTubeIframeAPIReady = () => resolve();
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

export default function VideoScreen() {
  const [ready, setReady] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [videoId, setVideoId] = useState('');
  const [title, setTitle] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loadingCaptions, setLoadingCaptions] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translating, setTranslating] = useState<number | null>(null);

  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const segmentsRef = useRef<Segment[]>([]);
  const pollRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    if (!videoId) return;
    let destroyed = false;
    loadYouTubeApi().then(() => {
      if (destroyed || !playerHostRef.current) return;
      const YT = (window as unknown as { YT: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer } }).YT;
      playerRef.current?.destroy();
      playerRef.current = new YT.Player(playerHostRef.current, {
        videoId,
        playerVars: { rel: 0 },
      });
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => {
        const p = playerRef.current;
        if (!p || typeof p.getCurrentTime !== 'function') return;
        let t = 0;
        try {
          t = p.getCurrentTime();
        } catch {
          return;
        }
        const segs = segmentsRef.current;
        if (!segs.length) return;
        let idx = -1;
        for (let i = 0; i < segs.length; i++) {
          const next = segs[i + 1];
          const end = next ? next.start : segs[i].start + segs[i].dur;
          if (t >= segs[i].start && t < end) {
            idx = i;
            break;
          }
        }
        setActiveIdx((prev) => {
          if (prev !== idx && idx >= 0) {
            const el = listRef.current?.children[idx] as HTMLElement | undefined;
            el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
          return idx;
        });
      }, 400);
    });
    return () => {
      destroyed = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  if (!ready) return null;

  function handleLoad() {
    const id = extractVideoId(urlInput);
    if (!id) {
      setCaptionError('유튜브 URL 또는 영상 ID를 다시 확인해 주세요.');
      return;
    }
    setVideoId(id);
    setTitle('');
    setSegments([]);
    setTranslations({});
    setActiveIdx(-1);
    setCaptionError(null);
  }

  async function fetchCaptions() {
    if (!videoId) return;
    setLoadingCaptions(true);
    setCaptionError(null);
    try {
      // basePath('/app')가 next.config.js에 고정되어 있어 클라이언트 fetch에는 자동 적용되지 않으므로 직접 붙인다.
      const res = await fetch(`/app/api/transcript?v=${videoId}`);
      const data = await res.json();
      if (!res.ok) {
        setCaptionError(data.message || '자막을 가져올 수 없어요.');
        return;
      }
      setTitle(data.title || '');
      setSegments(data.segments || []);
    } catch {
      setCaptionError('자막 서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoadingCaptions(false);
    }
  }

  function seekTo(seg: Segment) {
    playerRef.current?.seekTo(seg.start, true);
  }

  async function translateSeg(idx: number, text: string) {
    if (translations[idx] || translating !== null) return;
    if (!groqKey()) {
      setCaptionError('번역에는 무료 Groq 키가 필요해요. 회화 탭에서 등록할 수 있어요.');
      return;
    }
    setTranslating(idx);
    try {
      const out = await groqComplete([
        { role: 'system', content: '다음 영어 문장을 자연스러운 한국어로 한 줄로 번역하세요. 번역문만 출력하세요.' },
        { role: 'user', content: text },
      ]);
      setTranslations((prev) => ({ ...prev, [idx]: out.trim() }));
    } catch (e) {
      setCaptionError(e instanceof GroqError ? e.message : '번역에 실패했어요.');
    } finally {
      setTranslating(null);
    }
  }

  return (
    <div className="study-screen">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          className="text-input"
          placeholder="유튜브 URL 또는 영상 ID를 붙여넣으세요"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
        />
        <button className="btn primary" style={{ flex: '0 0 auto' }} onClick={handleLoad}>
          불러오기
        </button>
      </div>

      {!videoId && (
        <div className="study-card">
          <h3>🎬 영상으로 영어 듣기 연습</h3>
          <p className="muted">유튜브 영상을 불러오면 영상을 보면서 자막을 추적하고, 문장을 탭해 한국어 번역을 확인할 수 있어요.</p>
        </div>
      )}

      {videoId && (
        <>
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 10, background: '#000' }}>
            <div ref={playerHostRef} style={{ position: 'absolute', inset: 0 }} />
          </div>

          {title && <div style={{ fontSize: '0.84rem', fontWeight: 800, marginBottom: 8 }}>{title}</div>}

          {!segments.length && (
            <button className="btn primary" style={{ width: '100%', marginBottom: 10 }} onClick={fetchCaptions} disabled={loadingCaptions}>
              {loadingCaptions ? '⏳ 자막 불러오는 중...' : '📝 자막 불러오기'}
            </button>
          )}

          {captionError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '10px 13px', marginBottom: 10, fontSize: '0.76rem', color: '#b91c1c' }}>
              {captionError}
            </div>
          )}

          {!!segments.length && (
            <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {segments.map((seg, i) => (
                <div
                  key={i}
                  onClick={() => seekTo(seg)}
                  style={{
                    background: i === activeIdx ? 'var(--primary)' : 'var(--surface)',
                    color: i === activeIdx ? 'var(--on-primary)' : 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '9px 12px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: '0.68rem', opacity: 0.75, flexShrink: 0 }}>{fmtTime(seg.start)}</span>
                    <span style={{ flex: 1 }}>{seg.text}</span>
                    <button
                      className="tr-btn"
                      style={{ flexShrink: 0, color: i === activeIdx ? 'var(--on-primary)' : undefined }}
                      onClick={(e) => {
                        e.stopPropagation();
                        translateSeg(i, seg.text);
                      }}
                      disabled={translating === i}
                    >
                      {translating === i ? '⏳' : translations[i] ? '🇰🇷' : '🇰🇷 번역'}
                    </button>
                  </div>
                  {translations[i] && (
                    <div style={{ marginTop: 4, fontSize: '0.78rem', opacity: 0.9 }}>🇰🇷 {translations[i]}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
