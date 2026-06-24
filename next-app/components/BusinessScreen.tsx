'use client';

/**
 * 비즈니스 회화 전용 화면 — 기존 회화(talk) 탭에서 쌓인 챗 로그(va_chat_logs)를
 * AI가 비즈니스 미팅 회의록 형식으로 정리해 학습 자료(요약·안건·결정·액션아이템·
 * 핵심 표현·후속 연습 질문)로 만들어준다. 별도의 비즈니스 회화 진입점도 함께 제공한다.
 */
import { useEffect, useState } from 'react';
import { getChatLogs, type ChatLogEntry } from '../lib/state';
import { groqComplete, GroqError } from '../lib/groq';
import { buildMeetingMinutesPrompt, type MeetingMinutes } from '../lib/businessPrompts';
import EmptyState from './EmptyState';

const BUSINESS_LESSON_ID = 603;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BusinessScreen({ onStartTalk }: { onStartTalk: (lessonId: number) => void }) {
  const [ready, setReady] = useState(false);
  const [logs, setLogs] = useState<ChatLogEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);

  useEffect(() => {
    setLogs(getChatLogs().filter((l) => l.transcript.length >= 2).slice().reverse());
    setReady(true);
  }, []);

  if (!ready) return null;

  async function generate(log: ChatLogEntry) {
    setActiveId(log.id);
    setMinutes(null);
    setError(null);
    setBusy(true);
    try {
      const raw = await groqComplete(
        [{ role: 'user', content: buildMeetingMinutesPrompt(log.transcript, log.lessonTitle) }],
        { temperature: 0.4, maxTokens: 900, json: true }
      );
      const parsed = JSON.parse(raw) as MeetingMinutes;
      setMinutes({
        title_ko: parsed.title_ko || '회의록',
        summary_ko: parsed.summary_ko || '',
        agenda: parsed.agenda || [],
        decisions: parsed.decisions || [],
        action_items: parsed.action_items || [],
        vocab: parsed.vocab || [],
        follow_up_questions: parsed.follow_up_questions || [],
      });
    } catch (err) {
      const e = err as Error;
      if (e instanceof GroqError && e.message === 'NO_GROQ_KEY') {
        setError('⚡ 회의록 학습을 위해 회화 탭에서 무료 Groq 키를 먼저 등록해주세요.');
      } else {
        setError(`❌ 회의록 생성 실패: ${e.message}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="study-screen">
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 800, marginBottom: 8 }}>💼 비즈니스 회화 연습</div>
        <div className="feat-grid">
          <button className="feat-card" onClick={() => onStartTalk(BUSINESS_LESSON_ID)}>
            <div className="ic">💼</div>
            <div className="lbl">비즈니스 미팅</div>
            <div className="sub">해외 동료와 프로젝트 논의 롤플레이</div>
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 800, marginBottom: 8 }}>📋 회의록 학습</div>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
          회화 탭에서 나눈 대화를 골라 비즈니스 미팅 회의록 형식으로 정리하고, 안건·결정사항·핵심 표현을 학습해보세요.
        </div>

        {logs.length === 0 ? (
          <EmptyState art="inbox" title="아직 회화 기록이 없어요">
            회화 탭에서 AI와 몇 마디 나누면 여기서 회의록 학습 자료로 만들 수 있어요.
          </EmptyState>
        ) : (
          <div className="feat-grid" style={{ marginBottom: 14 }}>
            {logs.map((log) => (
              <button
                key={log.id}
                className="feat-card"
                onClick={() => generate(log)}
                disabled={busy}
              >
                <div className="ic">🗂️</div>
                <div className="lbl">{log.lessonTitle}</div>
                <div className="sub">
                  {fmtDate(log.date)} · {log.transcript.length}턴
                </div>
              </button>
            ))}
          </div>
        )}

        {busy && activeId && (
          <div className="msg system">
            <div className="bubble">📋 AI가 회의록을 정리하는 중...</div>
          </div>
        )}

        {error && (
          <div className="msg system">
            <div className="bubble">{error}</div>
          </div>
        )}

        {minutes && !busy && (
          <div className="caf-wrap" style={{ textAlign: 'left', maxWidth: '100%' }}>
            <h3>📋 {minutes.title_ko}</h3>
            <div className="caf-sub">{minutes.summary_ko}</div>

            {minutes.agenda.length > 0 && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, margin: '10px 0 4px' }}>🗒 다룬 안건</div>
                {minutes.agenda.map((a, i) => (
                  <div className="para-card" key={i}>
                    {a}
                  </div>
                ))}
              </>
            )}

            {minutes.decisions.length > 0 && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, margin: '10px 0 4px' }}>✅ 결정사항</div>
                {minutes.decisions.map((d, i) => (
                  <div className="para-card" key={i}>
                    {d}
                  </div>
                ))}
              </>
            )}

            {minutes.action_items.length > 0 && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, margin: '10px 0 4px' }}>🚀 액션 아이템</div>
                {minutes.action_items.map((a, i) => (
                  <div className="para-card" key={i}>
                    {a}
                  </div>
                ))}
              </>
            )}

            {minutes.vocab.length > 0 && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, margin: '10px 0 4px' }}>💬 핵심 비즈니스 표현</div>
                {minutes.vocab.map((v, i) => (
                  <div className="para-card" key={i}>
                    <span className="up">{v.en}</span> — {v.kr}
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{v.note_ko}</div>
                  </div>
                ))}
              </>
            )}

            {minutes.follow_up_questions.length > 0 && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, margin: '10px 0 4px' }}>🎯 다음 연습 질문</div>
                {minutes.follow_up_questions.map((q, i) => (
                  <div className="para-card" key={i}>
                    <span className="or">{q.en}</span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{q.kr}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
