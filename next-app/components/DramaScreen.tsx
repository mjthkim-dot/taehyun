'use client';

/**
 * 드라마 레슨 화면 — 허브(시리즈·출연진·에피소드) + 플레이어(대화가 한 줄씩 흐르고,
 * 중간중간 태오의 대사를 내가 고르거나 말한다) + 엔딩(오늘의 표현·다음 화 예고).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { speakText, stopSpeaking } from './SpeakButton';
import { haptic } from '../lib/haptics';
import { bumpSpoken, groqKey, load, store } from '../lib/state';
import { recordAndTranscribe, whisperAvailable } from '../lib/stt';
import { overall } from '../lib/cefrGrowth';
import {
  allEpisodes,
  CAST,
  castOf,
  DRAMA_AUTOPLAY_KEY,
  completeEpisode,
  episodeByNo,
  episodeScore,
  generateEpisode,
  INTERACTIVE,
  nextEpisodeNo,
  SERIES,
  SERIES_KR,
  watched,
  type Episode,
  type Scene,
} from '../lib/drama';

const AUTOPLAY_KEY = DRAMA_AUTOPLAY_KEY;
const MUTE_KEY = 'va_drama_mute';

function say(t: string) {
  stopSpeaking();
  speakText(t, 'en-US', 0.95);
}

/** 화면에 쌓이는 대화 기록 한 줄 */
type LogItem = { kind: 'narr'; kr: string } | { kind: 'line'; who: string; en: string; kr: string } | { kind: 'note'; ok: boolean; text: string };

function shuffleIdx(n: number, seed: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  let s = seed + 11;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

function Bubble({ item, subs }: { item: LogItem; subs: boolean }) {
  if (item.kind === 'narr') return <div className="dr-narr">{item.kr}</div>;
  if (item.kind === 'note') return <div className={`dr-note${item.ok ? ' ok' : ''}`}>{item.text}</div>;
  const c = castOf(item.who);
  const me = item.who === 'taeo';
  return (
    <div className={`dr-line${me ? ' me' : ''}`}>
      {!me && <span className="dr-av" aria-hidden="true">{c.icon}</span>}
      <button type="button" className="dr-bub" onClick={() => say(item.en)} aria-label={`${c.name}: ${item.en} (다시 듣기)`}>
        {!me && <span className="dr-name">{c.name}</span>}
        <span className="dr-en">{item.en}</span>
        {subs && item.kr && <span className="dr-kr">{item.kr}</span>}
      </button>
      {me && <span className="dr-av" aria-hidden="true">{c.icon}</span>}
    </div>
  );
}

/** 따라 말하기 — 선택(보너스). 비슷하게 말하면 통과 */
function SpeakStep({ scene, onDone }: { scene: Extract<Scene, { type: 'speak' }>; onDone: (said: string | null) => void }) {
  const [st, setSt] = useState<'idle' | 'rec' | 'wait'>('idle');
  const [msg, setMsg] = useState('');
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const canVoice = whisperAvailable() && !!groqKey();
  async function rec() {
    setSt('rec');
    setMsg('');
    try {
      const { text } = await recordAndTranscribe({ prompt: scene.en, language: 'en', silenceMs: 1800, maxMs: 15000, registerStop: (f) => (stop.current = f), onState: (s) => s === 'transcribing' && setSt('wait') });
      stop.current = null;
      const said = (text || '').trim();
      if (!said) {
        setMsg('소리가 안 잡혔어요. 한 번 더 해볼까요?');
        setSt('idle');
        return;
      }
      bumpSpoken();
      onDone(said);
    } catch {
      setMsg('마이크를 쓸 수 없어요. 들어보고 넘어가요.');
      setSt('idle');
    }
  }
  return (
    <div className="dr-act">
      <div className="dr-ask">🎙 태오가 되어 말해 보세요</div>
      <button type="button" className="dr-target" onClick={() => say(scene.en)}>
        <span className="dr-en">🔊 {scene.en}</span>
        <span className="dr-kr">{scene.kr}</span>
      </button>
      {canVoice && (
        <button type="button" className={`dr-mic${st === 'rec' ? ' on' : ''}`} disabled={st === 'wait'} onClick={() => (st === 'rec' ? stop.current?.() : void rec())} aria-label={st === 'rec' ? '말하기 끝' : '말하기'}>
          {st === 'rec' ? '⏹' : st === 'wait' ? '…' : '🎙'}
        </button>
      )}
      {msg && <p className="dr-msg">{msg}</p>}
      <button type="button" className="dr-skip" onClick={() => onDone(null)}>
        {canVoice ? '말하지 않고 넘어가기' : '들어보고 넘어가기 →'}
      </button>
    </div>
  );
}

function Player({ ep, onEnd }: { ep: Episode; onEnd: (score: number) => void }) {
  const [i, setI] = useState(0);
  const [log, setLog] = useState<LogItem[]>([]);
  const [ok, setOk] = useState(0);
  const [asked, setAsked] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [subs, setSubs] = useState(true);
  const [mute, setMute] = useState(() => load<boolean>(MUTE_KEY, false));
  const endRef = useRef<HTMLDivElement | null>(null);
  const scene = ep.scenes[i];
  const total = ep.scenes.length;

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [log.length, i, picked]);

  const push = (...items: LogItem[]) => setLog((l) => [...l, ...items]);
  const voice = (en: string) => {
    if (!mute) say(en);
  };

  function advance() {
    setPicked(null);
    if (i + 1 >= total) {
      const score = asked ? Math.round((ok / asked) * 100) : 100;
      onEnd(score);
      return;
    }
    setI(i + 1);
  }

  // 대사·해설은 도착하면 기록에 올리고 소리 낸다
  useEffect(() => {
    if (!scene) return;
    if (scene.type === 'narr') push({ kind: 'narr', kr: scene.kr });
    if (scene.type === 'line') {
      push({ kind: 'line', who: scene.who, en: scene.en, kr: scene.kr });
      voice(scene.en);
    }
    if (scene.type === 'meaning') voice(scene.en);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const order = useMemo(() => {
    if (!scene) return [];
    const n = scene.type === 'choice' ? scene.opts.length : scene.type === 'meaning' || scene.type === 'fill' ? scene.opts.length : 0;
    return shuffleIdx(n, ep.no * 31 + i);
  }, [scene, ep.no, i]);

  const isAct = scene && INTERACTIVE.has(scene.type);
  const pct = Math.round((i / total) * 100);

  function grade(good: boolean) {
    setAsked((a) => a + 1);
    if (good) setOk((o) => o + 1);
    haptic(good ? 'success' : 'error');
  }

  return (
    <div className="screen dr-screen">
      <div className="dr-top">
        <div className="dr-prog" aria-label={`진행 ${pct}%`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <button type="button" className="mini-btn" onClick={() => setSubs((v) => !v)} aria-pressed={subs}>
          {subs ? '자막 끄기' : '자막 켜기'}
        </button>
        <button
          type="button"
          className="mini-btn"
          onClick={() => {
            store(MUTE_KEY, !mute);
            setMute(!mute);
            stopSpeaking();
          }}
          aria-label={mute ? '소리 켜기' : '소리 끄기'}
        >
          {mute ? '🔇' : '🔊'}
        </button>
      </div>
      <div className="dr-ep">
        EP {ep.no} · {ep.titleKr}
      </div>

      <div className="dr-log">
        {log.map((it, k) => (
          <Bubble key={k} item={it} subs={subs} />
        ))}

        {scene?.type === 'choice' && picked === null && (
          <div className="dr-act">
            <div className="dr-ask">💬 {scene.prompt}</div>
            {order.map((k) => {
              const o = scene.opts[k];
              const st = picked === null ? '' : o.ok ? ' right' : k === picked ? ' wrong' : ' dim';
              return (
                <button
                  key={k}
                  type="button"
                  className={`wd-opt dr-opt${st}`}
                  disabled={picked !== null}
                  onClick={() => {
                    setPicked(k);
                    grade(o.ok);
                    const right = scene.opts.find((x) => x.ok)!;
                    if (!o.ok && o.why) push({ kind: 'note', ok: false, text: o.why });
                    push({ kind: 'line', who: 'taeo', en: right.en, kr: '' });
                    voice(right.en);
                    if (right.reply) {
                      const r = right.reply;
                      setTimeout(() => {
                        push({ kind: 'line', who: r.who, en: r.en, kr: r.kr });
                        voice(r.en);
                      }, 900);
                    }
                  }}
                >
                  {o.en}
                </button>
              );
            })}
          </div>
        )}

        {scene?.type === 'meaning' && (
          <div className="dr-act">
            <Bubble item={{ kind: 'line', who: scene.who, en: scene.en, kr: '' }} subs={false} />
            <div className="dr-ask">🤔 무슨 뜻일까요?</div>
            {order.map((k) => {
              const st = picked === null ? '' : k === scene.a ? ' right' : k === picked ? ' wrong' : ' dim';
              return (
                <button
                  key={k}
                  type="button"
                  className={`wd-opt dr-opt${st}`}
                  disabled={picked !== null}
                  onClick={() => {
                    setPicked(k);
                    grade(k === scene.a);
                  }}
                >
                  {scene.opts[k]}
                </button>
              );
            })}
            {picked !== null && <div className={`dr-note${picked === scene.a ? ' ok' : ''}`}>{scene.why}</div>}
          </div>
        )}

        {scene?.type === 'fill' && (
          <div className="dr-act">
            <div className="dr-ask">✏️ 빈칸에 들어갈 말은?</div>
            <div className="dr-fill">
              {scene.before} <b className="dr-blank">{picked === null ? '____' : scene.opts[scene.a]}</b> {scene.after}
              {subs && <span className="dr-kr">{scene.kr}</span>}
            </div>
            <div className="dr-fill-opts">
              {order.map((k) => {
                const st = picked === null ? '' : k === scene.a ? ' right' : k === picked ? ' wrong' : ' dim';
                return (
                  <button
                    key={k}
                    type="button"
                    className={`wd-opt dr-opt dr-chip${st}`}
                    disabled={picked !== null}
                    onClick={() => {
                      setPicked(k);
                      grade(k === scene.a);
                      voice(`${scene.before} ${scene.opts[scene.a]} ${scene.after}`);
                    }}
                  >
                    {scene.opts[k]}
                  </button>
                );
              })}
            </div>
            {picked !== null && <div className={`dr-note${picked === scene.a ? ' ok' : ''}`}>{scene.why}</div>}
          </div>
        )}

        {scene?.type === 'speak' && picked === null && (
          <SpeakStep
            scene={scene}
            onDone={(said) => {
              setPicked(0);
              push({ kind: 'line', who: 'taeo', en: scene.en, kr: scene.kr });
              if (said) push({ kind: 'note', ok: true, text: `🎙 내가 한 말: “${said}”` });
            }}
          />
        )}
        <div ref={endRef} />
      </div>

      {(!isAct || picked !== null) && (
        <button type="button" className="dr-next" onClick={advance}>
          {i + 1 >= total ? '엔딩 보기' : '다음 ▶'}
        </button>
      )}
    </div>
  );
}

function Ending({ ep, score, onNext, onHub }: { ep: Episode; score: number; onNext: () => void; onHub: () => void }) {
  return (
    <div className="screen dr-screen">
      <div className="study-card dr-end">
        <div className="dr-end-ep">EP {ep.no} 완료</div>
        <h2 className="dr-end-title">{ep.titleKr}</h2>
        <div className="dr-end-score">이해도 {score}%</div>
        <div className="dr-sec">오늘의 표현 — 복습 카드에 담았어요</div>
        {ep.learn.map((l, k) => (
          <button key={k} type="button" className="dr-learn" onClick={() => say(l.en)}>
            <b>🔊 {l.en}</b>
            <span>{l.kr}</span>
            <em>{l.note}</em>
          </button>
        ))}
      </div>
      <div className="study-card dr-cliff">
        <div className="dr-sec">다음 화 예고</div>
        <p>{ep.cliff}</p>
        <button type="button" className="btn primary dr-go" onClick={onNext}>
          다음 화 보기
        </button>
        <button type="button" className="btn ghost dr-go" onClick={onHub}>
          오늘은 여기까지
        </button>
      </div>
    </div>
  );
}

export default function DramaScreen() {
  const [view, setView] = useState<'hub' | 'loading' | 'play' | 'end'>('hub');
  const [ep, setEp] = useState<Episode | null>(null);
  const [score, setScore] = useState(0);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const eps = useMemo(() => allEpisodes(), [tick]);
  const seen = useMemo(() => new Set(watched()), [tick]);
  const nextNo = useMemo(() => nextEpisodeNo(), [tick]);

  async function open(no: number) {
    setErr('');
    const have = episodeByNo(no);
    if (have) {
      setEp(have);
      setView('play');
      return;
    }
    if (!groqKey()) {
      setErr('다음 화는 AI가 이어서 써요 — AI 키를 연결하면 볼 수 있어요.');
      setView('hub');
      return;
    }
    setView('loading');
    const lv = overall().level;
    const made = await generateEpisode(no, lv);
    if (!made) {
      setErr('작가가 원고를 완성하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setView('hub');
      return;
    }
    setEp(made);
    setTick((t) => t + 1);
    setView('play');
  }

  useEffect(() => {
    // 홈의 '오늘의 에피소드'에서 들어오면 허브를 건너뛰고 바로 재생
    const t = load<number>(AUTOPLAY_KEY, 0);
    if (t && Date.now() - t < 60_000) {
      store(AUTOPLAY_KEY, 0);
      void open(nextEpisodeNo());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (view === 'loading') {
    return (
      <div className="screen dr-screen">
        <div className="study-card gm-loading" role="status">
          <div className="gm-loading-dot" aria-hidden="true" />
          <b>EP {nextNo}</b>
          <span className="muted">작가가 다음 이야기를 쓰는 중… (10초 정도)</span>
        </div>
      </div>
    );
  }
  if (view === 'play' && ep) {
    return (
      <Player
        key={ep.no}
        ep={ep}
        onEnd={(s) => {
          completeEpisode(ep, s);
          setScore(s);
          setTick((t) => t + 1);
          setView('end');
        }}
      />
    );
  }
  if (view === 'end' && ep) {
    return <Ending ep={ep} score={score} onNext={() => void open(ep.no + 1)} onHub={() => setView('hub')} />;
  }

  return (
    <div className="screen dr-screen">
      <div className="study-card dr-hero" data-tilt>
        <div className="pg-kicker">드라마로 배우는 영어</div>
        <h2 className="dr-hero-title">{SERIES}</h2>
        <p className="muted">{SERIES_KR} — 하루 한 편, 5분</p>
        <div className="dr-cast">
          {CAST.map((c) => (
            <span key={c.id} className="dr-cast-item" title={c.desc}>
              <span className="dr-cast-ic">{c.icon}</span>
              {c.name}
            </span>
          ))}
        </div>
        <button type="button" className="btn primary dr-go" onClick={() => void open(nextNo)}>
          EP {nextNo} 보기{episodeByNo(nextNo) ? ` · ${episodeByNo(nextNo)!.titleKr}` : ' · 새 에피소드'}
        </button>
        {err && <p className="dr-msg">{err}</p>}
      </div>
      <div className="pg-sec-h">에피소드</div>
      <ul className="dr-list">
        {eps.map((e) => {
          const sc = episodeScore(e.no);
          return (
            <li key={e.no}>
              <button type="button" className={`gm-unit${seen.has(e.no) ? ' master' : ''}`} onClick={() => void open(e.no)}>
                <span className="gm-unit-n">{e.no}</span>
                <span className="gm-unit-body">
                  <b>{e.titleKr}</b>
                  <span className="muted">{e.title}</span>
                </span>
                <span className="gm-unit-state">{seen.has(e.no) ? `✓ ${sc ?? ''}%` : e.no === nextNo ? '다음' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
