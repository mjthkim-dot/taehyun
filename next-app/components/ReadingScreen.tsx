'use client';

/** 독해 — voice-assistant/index.html 의 renderReading()/gradeReading() 포팅. AI 새 지문 생성 포함. */
import { useState } from 'react';
import { CEFR_GSE, CEFR_ORDER, type Cefr } from '../lib/lessons';
import { addPhrase, bumpSkill, getProfile, groqKey, markPracticedToday } from '../lib/state';
import { groqComplete, GroqError } from '../lib/groq';
import { speakText } from './SpeakButton';

interface ReadingItem {
  title: string;
  text: string;
  qs: { q: string; o: string[]; a: number }[];
  vocab: { w: string; kr: string }[];
}

const READING_BANK: Record<Cefr, ReadingItem[]> = {
  A1: [
    {
      title: 'My Morning',
      text: "I get up at seven o'clock. I drink a glass of water and eat some bread. My sister makes coffee. We go to school together. School starts at nine. I like my English class the best.",
      qs: [
        { q: 'What time does the writer get up?', o: ['Six', 'Seven', 'Nine'], a: 1 },
        { q: 'Who makes coffee?', o: ['The writer', 'The mother', 'The sister'], a: 2 },
        { q: 'Which class does the writer like best?', o: ['Math', 'English', 'Science'], a: 1 },
      ],
      vocab: [{ w: 'get up', kr: '일어나다' }, { w: 'together', kr: '함께' }, { w: 'the best', kr: '가장 좋아하는' }],
    },
  ],
  A2: [
    {
      title: 'A Trip to the Market',
      text: 'Last Saturday, I went to the local market with my friend. We wanted to buy fresh vegetables and fruit. The market was crowded, but the food looked delicious. I bought some tomatoes and apples. My friend chose a big watermelon. We were tired but happy on the way home.',
      qs: [
        { q: 'When did they go to the market?', o: ['Last Sunday', 'Last Saturday', 'Yesterday'], a: 1 },
        { q: 'What did the friend buy?', o: ['Tomatoes', 'Apples', 'A watermelon'], a: 2 },
        { q: 'How did they feel going home?', o: ['Tired but happy', 'Angry', 'Bored'], a: 0 },
      ],
      vocab: [{ w: 'crowded', kr: '붐비는' }, { w: 'fresh', kr: '신선한' }, { w: 'on the way home', kr: '집에 가는 길에' }],
    },
  ],
  B1: [
    {
      title: 'Working from Home',
      text: 'Since the pandemic, many companies have allowed employees to work from home. This change has both advantages and disadvantages. On one hand, workers save time because they no longer commute. On the other hand, some people find it hard to separate work from their personal life. Experts suggest setting a fixed schedule and a dedicated workspace to stay productive.',
      qs: [
        { q: 'What is one advantage mentioned?', o: ['Higher salary', 'Saving commute time', 'More holidays'], a: 1 },
        { q: 'What problem do some people face?', o: ['Slow internet', 'Separating work and personal life', 'Noisy offices'], a: 1 },
        { q: 'What do experts recommend?', o: ['Working at night', 'A fixed schedule and workspace', 'Working less'], a: 1 },
      ],
      vocab: [{ w: 'commute', kr: '통근하다' }, { w: 'advantage', kr: '장점' }, { w: 'productive', kr: '생산적인' }],
    },
  ],
  B2: [
    {
      title: 'The Value of Failure',
      text: 'We often regard failure as something to be avoided at all costs. Yet many successful entrepreneurs argue that failure is an essential part of innovation. When a project collapses, it reveals flawed assumptions that would otherwise remain hidden. The key, they insist, is not to dwell on the setback but to extract lessons quickly and adapt. In this sense, resilience matters far more than an unbroken record of success.',
      qs: [
        { q: 'How do many entrepreneurs view failure?', o: ['As a disaster', 'As essential to innovation', 'As irrelevant'], a: 1 },
        { q: 'What does failure reveal?', o: ['Flawed assumptions', 'Hidden talent', 'Financial gain'], a: 0 },
        { q: 'What matters most, according to the text?', o: ['Resilience', 'Luck', 'Money'], a: 0 },
      ],
      vocab: [{ w: 'regard A as B', kr: 'A를 B로 여기다' }, { w: 'flawed', kr: '결함이 있는' }, { w: 'resilience', kr: '회복탄력성' }],
    },
  ],
  C1: [
    {
      title: 'The Paradox of Choice',
      text: 'Conventional wisdom holds that more options lead to greater satisfaction. However, psychologist Barry Schwartz contends that an abundance of choice can be paralysing. When confronted with dozens of nearly identical products, consumers often experience anxiety and, paradoxically, less contentment with whatever they ultimately select. The phenomenon underscores a subtle truth: autonomy, while valuable, carries a cognitive cost that we rarely acknowledge.',
      qs: [
        { q: 'What is conventional wisdom about choice?', o: ['Fewer options are better', 'More options increase satisfaction', 'Choice is unimportant'], a: 1 },
        { q: 'What does Schwartz argue?', o: ['Choice can be paralysing', 'Choice is always good', 'Money buys happiness'], a: 0 },
        { q: 'What "cognitive cost" is implied?', o: ['Memory loss', 'Mental effort of deciding', 'Physical fatigue'], a: 1 },
      ],
      vocab: [{ w: 'conventional wisdom', kr: '통념' }, { w: 'contend', kr: '주장하다' }, { w: 'paradoxically', kr: '역설적이게도' }],
    },
  ],
  C2: [
    {
      title: 'On Linguistic Relativity',
      text: 'The hypothesis that language shapes thought has long oscillated between fervent endorsement and outright dismissal. Strong formulations—claiming that speakers of different languages inhabit incommensurable conceptual worlds—have largely been discredited. Yet a more tempered version persists: that habitual linguistic categories subtly bias attention and memory. The contemporary consensus, insofar as one exists, is that language nudges cognition without imprisoning it.',
      qs: [
        { q: 'What has happened to strong formulations of the hypothesis?', o: ['They are widely accepted', 'They have been discredited', 'They were never proposed'], a: 1 },
        { q: 'What does the tempered version claim?', o: ['Language bias attention and memory', 'Language has no effect', 'Thought creates language'], a: 0 },
        { q: 'The phrase "nudges cognition without imprisoning it" means language…', o: ['controls thought completely', 'influences but does not determine thought', 'is unrelated to thought'], a: 1 },
      ],
      vocab: [{ w: 'oscillate', kr: '오가다, 진동하다' }, { w: 'incommensurable', kr: '통약 불가능한' }, { w: 'tempered', kr: '누그러진, 절제된' }],
    },
  ],
};

export default function ReadingScreen() {
  const [level, setLevel] = useState<Cefr>(getProfile().cefr || 'A2');
  const [item, setItem] = useState<ReadingItem | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [graded, setGraded] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  function start(custom?: ReadingItem) {
    const it = custom || READING_BANK[level]?.[0];
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
          <button className="btn primary" style={{ flex: 1 }} onClick={() => start()}>📄 {level} 지문 풀기</button>
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
