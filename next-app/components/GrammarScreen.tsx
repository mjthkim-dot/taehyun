'use client';

/**
 * 문법 시뮬레이션 화면 — 허브(레벨별 유닛) + 유닛 플레이어(사고 → 판단 → 조립 → 실전 → 결과).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { speakText, stopSpeaking } from './SpeakButton';
import { haptic } from '../lib/haptics';
import { bumpSpoken, groqKey } from '../lib/state';
import { recordAndTranscribe, whisperAvailable } from '../lib/stt';
import { overall } from '../lib/cefrGrowth';
import { takeUnitHandoff } from '../lib/ontology/handoff';
import type { Cefr } from '../lib/cefr';
import {
  GRAMMAR_LEVELS,
  gradeFree,
  grammarProgress,
  grammarStats,
  grammarUnit,
  MASTER_SCORE,
  normSentence,
  pickTodayGrammar,
  recordGrammar,
  shuffledOptions,
  tokensOf,
  unitsAt,
  type FreeGrade,
  type GrammarUnit,
  type GTurn,
} from '../lib/grammar';
import { applyVariant, generateVariant } from '../lib/grammarGen';

type Phase = 'think' | 'check' | 'build' | 'sim' | 'result';
const PHASES: { key: Phase; label: string }[] = [
  { key: 'think', label: '사고' },
  { key: 'check', label: '판단' },
  { key: 'build', label: '조립' },
  { key: 'sim', label: '실전' },
  { key: 'result', label: '결과' },
];

interface Miss {
  where: string;
  why: string;
}

function say(t: string) {
  stopSpeaking();
  speakText(t, 'en-US', 0.95);
}

/** 단어 조각 조립 */
function Builder({ answer, extra, seed, onDone }: { answer: string; extra?: string[]; seed: number; onDone: (ok: boolean, built: string) => void }) {
  const pool = useMemo(() => tokensOf({ a: answer, extra }, seed), [answer, extra, seed]);
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const built = picked.map((i) => pool[i]).join(' ');
  return (
    <div className="gm-build">
      <div className={`gm-slot${checked === true ? ' ok' : checked === false ? ' no' : ''}`} aria-live="polite">
        {picked.length ? (
          picked.map((i, k) => (
            <button key={k} type="button" className="gm-tok on" disabled={checked !== null} onClick={() => setPicked(picked.filter((_, x) => x !== k))}>
              {pool[i]}
            </button>
          ))
        ) : (
          <span className="muted gm-slot-hint">아래 조각을 순서대로 눌러 문장을 만드세요</span>
        )}
      </div>
      <div className="gm-pool">
        {pool.map((t, i) => (
          <button key={i} type="button" className="gm-tok" disabled={picked.includes(i) || checked !== null} onClick={() => setPicked([...picked, i])}>
            {t}
          </button>
        ))}
      </div>
      {checked === null ? (
        <button
          type="button"
          className="btn primary gm-go"
          disabled={!picked.length}
          onClick={() => {
            const ok = normSentence(built) === normSentence(answer);
            setChecked(ok);
            haptic(ok ? 'success' : 'error');
          }}
        >
          확인
        </button>
      ) : (
        <>
          {!checked && (
            <div className="gm-why">
              정답: <b>{answer}</b>
            </div>
          )}
          <button type="button" className="btn primary gm-go" onClick={() => onDone(!!checked, built)}>
            다음
          </button>
        </>
      )}
    </div>
  );
}

/** 보기 고르기 */
function Choice({ opts, a, why, seed, onDone }: { opts: string[]; a: number; why: string; seed: number; onDone: (ok: boolean) => void }) {
  const sh = useMemo(() => shuffledOptions(opts, a, seed), [opts, a, seed]);
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="gm-choice">
      {sh.opts.map((o, i) => {
        const st = pick === null ? '' : i === sh.a ? ' right' : i === pick ? ' wrong' : ' dim';
        return (
          <button
            key={i}
            type="button"
            className={`wd-opt gm-opt${st}`}
            disabled={pick !== null}
            onClick={() => {
              setPick(i);
              haptic(i === sh.a ? 'success' : 'error');
            }}
          >
            {o}
          </button>
        );
      })}
      {pick !== null && (
        <>
          <div className={`gm-why${pick === sh.a ? ' ok' : ''}`}>
            {pick === sh.a ? '맞아요 — ' : '다시 생각해 봐요 — '}
            {why}
          </div>
          <button type="button" className="btn primary gm-go" onClick={() => onDone(pick === sh.a)}>
            다음
          </button>
        </>
      )}
    </div>
  );
}

/** 실전 마지막 턴 — 말로 답한다(타이핑 없음). 마이크 → 받아쓰기 → AI가 목표 문법으로 채점 */
function SpeakTurn({ unit, turn, onDone }: { unit: GrammarUnit; turn: Extract<GTurn, { task: 'free' }>; onDone: (ok: boolean) => void }) {
  const [state, setState] = useState<'idle' | 'listening' | 'transcribing' | 'grading' | 'graded' | 'self'>('idle');
  const [heard, setHeard] = useState('');
  const [partial, setPartial] = useState('');
  const [grade, setGrade] = useState<FreeGrade | null>(null);
  const [err, setErr] = useState('');
  const stopRef = useRef<(() => void) | null>(null);
  const canVoice = whisperAvailable();
  const hasKey = !!groqKey();

  useEffect(() => () => stopRef.current?.(), []);

  async function listen() {
    setErr('');
    setHeard('');
    setPartial('');
    setGrade(null);
    setState('listening');
    try {
      const { text } = await recordAndTranscribe({
        prompt: turn.model,
        language: 'en',
        silenceMs: 2500,
        maxMs: 45000,
        onPartial: (t) => setPartial(t),
        onState: (st) => {
          if (st === 'transcribing') setState('transcribing');
        },
        registerStop: (fn) => {
          stopRef.current = fn;
        },
      });
      stopRef.current = null;
      const t = (text || '').trim();
      if (!t) {
        setErr('소리가 잡히지 않았어요. 마이크를 누르고 다시 말해 보세요.');
        setState('idle');
        return;
      }
      bumpSpoken();
      setHeard(t);
      if (!hasKey) {
        setState('self');
        return;
      }
      setState('grading');
      const g = await gradeFree(unit, turn, t);
      if (g) {
        setGrade(g);
        setState('graded');
      } else setState('self');
    } catch {
      stopRef.current = null;
      setErr('마이크를 사용할 수 없어요. 모범 답안을 듣고 따라 말해 보세요.');
      setState('self');
    }
  }

  return (
    <div className="gm-free">
      <div className="gm-task">🎙 {turn.prompt}</div>

      {heard && (
        <div className="gm-heard">
          <span className="gm-heard-lbl">내가 한 말</span>
          {heard}
        </div>
      )}

      {(state === 'idle' || state === 'listening' || state === 'transcribing') && canVoice && (
        <div className="gm-mic-wrap">
          <button
            type="button"
            className={`gm-mic${state === 'listening' ? ' on' : ''}`}
            disabled={state === 'transcribing'}
            aria-label={state === 'listening' ? '말하기 끝내기' : '말로 답하기'}
            onClick={() => (state === 'listening' ? stopRef.current?.() : void listen())}
          >
            {state === 'listening' ? '⏹' : '🎙'}
          </button>
          <div className="gm-mic-lbl">
            {state === 'listening' ? '듣고 있어요 — 다 말하면 누르거나 잠시 멈추세요' : state === 'transcribing' ? '받아 적는 중…' : '눌러서 영어로 말하기'}
          </div>
          {state === 'listening' && partial && <div className="gm-partial">{partial}</div>}
          <button type="button" className="gm-hint" onClick={() => say(turn.model)}>
            🔊 막히면 모범 답안 듣기
          </button>
        </div>
      )}

      {state === 'grading' && <p className="muted gm-mic-lbl">AI 코치가 문법을 보는 중…</p>}
      {err && <p className="gm-err">{err}</p>}

      {state === 'graded' && grade && (
        <>
          <div className={`gm-why${grade.ok ? ' ok' : ''}`}>
            {grade.ok ? '목표 문법을 잘 썼어요 — ' : '조금만 고쳐 볼까요 — '}
            {grade.why}
            <button type="button" className="gm-model gm-model-say" onClick={() => say(grade.corrected)}>
              🔊 다듬은 문장: {grade.corrected}
            </button>
          </div>
          <div className="gm-self">
            <button type="button" className="btn" onClick={() => void listen()}>
              다시 말하기
            </button>
            <button type="button" className="btn primary" onClick={() => onDone(grade.ok)}>
              결과 보기
            </button>
          </div>
        </>
      )}

      {(state === 'self' || (!canVoice && state === 'idle')) && (
        <>
          <div className="gm-why">
            모범 답안을 듣고 소리 내어 따라 말해 보세요.
            <button type="button" className="gm-model gm-model-say" onClick={() => say(turn.model)}>
              🔊 {turn.model}
            </button>
            <span className="gm-model">목표 문법: {unit.point}</span>
          </div>
          <div className="gm-self">
            <button type="button" className="btn" onClick={() => onDone(false)}>
              아직 어려워요
            </button>
            <button type="button" className="btn primary" onClick={() => onDone(true)}>
              목표 문법으로 말했어요
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Player({ unit, onExit, onAgain, fresh }: { unit: GrammarUnit; onExit: () => void; onAgain: () => void; fresh: boolean }) {
  const [phase, setPhase] = useState<Phase>('think');
  const [i, setI] = useState(0);
  const [ok, setOk] = useState(0);
  const [total, setTotal] = useState(0);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [final, setFinal] = useState<number | null>(null);

  useEffect(() => () => stopSpeaking(), []);

  const answer = (good: boolean, where: string, why: string) => {
    setTotal((t) => t + 1);
    if (good) setOk((o) => o + 1);
    else setMisses((m) => [...m, { where, why }]);
  };

  const finish = (lastGood: boolean, where: string, why: string) => {
    const nOk = ok + (lastGood ? 1 : 0);
    const nTot = total + 1;
    if (!lastGood) setMisses((m) => [...m, { where, why }]);
    setOk(nOk);
    setTotal(nTot);
    const score = Math.round((nOk / nTot) * 100);
    recordGrammar(unit.id, score);
    setFinal(score);
    setPhase('result');
  };

  const pi = PHASES.findIndex((p) => p.key === phase);
  const turn = unit.sim.turns[i];

  return (
    <div className="screen gm-screen">
      <div className="gm-top">
        <button type="button" className="mini-btn" onClick={onExit} aria-label="문법 목록으로">
          ✕
        </button>
        <ol className="gm-phases">
          {PHASES.map((p, k) => (
            <li key={p.key} className={k < pi ? 'done' : k === pi ? 'now' : ''}>
              {p.label}
            </li>
          ))}
        </ol>
      </div>
      <div className="gm-unit-kicker">
        {unit.level} · {unit.point}
        {fresh && <span className="gm-fresh">새 상황</span>}
      </div>
      <h2 className="gm-unit-title">{unit.title}</h2>

      {phase === 'think' && (
        <div className="gm-stage">
          <div className="study-card gm-scene">
            <div className="gm-label">상황</div>
            <p>{unit.scene}</p>
          </div>
          <div className="study-card gm-think">
            <div className="gm-label">생각해 보기</div>
            <p className="gm-q">{unit.think.q}</p>
            <div className="gm-vs">
              <div className="gm-vs-ko">
                <b>한국어식 사고</b>
                <span>{unit.think.ko}</span>
              </div>
              <div className="gm-vs-en">
                <b>영어식 사고</b>
                <span>{unit.think.en}</span>
              </div>
            </div>
            <div className="gm-rule">{unit.think.rule}</div>
            {unit.think.ex.map(([en, kr], k) => (
              <button key={k} type="button" className="gm-ex" onClick={() => say(en)}>
                <span className="gm-ex-en">🔊 {en}</span>
                <span className="gm-ex-kr">{kr}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn primary gm-go" onClick={() => { setPhase('check'); setI(0); }}>
            이해했어요 — 판단 연습
          </button>
        </div>
      )}

      {phase === 'check' && (
        <div className="gm-stage" key={`c${i}`}>
          <div className="gm-count">
            판단 {i + 1}/{unit.checks.length} — 이 상황에 맞는 형태는?
          </div>
          <div className="study-card gm-prompt">{unit.checks[i].q}</div>
          <Choice
            opts={unit.checks[i].opts}
            a={unit.checks[i].a}
            why={unit.checks[i].why}
            seed={i + unit.id.length}
            onDone={(g) => {
              answer(g, `판단 ${i + 1}`, unit.checks[i].why);
              if (i + 1 < unit.checks.length) setI(i + 1);
              else { setPhase('build'); setI(0); }
            }}
          />
        </div>
      )}

      {phase === 'build' && (
        <div className="gm-stage" key={`b${i}`}>
          <div className="gm-count">
            조립 {i + 1}/{unit.builds.length} — 영어 어순으로 세워 보세요
          </div>
          <div className="study-card gm-prompt">{unit.builds[i].kr}</div>
          <Builder
            answer={unit.builds[i].a}
            extra={unit.builds[i].extra}
            seed={i * 13 + 5}
            onDone={(g) => {
              answer(g, `조립 ${i + 1}`, `정답: ${unit.builds[i].a}`);
              if (i + 1 < unit.builds.length) setI(i + 1);
              else { setPhase('sim'); setI(0); }
            }}
          />
        </div>
      )}

      {phase === 'sim' && turn && (
        <div className="gm-stage" key={`s${i}`}>
          <div className="gm-count">
            실전 {i + 1}/{unit.sim.turns.length} · 상대: {unit.sim.who}
          </div>
          <div className="gm-bubble">
            <button type="button" className="gm-bubble-say" onClick={() => say(turn.them)} aria-label="상대 말 듣기">
              🔊
            </button>
            <div>
              <div className="gm-bubble-en">{turn.them}</div>
              <div className="gm-bubble-kr">{turn.kr}</div>
            </div>
          </div>
          {turn.task === 'choose' && (
            <>
              <div className="gm-task">어떻게 답할까요?</div>
              <Choice
                opts={turn.opts}
                a={turn.a}
                why={turn.why}
                seed={i * 7 + 11}
                onDone={(g) => {
                  answer(g, `실전 ${i + 1}`, turn.why);
                  setI(i + 1);
                }}
              />
            </>
          )}
          {turn.task === 'build' && (
            <>
              <div className="gm-task">답을 조립하세요 — {turn.why}</div>
              <Builder
                answer={turn.a}
                extra={turn.extra}
                seed={i * 17 + 3}
                onDone={(g) => {
                  answer(g, `실전 ${i + 1}`, `정답: ${turn.a}`);
                  setI(i + 1);
                }}
              />
            </>
          )}
          {turn.task === 'free' && <SpeakTurn unit={unit} turn={turn} onDone={(g) => finish(g, '실전 말하기', `모범: ${turn.model}`)} />}
        </div>
      )}

      {phase === 'result' && final !== null && (
        <div className="gm-stage">
          <div className="study-card gm-result">
            <div className="gm-score">{final}</div>
            <div className="gm-score-lbl">{final >= MASTER_SCORE ? '이 문법은 내 것이 됐어요' : '한 번 더 하면 굳어져요'}</div>
            <div className="muted gm-score-sub">
              {ok}/{total} 정답 · {unit.point}
            </div>
            {misses.length > 0 && (
              <ul className="gm-miss">
                {misses.map((m, k) => (
                  <li key={k}>
                    <b>{m.where}</b> {m.why}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="btn primary gm-go" onClick={onAgain}>
            같은 문법, 새 상황으로 한 번 더
          </button>
          <button type="button" className="btn gm-go gm-go-2" onClick={onExit}>
            문법 목록으로
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 플레이어 로더 — 처음엔 다듬어진 원본 문항, 두 번째부터는 같은 문법을 **새 상황·새 문항**으로
 * AI가 만든다(실패·오프라인이면 원본). "매번 똑같은 수업" 방지.
 */
function PlayerLoader({ unit, forceFresh, onExit }: { unit: GrammarUnit; forceFresh: boolean; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState<{ u: GrammarUnit; fresh: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    setReady(null);
    const attempts = grammarProgress()[unit.id]?.n ?? 0;
    const wantFresh = forceFresh || round > 0 || attempts > 0;
    if (!wantFresh || !groqKey()) {
      setReady({ u: unit, fresh: false });
      return;
    }
    void generateVariant(unit, attempts + round).then((v) => {
      if (!alive) return;
      setReady({ u: applyVariant(unit, v), fresh: !!v });
    });
    return () => {
      alive = false;
    };
  }, [unit, round, forceFresh]);
  if (!ready) {
    return (
      <div className="screen gm-screen">
        <div className="study-card gm-loading" role="status">
          <div className="gm-loading-dot" aria-hidden="true" />
          <b>{unit.title}</b>
          <span className="muted">같은 문법을 새로운 상황으로 만드는 중…</span>
        </div>
      </div>
    );
  }
  return <Player key={`${unit.id}-${round}`} unit={ready.u} fresh={ready.fresh} onExit={onExit} onAgain={() => setRound((r) => r + 1)} />;
}

export default function GrammarScreen() {
  const [tick, setTick] = useState(0);
  const cur = useMemo(() => overall().level, []);
  const [level, setLevel] = useState<Cefr>(() => (GRAMMAR_LEVELS.includes(cur) ? cur : 'C1'));
  const [playing, setPlaying] = useState<GrammarUnit | null>(() => {
    const h = takeUnitHandoff('grammar');
    return h ? grammarUnit(h.key) ?? null : null;
  });
  const prog = useMemo(() => grammarProgress(), [tick, playing]);
  const stats = useMemo(() => grammarStats(), [tick, playing]);
  const today = useMemo(() => pickTodayGrammar(cur), [cur, tick, playing]);

  if (playing) return <PlayerLoader unit={playing} forceFresh={false} onExit={() => { setPlaying(null); setTick((t) => t + 1); }} />;

  return (
    <div className="screen gm-screen">
      <div className="study-card gm-hero" data-tilt>
        <div className="pg-kicker">오늘의 문법 · {today.level}</div>
        <h2 className="gm-hero-title">{today.title}</h2>
        <p className="muted gm-hero-scene">{today.scene}</p>
        <button type="button" className="btn primary gm-go" onClick={() => setPlaying(today)}>
          시뮬레이션 시작 · 약 8분
        </button>
      </div>

      <div className="gm-levels" role="tablist">
        {stats.map((s) => (
          <button key={s.level} type="button" role="tab" aria-selected={level === s.level} className={`cf-lv-tab gm-lv${level === s.level ? ' on' : ''}${s.level === cur ? ' cur' : ''}`} onClick={() => setLevel(s.level)}>
            {s.level}
            <span className="gm-lv-n">
              {s.mastered}/{s.total}
            </span>
          </button>
        ))}
      </div>

      <ul className="gm-units">
        {unitsAt(level).map((u, k) => {
          const p = prog[u.id];
          const state = !p ? 'new' : p.best >= MASTER_SCORE ? 'master' : 'tried';
          return (
            <li key={u.id}>
              <button type="button" className={`gm-unit ${state}`} onClick={() => setPlaying(u)}>
                <span className="gm-unit-n">{k + 1}</span>
                <span className="gm-unit-body">
                  <b>{u.title}</b>
                  <span className="muted">{u.point}</span>
                </span>
                <span className="gm-unit-state">{!p ? '시작' : `${p.best}점`}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
