'use client';

/** 청해(딕테이션) — voice-assistant/index.html 의 renderListening()/checkListen() 포팅. */
import { useState } from 'react';
import { CEFR_GSE, CEFR_ORDER, type Cefr } from '../lib/lessons';
import { addWeakItem, bumpSkill, getProfile, markPracticedToday } from '../lib/state';
import { LISTEN_BANK } from '../lib/contentBanks';
import { speakText } from './SpeakButton';

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normWords(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean);
}

function lcsAccuracy(target: string[], got: string[]) {
  const m = target.length;
  const n = got.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = target[i - 1] === got[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return m ? Math.round((dp[m][n] / m) * 100) : 0;
}

interface Queue {
  sentences: string[];
  idx: number;
  scoreSum: number;
}

export default function ListeningScreen() {
  const [level, setLevel] = useState<Cefr>(getProfile().cefr || 'A2');
  const [queue, setQueue] = useState<Queue | null>(null);
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState<{ acc: number; colored: { w: string; ok: boolean }[]; sent: string } | null>(null);
  const [done, setDone] = useState<number | null>(null);

  function start() {
    const bank = shuffled(LISTEN_BANK[level] || []).slice(0, 6);
    setQueue({ sentences: bank, idx: 0, scoreSum: 0 });
    setResult(null);
    setGuess('');
    setDone(null);
    setTimeout(() => speakText(bank[0], 'en-US'), 200);
  }

  function check() {
    if (!queue) return;
    const sent = queue.sentences[queue.idx];
    const target = normWords(sent);
    const got = normWords(guess);
    const gotSet = new Set(got);
    const acc = lcsAccuracy(target, got);
    const colored = target.map((w) => ({ w, ok: gotSet.has(w) }));
    setResult({ acc, colored, sent });
    if (acc < 70) addWeakItem({ en: sent, kr: '(받아쓰기 문장)', lesson: 'listening', cat: 'listening' });
    setQueue({ ...queue, scoreSum: queue.scoreSum + acc });
  }

  function next() {
    if (!queue) return;
    const nextIdx = queue.idx + 1;
    setResult(null);
    setGuess('');
    if (nextIdx >= queue.sentences.length) {
      const avg = Math.round(queue.scoreSum / queue.sentences.length);
      const band = CEFR_GSE[level];
      const gse = Math.round(band.min + (band.max - band.min) * (avg / 100));
      bumpSkill('listening', gse);
      markPracticedToday();
      setDone(avg);
      setQueue(null);
      return;
    }
    setQueue({ ...queue, idx: nextIdx });
    setTimeout(() => speakText(queue.sentences[nextIdx], 'en-US'), 200);
  }

  if (done !== null) {
    return (
      <div className="study-screen">
        <div className="study-card" style={{ textAlign: 'center', border: '1px solid var(--primary)', padding: 20 }}>
          <div className="muted" style={{ fontSize: '0.8rem' }}>받아쓰기 평균 정확도</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--primary-light)', margin: '4px 0' }}>{done}%</div>
          <div className="muted" style={{ fontSize: '0.8rem' }}>청해 스킬에 반영됐어요</div>
          <button className="start-drill-btn" style={{ marginTop: 14 }} onClick={start}>↻ 다시 (새 문항)</button>
        </div>
      </div>
    );
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>🎧 청해 (Listening)</h3>
        <p className="muted" style={{ marginBottom: 12 }}>들리는 문장을 받아쓰는 딕테이션 — 듣기·철자·문법을 한번에</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {CEFR_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => {
                setLevel(c);
                setQueue(null);
                setDone(null);
              }}
              style={{
                flex: '1 0 auto',
                minWidth: 48,
                padding: '7px 4px',
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                border: `1px solid ${c === level ? 'var(--primary)' : 'var(--border)'}`,
                background: c === level ? 'var(--primary)' : 'var(--surface)',
                color: c === level ? '#fff' : 'var(--text-muted)',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {!queue ? (
          <button className="start-drill-btn" onClick={start}>🎧 {level} 받아쓰기 시작 (6문항)</button>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div className="muted" style={{ fontSize: '0.76rem', marginBottom: 10 }}>
              문항 {queue.idx + 1} / {queue.sentences.length} · 들리는 문장을 그대로 적으세요
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="btn primary" style={{ flex: 1 }} onClick={() => speakText(queue.sentences[queue.idx], 'en-US')}>
                🔊 다시 듣기
              </button>
              <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => speakText(queue.sentences[queue.idx], 'en-US', 0.6)}>
                🐢 느리게
              </button>
            </div>
            <textarea
              rows={2}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="여기에 받아쓰기..."
              style={{
                width: '100%',
                background: 'var(--surface2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 11,
                fontSize: '0.92rem',
                resize: 'vertical',
              }}
            />
            {!result ? (
              <button className="start-drill-btn" style={{ marginTop: 10 }} onClick={check}>확인</button>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: '0.82rem', marginBottom: 6 }}>
                  정확도{' '}
                  <b style={{ color: result.acc >= 80 ? 'var(--green)' : result.acc >= 50 ? 'var(--yellow)' : 'var(--red)' }}>
                    {result.acc}%
                  </b>
                </div>
                <div style={{ fontSize: '0.9rem', lineHeight: 1.7, background: 'var(--surface2)', borderRadius: 8, padding: 10 }}>
                  {result.colored.map((c, i) => (
                    <span key={i} style={{ color: c.ok ? 'var(--green)' : 'var(--red)', textDecoration: c.ok ? 'none' : 'underline' }}>
                      {c.w}{' '}
                    </span>
                  ))}
                </div>
                <div className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>정답: {result.sent}</div>
                <button className="btn primary" style={{ width: '100%', marginTop: 10 }} onClick={next}>
                  {queue.idx + 1 < queue.sentences.length ? '다음 문항 →' : '결과 보기'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
