'use client';

/**
 * 숙제 도우미 — voice-assistant/index.html 의 renderHomework()/solveHomework() 포팅.
 * 음성 입력(Groq Whisper + VAD)은 이번 단계에서 제외하고 텍스트 입력만 지원한다.
 */
import { useMemo, useState } from 'react';
import { ALL_LESSONS, LESSONS, lessonLabel, type Lesson } from '../lib/lessons';
import { groqComplete, GroqError } from '../lib/groq';
import { addPhrase, addWeakItem, groqKey, markPracticedToday } from '../lib/state';
import SpeakButton from './SpeakButton';

type HwMode = 'full' | 'hint';

interface HwItem {
  question?: string;
  answer?: string;
  explanation?: string;
  hint?: string;
}
interface HwResult {
  detected?: string;
  items?: HwItem[];
  keyPoints?: string[];
  saveItems?: { en: string; kr?: string }[];
  practice?: { q?: string; a?: string };
}

function hwLessonContext(lesson: Lesson | null) {
  if (!lesson) return '';
  const points = (lesson.sections || [])
    .flatMap((s) => (s.points || []).map((p) => `- ${p.en}${p.kr ? ` (${p.kr})` : ''}`))
    .join('\n');
  return `\n\nContext — this is for a Korean student's English lesson "${lessonLabel(lesson)} · ${lesson.title}". Homework assignment (Korean): "${lesson.homework || ''}". Lesson's key patterns:\n${points}\nMake your help directly relevant to this assignment and these patterns.`;
}

export default function HomeworkScreen({ lessonId }: { lessonId: number }) {
  const sessions = useMemo(() => LESSONS.filter((l) => !l.preview && l.homework), []);
  const [lessonChoice, setLessonChoice] = useState<number | null>(
    ALL_LESSONS.find((l) => l.id === lessonId && l.homework) ? lessonId : sessions[sessions.length - 1]?.id ?? null
  );
  const lesson = useMemo(() => ALL_LESSONS.find((l) => l.id === lessonChoice) ?? null, [lessonChoice]);

  const [mode, setMode] = useState<HwMode>('full');
  const [text, setText] = useState('');
  const [result, setResult] = useState<HwResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  async function solve() {
    const t = text.trim();
    if (!t) {
      setError('문제를 입력해 주세요.');
      return;
    }
    if (!groqKey()) {
      setError('NO_KEY');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    const modeRule =
      mode === 'hint'
        ? `MODE: HINT-ONLY. Do NOT reveal final answers. For each item, write a guiding "hint" in Korean (what to look at, which rule applies, how to start) and leave "answer" and "explanation" as empty strings.`
        : `MODE: FULL. For each item, give the correct "answer" (in English) and a clear step-by-step "explanation" in Korean. Leave "hint" empty.`;
    const sys = `You are a warm, patient Korean tutor helping a Korean student with their ENGLISH homework. Read the problem(s) from the text. If the student wrote their own attempted answers, also check them and gently correct mistakes. Explain in KOREAN (use English only for the English answers/examples). ${modeRule} Output ONLY valid JSON.${hwLessonContext(lesson)}`;
    const schema = `Return JSON:
{"detected":"1-line Korean summary of what this homework is",
 "items":[{"question":"the problem restated briefly","answer":"English answer (empty in HINT mode)","explanation":"Korean step-by-step (empty in HINT mode)","hint":"Korean guiding hint (only in HINT mode)"}],
 "keyPoints":["short Korean grammar/vocab takeaway"],
 "saveItems":[{"en":"useful English word/expression from this homework","kr":"Korean meaning"}],
 "practice":{"q":"one NEW similar practice problem in English","a":"its answer"}}`;
    try {
      const userText = `Homework text:\n"""${t}"""\n\n${schema}`;
      const raw = await groqComplete([{ role: 'system', content: sys }, { role: 'user', content: userText }], {
        json: true,
        maxTokens: 1500,
        temperature: 0.3,
      });
      setResult(JSON.parse(raw));
      markPracticedToday();
    } catch (e) {
      setError(e instanceof GroqError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function saveItems() {
    const items = (result?.saveItems || []).filter((x) => x && x.en?.trim());
    items.forEach((it) => {
      const en = it.en.trim();
      addPhrase({ en, kr: (it.kr || '').trim() });
      addWeakItem({ en, kr: (it.kr || '').trim(), lesson: 'homework', cat: 'homework' });
    });
    setSavedCount(items.length);
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>📚 숙제 도우미</h3>
        <p className="muted" style={{ marginBottom: 10 }}>회차별 숙제를 AI와 함께 — 텍스트로 풀이</p>

        {lesson?.homework && (
          <div
            style={{
              background: 'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.04))',
              border: '1px solid rgba(34,197,94,0.5)',
              borderRadius: 12,
              padding: '13px 15px',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--green)' }}>
                📋 {lesson.preview ? '예습 과제' : '이번 회차 숙제'}
              </span>
              {sessions.length > 1 ? (
                <select
                  value={lesson.id}
                  onChange={(e) => setLessonChoice(Number(e.target.value))}
                  style={{
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '4px 8px',
                    fontSize: '0.73rem',
                    maxWidth: '62%',
                  }}
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {lessonLabel(s)} · {s.title}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="muted" style={{ fontSize: '0.72rem' }}>{lessonLabel(lesson)}</span>
              )}
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.5 }}>{lesson.homework}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button
            onClick={() => setMode('full')}
            style={{
              flex: 1,
              padding: 9,
              borderRadius: 9,
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: `1px solid ${mode === 'full' ? 'var(--primary)' : 'var(--border)'}`,
              background: mode === 'full' ? 'var(--primary)' : 'var(--surface)',
              color: mode === 'full' ? '#fff' : 'var(--text-muted)',
            }}
          >
            ✅ 정답 + 풀이
          </button>
          <button
            onClick={() => setMode('hint')}
            style={{
              flex: 1,
              padding: 9,
              borderRadius: 9,
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: `1px solid ${mode === 'hint' ? 'var(--primary)' : 'var(--border)'}`,
              background: mode === 'hint' ? 'var(--primary)' : 'var(--surface)',
              color: mode === 'hint' ? '#fff' : 'var(--text-muted)',
            }}
          >
            💡 힌트로 스스로 풀기
          </button>
        </div>
        <p className="muted" style={{ fontSize: '0.74rem', marginBottom: 12, lineHeight: 1.5 }}>
          {mode === 'full'
            ? '정답과 한국어 단계별 풀이, 핵심 문법·표현을 알려드려요.'
            : '정답은 숨기고, 스스로 풀 수 있도록 방향과 힌트만 알려드려요 — 기억에 더 오래 남아요!'}
        </p>

        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'문제를 직접 입력해 주세요.\n예) 빈칸에 알맞은 것은? She ___ to school every day.'}
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
        <button className="start-drill-btn" style={{ marginTop: 10 }} onClick={solve} disabled={loading}>
          {loading ? '🤖 살펴보는 중...' : '🤖 숙제 도움 받기'}
        </button>

        {error === 'NO_KEY' && (
          <p style={{ fontSize: '0.78rem', color: 'var(--yellow)', marginTop: 10 }}>
            🤖 숙제 도우미는 Groq API 키 연결 후 쓸 수 있어요. 진도 화면에서 키를 등록해주세요.
          </p>
        )}
        {error && error !== 'NO_KEY' && (
          <p style={{ fontSize: '0.84rem', color: 'var(--red)', marginTop: 10 }}>🤖 숙제 도움 실패: {error}</p>
        )}

        {result && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 14, padding: 16, marginTop: 14 }}>
            {result.detected && (
              <div style={{ fontSize: '0.78rem', color: 'var(--primary-light)', fontWeight: 800, marginBottom: 10 }}>
                📚 {result.detected}
              </div>
            )}
            {(result.items || []).map((it, i) => (
              <div key={i} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '11px 13px', marginBottom: 9 }}>
                {it.question && (
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, lineHeight: 1.5, marginBottom: 6 }}>
                    {i + 1}. {it.question}
                  </div>
                )}
                {mode === 'hint'
                  ? it.hint && <div style={{ fontSize: '0.82rem', color: 'var(--yellow)', lineHeight: 1.6 }}>💡 {it.hint}</div>
                  : (
                    <>
                      {it.answer && (
                        <div style={{ fontSize: '0.86rem', lineHeight: 1.6, marginBottom: 4 }}>
                          ✅ <b style={{ color: 'var(--green)' }}>{it.answer}</b> <SpeakButton text={it.answer} />
                        </div>
                      )}
                      {it.explanation && <div className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>{it.explanation}</div>}
                    </>
                  )}
              </div>
            ))}
            {!!result.keyPoints?.length && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary-light)', margin: '10px 0 4px' }}>🔑 핵심 포인트</div>
                <ul style={{ margin: '0 0 4px 18px', fontSize: '0.8rem', lineHeight: 1.7, color: 'var(--text-muted)' }}>
                  {result.keyPoints.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </>
            )}
            {result.practice?.q && <PracticeBlock q={result.practice.q} a={result.practice.a || ''} />}
            {!!result.saveItems?.filter((x) => x?.en).length && (
              <button className="btn primary" style={{ width: '100%', marginTop: 12 }} onClick={saveItems}>
                {savedCount ? `✅ ${savedCount}개 저장 완료` : `💾 핵심 표현 ${result.saveItems.filter((x) => x?.en).length}개 암기카드에 추가`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PracticeBlock({ q, a }: { q: string; a: string }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary-light)', margin: '12px 0 4px' }}>📝 비슷한 연습문제</div>
      <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '11px 13px', fontSize: '0.84rem', lineHeight: 1.6 }}>
        {q}
        <div style={{ marginTop: 6 }}>
          {!shown ? (
            <button className="btn" style={{ padding: '4px 10px', fontSize: '0.74rem' }} onClick={() => setShown(true)}>
              정답 보기
            </button>
          ) : (
            <div style={{ color: 'var(--green)', fontWeight: 700 }}>{a}</div>
          )}
        </div>
      </div>
    </>
  );
}
