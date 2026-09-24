'use client';

/**
 * 단어 — 상황별 대량 암기 화면.
 *
 * 세 화면: 허브(오늘의 단어·상황 팩) → 세션(3D 플립 카드 + 4지선다) → 완료 요약.
 * 세션은 복습 먼저, 그다음 신규. 신규 단어는 먼저 카드로 "만나고"(앞면 영어 →
 * 탭하면 3D로 뒤집혀 뜻·예문) 곧바로 뜻 고르기로 확인한다. 오답은 3문제 뒤에 다시.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { speakText, stopSpeaking } from './SpeakButton';
import { haptic } from '../lib/haptics';
import {
  DAILY_CHOICES,
  generateMoreWords,
  getPacks,
  gradeWord,
  makeQuiz,
  MASTER_BOX,
  packStats,
  progress,
  quizKindFor,
  setWordConfig,
  todayQueue,
  wordConfig,
  wordStats,
  type QueueItem,
  type Quiz,
  type Word,
  type WordPack,
} from '../lib/words';
import { groqKey } from '../lib/state';

type View = 'hub' | 'session' | 'done' | 'pack';

interface Step {
  item: QueueItem;
  /** 신규 단어의 카드 단계를 이미 봤는가 */
  met: boolean;
  retry?: boolean;
}

function say(w: string) {
  stopSpeaking();
  speakText(w, 'en-US', 0.95);
}

function Ring({ value, max, label }: { value: number; max: number; label: string }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="wd-ring">
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r={R} className="wd-ring-track" />
        <circle cx="36" cy="36" r={R} className="wd-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
      </svg>
      <div className="wd-ring-num">
        <b>{value}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

function FlipCard({ word, flipped, onFlip }: { word: Word; flipped: boolean; onFlip: () => void }) {
  return (
    <button type="button" className={`wd-flip${flipped ? ' flipped' : ''}`} onClick={onFlip} aria-label={flipped ? '앞면 보기' : '뜻 보기'}>
      <span className="wd-flip-inner">
        <span className="wd-face wd-front">
          <span className="wd-lv">
            {word.lv} · {word.pos}
          </span>
          <span className="wd-word">{word.w}</span>
          <span className="wd-hint">탭해서 뜻 보기</span>
        </span>
        <span className="wd-face wd-back">
          <span className="wd-kr">{word.kr}</span>
          <span className="wd-ex">{word.ex}</span>
          <span className="wd-exkr">{word.exKr}</span>
        </span>
      </span>
    </button>
  );
}

export default function WordsScreen() {
  const [view, setView] = useState<View>('hub');
  const [tick, setTick] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState({ ok: 0, total: 0, fresh: 0 });
  const [openPack, setOpenPack] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cfg = useMemo(() => wordConfig(), [tick]);
  const stats = useMemo(() => wordStats(), [tick]);
  const packs = useMemo(() => getPacks(), [tick]);
  const queue = useMemo(() => todayQueue(), [tick]);
  const dueN = queue.filter((q) => q.kind === 'review').length;
  const newN = queue.length - dueN;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    stopSpeaking();
  }, []);

  const cur = steps[idx];
  const box = cur ? progress()[cur.item.word.id]?.b ?? 0 : 0;
  const quiz: Quiz | null = useMemo(() => {
    if (!cur || (cur.item.kind === 'learn' && !cur.met)) return null;
    return makeQuiz(cur.item.word, cur.item.kind === 'learn' ? 'meaning' : quizKindFor(box, idx), idx * 31 + 7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.item.word.id, cur?.met, idx]);

  useEffect(() => {
    if (view !== 'session' || !cur) return;
    // 카드가 나오면 발음을 들려준다(듣기 문제는 소리가 곧 문제다)
    if ((cur.item.kind === 'learn' && !cur.met) || quiz?.kind === 'listen') say(cur.item.word.w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, cur?.met, view]);

  function start() {
    const q = todayQueue();
    if (!q.length) return;
    setSteps(q.map((item) => ({ item, met: item.kind === 'review' })));
    setIdx(0);
    setFlipped(false);
    setPicked(null);
    setResult({ ok: 0, total: 0, fresh: 0 });
    setView('session');
    haptic('tap');
  }

  function metCard() {
    const next = steps.slice();
    next[idx] = { ...next[idx], met: true };
    setSteps(next);
    setFlipped(false);
  }

  function choose(i: number) {
    if (!quiz || picked !== null) return;
    setPicked(i);
    const ok = i === quiz.answer;
    haptic(ok ? 'success' : 'error');
    gradeWord(cur.item.word.id, ok, { retry: cur.retry });
    setResult((r) => ({ ok: r.ok + (ok && !cur.retry ? 1 : 0), total: r.total + (cur.retry ? 0 : 1), fresh: r.fresh + (cur.item.kind === 'learn' && !cur.retry ? 1 : 0) }));
    let nextSteps = steps;
    if (!ok && !cur.retry) {
      // 오답은 3문제 뒤에 한 번 더 — 틀린 채로 세션이 끝나지 않게
      nextSteps = steps.slice();
      nextSteps.splice(Math.min(idx + 4, nextSteps.length), 0, { item: { ...cur.item, kind: 'review' }, met: true, retry: true });
      setSteps(nextSteps);
    }
    timer.current = setTimeout(() => {
      setPicked(null);
      if (idx + 1 >= nextSteps.length) {
        setView('done');
        setTick((t) => t + 1);
      } else setIdx(idx + 1);
    }, ok ? 650 : 1500);
  }

  function toggleDaily(n: number) {
    setWordConfig({ daily: n });
    setTick((t) => t + 1);
  }

  function togglePack(id: string) {
    const all = packs.map((p) => p.id);
    const sel = cfg.packs.length ? cfg.packs : all;
    const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    setWordConfig({ packs: next.length === all.length || next.length === 0 ? [] : next });
    setTick((t) => t + 1);
  }

  async function genMore(p: WordPack) {
    if (genBusy) return;
    setGenBusy(true);
    setGenMsg('');
    try {
      const n = await generateMoreWords(p.id);
      setGenMsg(n > 0 ? `「${p.name}」에 새 단어 ${n}개가 들어왔어요.` : '새 단어를 만들지 못했어요 — 잠시 후 다시 시도해 주세요.');
      setTick((t) => t + 1);
    } finally {
      setGenBusy(false);
    }
  }

  /* ─────────── 세션 ─────────── */
  if (view === 'session' && cur) {
    const w = cur.item.word;
    const pct = Math.round((idx / steps.length) * 100);
    return (
      <div className="screen wd-screen">
        <div className="wd-top">
          <button type="button" className="mini-btn" onClick={() => { stopSpeaking(); setView('hub'); setTick((t) => t + 1); }}>
            ✕
          </button>
          <div className="wd-prog" role="progressbar" aria-valuenow={idx} aria-valuemax={steps.length}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="wd-count">
            {idx + 1}/{steps.length}
          </span>
        </div>

        {cur.item.kind === 'learn' && !cur.met ? (
          <div className="wd-stage">
            <div className="wd-tag new">새 단어 · {packs.find((p) => p.id === w.pack)?.name}</div>
            <FlipCard word={w} flipped={flipped} onFlip={() => { setFlipped((f) => !f); haptic('tap'); }} />
            <div className="wd-actions">
              <button type="button" className="btn wd-say" onClick={() => say(w.w)}>
                🔊 발음
              </button>
              <button type="button" className="btn primary wd-next" onClick={metCard}>
                {flipped ? '외웠어요 → 확인 문제' : '뜻을 봤어요 →'}
              </button>
            </div>
          </div>
        ) : quiz ? (
          <div className="wd-stage">
            <div className={`wd-tag${cur.retry ? ' retry' : ''}`}>
              {cur.retry ? '다시 한 번' : quiz.kind === 'meaning' ? '뜻 고르기' : quiz.kind === 'reverse' ? '영어로 고르기' : quiz.kind === 'cloze' ? '빈칸 채우기' : '듣고 뜻 고르기'}
              {!cur.retry && box > 0 && <span className="wd-box"> · 상자 {box}</span>}
            </div>
            <div className="wd-q">
              {quiz.kind === 'listen' ? (
                <button type="button" className="wd-listen" onClick={() => say(w.w)}>
                  🔊
                </button>
              ) : (
                <span className={`wd-q-text${quiz.kind === 'cloze' ? ' cloze' : ''}`}>{quiz.prompt}</span>
              )}
              {quiz.sub && <span className="wd-q-sub">{quiz.sub}</span>}
            </div>
            <div className="wd-opts">
              {quiz.options.map((o, i) => {
                const state = picked === null ? '' : i === quiz.answer ? ' right' : i === picked ? ' wrong' : ' dim';
                return (
                  <button key={i} type="button" className={`wd-opt${state}`} onClick={() => choose(i)} disabled={picked !== null}>
                    {o}
                  </button>
                );
              })}
            </div>
            {picked !== null && picked !== quiz.answer && (
              <div className="wd-reveal">
                <b>{w.w}</b> — {w.kr}
                <span>{w.ex}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  /* ─────────── 완료 ─────────── */
  if (view === 'done') {
    const acc = result.total ? Math.round((result.ok / result.total) * 100) : 0;
    return (
      <div className="screen wd-screen">
        <div className="study-card wd-done">
          <div className="wd-done-emoji">🎉</div>
          <h2>오늘의 단어 완료</h2>
          <div className="wd-done-stats">
            <div>
              <b>{result.fresh}</b>
              <span>새 단어</span>
            </div>
            <div>
              <b>{result.total - result.fresh}</b>
              <span>복습</span>
            </div>
            <div>
              <b>{acc}%</b>
              <span>정답률</span>
            </div>
          </div>
          <p className="muted">
            지금까지 {stats.seen}개를 만났고 {stats.mastered}개를 장기 기억으로 넘겼어요. 내일 복습 {stats.dueTomorrow}개가 기다려요.
          </p>
          <button type="button" className="btn primary wd-cta" onClick={() => { setView('hub'); setTick((t) => t + 1); }}>
            단어 홈으로
          </button>
          {newN === 0 && dueN === 0 && (
            <button type="button" className="btn wd-more" onClick={() => { toggleDaily(Math.min(50, cfg.daily + 10)); }}>
              더 하고 싶어요 — 오늘 할당량 +10
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ─────────── 팩 상세 ─────────── */
  if (view === 'pack' && openPack) {
    const p = packs.find((x) => x.id === openPack);
    if (p) {
      const prog = progress();
      const st = packStats(p);
      return (
        <div className="screen wd-screen">
          <button type="button" className="mini-btn" onClick={() => { setView('hub'); setGenMsg(''); }}>
            ← 단어 홈
          </button>
          <div className="study-card wd-pack-head">
            <span className="wd-pack-icon">{p.icon}</span>
            <div>
              <h2>{p.name}</h2>
              <p className="muted">{p.desc}</p>
              <p className="wd-pack-meta">
                {st.seen}/{st.total} 학습 · 마스터 {st.mastered}
              </p>
            </div>
          </div>
          {groqKey() && (
            <button type="button" className="btn wd-gen" disabled={genBusy} onClick={() => void genMore(p)}>
              {genBusy ? 'AI가 이 상황의 단어를 고르는 중…' : '✨ 이 상황 단어 20개 더 만들기'}
            </button>
          )}
          {genMsg && <p className="wd-gen-msg">{genMsg}</p>}
          <ul className="wd-list">
            {p.words.map((w) => {
              const s = prog[w.id];
              const lvl = !s ? 'new' : s.b >= MASTER_BOX ? 'master' : 'learning';
              return (
                <li key={w.id} className={`wd-row ${lvl}`}>
                  <button type="button" className="wd-row-say" onClick={() => say(w.w)} aria-label={`${w.w} 발음`}>
                    🔊
                  </button>
                  <span className="wd-row-body">
                    <b>{w.w}</b> <em>{w.pos}</em>
                    {w.ai && <span className="wd-ai">AI</span>}
                    <span className="wd-row-kr">{w.kr}</span>
                  </span>
                  <span className="wd-row-state">{!s ? '미학습' : s.b >= MASTER_BOX ? '마스터' : `상자 ${s.b}`}</span>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
  }

  /* ─────────── 허브 ─────────── */
  const sel = cfg.packs.length ? cfg.packs : packs.map((p) => p.id);
  return (
    <div className="screen wd-screen">
      <div className="study-card wd-hero" data-tilt>
        <div className="wd-hero-row">
          <Ring value={stats.seen} max={stats.total} label={`/ ${stats.total}`} />
          <div className="wd-hero-body">
            <div className="pg-kicker">상황별 단어</div>
            <div className="wd-hero-title">오늘 {newN}개 새로 · {dueN}개 복습</div>
            <div className="wd-hero-sub">
              마스터 {stats.mastered} · 🔥 {stats.streak}일
              {stats.accuracy7 !== null ? ` · 7일 정답률 ${stats.accuracy7}%` : ''}
            </div>
          </div>
        </div>
        <button type="button" className="btn primary wd-cta" disabled={queue.length === 0} onClick={start}>
          {queue.length ? `오늘의 단어 시작 (${queue.length})` : '오늘 할 단어를 다 끝냈어요'}
        </button>
        <div className="wd-daily">
          <span className="muted">하루 새 단어</span>
          {DAILY_CHOICES.map((n) => (
            <button key={n} type="button" className={`wd-chip${cfg.daily === n ? ' on' : ''}`} onClick={() => toggleDaily(n)}>
              {n}
            </button>
          ))}
        </div>
        {stats.today.new + stats.today.rev > 0 && (
          <p className="wd-today muted">
            오늘 신규 {stats.today.new} · 복습 {stats.today.rev} · 정답 {stats.today.ok}
          </p>
        )}
      </div>

      <div className="pg-sec-h">상황 팩 — 고른 팩을 번갈아 배워요</div>
      <div className="wd-packs">
        {packs.map((p) => {
          const st = packStats(p);
          const on = sel.includes(p.id);
          return (
            <div key={p.id} className={`wd-pack${on ? ' on' : ''}`}>
              <button type="button" className="wd-pack-main" onClick={() => { setOpenPack(p.id); setView('pack'); }}>
                <span className="wd-pack-icon">{p.icon}</span>
                <span className="wd-pack-name">{p.name}</span>
                <span className="wd-pack-bar">
                  <span style={{ width: `${st.total ? (st.seen / st.total) * 100 : 0}%` }} />
                </span>
                <span className="wd-pack-meta">
                  {st.seen}/{st.total}
                  {st.mastered ? ` · ★${st.mastered}` : ''}
                </span>
              </button>
              <button type="button" className="wd-pack-toggle" aria-pressed={on} aria-label={`${p.name} ${on ? '제외' : '포함'}`} onClick={() => togglePack(p.id)}>
                {on ? '✓' : '+'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
