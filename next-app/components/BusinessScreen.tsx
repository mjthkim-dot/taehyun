'use client';

/**
 * 비즈니스 영어 레슨 화면 — 학습자의 실제 상황(회의록/이메일)을 입력하거나 저장된 회화를
 * 골라, AI가 "원어민은 이렇게 쓴다" 레슨(실무 문서 전문 + 용도별 표현 + 핵심 표현)을 만든다.
 * 핵심: 전체 내용을 처음부터 끝까지 음성으로 순차 낭독한다(현재 읽는 줄 하이라이트).
 * TTS는 SpeakButton의 공용 오디오/Media Session을 그대로 써서 잠금화면에서도 이어 재생된다.
 */
import { useEffect, useRef, useState } from 'react';
import { getChatLogs, type ChatLogEntry } from '../lib/state';
import { groqComplete, GroqError } from '../lib/groq';
import { buildBusinessLessonPrompt, type BusinessLesson, type ScenarioType } from '../lib/businessPrompts';
import { speakText, stopSpeaking } from './SpeakButton';

/** 문서를 음성 낭독·하이라이트 단위(줄/문장)로 쪼갠다. (룩비하인드 미사용 — 구형 사파리 호환) */
function splitLines(doc: string): string[] {
  return doc
    .split(/\n+/)
    .flatMap((para) => para.replace(/([.!?])\s+/g, '$1\n').split('\n'))
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function BusinessScreen({ onStartTalk }: { onStartTalk: (lessonId: number) => void }) {
  const [ready, setReady] = useState(false);
  const [scenario, setScenario] = useState<ScenarioType>('meeting');
  const [situation, setSituation] = useState('');
  const [logs, setLogs] = useState<ChatLogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<BusinessLesson | null>(null);
  const [showKo, setShowKo] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  const playAllRef = useRef(false);

  useEffect(() => {
    setLogs(getChatLogs().filter((l) => l.transcript.length >= 2).slice().reverse());
    setReady(true);
  }, []);

  // 화면을 떠나면 재생 중인 음성을 멈춘다.
  useEffect(() => {
    return () => {
      playAllRef.current = false;
      stopSpeaking();
    };
  }, []);

  if (!ready) return null;

  const docLines = lesson ? splitLines(lesson.native_doc) : [];

  async function generate(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    stopAll();
    setLesson(null);
    setShowKo(false);
    setError(null);
    setBusy(true);
    try {
      const raw = await groqComplete([{ role: 'user', content: buildBusinessLessonPrompt(scenario, trimmed) }], {
        temperature: 0.5,
        maxTokens: 1600,
        json: true,
      });
      const parsed = JSON.parse(raw) as BusinessLesson;
      setLesson({
        situation_ko: parsed.situation_ko || '',
        native_doc: parsed.native_doc || '',
        native_doc_ko: parsed.native_doc_ko || '',
        expressions: parsed.expressions || [],
        key_phrases: parsed.key_phrases || [],
      });
    } catch (err) {
      const e = err as Error;
      if (e instanceof GroqError && e.message === 'NO_GROQ_KEY') {
        setError('⚡ 레슨 생성을 위해 회화 탭에서 무료 Groq 키를 먼저 등록해주세요.');
      } else {
        setError(`❌ 레슨 생성 실패: ${e.message}`);
      }
    } finally {
      setBusy(false);
    }
  }

  /** 문서 전체를 처음부터 끝까지 순차 낭독 (각 줄 끝나면 다음 줄). */
  function playAll(start = 0) {
    if (!docLines.length) return;
    playAllRef.current = true;
    const step = (i: number) => {
      if (!playAllRef.current || i >= docLines.length) {
        playAllRef.current = false;
        setPlayingIdx(null);
        return;
      }
      setPlayingIdx(i);
      speakText(docLines[i], 'en-US', 1, () => step(i + 1));
    };
    step(start);
  }

  function stopAll() {
    playAllRef.current = false;
    stopSpeaking();
    setPlayingIdx(null);
  }

  const isPlaying = playingIdx !== null;
  const samples = logs.slice(0, 4);

  return (
    <div className="study-screen">
      {/* 시나리오 유형 */}
      <div className="biz-seg" role="tablist" aria-label="시나리오 유형">
        <button
          role="tab"
          aria-selected={scenario === 'meeting'}
          className={`biz-seg-btn${scenario === 'meeting' ? ' active' : ''}`}
          onClick={() => setScenario('meeting')}
        >
          📝 회의록
        </button>
        <button
          role="tab"
          aria-selected={scenario === 'email'}
          className={`biz-seg-btn${scenario === 'email' ? ' active' : ''}`}
          onClick={() => setScenario('email')}
        >
          ✉️ 이메일
        </button>
      </div>

      {/* 상황 입력 */}
      <div style={{ marginBottom: 6, fontSize: '0.82rem', fontWeight: 800 }}>
        내 상황을 알려주세요
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
        {scenario === 'meeting'
          ? '예: 신제품 출시 일정을 정하는 팀 회의, 해외 거래처와 가격 협상 미팅...'
          : '예: 거래처에 납기 지연을 사과하는 메일, 미팅 일정을 다시 잡자는 메일...'}
      </div>
      <textarea
        className="text-input"
        style={{ width: '100%', minHeight: 72, resize: 'vertical', marginBottom: 8 }}
        placeholder="상황을 한국어 또는 영어로 자유롭게 적어주세요"
        maxLength={500}
        value={situation}
        onChange={(e) => setSituation(e.target.value)}
      />
      <button className="btn primary" style={{ width: '100%', marginBottom: 8 }} disabled={busy || !situation.trim()} onClick={() => generate(situation)}>
        {busy ? '⏳ 레슨 만드는 중...' : '✨ 원어민 표현 레슨 만들기'}
      </button>

      {samples.length > 0 && (
        <>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '6px 0' }}>또는 저장된 내 회화로 만들기:</div>
          <div className="feat-grid" style={{ marginBottom: 6 }}>
            {samples.map((log) => (
              <button
                key={log.id}
                className="feat-card"
                disabled={busy}
                onClick={() => generate(`주제: ${log.lessonTitle}\n대화 내용:\n${log.transcript.map((m) => `${m.role === 'user' ? '나' : '상대'}: ${m.content}`).join('\n')}`)}
              >
                <div className="ic">🗂️</div>
                <div className="lbl">{log.lessonTitle}</div>
                <div className="sub">{log.transcript.length}턴 대화로 레슨화</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* 비즈니스 회화 롤플레이 바로가기 */}
      <button className="feat-card" style={{ width: '100%', marginTop: 6 }} onClick={() => onStartTalk(603)}>
        <div className="ic">💼</div>
        <div className="lbl">비즈니스 미팅 롤플레이</div>
        <div className="sub">AI 해외 동료와 실시간 영어 대화 연습</div>
      </button>

      {error && (
        <div className="msg system" style={{ marginTop: 12 }}>
          <div className="bubble">{error}</div>
        </div>
      )}

      {/* 레슨 결과 */}
      {lesson && (
        <div className="caf-wrap" style={{ textAlign: 'left', maxWidth: '100%', marginTop: 14 }}>
          <h3>📘 {lesson.situation_ko}</h3>

          {/* 원어민 실무 문서 + 전체 음성 */}
          <div className="biz-doc-head">
            <span>{scenario === 'meeting' ? '📄 원어민 회의록' : '📄 원어민 이메일'}</span>
            <span className="biz-doc-actions">
              {isPlaying ? (
                <button className="mini-btn" onClick={stopAll}>⏹ 정지</button>
              ) : (
                <button className="mini-btn" onClick={() => playAll(0)}>🔊 전체 듣기</button>
              )}
              <button className="mini-btn" onClick={() => setShowKo((v) => !v)}>{showKo ? '🇰🇷 끄기' : '🇰🇷 번역'}</button>
            </span>
          </div>
          <div className="biz-doc">
            {docLines.map((line, i) => (
              <p
                key={i}
                className={`biz-doc-line${playingIdx === i ? ' playing' : ''}`}
                onClick={() => playAll(i)}
                title="이 줄부터 듣기"
              >
                {line}
              </p>
            ))}
          </div>
          {showKo && lesson.native_doc_ko && <div className="biz-doc-ko">{lesson.native_doc_ko}</div>}

          {/* 용도별 원어민 표현 */}
          {lesson.expressions.length > 0 && (
            <>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, margin: '14px 0 6px' }}>💬 원어민은 이렇게 말해요</div>
              {lesson.expressions.map((ex, i) => (
                <div className="para-card" key={i}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, marginBottom: 3 }}>{ex.purpose_ko}</div>
                  <span className="up">{ex.en}</span>{' '}
                  <button className="speak-mini" onClick={() => { stopAll(); speakText(ex.en, 'en-US', 1); }}>🔊</button>
                  <div style={{ fontSize: '0.76rem', marginTop: 2 }}>{ex.kr}</div>
                  {ex.tip_ko && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>💡 {ex.tip_ko}</div>}
                </div>
              ))}
            </>
          )}

          {/* 핵심 표현 */}
          {lesson.key_phrases.length > 0 && (
            <>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, margin: '14px 0 6px' }}>📌 꼭 외울 핵심 표현</div>
              {lesson.key_phrases.map((p, i) => (
                <div className="para-card" key={i}>
                  <span className="up">{p.en}</span>{' '}
                  <button className="speak-mini" onClick={() => { stopAll(); speakText(p.en, 'en-US', 1); }}>🔊</button>
                  <div style={{ fontSize: '0.76rem', marginTop: 2 }}>{p.kr}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
