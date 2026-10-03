'use client';

// 화면 전용 스타일 — 이 화면을 처음 열 때 함께 받는다(홈 첫 로딩의 렌더 차단 CSS에서 분리)
import '../app/screens.css';

/**
 * 집중 모드 '회화' — 드라마 인물과 영어로 대화하기.
 *
 * 방금 본 화의 인물(그 화에서 가장 많이 말한 사람)이 그 화 직후 상황에서 태오(나)에게
 * 말을 건다. 나는 목소리로만 답하고(텍스트 입력칸 없음), 막히면 힌트(한국어 → 영어)를 본다.
 * 다섯 번 말하면 끝 — 그 화 표현을 썼는지, 고쳐 준 문장은 복습 카드로 들어갔는지 보여 준다.
 * AI가 없으면 그 화 대사를 역할극(RoleStep)으로 듣고 따라 말하는 연습으로 대신한다.
 *
 * M6 교정 게이트(플래그 fixGate, 키 있을 때):
 *  ① 턴마다 반응 지연 칩 '⏱ 1.8초'(인물 TTS 끝 → 내 첫 유성)
 *  ② fix가 오면 FixGate — 인물 목소리로 듣고 ≥60점 따라 말하기 1회(실패해도 통과·회상 큐), 그동안 인물의 다음 말은 기다린다
 *  ③ 🎙 길게 누르기(400ms) → 한국어로 녹음(language 'ko') → 인물이 받아 주고 '이렇게 말해 보세요: hint.en'
 *  ④ 3번째 턴 전 리액션 턴(ReactionTurn — 두 문장 사이 2.0초, clarify면 0.8× 재발화)
 *  ⑤ 발화마다 L1 간섭·콩글리시 규칙(detectL1) — AI fix가 없어도 규칙 교정을 게이트로
 *  ⑥ 종료: 표현 사용✓·반응 중앙값·교정 재발화 N/M·리액션 수·필러 + 화·금 LadderMini / 그 외 날 CAF-lite 증거(src 'dtalk')
 * 기록: logAttempt(src 'dtalk') — 홈 DramaCard '회화' 점, bumpSpoken, setStrand('output'), va_dtalk_stats.
 * 플래그 off면 예전 동작(fix 듣기 버튼만, 키 없음은 대사 따라 말하기 목록).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Mode } from './NavBar';
import { primeAudio, speakText, stopSpeaking } from './SpeakButton';
import TtsDegradedChip from './TtsDegradedChip';
import { bumpSpoken, groqKey, load, markPracticedToday, slowRate } from '../lib/state';
import { browserSttAvailable, listenOnce } from '../lib/browserStt';
import { whisperAvailable } from '../lib/stt';
import { gateMessage } from '../lib/sttQuality';
import { groqKoJson, hasHangul } from '../lib/aiGuard';
import { castNameKo, castOf, gradeRecycled, requestDramaAutoplay, speakMatch, withIGa } from '../lib/drama';
import { dayLite } from '../lib/homeLite';
import { saveFixes, talkSetup, talkSystemPrompt, TALK_TURNS, usedExpressions, validateTalk, voiceOf, type TalkReply } from '../lib/dramaTalk';
import { isOn } from '../lib/flags';
import { logAttempt } from '../lib/reviewEngine';
import { detectL1 } from '../lib/l1Grammar';
import { recordSkillResult } from '../lib/cefrGrowth';
import { cafLite, taskCefr } from '../lib/cafLite';
import { markInteraction, setDaySession, setStrand, startDayTracking } from '../lib/dayGovernor';
import { pickReactionHints } from '../lib/reactions';
import { fillerText, L1_LABEL } from '../lib/speakLabels';
import { recAvailable, recOnce } from '../lib/dtalkRec';
import {
  dtalkEvidenceScore,
  fillerCount,
  fixFromL1,
  gateTallyLabel,
  isLadderDay,
  latencyLabel,
  longestSentence,
  median,
  recordL1,
  saveDtalkStats,
  shouldReactionTurn,
  splitForReaction,
  turnLatencyMs,
  wpmOf,
  type GateResult,
  type ReactionVerdict,
  type TalkFix,
} from '../lib/fixGate';

// 게이트·리액션·사다리·역할극은 이 화면 청크 안에서도 따로 받는다(키 없는 날·플래그 off엔 안 받는다)
const FixGate = dynamic(() => import('./dtalk/FixGate'), { ssr: false, loading: () => null });
const ReactionTurn = dynamic(() => import('./dtalk/ReactionTurn'), { ssr: false, loading: () => null });
const LadderMini = dynamic(() => import('./dtalk/LadderMini'), { ssr: false, loading: () => null });
const RoleStep = dynamic(() => import('./drama/RoleStep'), { ssr: false, loading: () => <div className="dr-act rs-loading">🎙 준비 중…</div> });

type MeMsg = {
  role: 'me';
  en: string;
  /** 한국어로 말한 턴은 5턴에 세지 않는다(영어로 다시 말해야 완료) */
  lang?: 'en' | 'ko';
  fix?: TalkFix | null;
  /** L1 간섭 칩 문구('hand phone → cell phone') */
  l1?: string | null;
  latencyMs?: number;
  gate?: GateResult;
};
type PartnerMsg = { role: 'partner'; en: string; kr: string; reaction?: ReactionVerdict };
type Msg = PartnerMsg | MeMsg;

/** 영어로 한 내 턴 수(한국어 턴 제외) */
const enTurns = (ms: Msg[]) => ms.filter((m) => m.role === 'me' && m.lang !== 'ko').length;
/** 길게 누르기 기준 */
const LONG_PRESS_MS = 400;

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

/**
 * 키 없음(M6) — 그 화 대사 8줄 + 리액션 뱅크 3개를 역할극(RoleStep)으로 하나씩 듣고 따라 말한다.
 * 받아쓰기가 있으면 채점(webspeech), 없으면(iOS PWA) 자기확인. 기록은 logRoleResult(src 'dtalk').
 * 리액션 턴·교정 게이트·사다리·CAF는 AI가 필요해 여기엔 없다.
 */
function KeylessRole({ ep, rate }: { ep: NonNullable<ReturnType<typeof talkSetup>>['ep']; rate: number }) {
  const items = useMemo(() => {
    const lines = ep.scenes.flatMap((s, idx) => (s.type === 'line' || s.type === 'speak' ? [{ idx, who: s.who, en: s.en, kr: s.kr, react: false }] : [])).slice(0, 8);
    const reacts = pickReactionHints(lines[lines.length - 1]?.en || '', 3, 'A1').map((r, k) => ({ idx: 900 + k, who: 'taeo', en: r.en, kr: r.kr, react: true }));
    return [...lines, ...reacts];
  }, [ep]);
  const [i, setI] = useState(0);
  const cur = items[i];
  if (!cur) {
    return (
      <div className="study-card dr-end">
        <h2 className="dr-end-title">대사·리액션 {items.length}개 따라 말하기 끝 👏</h2>
        <button type="button" className="btn ghost dr-go" onClick={() => setI(0)}>
          처음부터 한 번 더
        </button>
      </div>
    );
  }
  return (
    <div className="fgate-keyless">
      <div className="pg-sec-h">
        {cur.react ? '리액션 한마디 따라 말하기' : `EP ${ep.no} 대사 따라 말하기`} · {i + 1}/{items.length}
      </div>
      <div className="dr-line">
        <span className="dr-av" aria-hidden="true">
          {castOf(cur.who).icon}
        </span>
        <div className="dr-bub">
          <span className="dr-name">{castOf(cur.who).name}</span>
          <span className="dr-kr">{cur.kr}</span>
        </div>
      </div>
      <RoleStep
        key={i}
        scene={{ idx: cur.idx, who: cur.who, en: cur.en, kr: cur.kr }}
        epNo={ep.no}
        mode="role"
        maxSkips={Infinity}
        rate={rate}
        // 기록은 RoleStep이 한 번만(출처 'dtalk' — 홈 '회화' 점). 여기서 다시 logRoleResult 하면 한 줄이 두 문장으로 셌다
        logSrc="dtalk"
        onDone={() => setI((n) => n + 1)}
      />
    </div>
  );
}

/** 사다리 없는 날의 CAF-lite 증거 1회 — 이번 대화 전사로 말하기 수준을 보고 cefrGrowth에 src 'dtalk'로 남긴다 */
function CafNote({ said, level, learn }: { said: string[]; level: string; learn: string[] }) {
  const [res, setRes] = useState<Awaited<ReturnType<typeof cafLite>> | 'wait'>('wait');
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    let on = true;
    void cafLite(said.join(' '), { level, learn }).then((r) => {
      if (r) {
        try {
          recordSkillResult('speaking', taskCefr(level), dtalkEvidenceScore(level, r.level), 'dtalk');
        } catch {
          /* 증거 기록 실패는 화면을 막지 않는다 */
        }
      }
      if (on) setRes(r);
    });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (res === 'wait') return <p className="fgate-caf muted">📈 이번 대화 말하기 수준을 보는 중…</p>;
  if (!res) return null;
  return (
    <div className="fgate-caf" role="status">
      <b>📈 말하기 증거 1건 — 이번 대화는 {res.level} 수준</b>
      {res.fix && (
        <span>
          “{res.fix.wrong}” → <span lang="en">“{res.fix.better}”</span> — {res.fix.kr}
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
  const [recLang, setRecLang] = useState<'en' | 'ko'>('en');
  const [err, setErr] = useState('');
  const [subs, setSubs] = useState(() => load<boolean>('va_drama_subs', true));
  /** 게이트 대기 — 인물의 다음 말(r)은 따라 말하기가 끝난 뒤에 */
  const [pending, setPending] = useState<{ r: TalkReply; idx: number; fix: TalkFix; enCount: number } | null>(null);
  const [reaction, setReaction] = useState<{ first: string; rest: string } | null>(null);
  /** 방금 한국어로 말했다 — '이렇게 말해 보세요: hint.en' */
  const [koHint, setKoHint] = useState(false);
  const stopRec = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const endRef = useRef<HTMLDivElement | null>(null);
  /** 인물 TTS가 끝난 시각(반응 지연의 시작점) — 새 대사를 말하기 시작하면 null */
  const partnerEnd = useRef<number | null>(null);
  /** 직전에 스피커로 나간 인물 대사 — echo 게이트 */
  const lastTts = useRef('');
  const reactionDone = useRef(false);
  const fillers = useRef(0);
  const koTurns = useRef(0);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const hasKey = !!groqKey();
  // M6 플래그 — off면 예전 동작(fix 듣기 버튼만·리액션 턴 없음·키 없음은 대사 목록)
  const [gateOn] = useState(() => isOn('fixGate'));
  // 키가 있으면 Whisper, 없으면 브라우저 내장 받아쓰기(대화 자체는 AI가 필요하다)
  const useWhisper = whisperAvailable() && hasKey;
  const canMic = useWhisper || browserSttAvailable();
  const myTurns = enTurns(msgs);

  useEffect(() => {
    alive.current = true;
    startDayTracking();
    return () => {
      alive.current = false;
      stopRec.current?.();
      stopSpeaking();
      setDaySession(false);
      if (longTimer.current) clearTimeout(longTimer.current);
    };
  }, []);
  useEffect(() => {
    // 대화 중은 하루 시간(산출 갈래)으로 센다
    setDaySession(phase === 'talk');
  }, [phase]);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [msgs.length, busy, showHint, pending, reaction]);

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
  /** 인물 대사 재생 — 끝난 시각을 반응 지연의 시작점으로 */
  const sayPartner = (en: string) => {
    partnerEnd.current = null;
    lastTts.current = en;
    say(en, partner, () => {
      partnerEnd.current = Date.now();
    });
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

  function receive(r: TalkReply, enCount: number) {
    setMsgs((m) => [...m, { role: 'partner', en: r.reply, kr: r.kr }]);
    setHint(r.hint);
    setShowHint(0);
    // M6 리액션 턴 — 3번째 내 턴 직전, 근황 두 문장 사이 2.0초
    const sp = splitForReaction(r.reply);
    if (sp && shouldReactionTurn({ enabled: gateOn && recAvailable(), myTurns: enCount, reply: r.reply, reaction: r.reaction, done: reactionDone.current })) {
      reactionDone.current = true;
      partnerEnd.current = null;
      lastTts.current = r.reply;
      setReaction(sp);
      return;
    }
    sayPartner(r.reply);
  }

  function onReactionDone(v: ReactionVerdict) {
    setMsgs((m) => {
      const k = m.map((x) => x.role).lastIndexOf('partner');
      return k < 0 ? m : m.map((x, j) => (j === k && x.role === 'partner' ? { ...x, reaction: v } : x));
    });
    partnerEnd.current = Date.now();
    setReaction(null);
  }

  function onGateDone(res: GateResult) {
    const p = pending;
    if (!p) return;
    setMsgs((m) => m.map((x, k) => (k === p.idx && x.role === 'me' ? { ...x, gate: res } : x)));
    setPending(null);
    receive(p.r, p.enCount);
  }

  async function start() {
    primeAudio();
    setPhase('talk');
    setStrand('output');
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
    receive(r, 0);
  }

  async function send(said: string, meta: { lang: 'en' | 'ko'; latencyMs?: number; durationMs?: number; voiceOnsetMs?: number } = { lang: 'en' }) {
    const { lang } = meta;
    // L1 간섭·콩글리시(규칙, AI 0) — 턴당 1개
    const hit = gateOn && lang === 'en' ? detectL1(said, 1)[0] : undefined;
    const mine: MeMsg = { role: 'me', en: said, lang, latencyMs: lang === 'en' ? meta.latencyMs : undefined, l1: hit ? `“${hit.wrong.trim()}”` : null };
    const history = [...msgs, mine];
    setMsgs(history);
    if (lang === 'en') {
      bumpSpoken();
      fillers.current += fillerCount(said);
      if (hit) recordL1(said, hit);
    } else koTurns.current++;
    markInteraction();
    setKoHint(false);
    setBusy(true);
    setErr('');
    const r = await ask(history);
    if (!alive.current) return;
    setBusy(false);
    const enCount = enTurns(history);
    if (lang === 'en') {
      // 홈 DramaCard '회화' 점은 오늘 src 'dtalk' 시도를 본다. 자유 발화라 목표 문장이 없어 점수는 교정 여부로만.
      logAttempt({
        t: Date.now(),
        en: said,
        score: r?.fix ? 50 : hit ? 60 : 100,
        src: 'dtalk',
        latencyMs: meta.latencyMs,
        durationMs: meta.durationMs,
        wpm: wpmOf(said, meta.durationMs, meta.voiceOnsetMs),
        quality: 'ok',
      });
    }
    if (!r) {
      // 내 말은 남기고, 같은 차례를 다시 이어 갈 수 있게
      setErr('답을 받지 못했어요. 🔄 다시 받기를 눌러 주세요.');
      return;
    }
    const fix: TalkFix | null = lang !== 'en' ? null : r.fix ? { ...r.fix } : hit ? fixFromL1(hit) : null;
    if (fix) setMsgs((m) => m.map((x, k) => (k === history.length - 1 && x.role === 'me' ? { ...x, fix } : x)));
    if (gateOn && fix) {
      // 교정 → 다시 말하기 — 인물의 다음 말은 게이트가 끝난 뒤
      stopSpeaking();
      setPending({ r, idx: history.length - 1, fix, enCount });
      return;
    }
    receive(r, enCount);
    if (lang === 'ko') {
      // 한국어로 말했으면 영어 문장을 바로 펼쳐 둔다 — 그 문장을 말해야 이 턴이 끝난다
      setKoHint(true);
      setShowHint(2);
    }
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
    receive(r, enTurns(msgs));
  }

  async function talk(mode: 'auto' | 'ko' = 'auto') {
    if (rec === 'rec') {
      stopRec.current?.();
      return;
    }
    stopSpeaking();
    setErr('');
    setRec('rec');
    setRecLang(mode === 'ko' ? 'ko' : 'en');
    try {
      const r = await recOnce({
        // 이중언어 회화 — 한국어로 말해도 한글로 받아써지도록 언어 자동 감지. 길게 누르기는 한국어로 고정.
        // 세그먼트만 받는다(게이트용) — 회화는 단어 타임스탬프가 필요 없다.
        language: mode === 'ko' ? 'ko' : 'auto',
        silenceMs: 1800,
        maxMs: 20000,
        // 회화 턴은 인물과 다른 말을 한다 — 스피커 누출(직전 인물 대사와 ≥80% 일치)을 거른다
        lastTtsText: lastTts.current || undefined,
        registerStop: (f) => (stopRec.current = f),
        onState: (st) => {
          if (st === 'transcribing') setRec('wait');
        },
      });
      stopRec.current = null;
      if (!alive.current) return;
      setRec('idle');
      if (r.block) {
        logAttempt({ t: Date.now(), en: '', score: 0, src: 'dtalk', durationMs: r.durationMs, quality: r.block });
        setErr(gateMessage(r.block));
        return;
      }
      const said = r.text;
      if (!said) {
        setErr('소리가 안 잡혔어요. 한 번 더 말해 볼까요?');
        return;
      }
      const ko = gateOn && (mode === 'ko' || hasHangul(said));
      const latencyMs = turnLatencyMs({ partnerEndAt: partnerEnd.current, recStartAt: r.recStartAt, voiceOnsetMs: r.voiceOnsetMs });
      void send(said, { lang: ko ? 'ko' : 'en', latencyMs, durationMs: r.durationMs, voiceOnsetMs: r.voiceOnsetMs });
    } catch {
      stopRec.current = null;
      if (!alive.current) return;
      setRec('idle');
      setErr('녹음이나 받아 적기에 실패했어요. 마이크 권한을 확인하거나, 아래 힌트 문장으로 대신 말할 수 있어요.');
    }
  }

  function finish(all: Msg[]) {
    const mine = all.filter((m): m is MeMsg => m.role === 'me');
    const said = mine.filter((m) => m.lang !== 'ko').map((m) => m.en);
    // 규칙(L1) 교정은 이미 recordL1로 남겼고 뜻(kr)이 없어 복습 카드가 안 된다 — AI 교정만 wrong을 붙여 교정 축적
    const fixes = mine.flatMap((m) => (m.fix ? [{ ...m.fix, wrong: m.fix.rule ? undefined : m.fix.wrong || m.en }] : []));
    saveFixes(ep, fixes);
    // 대화 속에서 지난 표현을 스스로 꺼내 썼다면 = 간격 반복 한 번 맞힘
    for (const x of said) {
      try {
        gradeRecycled(x, true, ep.no + 1);
      } catch {
        /* 복습 기록 실패는 대화를 막지 않는다 */
      }
    }
    if (gateOn) {
      const gates = mine.flatMap((m) => (m.gate ? [m.gate] : []));
      const reacts = all.flatMap((m) => (m.role === 'partner' && m.reaction?.kind === 'match' ? [m.reaction] : []));
      try {
        saveDtalkStats({
          turns: said.length,
          latencyMed: median(mine.flatMap((m) => (m.latencyMs != null ? [m.latencyMs] : []))),
          fixPass: gates.filter((g) => g.passed).length,
          fixTotal: gates.length,
          reactions: reacts.length,
          reactionIds: reacts.map((r) => r.id),
          clarify: reacts.filter((r) => r.clarify).length,
          fillers: fillers.current,
          koTurns: koTurns.current,
        });
      } catch {
        /* 통계 저장 실패는 완료를 막지 않는다 */
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
          <p className="muted">연결 전에는 EP {ep.no} 대사를 인물 목소리로 듣고 따라 말해 봐요{gateOn ? ' — 마지막엔 리액션 한마디도' : ''}.</p>
          {onNavigate && (
            <button type="button" className="btn primary dr-go" onClick={() => onNavigate('apikey')}>
              AI 연결하기
            </button>
          )}
        </div>
        {gateOn ? (
          <KeylessRole ep={ep} rate={rate()} />
        ) : (
          <>
            <div className="pg-sec-h">EP {ep.no} 대사 따라 말하기</div>
            <p className="dr-tip">🔊로 인물 목소리를 듣고, 🎙로 따라 말해요{browserSttAvailable() ? '' : '(말한 뒤 ✓를 눌러요)'}.</p>
            {lines.map((l, k) => (
              <ShadowLine key={k} who={l.who} en={l.en} kr={l.kr} onHear={() => say(l.en, l.who)} />
            ))}
          </>
        )}
      </div>
    );
  }

  if (phase === 'intro') {
    // M4 조용히 모드(낮) — 회화는 소리를 내야 하니 오늘은 쉬자고 먼저 말한다(시작은 막지 않는다 — 저녁 보충이면 이어서)
    const d = dayLite();
    const quietDay = d.mode === 'quiet' && !d.evening;
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
            {pc.name}가 먼저 말을 걸어요. 나는 🎙 버튼을 눌러 영어로 {TALK_TURNS}번 대답하면 끝. 막히면 💡 힌트, 한국어로 말해도 괜찮아요
            {gateOn ? '(🎙 길게 누르기)' : ''}.
          </p>
          {quietDay && (
            <p className="dr-msg dg-quiet-talk" role="status">
              🤫 조용히 모드 — 회화는 소리를 내야 해서 오늘 낮엔 쉬어요. 소리 낼 수 있을 때(저녁 보충) 시작해도 돼요.
            </p>
          )}
          <button type="button" className={`btn ${quietDay ? 'ghost' : 'primary'} dr-go`} onClick={() => void start()} disabled={busy}>
            {quietDay ? '그래도 지금 대화하기' : '대화 시작'}
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
    const mine = msgs.filter((m): m is MeMsg => m.role === 'me');
    const said = mine.filter((m) => m.lang !== 'ko').map((m) => m.en);
    const used = usedExpressions(ep, said);
    const fixes = mine.flatMap((m) => (m.fix && !m.fix.rule ? [m.fix] : []));
    const gates = mine.flatMap((m) => (m.gate ? [m.gate] : []));
    const latMed = median(mine.flatMap((m) => (m.latencyMs != null ? [m.latencyMs] : [])));
    const reacts = msgs.filter((m) => m.role === 'partner' && m.reaction?.kind === 'match').length;
    const seed = gateOn ? longestSentence(said) : null;
    return (
      <div className="screen dr-screen">
        <div className="study-card dr-end">
          <div className="dr-end-ep">
            {pc.icon} {pc.name}와 대화 완료
          </div>
          <h2 className="dr-end-title">영어로 {said.length}번 말했어요 👏</h2>
          {gateOn && (
            <div className="fgate-stats" aria-label="오늘 회화 요약">
              <span className="fgate-stat">
                표현 사용 {used.length}/{ep.learn.length}
                {used.length ? ' ✓' : ''}
              </span>
              {latMed != null && <span className="fgate-stat">반응 중앙값 {latencyLabel(latMed).replace('⏱ ', '')}</span>}
              <span className="fgate-stat">{gateTallyLabel(gates.filter((g) => g.passed).length, gates.length)}</span>
              <span className="fgate-stat">리액션 {reacts}</span>
              {fillers.current > 0 && <span className="fgate-stat">{fillerText(fillers.current)}</span>}
            </div>
          )}
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
          {gateOn &&
            (seed && isLadderDay() ? (
              <LadderMini seed={seed} level={setup.level} epNo={ep.no} partnerName={pc.name} voice={voiceOf(partner)} rate={rate()} />
            ) : said.length ? (
              <CafNote said={said} level={setup.level} learn={ep.learn.map((l) => l.en)} />
            ) : null)}
          <button
            type="button"
            className="btn primary dr-go"
            onClick={() => {
              setMsgs([]);
              setHint(null);
              setPending(null);
              setReaction(null);
              setKoHint(false);
              reactionDone.current = false;
              fillers.current = 0;
              koTurns.current = 0;
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
  const blocked = !!pending || !!reaction;
  // 다섯 번 대답했으면 상대의 마지막 말을 듣고 마무리
  const over = myTurns >= TALK_TURNS && last?.role === 'partner' && !blocked;
  const waitingMe = !busy && last?.role === 'partner' && !over && !blocked;
  /** 🎙 길게 누르기 → 한국어 */
  const press = gateOn
    ? {
        onPointerDown: () => {
          longFired.current = false;
          if (rec !== 'idle') return;
          if (longTimer.current) clearTimeout(longTimer.current);
          longTimer.current = setTimeout(() => {
            longFired.current = true;
            void talk('ko');
          }, LONG_PRESS_MS);
        },
        onPointerUp: () => longTimer.current && clearTimeout(longTimer.current),
        onPointerLeave: () => longTimer.current && clearTimeout(longTimer.current),
        onPointerCancel: () => longTimer.current && clearTimeout(longTimer.current),
        onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
      }
    : {};
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
            <div key={k}>
              <div className="dr-line">
                <span className="dr-av" aria-hidden="true">
                  {pc.icon}
                </span>
                <button type="button" className="dr-bub" onClick={() => say(m.en)} aria-label={`${pc.name}: ${m.en} (다시 듣기)`}>
                  <span className="dr-name">{pc.name}</span>
                  <span className="dr-en">{m.en}</span>
                  {subs && <span className="dr-kr">{m.kr}</span>}
                </button>
              </div>
              {m.reaction?.kind === 'match' && (
                <span className="fgate-chip fgate-react">
                  💬 리액션 ✓ {m.reaction.en}
                  {m.reaction.clarify ? ' · 천천히 다시 들었어요' : ''}
                </span>
              )}
            </div>
          ) : (
            <div key={k}>
              <div className="dr-line me">
                <div className="dr-bub">
                  {m.lang === 'ko' && <span className="dr-name">🇰🇷 한국어로</span>}
                  <span className="dr-en">{m.en}</span>
                </div>
                <span className="dr-av" aria-hidden="true">
                  {castOf('taeo').icon}
                </span>
              </div>
              {gateOn && m.latencyMs != null && (
                <div className="fgate-chips">
                  <span className="fgate-chip fgate-lat" aria-label={`반응 지연 ${m.latencyMs}ms`}>
                    {latencyLabel(m.latencyMs)}
                  </span>
                </div>
              )}
              {pending && pending.idx === k ? (
                <FixGate fix={pending.fix} epNo={ep.no} voice={voiceOf(partner)} rate={rate()} l1Label={m.l1} onDone={onGateDone} />
              ) : m.fix && gateOn ? (
                <button type="button" className="dr-note dt-fix fgate-done" onClick={() => say(m.fix!.better, partner)}>
                  {m.l1 && <span className="fgate-l1">{L1_LABEL} · {m.l1}</span>}✏️ 더 자연스럽게: “{m.fix.better}” — {m.fix.why}
                  {m.gate && <b className="fgate-mark">{m.gate.passed ? ` · ${m.gate.score}점 ✓` : ' · 회상에 넣었어요'}</b>}
                </button>
              ) : m.fix ? (
                <button type="button" className="dr-note dt-fix" onClick={() => say(m.fix!.better, 'taeo')}>
                  ✏️ 더 자연스럽게: “{m.fix.better}” — {m.fix.why}
                </button>
              ) : null}
            </div>
          )
        )}
        {reaction && (
          <ReactionTurn
            first={reaction.first}
            rest={reaction.rest}
            partnerName={castNameKo(partner)}
            voice={voiceOf(partner)}
            rate={rate()}
            level={setup.level === 'A1' ? 'A1' : 'A2'}
            onDone={onReactionDone}
          />
        )}
        {busy && (
          <div className="dr-narr" role="status">
            {withIGa(castNameKo(partner))} 생각하는 중…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {err && (
        <p className="dr-msg" role="alert">
          {err}
        </p>
      )}
      {!busy && !pending && last?.role === 'me' && (
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
          {koHint && hint && (
            <button type="button" className="fgate-ko" onClick={() => say(hint.en, 'taeo')}>
              이렇게 말해 보세요: <b lang="en">🔊 {hint.en}</b>
            </button>
          )}
          {hint && !koHint && (
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
          {rec !== 'idle' && recLang === 'ko' && (
            <p className="fgate-ko-rec" role="status">
              🇰🇷 한국어로 말하는 중
            </p>
          )}
          {canMic ? (
            <button
              type="button"
              className={`dr-mic${rec === 'rec' ? ' on' : ''}`}
              disabled={rec === 'wait'}
              {...press}
              onClick={() => {
                // 길게 누르기로 이미 한국어 녹음을 시작했으면 손을 뗄 때의 클릭은 무시
                if (longFired.current) {
                  longFired.current = false;
                  return;
                }
                if (longTimer.current) clearTimeout(longTimer.current);
                void talk('auto');
              }}
              aria-label={rec === 'rec' ? '말하기 끝' : gateOn ? '영어로 대답하기(길게 누르면 한국어로)' : '영어로 대답하기'}
            >
              {rec === 'rec' ? '⏹' : rec === 'wait' ? '…' : '🎙'}
            </button>
          ) : null}
          {gateOn && canMic && rec === 'idle' && <p className="fgate-tip">막히면 🎙 길게 눌러 🇰🇷 한국어로</p>}
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
