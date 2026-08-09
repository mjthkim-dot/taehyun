'use client';

/** 작문 — voice-assistant/index.html 의 renderWriting()/gradeWriting() 포팅. */
import { useState } from 'react';
import { CEFR_GSE, CEFR_ORDER, type Cefr } from '../lib/lessons';
import { bumpSkill, getProfile, groqKey, markPracticedToday } from '../lib/state';
import { GroqError } from '../lib/groq';
import { AI_FAIL_KO, groqKoJson, hasHangul } from '../lib/aiGuard';
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
      // 설명 필드(summary/strengths/why)는 학습자가 읽는 부분 — 반드시 한국어.
      // 시스템 프롬프트를 한국어로 쓰고, 어기면 groqKoJson이 한 번 다시 묻는다.
      const sys = `너는 한국인 학습자를 위한 영어 작문 첨삭 코치다. 채점 기준은 IELTS/CEFR. summary·strengths·why는 반드시 한국어(존댓말)로 쓴다. 영어는 corrected·modelAnswer·wrong·fix에만 쓴다. Output ONLY JSON.`;
      const user = `과제: "${prompt.p}"
목표 레벨: CEFR ${level}.
학생의 작문: """${text.trim()}"""
JSON으로 답하라: {"cefr":"추정 CEFR (예: B1)","score":0-100 숫자,"summary":"한국어 총평 1~2문장","strengths":["한국어로 쓴 잘한 점",...2개],"issues":[{"wrong":"원문에서 틀린 구절 그대로","fix":"고친 구절 (영어)","why":"왜 고쳐야 하는지 한국어 한 줄"},...최대 5개],"corrected":"전체 글을 자연스럽게 고쳐 쓴 영어","modelAnswer":"${level}+ 수준의 영어 모범답안"}`;
      const d = await groqKoJson<Feedback>(
        [{ role: 'system', content: sys }, { role: 'user', content: user }],
        { maxTokens: 1400, temperature: 0.4 },
        (data) => {
          const o = (data ?? {}) as Feedback;
          // 형태: 교정문이 있어야 첨삭이라 부를 수 있다. 언어: 총평이 한국어여야 하고,
          // 설명 배열이 배열이 아니면(모델 변덕) 응답을 버린다.
          if (!o || typeof o !== 'object' || !o.corrected) return null;
          if (!hasHangul(o.summary)) return null;
          if (o.strengths != null && !Array.isArray(o.strengths)) return null;
          if (o.issues != null && !Array.isArray(o.issues)) return null;
          return o;
        }
      );
      if (!d) {
        setError(AI_FAIL_KO);
        return;
      }
      setFeedback(d);
      // score가 "85/100" 같은 문자열로 와도 NaN이 스킬 저장소로 흘러가지 않게 한다
      const rawScore = Number(String(d.score ?? '').replace(/[^\d.]/g, ''));
      const score = Number.isFinite(rawScore) && rawScore > 0 ? Math.min(rawScore, 100) : 60;
      const band = CEFR_GSE[level];
      const gse = Math.round(band.min + (band.max - band.min) * Math.min(1, score / 100));
      bumpSkill('writing', gse);
      markPracticedToday();
    } catch (e) {
      setError(e instanceof GroqError ? e.message : AI_FAIL_KO);
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
                color: c === level ? 'var(--on-primary)' : 'var(--text-muted)',
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
