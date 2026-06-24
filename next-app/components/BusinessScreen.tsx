'use client';

/**
 * 비즈니스 영어 레슨 화면 — 학습자의 실제 상황(회의록/이메일)을 입력하거나 저장된 회화를
 * 골라, AI가 "원어민은 이렇게 쓴다" 레슨을 만든다. 품질을 위해 2단계로 생성한다:
 *   1) 원어민 작가가 자연스러운 실무 문서를 섹션 구조로 작성
 *   2) 코치가 그 문서에서 학습용 표현·핵심 표현을 추출
 * 문서는 섹션·줄 단위로 렌더해 문단이 섞이지 않고, 전체를 순차 음성 낭독한다(현재 줄 하이라이트).
 */
import { useEffect, useRef, useState } from 'react';
import { getChatLogs, type ChatLogEntry } from '../lib/state';
import { groqComplete, GroqError } from '../lib/groq';
import {
  buildNativeDocPrompt,
  buildLessonExtractPrompt,
  buildExampleScenariosPrompt,
  docToText,
  type BusinessLesson,
  type NativeDoc,
  type ScenarioType,
  type ExampleScenario,
} from '../lib/businessPrompts';
import { speakText, stopSpeaking } from './SpeakButton';

export default function BusinessScreen({ onStartTalk }: { onStartTalk: (lessonId: number) => void }) {
  const [ready, setReady] = useState(false);
  const [scenario, setScenario] = useState<ScenarioType>('meeting');
  const [situation, setSituation] = useState('');
  const [logs, setLogs] = useState<ChatLogEntry[]>([]);
  const [phase, setPhase] = useState<'' | 'doc' | 'extract'>('');
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<BusinessLesson | null>(null);
  const [showKo, setShowKo] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [examples, setExamples] = useState<ExampleScenario[]>([]);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [activeExample, setActiveExample] = useState<number | null>(null);

  const playAllRef = useRef(false);

  useEffect(() => {
    setLogs(getChatLogs().filter((l) => l.transcript.length >= 2).slice().reverse());
    setReady(true);
  }, []);

  useEffect(() => {
    loadExamples(scenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  async function loadExamples(s: ScenarioType) {
    setExamplesLoading(true);
    setActiveExample(null);
    try {
      const raw = await groqComplete([{ role: 'user', content: buildExampleScenariosPrompt(s) }], {
        temperature: 0.8,
        maxTokens: 700,
        json: true,
      });
      const parsed = JSON.parse(raw) as { examples?: ExampleScenario[] };
      setExamples((parsed.examples || []).filter((e) => e && e.situation));
    } catch {
      setExamples([]);
    } finally {
      setExamplesLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      playAllRef.current = false;
      stopSpeaking();
    };
  }, []);

  if (!ready) return null;

  const busy = phase !== '';
  // 음성 낭독·하이라이트용으로 모든 영어 줄을 평탄화한다.
  const audioLines: string[] = lesson ? lesson.doc.sections.flatMap((s) => s.lines.map((l) => l.en)) : [];

  async function generate(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    stopAll();
    setLesson(null);
    setShowKo(false);
    setError(null);
    try {
      // 1단계 — 원어민 문서 작성
      setPhase('doc');
      const docRaw = await groqComplete([{ role: 'user', content: buildNativeDocPrompt(scenario, trimmed) }], {
        temperature: 0.55,
        maxTokens: 1800,
        json: true,
      });
      const doc = JSON.parse(docRaw) as NativeDoc;
      doc.title_en = doc.title_en || '';
      doc.title_ko = doc.title_ko || '';
      doc.sections = (doc.sections || []).map((s) => ({
        heading_en: s.heading_en || '',
        heading_ko: s.heading_ko || '',
        lines: (s.lines || []).filter((l) => l && l.en),
      }));

      // 2단계 — 표현 추출
      setPhase('extract');
      const exRaw = await groqComplete([{ role: 'user', content: buildLessonExtractPrompt(scenario, docToText(doc)) }], {
        temperature: 0.4,
        maxTokens: 1100,
        json: true,
      });
      const ex = JSON.parse(exRaw) as Omit<BusinessLesson, 'doc'>;

      setLesson({
        situation_ko: ex.situation_ko || '',
        doc,
        expressions: ex.expressions || [],
        key_phrases: ex.key_phrases || [],
      });
    } catch (err) {
      const e = err as Error;
      if (e instanceof GroqError && e.message === 'NO_GROQ_KEY') {
        setError('⚡ 레슨 생성을 위해 회화 탭에서 무료 Groq 키를 먼저 등록해주세요.');
      } else {
        setError(`❌ 레슨 생성 실패: ${e.message}`);
      }
    } finally {
      setPhase('');
    }
  }

  function pickExample(i: number) {
    const ex = examples[i];
    if (!ex || busy) return;
    setActiveExample(i);
    setSituation(ex.situation);
    generate(ex.situation);
  }

  /** 문서 전체를 처음부터 끝까지 순차 낭독. */
  function playAll(start = 0) {
    if (!audioLines.length) return;
    playAllRef.current = true;
    const step = (i: number) => {
      if (!playAllRef.current || i >= audioLines.length) {
        playAllRef.current = false;
        setPlayingIdx(null);
        return;
      }
      setPlayingIdx(i);
      speakText(audioLines[i], 'en-US', 1, () => step(i + 1));
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
  // 렌더 시 줄마다 전역 인덱스를 부여하기 위한 카운터.
  let lineCursor = -1;

  return (
    <div className="study-screen">
      {/* 시나리오 유형 */}
      <div className="biz-seg" role="tablist" aria-label="시나리오 유형">
        <button role="tab" aria-selected={scenario === 'meeting'} className={`biz-seg-btn${scenario === 'meeting' ? ' active' : ''}`} onClick={() => setScenario('meeting')}>
          📝 회의록
        </button>
        <button role="tab" aria-selected={scenario === 'email'} className={`biz-seg-btn${scenario === 'email' ? ' active' : ''}`} onClick={() => setScenario('email')}>
          ✉️ 이메일
        </button>
      </div>

      {/* AI 예시 상황 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>✨ AI가 만든 예시 상황</div>
        <button className="mini-btn" disabled={busy || examplesLoading} onClick={() => loadExamples(scenario)}>
          {examplesLoading ? '⏳ 생성 중...' : '🔄 다른 예시'}
        </button>
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
        카드를 누르면 바로 그 상황으로 레슨이 만들어져요.
      </div>
      <div className="biz-ex-grid" style={{ marginBottom: 12 }}>
        {examplesLoading && examples.length === 0 ? (
          <div className="biz-ex-card biz-ex-skel" />
        ) : (
          examples.map((ex, i) => (
            <button
              key={i}
              className={`biz-ex-card${activeExample === i ? ' active' : ''}`}
              disabled={busy}
              onClick={() => pickExample(i)}
            >
              <div className="lbl">{ex.label_ko}</div>
              <div className="sub">{ex.situation}</div>
            </button>
          ))
        )}
      </div>

      {/* 상황 입력 */}
      <div style={{ marginBottom: 6, fontSize: '0.82rem', fontWeight: 800 }}>또는 직접 입력</div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
        {scenario === 'meeting'
          ? '예: 신제품 출시 일정을 정하는 팀 회의, 해외 거래처와 가격 협상 미팅... (또는 실제 회의록을 붙여넣어도 됩니다)'
          : '예: 거래처에 납기 지연을 사과하는 메일, 미팅 일정을 다시 잡자는 메일... (또는 실제 메일 내용을 붙여넣어도 됩니다)'}
      </div>
      <textarea
        className="text-input"
        style={{ width: '100%', minHeight: 84, resize: 'vertical', marginBottom: 8 }}
        placeholder="상황을 한국어 또는 영어로 적거나, 실제 회의록·메일 내용을 붙여넣으세요"
        maxLength={2000}
        value={situation}
        onChange={(e) => {
          setActiveExample(null);
          setSituation(e.target.value);
        }}
      />
      <button className="btn primary" style={{ width: '100%', marginBottom: 8 }} disabled={busy || !situation.trim()} onClick={() => generate(situation)}>
        {phase === 'doc' ? '⏳ 원어민 문서 작성 중...' : phase === 'extract' ? '⏳ 핵심 표현 정리 중...' : '✨ 원어민 표현 레슨 만들기'}
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
          {lesson.situation_ko && <h3>📘 {lesson.situation_ko}</h3>}

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
            {lesson.doc.title_en && (
              <div className="biz-doc-title">
                {lesson.doc.title_en}
                {showKo && lesson.doc.title_ko && <span className="biz-doc-title-ko">{lesson.doc.title_ko}</span>}
              </div>
            )}
            {lesson.doc.sections.map((sec, si) => (
              <div className="biz-doc-sec" key={si}>
                {sec.heading_en && (
                  <div className="biz-doc-h">
                    {sec.heading_en}
                    {sec.heading_ko ? <span className="biz-doc-h-ko"> · {sec.heading_ko}</span> : null}
                  </div>
                )}
                {sec.lines.map((line, li) => {
                  lineCursor += 1;
                  const idx = lineCursor;
                  return (
                    <p
                      key={li}
                      className={`biz-doc-line${playingIdx === idx ? ' playing' : ''}`}
                      onClick={() => playAll(idx)}
                      title="이 줄부터 듣기"
                    >
                      {line.en}
                      {showKo && line.ko && <span className="biz-doc-line-ko">{line.ko}</span>}
                    </p>
                  );
                })}
              </div>
            ))}
          </div>

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
