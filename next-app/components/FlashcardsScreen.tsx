'use client';

/**
 * 암기 카드 — voice-assistant/index.html 의 flashState/renderFlashcards() 포팅.
 * 능동적 회상(active recall) + SRS 자가채점(다시/어려움/알맞음/쉬움)으로 복습 간격을 갱신한다.
 */
import { useEffect, useState } from 'react';
import {
  dueWeak,
  load,
  gradeWeakItem,
  markPracticedToday,
  SRS_MAX_BOX,
  SRS_LEECH_THRESHOLD,
  type WeakItem,
  type FlashGrade,
} from '../lib/state';
import { groqComplete, GroqError } from '../lib/groq';
import { speakText } from './SpeakButton';

type Scope = 'due' | 'all';
type Dir = 'krToEn' | 'enToKr';

interface Session {
  cards: WeakItem[];
  idx: number;
  flipped: boolean;
  again: WeakItem[];
  total: number;
  graded: number;
  spoke: boolean;
}

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FlashcardsScreen({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [dir, setDir] = useState<Dir>('krToEn');
  const [example, setExample] = useState<string | null>(null);
  const [exampleLoading, setExampleLoading] = useState(false);

  function start(scope: Scope) {
    const cards = (scope === 'all' ? load<WeakItem[]>('va_weak', []) : dueWeak()).filter((c) => c.en);
    setSession({ cards: shuffled(cards), idx: 0, flipped: false, again: [], total: cards.length, graded: 0, spoke: false });
    setExample(null);
  }

  function flip() {
    setSession((s) => (s ? { ...s, flipped: true } : s));
  }

  function toggleDir() {
    setDir((d) => (d === 'krToEn' ? 'enToKr' : 'krToEn'));
    setSession((s) => (s ? { ...s, flipped: false, spoke: false } : s));
    setExample(null);
  }

  function grade(g: FlashGrade) {
    if (!session) return;
    const card = session.cards[session.idx];
    gradeWeakItem(card.en, g);
    const again = g === 'again' ? [...session.again, card] : session.again;
    setSession({ ...session, again, graded: session.graded + 1, idx: session.idx + 1, flipped: false, spoke: false });
    setExample(null);
  }

  function restartWithAgain() {
    if (!session) return;
    setSession({ ...session, cards: session.again, again: [], idx: 0, flipped: false, spoke: false });
    setExample(null);
  }

  useEffect(() => {
    if (!session || !session.flipped || session.spoke) return;
    const card = session.cards[session.idx];
    const back = dir === 'krToEn' ? card.en : card.kr || '(뜻 없음)';
    const backLang = dir === 'krToEn' ? 'en-US' : 'ko-KR';
    speakText(back, backLang);
    setSession((s) => (s ? { ...s, spoke: true } : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.flipped, session?.idx, session?.spoke, dir]);

  async function showExample(card: WeakItem) {
    setExampleLoading(true);
    try {
      const sys = `You help a Korean learner memorize an English expression. Output ONLY JSON.`;
      const user = `Expression: "${card.en}" (Korean meaning: "${card.kr || ''}").
Return JSON: {"example":"one short natural English example sentence using it","exampleKr":"its Korean translation","tip":"a short Korean memory tip or association to remember it"}`;
      const raw = await groqComplete([{ role: 'system', content: sys }, { role: 'user', content: user }], {
        json: true,
        maxTokens: 320,
        temperature: 0.6,
      });
      const d = JSON.parse(raw);
      setExample(JSON.stringify(d));
    } catch (e) {
      setExample(
        JSON.stringify({ error: e instanceof GroqError ? e.message : '예문 생성 실패: ' + String(e) })
      );
    } finally {
      setExampleLoading(false);
    }
  }

  if (!session) {
    const due = dueWeak().length;
    const total = load<WeakItem[]>('va_weak', []).filter((c) => c.en).length;
    return (
      <div className="study-screen">
        <div className="study-card">
          <h3>🃏 암기 카드</h3>
          <p className="muted" style={{ marginBottom: 14 }}>
            능동적 회상(active recall)과 망각곡선 간격 반복으로 장기기억에 새깁니다. 정답을 확인한 뒤 얼마나
            쉬웠는지 스스로 평가하면 다음 복습 시점이 자동으로 정해져요.
          </p>
          <button className="start-drill-btn" disabled={!due} style={!due ? { opacity: 0.5 } : undefined} onClick={() => start('due')}>
            ▶ 오늘 복습 카드 {due}개 외우기
          </button>
          <button
            className="btn"
            style={{ width: '100%', marginTop: 10, opacity: total ? 1 : 0.5 }}
            disabled={!total}
            onClick={() => start('all')}
          >
            📚 전체 카드 {total}개 외우기
          </button>
          {!total && (
            <div className="empty-note" style={{ marginTop: 14 }}>
              아직 외울 카드가 없어요.
              <br />
              드릴·어휘·숙제 도우미에서 표현이 쌓이면 여기서 외울 수 있어요.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (session.idx >= session.cards.length) {
    if (session.again.length) {
      restartWithAgain();
      return null;
    }
    markPracticedToday();
    return (
      <div className="study-screen">
        <div
          className="study-card"
          style={{ textAlign: 'center', border: '1px solid var(--primary)', padding: 24 }}
        >
          <div style={{ fontSize: '2.4rem' }}>🎉</div>
          <div style={{ fontSize: '1rem', fontWeight: 800, margin: '6px 0' }}>{session.graded}개 카드를 외웠어요!</div>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            맞힌 카드는 복습 간격이 늘어났고,
            <br />
            어려웠던 카드는 곧 다시 나타납니다.
          </p>
          <button className="start-drill-btn" style={{ marginTop: 16 }} onClick={() => setSession(null)}>
            ↻ 더 외우기
          </button>
          <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={onExit}>
            📝 복습 탭으로
          </button>
        </div>
      </div>
    );
  }

  const card = session.cards[session.idx];
  const front = dir === 'krToEn' ? card.kr || '(뜻 없음)' : card.en;
  const back = dir === 'krToEn' ? card.en : card.kr || '(뜻 없음)';
  const backLang = dir === 'krToEn' ? 'en-US' : 'ko-KR';
  const progress = Math.round((session.idx / Math.max(1, session.cards.length)) * 100);

  let exampleData: { example?: string; exampleKr?: string; tip?: string; error?: string } | null = null;
  if (example) {
    try {
      exampleData = JSON.parse(example);
    } catch {
      exampleData = null;
    }
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>🃏 암기 카드 — {dir === 'krToEn' ? '뜻 → 영어 떠올리기' : '영어 → 뜻 떠올리기'}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="muted" style={{ fontSize: '0.76rem' }}>
            {session.idx + 1} / {session.cards.length}
            {session.again.length ? ` · 🔁 ${session.again.length}` : ''}
          </span>
          <button className="btn" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={toggleDir}>
            ↔ {dir === 'krToEn' ? 'KR→EN' : 'EN→KR'}
          </button>
        </div>
        <div className="bar" style={{ marginBottom: 12 }}>
          <div className="fill" style={{ width: `${progress}%` }} />
        </div>

        <div
          onClick={flip}
          style={{
            cursor: 'pointer',
            background: 'var(--surface)',
            border: '1px solid var(--primary)',
            borderRadius: 16,
            padding: '30px 18px',
            minHeight: 150,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          {!session.flipped ? (
            <>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.5 }}>{front}</div>
              <div className="muted" style={{ fontSize: '0.74rem', marginTop: 16 }}>탭하면 정답이 보여요</div>
            </>
          ) : (
            <>
              <div className="muted" style={{ fontSize: '0.92rem', marginBottom: 8 }}>{front}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary-light)', lineHeight: 1.5 }}>
                {back}{' '}
                <button
                  type="button"
                  className="speak-mini"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakText(back, backLang);
                  }}
                >
                  🔊
                </button>
              </div>
              {(card.lapses || 0) >= SRS_LEECH_THRESHOLD && (
                <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginTop: 8 }}>
                  🔥 자주 틀리는 표현 — 예문으로 익혀보세요
                </div>
              )}
            </>
          )}
        </div>

        {!session.flipped ? (
          <button className="start-drill-btn" style={{ marginTop: 14 }} onClick={flip}>
            정답 확인 →
          </button>
        ) : (
          <>
            <div style={{ marginTop: 10 }}>
              {exampleLoading && <p className="muted" style={{ fontSize: '0.8rem' }}>💡 예문·암기팁 생성 중...</p>}
              {exampleData && !exampleData.error && (
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '11px 13px', fontSize: '0.82rem', lineHeight: 1.6 }}>
                  <div>
                    📝 <b>{exampleData.example}</b>{' '}
                    <button type="button" className="speak-mini" onClick={() => speakText(exampleData!.example || '', 'en-US')}>
                      🔊
                    </button>
                  </div>
                  {exampleData.exampleKr && (
                    <div className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>{exampleData.exampleKr}</div>
                  )}
                  {exampleData.tip && <div style={{ color: 'var(--yellow)', marginTop: 6 }}>💡 {exampleData.tip}</div>}
                </div>
              )}
              {exampleData?.error && <p style={{ fontSize: '0.78rem', color: 'var(--red)' }}>{exampleData.error}</p>}
            </div>
            {!example && !exampleLoading && (
              <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => showExample(card)}>
                💡 예문 · 암기팁 보기
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 12 }}>
              <button
                onClick={() => grade('again')}
                style={{
                  padding: '11px 4px',
                  borderRadius: 10,
                  border: '1px solid var(--red)',
                  background: 'rgba(239,68,68,.12)',
                  color: '#fca5a5',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  lineHeight: 1.3,
                }}
              >
                다시
                <br />
                <span style={{ fontSize: '0.63rem', fontWeight: 400, opacity: 0.8 }}>처음부터</span>
              </button>
              <button
                onClick={() => grade('hard')}
                style={{
                  padding: '11px 4px',
                  borderRadius: 10,
                  border: '1px solid var(--yellow)',
                  background: 'rgba(234,179,8,.12)',
                  color: 'var(--yellow)',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  lineHeight: 1.3,
                }}
              >
                어려움
                <br />
                <span style={{ fontSize: '0.63rem', fontWeight: 400, opacity: 0.8 }}>유지</span>
              </button>
              <button
                onClick={() => grade('good')}
                style={{
                  padding: '11px 4px',
                  borderRadius: 10,
                  border: '1px solid var(--primary)',
                  background: 'rgba(99,102,241,.16)',
                  color: 'var(--primary-light)',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  lineHeight: 1.3,
                }}
              >
                알맞음
                <br />
                <span style={{ fontSize: '0.63rem', fontWeight: 400, opacity: 0.8 }}>+1단계</span>
              </button>
              <button
                onClick={() => grade('easy')}
                style={{
                  padding: '11px 4px',
                  borderRadius: 10,
                  border: '1px solid var(--green)',
                  background: 'rgba(34,197,94,.12)',
                  color: 'var(--green)',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  lineHeight: 1.3,
                }}
              >
                쉬움
                <br />
                <span style={{ fontSize: '0.63rem', fontWeight: 400, opacity: 0.8 }}>+2단계</span>
              </button>
            </div>
          </>
        )}
        <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={onExit}>
          ← 그만하기
        </button>
      </div>
    </div>
  );
}
