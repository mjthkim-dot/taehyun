'use client';

/**
 * 드라마 레슨 화면 — 허브(시리즈·출연진·에피소드) + 플레이어(대화가 한 줄씩 흐르고,
 * 중간중간 태오의 대사를 내가 고르거나 말한다) + 엔딩(오늘의 표현·다음 화 예고).
 *
 * v1.30 감사 반영:
 *  - 소리는 한 줄씩 순서대로(태오 정답 → 상대 반응)만 나고, 대화 기록 순서도 항상 같다
 *    (예전엔 반응이 900ms 타이머로 태오 목소리를 끊고, 수동 재생 땐 다음 줄보다 뒤에 붙었다)
 *  - 답한 뒤에도 '뜻 알아듣기'·'빈칸' 대사와 해설이 기록에 남는다
 *  - 말풍선 다시 듣기·음소거가 자동 재생을 멈춰 세우지 않는다
 *  - 다음 화 첫머리에 '지난 화 기억나요?' — 드라마 표현의 간격 반복 복습
 *  - AI 원고가 실패·오류여도 무한 로딩·영구 막힘이 없다
 */
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Mode } from './NavBar';
import { primeAudio, speakText, stopSpeaking } from './SpeakButton';
import { haptic } from '../lib/haptics';
import { bumpSpoken, groqKey, load, store } from '../lib/state';
import { recordAndTranscribe, whisperAvailable } from '../lib/stt';
import { overall } from '../lib/cefrGrowth';
import {
  allEpisodes,
  CAST,
  castOf,
  completeEpisode,
  discardGenerated,
  DRAMA_AUTOPLAY_KEY,
  episodeByNo,
  episodeScore,
  generateEpisode,
  gradeRecall,
  INTERACTIVE,
  nextEpisodeNo,
  recallItems,
  SERIES,
  SERIES_KR,
  watched,
  watchedToday,
  type Episode,
  type RecallItem,
  type Scene,
} from '../lib/drama';

const MUTE_KEY = 'va_drama_mute';
const AUTO_KEY = 'va_drama_auto';
const SUBS_KEY = 'va_drama_subs';

/** 인물별 목소리(Groq Orpheus) — 없는 목소리면 TTS 라우트가 PlayAI → 브라우저 음성으로 넘어간다 */
const VOICE: Record<string, string> = { taeo: 'austin', jun: 'daniel', grant: 'troy', maya: 'hannah', diane: 'diana' };
const voiceOf = (who?: string) => VOICE[who || 'taeo'] || 'austin';

/** 플레이어가 도는 장면 — 원고 장면 + 첫머리 복습(recall) */
type PScene = Scene | ({ type: 'recall' } & RecallItem);

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

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** 따라 말한 문장이 목표와 얼마나 겹치나(0~1) — 목표 단어 중 들린 비율 */
export function speakMatch(target: string, said: string): number {
  const t = words(target);
  if (!t.length) return 0;
  const bag = new Map<string, number>();
  for (const w of words(said)) bag.set(w, (bag.get(w) || 0) + 1);
  let hit = 0;
  for (const w of t) {
    const n = bag.get(w) || 0;
    if (n > 0) {
      hit++;
      bag.set(w, n - 1);
    }
  }
  return hit / t.length;
}

/** 대사 한 줄을 읽는 데 필요한 시간(음소거·추정용) */
const lineMs = (en: string) => en.split(/\s+/).length * 380 + 700;

function Bubble({ item, subs, onReplay }: { item: LogItem; subs: boolean; onReplay: (en: string, who?: string) => void }) {
  if (item.kind === 'narr') return <div className="dr-narr">{item.kr}</div>;
  if (item.kind === 'note') return <div className={`dr-note${item.ok ? ' ok' : ''}`}>{item.text}</div>;
  const c = castOf(item.who);
  const me = item.who === 'taeo';
  return (
    <div className={`dr-line${me ? ' me' : ''}`}>
      {!me && <span className="dr-av" aria-hidden="true">{c.icon}</span>}
      <button type="button" className="dr-bub" onClick={() => onReplay(item.en, item.who)} aria-label={`${c.name}: ${item.en} (다시 듣기)`}>
        {!me && <span className="dr-name">{c.name}</span>}
        <span className="dr-en">{item.en}</span>
        {subs && item.kr && <span className="dr-kr">{item.kr}</span>}
      </button>
      {me && <span className="dr-av" aria-hidden="true">{c.icon}</span>}
    </div>
  );
}

/** 따라 말하기 — 선택(보너스). 문장을 먼저 들려주고, 말하면 얼마나 비슷했는지 알려준다 */
function SpeakStep({ scene, onDone, play }: { scene: Extract<Scene, { type: 'speak' }>; onDone: (said: string | null, match: number) => void; play: (en: string) => void }) {
  const [st, setSt] = useState<'idle' | 'rec' | 'wait' | 'heard'>('idle');
  const [msg, setMsg] = useState('');
  const [heard, setHeard] = useState<{ text: string; m: number } | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);
  const canVoice = whisperAvailable() && !!groqKey();

  useEffect(() => {
    // 무엇을 말할지 먼저 들려준다(예전엔 한 번도 소리로 들려주지 않았다)
    play(scene.en);
    return () => {
      cancelled.current = true;
      stop.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function rec() {
    cancelled.current = false;
    stopSpeaking();
    setSt('rec');
    setMsg('');
    try {
      const { text } = await recordAndTranscribe({
        prompt: scene.en,
        language: 'en',
        silenceMs: 1800,
        maxMs: 15000,
        registerStop: (f) => (stop.current = f),
        onState: (s) => {
          if (s === 'transcribing') setSt('wait');
        },
      });
      stop.current = null;
      // 녹음 중에 '넘어가기'를 눌렀으면 결과를 버린다(예전엔 그래도 반영돼 대사가 중복됐다)
      if (cancelled.current) return;
      const said = (text || '').trim();
      if (!said) {
        setMsg('소리가 안 잡혔어요. 한 번 더 해볼까요?');
        setSt('idle');
        return;
      }
      bumpSpoken();
      setHeard({ text: said, m: speakMatch(scene.en, said) });
      setSt('heard');
    } catch {
      stop.current = null;
      if (cancelled.current) return;
      setMsg('녹음이나 받아 적기에 실패했어요. 한 번 더 하거나 넘어가도 괜찮아요.');
      setSt('idle');
    }
  }

  const verdict = heard ? (heard.m >= 0.7 ? '좋아요! 거의 똑같이 말했어요 🎉' : heard.m >= 0.4 ? '비슷해요 — 한 번 더 들어보고 말해 볼까요?' : '조금 달라요 — 천천히 한 번 더 들어볼까요?') : '';

  return (
    <div className="dr-act">
      <div className="dr-ask">🎙 태오가 되어 말해 보세요</div>
      <button type="button" className="dr-target" onClick={() => play(scene.en)}>
        <span className="dr-en">🔊 {scene.en}</span>
        <span className="dr-kr">{scene.kr}</span>
      </button>
      {heard && (
        <div className={`dr-note${heard.m >= 0.7 ? ' ok' : ''}`}>
          내가 한 말: “{heard.text}” · {verdict}
        </div>
      )}
      {canVoice && st !== 'heard' && (
        <button type="button" className={`dr-mic${st === 'rec' ? ' on' : ''}`} disabled={st === 'wait'} onClick={() => (st === 'rec' ? stop.current?.() : void rec())} aria-label={st === 'rec' ? '말하기 끝' : '말하기'}>
          {st === 'rec' ? '⏹' : st === 'wait' ? '…' : '🎙'}
        </button>
      )}
      {msg && <p className="dr-msg">{msg}</p>}
      {st === 'heard' && heard ? (
        <div className="dr-row">
          <button type="button" className="btn" onClick={() => { setHeard(null); setSt('idle'); }}>
            다시 말하기
          </button>
          <button type="button" className="btn primary" onClick={() => onDone(heard.text, heard.m)}>
            계속
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="dr-skip"
          onClick={() => {
            cancelled.current = true;
            stop.current?.();
            onDone(null, 0);
          }}
        >
          {canVoice ? '말하지 않고 넘어가기' : '따라 말해 보고 넘어가기 →'}
        </button>
      )}
    </div>
  );
}

function Player({ ep, onEnd }: { ep: Episode; onEnd: (score: number, asked: number) => void }) {
  // 첫머리 복습 — 지난 화 표현 떠올리기(간격 반복)
  const scenes = useMemo<PScene[]>(() => {
    const rc = recallItems(ep.no);
    if (!rc.length) return ep.scenes;
    return [{ type: 'narr', kr: '지난 화 기억나요? 표현 하나만 떠올려 보고 시작해요.' } as Scene, ...rc.map((r) => ({ type: 'recall' as const, ...r })), { type: 'narr', kr: `EP ${ep.no} · ${ep.titleKr}` } as Scene, ...ep.scenes];
  }, [ep]);

  const [i, setI] = useState(0);
  const [log, setLog] = useState<LogItem[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [subs, setSubs] = useState(() => load<boolean>(SUBS_KEY, true));
  const [mute, setMute] = useState(() => load<boolean>(MUTE_KEY, false));
  // 자동 재생 — 대사는 목소리가 끝나고 자막을 읽을 틈만큼 쉬었다가 저절로 넘어간다.
  // 멈추는 곳은 내 차례(참여 문항)뿐이고, 답하면 해설을 읽을 시간 뒤 다시 흐른다.
  const [auto, setAuto] = useState(() => load<boolean>(AUTO_KEY, true));
  const endRef = useRef<HTMLDivElement | null>(null);
  const scene = scenes[i];
  const total = scenes.length;
  const okRef = useRef(0);
  const askedRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useRef(0);
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const muteRef = useRef(mute);
  muteRef.current = mute;
  const iRef = useRef(i);
  iRef.current = i;
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const ended = useRef(false);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      clearTimer();
      token.current++;
      stopSpeaking();
    },
    []
  );
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [log.length, i, picked]);

  const push = (...items: LogItem[]) => setLog((l) => [...l, ...items]);

  function advance() {
    clearTimer();
    token.current++;
    setPicked(null);
    const cur = iRef.current;
    if (cur + 1 >= total) {
      if (ended.current) return;
      ended.current = true;
      stopSpeaking();
      const score = askedRef.current ? Math.round((okRef.current / askedRef.current) * 100) : 100;
      onEnd(score, askedRef.current);
      return;
    }
    setI(cur + 1);
  }

  /** 지금 장면에서 기다렸다가 넘어가도 되는가(자동 재생 켜짐 + 내 차례가 아니거나 이미 답함) */
  const canFlow = () => {
    const sc = scenes[iRef.current];
    return autoRef.current && !!sc && (!INTERACTIVE.has(sc.type) && sc.type !== 'recall' ? true : pickedRef.current !== null);
  };

  /** ms 뒤 다음으로(그 사이 장면이 바뀌었거나 멈췄으면 무시) */
  function scheduleNext(ms: number) {
    clearTimer();
    const at = iRef.current;
    const t = token.current;
    timer.current = setTimeout(() => {
      if (t !== token.current || at !== iRef.current || !canFlow()) return;
      advance();
    }, ms);
  }

  /**
   * 대사들을 순서대로 소리 내고, 다 끝나면 then(). 음소거면 글자 수로 시간을 추정한다.
   * 새 호출이나 장면 전환이 있으면 이전 순서는 조용히 버려진다(token).
   */
  function speakSeq(input: (string | { en: string; who?: string })[], then?: () => void) {
    const lines = input.map((x) => (typeof x === 'string' ? { en: x, who: 'taeo' } : { en: x.en, who: x.who || 'taeo' }));
    clearTimer();
    const t = ++token.current;
    const at = iRef.current;
    const alive = () => t === token.current && at === iRef.current;
    if (!lines.length || muteRef.current) {
      const ms = lines.reduce((a, l) => a + lineMs(l.en), 0);
      timer.current = setTimeout(() => alive() && then?.(), ms);
      return;
    }
    stopSpeaking();
    let k = 0;
    const next = () => {
      if (!alive()) return;
      if (k >= lines.length) {
        then?.();
        return;
      }
      const { en, who } = lines[k++];
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        next();
      };
      // 인물마다 다른 목소리(예전엔 모두 같은 남성 목소리 하나)
      speakText(en, 'en-US', 0.95, go, voiceOf(who));
      // 안전장치 — onend를 안 주는 기기에서도 멈추지 않게
      setTimeout(go, lineMs(en) * 2 + 3000);
    };
    next();
  }

  /** 말풍선 다시 듣기 — 자동 재생 중이면 다 듣고 이어서 흐른다 */
  function replay(en: string, who?: string) {
    if (muteRef.current) return;
    speakSeq([{ en, who }], () => {
      if (canFlow()) scheduleNext(600);
    });
  }

  // 장면 도착 — 해설·대사는 기록에 올리고 소리 낸 뒤 자동으로 넘어간다
  useEffect(() => {
    if (!scene) return;
    if (scene.type === 'narr') {
      push({ kind: 'narr', kr: scene.kr });
      if (autoRef.current) scheduleNext(Math.max(2200, scene.kr.length * 70));
    } else if (scene.type === 'line') {
      push({ kind: 'line', who: scene.who, en: scene.en, kr: scene.kr });
      speakSeq([{ en: scene.en, who: scene.who }], () => {
        if (canFlow()) scheduleNext(700 + (subs ? scene.kr.length * 30 : 0));
      });
    } else if (scene.type === 'meaning') {
      speakSeq([{ en: scene.en, who: scene.who }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const order = useMemo(() => {
    if (!scene || !('opts' in scene)) return [];
    return shuffleIdx(scene.opts.length, ep.no * 31 + i);
  }, [scene, ep.no, i]);

  function grade(good: boolean) {
    askedRef.current += 1;
    if (good) okRef.current += 1;
    haptic(good ? 'success' : 'error');
  }

  /** 답한 뒤: 기록을 순서대로 남기고, 소리를 순서대로 낸 뒤, 해설을 읽을 시간 뒤 흐른다 */
  function afterAnswer(k: number, good: boolean, items: LogItem[], voiceLines: (string | { en: string; who?: string })[]) {
    pickedRef.current = k;
    setPicked(k);
    push(...items);
    speakSeq(voiceLines, () => {
      if (canFlow()) scheduleNext(good ? 1400 : 3400);
    });
  }

  function toggleAuto() {
    const next = !auto;
    store(AUTO_KEY, next);
    setAuto(next);
    autoRef.current = next;
    if (!next) {
      clearTimer();
      token.current++;
      return;
    }
    if (canFlow()) scheduleNext(600);
  }

  const isAct = !!scene && (INTERACTIVE.has(scene.type) || scene.type === 'recall');
  const pct = Math.round((i / total) * 100);

  return (
    <div className="screen dr-screen">
      <div className="dr-top">
        <div className="dr-prog" aria-label={`진행 ${pct}%`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <button type="button" className="mini-btn dr-auto" onClick={toggleAuto} aria-pressed={auto} aria-label={auto ? '자동 재생 멈추기' : '자동 재생'}>
          {auto ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          className="mini-btn"
          onClick={() => {
            store(SUBS_KEY, !subs);
            setSubs((v) => !v);
          }}
          aria-pressed={subs}
        >
          {subs ? '자막 끄기' : '자막 켜기'}
        </button>
        <button
          type="button"
          className="mini-btn"
          onClick={() => {
            const m = !mute;
            store(MUTE_KEY, m);
            setMute(m);
            muteRef.current = m;
            stopSpeaking();
            // 끊긴 대사 때문에 멈춰 있지 않게 — 읽을 시간만 주고 이어서
            if (canFlow()) scheduleNext(1500);
          }}
          aria-label={mute ? '소리 켜기' : '소리 끄기'}
        >
          {mute ? '🔇' : '🔊'}
        </button>
      </div>
      <div className="dr-ep">
        EP {ep.no} · {ep.titleKr}
      </div>

      <div className="dr-log" aria-live="polite">
        {log.map((it, k) => (
          <Bubble key={k} item={it} subs={subs} onReplay={replay} />
        ))}

        {scene?.type === 'recall' && picked === null && (
          <div className="dr-act">
            <div className="dr-ask">🧠 지난 화: “{scene.kr}” — 영어로는?</div>
            {order.map((k) => (
              <button
                key={k}
                type="button"
                className="wd-opt dr-opt"
                onClick={() => {
                  const good = k === scene.a;
                  gradeRecall(scene.en, good);
                  haptic(good ? 'success' : 'error');
                  afterAnswer(k, good, [{ kind: 'note', ok: good, text: `${good ? '기억하고 있네요! ' : '다시 볼게요 — '}“${scene.en}” = ${scene.kr}` }], [scene.en]);
                }}
              >
                {scene.opts[k]}
              </button>
            ))}
          </div>
        )}

        {scene?.type === 'choice' && picked === null && (
          <div className="dr-act">
            <div className="dr-ask">💬 {scene.prompt}</div>
            {order.map((k) => {
              const o = scene.opts[k];
              return (
                <button
                  key={k}
                  type="button"
                  className="wd-opt dr-opt"
                  onClick={() => {
                    grade(o.ok);
                    const right = scene.opts.find((x) => x.ok)!;
                    const items: LogItem[] = [];
                    if (!o.ok && o.why) items.push({ kind: 'note', ok: false, text: `“${o.en}” — ${o.why}` });
                    items.push({ kind: 'line', who: 'taeo', en: right.en, kr: '' });
                    if (right.reply) items.push({ kind: 'line', who: right.reply.who, en: right.reply.en, kr: right.reply.kr });
                    afterAnswer(k, o.ok, items, right.reply ? [right.en, { en: right.reply.en, who: right.reply.who }] : [right.en]);
                  }}
                >
                  {o.en}
                </button>
              );
            })}
          </div>
        )}

        {scene?.type === 'meaning' && picked === null && (
          <div className="dr-act">
            <Bubble item={{ kind: 'line', who: scene.who, en: scene.en, kr: '' }} subs={false} onReplay={replay} />
            <div className="dr-ask">🤔 무슨 뜻일까요?</div>
            {order.map((k) => (
              <button
                key={k}
                type="button"
                className="wd-opt dr-opt"
                onClick={() => {
                  const good = k === scene.a;
                  grade(good);
                  // 답한 뒤에도 대사와 해설이 기록에 남는다
                  afterAnswer(
                    k,
                    good,
                    [
                      { kind: 'line', who: scene.who, en: scene.en, kr: scene.opts[scene.a] },
                      { kind: 'note', ok: good, text: `${good ? '맞아요 — ' : `정답은 “${scene.opts[scene.a]}” — `}${scene.why}` },
                    ],
                    []
                  );
                }}
              >
                {scene.opts[k]}
              </button>
            ))}
          </div>
        )}

        {scene?.type === 'fill' && picked === null && (
          <div className="dr-act">
            <div className="dr-ask">✏️ 빈칸에 들어갈 말은?</div>
            <div className="dr-fill">
              {scene.before} <b className="dr-blank">____</b> {scene.after}
              {subs && <span className="dr-kr">{scene.kr}</span>}
            </div>
            <div className="dr-fill-opts">
              {order.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="wd-opt dr-opt dr-chip"
                  onClick={() => {
                    const good = k === scene.a;
                    grade(good);
                    const full = `${scene.before} ${scene.opts[scene.a]} ${scene.after}`.replace(/\s+/g, ' ').trim();
                    afterAnswer(
                      k,
                      good,
                      [
                        { kind: 'line', who: scene.who, en: full, kr: scene.kr },
                        { kind: 'note', ok: good, text: `${good ? '맞아요 — ' : `정답은 “${scene.opts[scene.a]}” — `}${scene.why}` },
                      ],
                      [{ en: full, who: scene.who }]
                    );
                  }}
                >
                  {scene.opts[k]}
                </button>
              ))}
            </div>
          </div>
        )}

        {scene?.type === 'speak' && picked === null && (
          <SpeakStep
            key={i}
            scene={scene}
            play={(en) => speakSeq([en])}
            onDone={(said, m) => {
              const items: LogItem[] = [{ kind: 'line', who: 'taeo', en: scene.en, kr: scene.kr }];
              afterAnswer(0, true, items, []);
              void said;
              void m;
            }}
          />
        )}
        <div ref={endRef} />
      </div>

      {(!isAct || picked !== null) &&
        (auto ? (
          <button type="button" className="dr-playing" onClick={toggleAuto} aria-label="자동 재생 멈추기">
            <span className="dr-eq" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            자동 재생 중 · 탭하면 멈춤
          </button>
        ) : (
          <button type="button" className="dr-next" onClick={advance}>
            {i + 1 >= total ? '엔딩 보기' : '다음 ▶'}
          </button>
        ))}
    </div>
  );
}

/** 생성 원고가 화면을 죽이면 — 그 원고를 버리고 허브로(시리즈가 영구히 막히지 않게) */
class PlayerGuard extends Component<{ ep: Episode; onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    if (this.props.ep.ai) discardGenerated(this.props.ep.no);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="screen dr-screen">
          <div className="study-card dr-end" role="alert">
            <h2 className="dr-end-title">이 화를 재생하지 못했어요</h2>
            <p className="muted">원고에 문제가 있어 버렸어요. 다시 열면 작가가 새로 써요.</p>
            <button type="button" className="btn primary dr-go" onClick={this.props.onFail}>
              에피소드 목록으로
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Ending({
  ep,
  score,
  binge,
  nextReady,
  hasKey,
  onNext,
  onHub,
  onNavigate,
}: {
  ep: Episode;
  score: number;
  binge: boolean;
  nextReady: boolean;
  hasKey: boolean;
  onNext: () => void;
  onHub: () => void;
  onNavigate?: (m: Mode) => void;
}) {
  const say = (en: string) => {
    stopSpeaking();
    speakText(en, 'en-US', 0.95);
  };
  const canNext = nextReady || hasKey;
  return (
    <div className="screen dr-screen">
      <div className="study-card dr-end">
        <div className="dr-end-ep">EP {ep.no} 완료</div>
        <h2 className="dr-end-title">{ep.titleKr}</h2>
        <div className="dr-end-score">이해도 {score}%</div>
        <div className="dr-sec">오늘의 표현 — 내일 다음 화 첫머리에 다시 물어볼게요</div>
        {ep.learn.map((l, k) => (
          <button key={k} type="button" className="dr-learn" onClick={() => say(l.en)}>
            <b>🔊 {l.en}</b>
            <span>{l.kr}</span>
            {l.note && <em>{l.note}</em>}
          </button>
        ))}
      </div>
      <div className="study-card dr-cliff">
        <div className="dr-sec">다음 화 예고</div>
        <p>{ep.cliff}</p>
        {/* 하루 한 편 — 기본 행동은 '오늘은 여기까지', 더 보기는 보조 */}
        <button type="button" className="btn primary dr-go" onClick={onHub}>
          {binge ? '오늘은 충분해요 — 내일 이어서' : '오늘은 여기까지 — 내일 이어서'}
        </button>
        {canNext ? (
          <button type="button" className="btn ghost dr-go" onClick={onNext}>
            궁금하면 다음 화 미리 보기
          </button>
        ) : (
          <>
            <p className="dr-msg">다음 화부터는 AI 작가가 이어서 써요 — AI를 연결하면 볼 수 있어요.</p>
            {onNavigate && (
              <button type="button" className="btn ghost dr-go" onClick={() => onNavigate('apikey')}>
                AI 연결하기
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function DramaScreen({ onNavigate }: { onNavigate?: (m: Mode) => void } = {}) {
  const [view, setView] = useState<'hub' | 'loading' | 'play' | 'end'>('hub');
  const [ep, setEp] = useState<Episode | null>(null);
  const [score, setScore] = useState(0);
  const [binge, setBinge] = useState(false);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const eps = useMemo(() => allEpisodes(), [tick]);
  const seen = useMemo(() => new Set(watched()), [tick]);
  const nextNo = useMemo(() => nextEpisodeNo(), [tick]);
  const loadingNo = useRef(nextNo);

  async function open(no: number) {
    primeAudio(); // 탭(제스처) 안에서 오디오 언락 — iOS 첫 대사 무음 방지
    setErr('');
    const have = episodeByNo(no);
    if (have) {
      setEp(have);
      setView('play');
      return;
    }
    if (!groqKey()) {
      setErr('NO_KEY');
      setView('hub');
      return;
    }
    loadingNo.current = no;
    setView('loading');
    const made = await generateEpisode(no, overall().level);
    if (!made) {
      setErr('작가가 원고를 완성하지 못했어요(연결 오류나 사용량 한도일 수 있어요). 잠시 후 다시 눌러 주세요.');
      setView('hub');
      return;
    }
    setEp(made);
    setTick((t) => t + 1);
    setView('play');
  }

  useEffect(() => {
    // 홈의 '오늘의 에피소드'에서 들어오면 허브를 건너뛰고 바로 재생
    const t = load<number>(DRAMA_AUTOPLAY_KEY, 0);
    if (t && Date.now() - t < 60_000) {
      store(DRAMA_AUTOPLAY_KEY, 0);
      void open(nextEpisodeNo());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (view === 'loading') {
    return (
      <div className="screen dr-screen">
        <div className="study-card gm-loading" role="status">
          <div className="gm-loading-dot" aria-hidden="true" />
          <b>EP {loadingNo.current}</b>
          <span className="muted">작가가 다음 이야기를 쓰는 중… (보통 10~30초)</span>
          <button type="button" className="btn ghost" onClick={() => setView('hub')}>
            나중에 볼게요
          </button>
        </div>
      </div>
    );
  }
  if (view === 'play' && ep) {
    return (
      <PlayerGuard
        key={ep.no}
        ep={ep}
        onFail={() => {
          setTick((t) => t + 1);
          setView('hub');
        }}
      >
        <Player
          ep={ep}
          onEnd={(s, asked) => {
            // 오늘 이미 다른 화를 봤다면 몰아보기 — 엔딩에서 '내일'을 더 권한다
            setBinge(watchedToday() && !seen.has(ep.no));
            completeEpisode(ep, s, asked);
            setScore(s);
            setTick((t) => t + 1);
            setView('end');
          }}
        />
      </PlayerGuard>
    );
  }
  if (view === 'end' && ep) {
    return (
      <Ending
        ep={ep}
        score={score}
        binge={binge}
        nextReady={!!episodeByNo(ep.no + 1)}
        hasKey={!!groqKey()}
        onNext={() => void open(nextEpisodeNo() > ep.no ? nextEpisodeNo() : ep.no + 1)}
        onHub={() => setView('hub')}
        onNavigate={onNavigate}
      />
    );
  }

  const nextEp = episodeByNo(nextNo);
  const noKeyWall = err === 'NO_KEY';
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
          EP {nextNo} 보기{nextEp ? ` · ${nextEp.titleKr}` : ' · 새 에피소드'}
        </button>
        {noKeyWall ? (
          <>
            <p className="dr-msg">EP {nextNo}부터는 AI 작가가 이어서 써요 — AI를 연결하면 볼 수 있어요.</p>
            {onNavigate && (
              <button type="button" className="btn ghost dr-go" onClick={() => onNavigate('apikey')}>
                AI 연결하기
              </button>
            )}
          </>
        ) : (
          err && <p className="dr-msg">{err}</p>
        )}
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
