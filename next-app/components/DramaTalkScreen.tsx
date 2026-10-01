'use client';

// 화면 전용 스타일 — 이 화면을 처음 열 때 함께 받는다(홈 첫 로딩의 렌더 차단 CSS에서 분리)
import '../app/screens.css';

/**
 * 집중 모드 '회화' — 드라마 인물과 영어로 대화하기.
 *
 * 방금 본 화의 인물(그 화에서 가장 많이 말한 사람)이 그 화 직후 상황에서 태오(나)에게
 * 말을 건다. 나는 목소리로만 답하고(텍스트 입력칸 없음), 막히면 힌트(한국어 → 영어)를 본다.
 * 다섯 번 말하면 끝 — 그 화 표현을 썼는지, 고쳐 준 문장은 복습 카드로 들어갔는지 보여 준다.
 * AI가 없으면 그 화 대사를 인물 목소리로 듣고 따라 말하는 연습으로 대신한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Mode } from './NavBar';
import { primeAudio, speakText, stopSpeaking } from './SpeakButton';
import TtsDegradedChip from './TtsDegradedChip';
import { bumpSpoken, groqKey, load, markPracticedToday, slowRate } from '../lib/state';
import { browserSttAvailable, listenOnce } from '../lib/browserStt';
import { recordAndTranscribe, STT_PROPER_NOUNS, whisperAvailable } from '../lib/stt';
import { groqKoJson } from '../lib/aiGuard';
import { castOf, gradeRecycled, requestDramaAutoplay, speakMatch } from '../lib/drama';
import { saveFixes, talkSetup, talkSystemPrompt, TALK_TURNS, usedExpressions, validateTalk, voiceOf, type TalkReply } from '../lib/dramaTalk';

type Msg = { role: 'partner'; en: string; kr: string } | { role: 'me'; en: string; fix?: { better: string; kr: string; why: string } | null };

const rate = () => (load<boolean>('va_drama_slow', false) ? Math.max(0.6, Math.min(0.9, slowRate())) : 0.95);

/**
 * 키 없이 대사 한 줄 따라 말하기 — 브라우저 받아쓰기가 있으면 얼마나 비슷했는지, 없으면 스스로 확인.
 * 어느 쪽이든 한 줄에 한 번 '말한 문장'으로 센다(집중 모드 퀘스트 '3문장 말하기'가 채워지게).
 */
function ShadowLine({ who, en, kr, onHear }: { who: string; en: string; kr: string; onHear: () => void }) {
  const [st, setSt] = useState<'idle' | 'rec' | 'done'>('idle');
  const [msg, setMsg] = useState('');
  const counted = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  const sr = browserSttAvailable();
  const count = () => {
    if (counted.current) return;
    counted.current = true;
    bumpSpoken();
  };
  async function rec() {
    if (st === 'rec') {
      stop.current?.();
      return;
    }
    stopSpeaking();
    setSt('rec');
    setMsg('');
    try {
      const said = (await listenOnce({ lang: 'en-US', maxMs: 12000, registerStop: (f) => (stop.current = f) })).trim();
      if (!said) {
        setMsg('소리가 안 잡혔어요. 한 번 더 해볼까요?');
        setSt('idle');
        return;
      }
      count();
      const m = speakMatch(en, said);
      setMsg(`“${said}” · ${m >= 0.7 ? '거의 똑같아요 👍' : m >= 0.4 ? '비슷해요 — 한 번 더 들어볼까요?' : '조금 달라요 — 천천히 다시 들어봐요'}`);
      setSt('done');
    } catch {
      setMsg('받아쓰기를 못 했어요. 말한 뒤 ✓를 눌러도 괜찮아요.');
      setSt('idle');
    }
  }
  return (
    <div className="dr-learn dt-shadow">
      <button type="button" className="dt-shadow-hear" onClick={onHear}>
        <b>
          🔊 {castOf(who).name}: {en}
        </b>
        <span>{kr}</span>
      </button>
      <div className="dt-shadow-row">
        {sr && (
          <button type="button" className={`mini-btn${st === 'rec' ? ' active' : ''}`} onClick={() => void rec()} aria-label={st === 'rec' ? '말하기 끝' : `따라 말하기: ${en}`}>
            {st === 'rec' ? '⏹' : '🎙'}
          </button>
        )}
        <button
          type="button"
          className={`mini-btn${counted.current ? ' active' : ''}`}
          onClick={() => {
            count();
            setSt('done');
            if (!msg) setMsg('좋아요! 소리 내어 말한 문장으로 셌어요.');
          }}
          aria-label="소리 내어 말했어요"
        >
          ✓ 말했어요
        </button>
      </div>
      {msg && (
        <span className="dt-shadow-msg" role="status">
          {msg}
        </span>
      )}
    </div>
  );
}

export default function DramaTalkScreen({ onNavigate }: { onNavigate?: (m: Mode) => void } = {}) {
  const setup = useMemo(() => talkSetup(), []);
  const [phase, setPhase] = useState<'intro' | 'talk' | 'done'>('intro');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hint, setHint] = useState<TalkReply['hint']>(null);
  const [showHint, setShowHint] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<'idle' | 'rec' | 'wait'>('idle');
  const [err, setErr] = useState('');
  const [subs, setSubs] = useState(() => load<boolean>('va_drama_subs', true));
  const stopRec = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const endRef = useRef<HTMLDivElement | null>(null);
  const hasKey = !!groqKey();
  // 키가 있으면 Whisper, 없으면 브라우저 내장 받아쓰기(대화 자체는 AI가 필요하다)
  const useWhisper = whisperAvailable() && hasKey;
  const canMic = useWhisper || browserSttAvailable();
  const myTurns = msgs.filter((m) => m.role === 'me').length;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopRec.current?.();
      stopSpeaking();
    };
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [msgs.length, busy, showHint]);

  if (!setup) {
    return (
      <div className="screen dr-screen">
        <div className="study-card dr-end">
          <div className="pg-kicker">드라마 인물과 대화하기</div>
          <h2 className="dr-end-title">먼저 드라마 1화를 봐요</h2>
          <p className="muted">한 화를 보고 나면, 그 화에 나온 인물이 태오(나)에게 영어로 말을 걸어요. 그 화에서 배운 표현을 직접 써 보는 시간이에요.</p>
          <button
            type="button"
            className="btn primary dr-go"
            onClick={() => {
              primeAudio();
              requestDramaAutoplay();
              onNavigate?.('drama');
            }}
          >
            1화 보러 가기
          </button>
        </div>
      </div>
    );
  }

  const { ep, partner } = setup;
  const pc = castOf(partner);
  const say = (en: string, who = partner, then?: () => void) => {
    stopSpeaking();
    speakText(en, 'en-US', rate(), then, voiceOf(who));
  };

  /** AI 대사 받기 — 실패하면 null(같은 차례를 다시 시도할 수 있게) */
  async function ask(history: Msg[]): Promise<TalkReply | null> {
    const convo = history.map((m) => (m.role === 'partner' ? { role: 'assistant', content: JSON.stringify({ reply: m.en, kr: m.kr }) } : { role: 'user', content: m.en }));
    const messages = [{ role: 'system', content: talkSystemPrompt(setup!) }, ...(convo.length ? convo : [{ role: 'user', content: `(대화 시작 — ${pc.name}가 먼저 상황에 맞게 태오에게 말을 건다)` }])];
    try {
      return await groqKoJson(messages, { temperature: 0.8, maxTokens: 900 }, validateTalk);
    } catch {
      return null;
    }
  }

  function receive(r: TalkReply) {
    setMsgs((m) => [...m, { role: 'partner', en: r.reply, kr: r.kr }]);
    setHint(r.hint);
    setShowHint(0);
    say(r.reply);
  }

  async function start() {
    primeAudio();
    setPhase('talk');
    setBusy(true);
    setErr('');
    const r = await ask([]);
    if (!alive.current) return;
    setBusy(false);
    if (!r) {
      setErr('AI 연결이 불안정해요. 잠시 후 다시 눌러 주세요.');
      setPhase('intro');
      return;
    }
    receive(r);
  }

  async function send(said: string) {
    const mine: Msg = { role: 'me', en: said };
    const history = [...msgs, mine];
    setMsgs(history);
    bumpSpoken();
    setBusy(true);
    setErr('');
    const r = await ask(history);
    if (!alive.current) return;
    setBusy(false);
    if (!r) {
      // 내 말은 남기고, 같은 차례를 다시 이어 갈 수 있게
      setErr('답을 받지 못했어요. 🔄 다시 받기를 눌러 주세요.');
      return;
    }
    if (r.fix) setMsgs((m) => m.map((x, k) => (k === history.length - 1 && x.role === 'me' ? { ...x, fix: r.fix } : x)));
    receive(r);
  }

  async function retry() {
    setBusy(true);
    setErr('');
    const r = await ask(msgs);
    if (!alive.current) return;
    setBusy(false);
    if (!r) {
      setErr('아직 연결이 안 돼요. 조금 뒤에 다시 시도해 주세요.');
      return;
    }
    receive(r);
  }

  async function talk() {
    if (rec === 'rec') {
      stopRec.current?.();
      return;
    }
    stopSpeaking();
    setErr('');
    setRec('rec');
    try {
      // 받아쓰기 힌트에 모범 문장을 넣지 않는다(받아쓰기가 그쪽으로 끌려간다) — 고유명사만
      const text = useWhisper
        ? (
            await recordAndTranscribe({
              prompt: STT_PROPER_NOUNS,
              // 이중언어 회화 — 한국어로 말해도 한글로 받아써지도록 언어 자동 감지(예전엔 서버가 영어로 고정했다).
              // 세그먼트만 받는다(게이트용) — 회화는 WPM을 재지 않으므로 단어 타임스탬프는 불필요.
              language: 'auto',
              detail: 'segments',
              silenceMs: 1800,
              maxMs: 20000,
              registerStop: (f) => (stopRec.current = f),
              onState: (st) => {
                if (st === 'transcribing') setRec('wait');
              },
            })
          ).text
        : await listenOnce({ lang: 'en-US', maxMs: 15000, registerStop: (f) => (stopRec.current = f) });
      stopRec.current = null;
      if (!alive.current) return;
      setRec('idle');
      const said = (text || '').trim();
      if (!said) {
        setErr('소리가 안 잡혔어요. 한 번 더 말해 볼까요?');
        return;
      }
      void send(said);
    } catch {
      stopRec.current = null;
      if (!alive.current) return;
      setRec('idle');
      setErr('녹음이나 받아 적기에 실패했어요. 마이크 권한을 확인하거나, 아래 힌트 문장으로 대신 말할 수 있어요.');
    }
  }

  function finish(all: Msg[]) {
    const said = all.filter((m): m is Extract<Msg, { role: 'me' }> => m.role === 'me').map((m) => m.en);
    const fixes = all.flatMap((m) => (m.role === 'me' && m.fix ? [m.fix] : []));
    saveFixes(ep, fixes);
    // 대화 속에서 지난 표현을 스스로 꺼내 썼다면 = 간격 반복 한 번 맞힘
    for (const x of said) {
      try {
        gradeRecycled(x, true, ep.no + 1);
      } catch {
        /* 복습 기록 실패는 대화를 막지 않는다 */
      }
    }
    markPracticedToday();
    setPhase('done');
  }

  /* ── AI 없이: 그 화 대사를 인물 목소리로 듣고 따라 말하기 ── */
  if (!hasKey) {
    const lines = ep.scenes.flatMap((s) => (s.type === 'line' || s.type === 'speak' ? [{ who: s.who, en: s.en, kr: s.kr }] : [])).slice(0, 8);
    return (
      <div className="screen dr-screen">
        <div className="study-card dr-end">
          <div className="pg-kicker">드라마 인물과 대화하기</div>
          <h2 className="dr-end-title">
            {pc.icon} {pc.name}와 대화하려면 AI 연결이 필요해요
          </h2>
          <p className="muted">연결 전에는 EP {ep.no} 대사를 인물 목소리로 듣고 따라 말해 봐요.</p>
          {onNavigate && (
            <button type="button" className="btn primary dr-go" onClick={() => onNavigate('apikey')}>
              AI 연결하기
            </button>
          )}
        </div>
        <div className="pg-sec-h">EP {ep.no} 대사 따라 말하기</div>
        <p className="dr-tip">🔊로 인물 목소리를 듣고, 🎙로 따라 말해요{browserSttAvailable() ? '' : '(말한 뒤 ✓를 눌러요)'}.</p>
        {lines.map((l, k) => (
          <ShadowLine key={k} who={l.who} en={l.en} kr={l.kr} onHear={() => say(l.en, l.who)} />
        ))}
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="screen dr-screen">
        <div className="study-card dr-hero">
          <div className="pg-kicker">드라마 인물과 대화하기 · EP {ep.no} 그 후</div>
          <h2 className="dr-hero-title">
            {pc.icon} {pc.name}
          </h2>
          <p className="muted">{pc.desc}</p>
          <p className="dt-situation">{ep.cliff}</p>
          <div className="dr-sec">오늘 써 볼 표현</div>
          {ep.learn.map((l, k) => (
            <button key={k} type="button" className="dr-learn" onClick={() => say(l.en, 'taeo')}>
              <b>🔊 {l.en}</b>
              <span>{l.kr}</span>
            </button>
          ))}
          <p className="dr-tip">
            {pc.name}가 먼저 말을 걸어요. 나는 🎙 버튼을 눌러 영어로 {TALK_TURNS}번 대답하면 끝. 막히면 💡 힌트, 한국어로 말해도 괜찮아요.
          </p>
          <button type="button" className="btn primary dr-go" onClick={() => void start()} disabled={busy}>
            대화 시작
          </button>
          {err && (
            <p className="dr-msg" role="alert">
              {err}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const said = msgs.filter((m): m is Extract<Msg, { role: 'me' }> => m.role === 'me').map((m) => m.en);
    const used = usedExpressions(ep, said);
    const fixes = msgs.flatMap((m) => (m.role === 'me' && m.fix ? [m.fix] : []));
    return (
      <div className="screen dr-screen">
        <div className="study-card dr-end">
          <div className="dr-end-ep">
            {pc.icon} {pc.name}와 대화 완료
          </div>
          <h2 className="dr-end-title">영어로 {said.length}번 말했어요 👏</h2>
          <div className="dr-sec">오늘 표현</div>
          {ep.learn.map((l, k) => (
            <div key={k} className={`dr-note${used.includes(l.en) ? ' ok' : ''}`}>
              {used.includes(l.en) ? '✓ 직접 썼어요' : '다음엔 써 봐요'} — “{l.en}” {l.kr}
            </div>
          ))}
          {fixes.length > 0 && (
            <>
              <div className="dr-sec">더 자연스러운 말 — 복습 카드에 담았어요</div>
              {fixes.map((f, k) => (
                <button key={k} type="button" className="dr-learn" onClick={() => say(f.better, 'taeo')}>
                  <b>🔊 {f.better}</b>
                  <span>{f.kr || f.why}</span>
                  <em>{f.why}</em>
                </button>
              ))}
            </>
          )}
          <button
            type="button"
            className="btn primary dr-go"
            onClick={() => {
              setMsgs([]);
              setHint(null);
              setPhase('intro');
            }}
          >
            한 번 더 대화하기
          </button>
          {onNavigate && (
            <button type="button" className="btn ghost dr-go" onClick={() => onNavigate('master')}>
              홈으로
            </button>
          )}
        </div>
      </div>
    );
  }

  const last = msgs[msgs.length - 1];
  // 다섯 번 대답했으면 상대의 마지막 말을 듣고 마무리
  const over = myTurns >= TALK_TURNS && last?.role === 'partner';
  const waitingMe = !busy && last?.role === 'partner' && !over;
  return (
    <div className="screen dr-screen">
      <TtsDegradedChip />
      <div className="dr-top">
        <div className="dr-prog" aria-label={`대답 ${myTurns}/${TALK_TURNS}`}>
          <span style={{ width: `${(myTurns / TALK_TURNS) * 100}%` }} />
        </div>
        <button type="button" className="mini-btn" onClick={() => setSubs((v) => !v)} aria-pressed={subs}>
          {subs ? '자막 끄기' : '자막 켜기'}
        </button>
      </div>
      <div className="dr-ep">
        {pc.icon} {pc.name}와 대화 · 대답 {myTurns}/{TALK_TURNS}
      </div>
      <div className="dr-log" aria-live="polite">
        {msgs.map((m, k) =>
          m.role === 'partner' ? (
            <div key={k} className="dr-line">
              <span className="dr-av" aria-hidden="true">
                {pc.icon}
              </span>
              <button type="button" className="dr-bub" onClick={() => say(m.en)} aria-label={`${pc.name}: ${m.en} (다시 듣기)`}>
                <span className="dr-name">{pc.name}</span>
                <span className="dr-en">{m.en}</span>
                {subs && <span className="dr-kr">{m.kr}</span>}
              </button>
            </div>
          ) : (
            <div key={k}>
              <div className="dr-line me">
                <div className="dr-bub">
                  <span className="dr-en">{m.en}</span>
                </div>
                <span className="dr-av" aria-hidden="true">
                  {castOf('taeo').icon}
                </span>
              </div>
              {m.fix && (
                <button type="button" className="dr-note dt-fix" onClick={() => say(m.fix!.better, 'taeo')}>
                  ✏️ 더 자연스럽게: “{m.fix.better}” — {m.fix.why}
                </button>
              )}
            </div>
          )
        )}
        {busy && (
          <div className="dr-narr" role="status">
            {pc.name}가 생각하는 중…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {err && (
        <p className="dr-msg" role="alert">
          {err}
        </p>
      )}
      {!busy && last?.role === 'me' && (
        <button type="button" className="btn ghost dr-go" onClick={() => void retry()}>
          🔄 다시 받기
        </button>
      )}
      {over && (
        <button type="button" className="btn primary dr-go" onClick={() => finish(msgs)}>
          대화 마치기 — 오늘 쓴 표현 보기
        </button>
      )}
      {waitingMe && (
        <div className="dr-act">
          {hint && (
            <div className="dt-hint">
              {showHint === 0 && (
                <button type="button" className="dr-skip" onClick={() => setShowHint(1)}>
                  💡 뭐라고 하지? 힌트 보기
                </button>
              )}
              {showHint >= 1 && (
                <button type="button" className="dr-target" onClick={() => (showHint === 1 ? setShowHint(2) : say(hint.en, 'taeo'))}>
                  <span className="dr-kr">💡 {hint.kr}</span>
                  {showHint === 2 ? <span className="dr-en">🔊 {hint.en}</span> : <span className="dr-en muted">영어 문장 보기 ›</span>}
                </button>
              )}
            </div>
          )}
          {canMic ? (
            <button type="button" className={`dr-mic${rec === 'rec' ? ' on' : ''}`} disabled={rec === 'wait'} onClick={() => void talk()} aria-label={rec === 'rec' ? '말하기 끝' : '영어로 대답하기'}>
              {rec === 'rec' ? '⏹' : rec === 'wait' ? '…' : '🎙'}
            </button>
          ) : null}
          {(!canMic || err.includes('마이크')) && hint && (
            // 받아쓰기를 못 쓰는 기기 — 힌트를 듣고 소리 내어 말한 뒤 스스로 확인(말하지 않고 보내는 버튼이 아니다)
            <button
              type="button"
              className="btn ghost dr-go"
              onClick={() => {
                say(hint.en, 'taeo');
                void send(hint.en);
              }}
            >
              🗣 힌트 문장을 소리 내어 말했어요 ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}
