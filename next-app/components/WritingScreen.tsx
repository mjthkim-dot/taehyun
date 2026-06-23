'use client';

/** 작문 — voice-assistant/index.html 의 renderWriting()/gradeWriting() 포팅. */
import { useState } from 'react';
import { CEFR_GSE, CEFR_ORDER, type Cefr } from '../lib/lessons';
import { bumpSkill, getProfile, groqKey, markPracticedToday } from '../lib/state';
import { groqComplete, GroqError } from '../lib/groq';
import { WRITE_PROMPTS } from '../lib/contentBanks';
import { Skeleton } from './Skeleton';

interface Feedback {
  cefr?: string;
  score?: number;
  summary?: string;
  strengths?: string[];
  issues?: { wrong?: string; fix?: string; why?: string }[];
  corrected?: string;
  modelAnswer?: string;
}

export default function WritingScreen() {
  const [level, setLevel] = useState<Cefr>(getProfile().cefr || 'A2');
  const [promptIdx, setPromptIdx] = useState(0);
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const list = WRITE_PROMPTS[level] || WRITE_PROMPTS.A2;
  const prompt = list[Math.min(promptIdx, list.length - 1)];
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  function rollPrompt() {
    if (list.length <= 1) return;
    let next = promptIdx;
    while (next === promptIdx) next = Math.floor(Math.random() * list.length);
    setPromptIdx(next);
    setFeedback(null);
  }

  async function grade() {
    if (wordCount < 8) {
      setError('조금 더 작성해 주세요 (최소 8단어).');
      return;
    }
    if (!groqKey()) {
      setError('NO_KEY');
      return;
    }
    setError(null);
    setLoading(true);
    setFeedback(null);
    try {
      const sys = `You are an IELTS/CEFR writing examiner for Korean learners. Output ONLY JSON.`;
      const user = `Task prompt: "${prompt.p}"
Target level: CEFR ${level}.
Student's writing: """${text.trim()}"""
Return JSON: {"cefr":"estimated CEFR like B1","score":0-100,"summary":"1-2 sentence overall in Korean","strengths":["Korean point",...],"issues":[{"wrong":"exact phrase from text","fix":"corrected phrase","why":"short Korean reason"},... up to 5],"corrected":"the full text rewritten correctly in natural English","modelAnswer":"a model answer at ${level}+ level"}`;
      const raw = await groqComplete([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true, maxTokens: 1400, temperature: 0.4 });
      const d: Feedback = JSON.parse(raw);
      setFeedback(d);
      const band = CEFR_GSE[level];
      const gse = Math.round(band.min + (band.max - band.min) * Math.min(1, (d.score ?? 60) / 100));
      bumpSkill('writing', gse);
      markPracticedToday();
    } catch (e) {
      setError(e instanceof GroqError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>✍️ 작문 (Writing)</h3>
        <p className="muted" style={{ marginBottom: 12 }}>AI가 IELTS 스타일로 채점 — 문법·어휘·구성·교정문 제공</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {CEFR_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => {
                setLevel(c);
                setPromptIdx(0);
                setFeedback(null);
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

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', marginBottom: 10 }}>
          <div className="muted" style={{ fontSize: '0.74rem', marginBottom: 4 }}>✏️ 과제 ({level}) · 최소 {prompt.min}단어</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.5 }}>{prompt.p}</div>
          <button className="btn" onClick={rollPrompt} style={{ marginTop: 8, padding: '5px 10px', fontSize: '0.74rem' }}>🎲 다른 과제</button>
        </div>

        <textarea
          rows={9}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="여기에 영어로 작성하세요..."
          style={{
            width: '100%',
            background: 'var(--surface2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 12,
            fontSize: '0.92rem',
            lineHeight: 1.6,
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
          <span style={{ fontSize: '0.76rem', color: wordCount >= prompt.min ? 'var(--green)' : 'var(--text-muted)' }}>
            {wordCount} 단어{wordCount < prompt.min ? ` (목표 ${prompt.min})` : ' ✓'}
          </span>
        </div>
        <button className="start-drill-btn" onClick={grade} disabled={loading}>
          {loading ? '🤖 채점 중...' : '🤖 AI 첨삭 받기'}
        </button>

        {error === 'NO_KEY' && (
          <p style={{ fontSize: '0.82rem', color: 'var(--yellow)', marginTop: 10 }}>
            🤖 상세 AI 첨삭은 Groq API 키 연결 후 가능해요.
          </p>
        )}
        {error && error !== 'NO_KEY' && <p style={{ fontSize: '0.84rem', color: 'var(--red)', marginTop: 10 }}>{error}</p>}

        {loading && !feedback && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginTop: 14 }}>
            <Skeleton width={64} height={26} style={{ marginBottom: 12 }} />
            <Skeleton width="100%" height={12} style={{ marginBottom: 8 }} />
            <Skeleton width="90%" height={12} style={{ marginBottom: 8 }} />
            <Skeleton width="75%" height={12} />
          </div>
        )}

        {feedback && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 14, padding: 16, marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary-light)' }}>{feedback.cefr || ''}</span>
              {feedback.score != null && <span className="muted" style={{ fontSize: '0.9rem' }}>{feedback.score}/100</span>}
            </div>
            {feedback.summary && <div style={{ fontSize: '0.84rem', lineHeight: 1.6, marginBottom: 10 }}>{feedback.summary}</div>}
            {!!feedback.strengths?.length && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--green)', margin: '6px 0 4px' }}>잘한 점</div>
                <ul style={{ margin: '0 0 8px 18px', fontSize: '0.8rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                  {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </>
            )}
            {!!feedback.issues?.length && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--yellow)', margin: '8px 0 4px' }}>고칠 점</div>
                {feedback.issues.map((it, i) => (
                  <div key={i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '9px 11px', marginBottom: 6, fontSize: '0.8rem', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--red)', textDecoration: 'line-through' }}>{it.wrong || ''}</span> →{' '}
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>{it.fix || ''}</span>
                    <div className="muted" style={{ fontSize: '0.74rem', marginTop: 2 }}>{it.why || ''}</div>
                  </div>
                ))}
              </>
            )}
            {feedback.corrected && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary-light)', margin: '10px 0 4px' }}>✅ 교정문</div>
                <div style={{ fontSize: '0.84rem', lineHeight: 1.7, background: 'var(--surface2)', borderRadius: 8, padding: 11 }}>{feedback.corrected}</div>
              </>
            )}
            {feedback.modelAnswer && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary-light)', margin: '10px 0 4px' }}>🌟 모범답안</div>
                <div style={{ fontSize: '0.84rem', lineHeight: 1.7, background: 'var(--surface2)', borderRadius: 8, padding: 11 }}>{feedback.modelAnswer}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
