'use client';

/** 독해 — voice-assistant/index.html 의 renderReading()/gradeReading() 포팅. AI 새 지문 생성 포함. */
import { useState } from 'react';
import { CEFR_GSE, CEFR_ORDER, type Cefr } from '../lib/lessons';
import { addPhrase, bumpSkill, getProfile, groqKey, markPracticedToday } from '../lib/state';
import { groqComplete, GroqError } from '../lib/groq';
import { READING_BANK, type ReadingItem } from '../lib/contentBanks';
import { speakText } from './SpeakButton';

export default function ReadingScreen() {
  const [level, setLevel] = useState<Cefr>(getProfile().cefr || 'A2');
  const [item, setItem] = useState<ReadingItem | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [graded, setGraded] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  function start(custom?: ReadingItem) {
    const bank = READING_BANK[level] || [];
    const it = custom || bank[Math.floor(Math.random() * bank.length)];
    if (!it) return;
    setItem(it);
    setAnswers({});
    setGraded(false);
    setSavedWords(new Set());
  }

  function pick(i: number, j: number) {
    if (graded) return;
    setAnswers((a) => ({ ...a, [i]: j }));
  }

  function grade() {
    if (!item) return;
    let correct = 0;
    item.qs.forEach((qq, i) => {
      if (answers[i] === qq.a) correct++;
    });
    const ratio = correct / item.qs.length;
    const band = CEFR_GSE[level];
    const gse = Math.round(band.min + (band.max - band.min) * ratio);
    bumpSkill('reading', gse);
    markPracticedToday();
    setGraded(true);
  }

  async function genReading() {
    if (!groqKey()) {
      setGenError('NO_KEY');
      return;
    }
    setGenError(null);
    setGenLoading(true);
    try {
      const sys = `You are an English reading-material author. Output ONLY JSON.`;
      const user = `Create a CEFR ${level} reading passage for a Korean learner.
JSON shape: {"title":"...","text":"5-7 sentences at ${level} difficulty","qs":[{"q":"...","o":["a","b","c"],"a":0},{...3 questions...}],"vocab":[{"w":"word/phrase","kr":"Korean meaning"},{...3 items...}]}
Keep vocabulary and grammar appropriate for ${level}. "a" is the index (0-based) of the correct option.`;
      const raw = await groqComplete([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true, maxTokens: 900, temperature: 0.7 });
      const data = JSON.parse(raw);
      if (!data.text || !Array.isArray(data.qs)) throw new Error('bad');
      start(data);
    } catch (e) {
      setGenError(e instanceof GroqError ? e.message : '지문 생성 실패 — 기본 지문으로 진행하세요.');
    } finally {
      setGenLoading(false);
    }
  }

  function saveVocab(w: string, kr: string) {
    addPhrase({ en: w, kr });
    setSavedWords((s) => new Set(s).add(w));
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>📖 독해 (Reading)</h3>
        <p className="muted" style={{ marginBottom: 12 }}>내 레벨에 맞춘 지문 + 이해 문제 + 핵심 어휘</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {CEFR_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => {
                setLevel(c);
                setItem(null);
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => start()}>📄 {level} 지문 풀기 (랜덤)</button>
          <button className="btn" style={{ flex: '0 0 auto' }} disabled={genLoading} onClick={genReading} title="AI가 새 지문을 생성합니다">
            {genLoading ? '생성 중...' : '🤖 AI 새 지문'}
          </button>
        </div>
        {genError === 'NO_KEY' && (
          <p style={{ fontSize: '0.78rem', color: 'var(--yellow)', marginBottom: 10 }}>
            🤖 AI 지문 생성은 Groq 키 연결 후 사용할 수 있어요.
          </p>
        )}
        {genError && genError !== 'NO_KEY' && (
          <p style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 10 }}>{genError}</p>
        )}
      </div>

      {item && (
        <>
          <div className="study-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{item.title}</div>
              <button className="btn" style={{ padding: '3px 9px', fontSize: '0.74rem' }} onClick={() => speakText(item.text, 'en-US')}>
                🔊 듣기
              </button>
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.85 }}>{item.text}</div>
          </div>

          <div className="study-card">
            <h4 style={{ color: 'var(--primary-light)', marginBottom: 8 }}>📝 이해 문제</h4>
            {item.qs.map((qq, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 9 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 8 }}>{i + 1}. {qq.q}</div>
                {qq.o.map((opt, j) => {
                  const picked = answers[i] === j;
                  const isCorrect = j === qq.a;
                  let border = 'var(--border)';
                  let bg = 'var(--surface2)';
                  let color = 'var(--text)';
                  if (graded) {
                    if (isCorrect) {
                      border = 'var(--green)';
                    } else if (picked) {
                      border = 'var(--red)';
                      bg = 'rgba(239,68,68,0.12)';
                    }
                  } else if (picked) {
                    border = 'var(--primary)';
                    bg = 'var(--primary)';
                    color = '#fff';
                  }
                  return (
                    <button
                      key={j}
                      onClick={() => pick(i, j)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 11px',
                        borderRadius: 8,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        border: `1px solid ${border}`,
                        background: bg,
                        color,
                        marginBottom: 5,
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ))}
            {!graded && <button className="start-drill-btn" onClick={grade}>채점하기</button>}

            <h4 style={{ color: 'var(--primary-light)', margin: '16px 0 8px' }}>
              🔑 핵심 어휘 <span className="muted" style={{ fontSize: '0.7rem', fontWeight: 400 }}>· 탭하면 표현장 저장</span>
            </h4>
            {item.vocab.map((v) => (
              <button
                key={v.w}
                onClick={() => saveVocab(v.w, v.kr)}
                style={{
                  display: 'inline-block',
                  margin: '0 6px 6px 0',
                  padding: '7px 11px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                <b>{v.w}</b> · {v.kr} {savedWords.has(v.w) ? '✅' : '＋'}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
