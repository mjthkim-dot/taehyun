'use client';

/**
 * 한→영 스피킹 드릴 — 한국어 상황만 보고 배운 표현을 스스로 말하게 한다.
 *
 * 흐름: 상황 프롬프트 → 🎙 말하기 → 키워드 채점(핵심 단어가 모두 들어갔는가)
 * → 모범 답안 공개 + 듣기. "보고 따라 읽기"보다 한 단계 위의 능동 회상 훈련.
 * STT 미지원 브라우저는 "정답 보기" 버튼으로 회상 훈련만 진행한다.
 */
import { useEffect, useRef, useState } from 'react';
import type { SpeakingDrill } from '../lib/types';
import { startListening, sttSupported, stopSpeaking, type SttSession } from '../lib/speech';
import { normalizeWords } from '../lib/scoring';
import SpeakButton from './SpeakButton';
import { MicIcon } from './Icon';

interface DrillResult {
  transcript: string;
  hitKeywords: string[];
  missedKeywords: string[];
  passed: boolean;
}

export default function PatternDrill({ drills }: { drills: SpeakingDrill[] }) {
  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [result, setResult] = useState<DrillResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SttSession | null>(null);

  useEffect(
    () => () => {
      stopSpeaking();
      sessionRef.current?.stop();
    },
    [],
  );

  const drill = drills[idx];
  if (!drill) return null;

  function grade(transcript: string): DrillResult {
    const words = new Set(normalizeWords(transcript));
    const hit: string[] = [];
    const missed: string[] = [];
    for (const kw of drill.keywords) {
      // 키워드 자체도 정규화(축약형 등)해서 비교 — "gonna" vs "going to" 케이스 방어.
      const kwWords = normalizeWords(kw);
      if (kwWords.every((w) => words.has(w))) hit.push(kw);
      else missed.push(kw);
    }
    return { transcript, hitKeywords: hit, missedKeywords: missed, passed: missed.length === 0 };
  }

  function listen() {
    if (listening) {
      sessionRef.current?.stop();
      return;
    }
    setError(null);
    setInterim('');
    setResult(null);
    setListening(true);
    let last = '';
    sessionRef.current = startListening({
      onResult: (r) => {
        last = r.transcript;
        setInterim(r.transcript);
      },
      onEnd: () => {
        setListening(false);
        setInterim('');
        if (last) {
          setResult(grade(last));
          setRevealed(true);
        }
      },
      onError: (m) => setError(m),
    });
    if (!sessionRef.current) setListening(false);
  }

  function next() {
    setResult(null);
    setRevealed(false);
    setError(null);
    setIdx((i) => Math.min(i + 1, drills.length - 1));
  }

  const last = idx === drills.length - 1;
  const canSpeak = sttSupported();

  return (
    <div className="card drill-card">
      <div className="muted num" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
        스피킹 드릴 {idx + 1} / {drills.length}
      </div>
      <p className="drill-prompt">{drill.promptKr}</p>

      {error && (
        <div role="alert" className="drill-error">
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        {canSpeak && (
          <button
            className={`btn btn-primary btn-sm mic-btn${listening ? ' listening' : ''}`}
            onClick={listen}
          >
            <MicIcon size={15} />
            {listening ? '녹음 멈추기' : '영어로 말해 보기'}
          </button>
        )}
        {!revealed && (
          <button className="btn btn-ghost btn-sm" onClick={() => setRevealed(true)}>
            정답 보기
          </button>
        )}
      </div>

      {listening && (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
          🎙 듣고 있어요… {interim && <em>“{interim}”</em>}
        </div>
      )}

      {result && (
        <div className={`drill-result${result.passed ? ' pass' : ''}`}>
          {result.passed ? '🎉 핵심 표현이 다 들어갔어요!' : '조금 아쉬워요 — 아래 모범 답안과 비교해 보세요.'}
          <div style={{ marginTop: 6, fontSize: 12.5 }}>
            내가 말한 것: <em>“{result.transcript}”</em>
          </div>
          {result.missedKeywords.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 12.5 }}>
              빠진 키워드: <b>{result.missedKeywords.join(', ')}</b>
            </div>
          )}
        </div>
      )}

      {revealed && (
        <div className="drill-answer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <b style={{ fontSize: 15 }}>{drill.targetEn}</b>
            <SpeakButton text={drill.targetEn} />
          </div>
          {!last ? (
            <button className="btn btn-soft btn-sm" style={{ marginTop: 10 }} onClick={next}>
              다음 드릴 →
            </button>
          ) : (
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
              ✓ 드릴 완료! 아래에서 장면을 마무리하세요.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
