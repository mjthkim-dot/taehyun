'use client';

/**
 * 딕테이션 — 대화의 핵심 라인(expressionId가 달린 문장)을 듣고 받아쓴다.
 *
 * 문장은 숨긴 채 TTS로만 들려주고, 타이핑한 답을 단어 단위로 채점한다.
 * 리스닝과 철자를 동시에 잡는 전통의 훈련법. 원하면 느리게 다시 들을 수 있다.
 */
import { useMemo, useState } from 'react';
import type { DialogueLine } from '../lib/types';
import { scoreAttempt, type ScoreResult } from '../lib/scoring';
import SpeakButton from './SpeakButton';

export default function DictationCard({ dialogue }: { dialogue: DialogueLine[] }) {
  // 핵심 표현이 든 라인만 출제 — 장면당 3~4문장.
  const targets = useMemo(() => dialogue.filter((l) => l.expressionId), [dialogue]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<ScoreResult | null>(null);

  const line = targets[idx];
  if (!line) return null;

  function check() {
    if (!answer.trim()) return;
    setResult(scoreAttempt(line.en, answer));
  }

  function next() {
    setAnswer('');
    setResult(null);
    setIdx((i) => Math.min(i + 1, targets.length - 1));
  }

  const last = idx === targets.length - 1;

  return (
    <div className="card">
      <div className="muted num" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
        딕테이션 {idx + 1} / {targets.length}
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        문장을 듣고 그대로 받아써 보세요. <span className="muted">(힌트: {line.kr})</span>
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <SpeakButton text={line.en} />
        <SpeakButton text={line.en} slow />
      </div>

      <textarea
        className="dictation-input"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="들은 문장을 영어로 입력하세요"
        rows={2}
        spellCheck={false}
        autoCapitalize="off"
      />

      {!result ? (
        <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={check} disabled={!answer.trim()}>
          채점하기
        </button>
      ) : (
        <>
          <div className="score-banner">
            <div className="score-num num">{result.score}</div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              {result.hits.map((h, i) => (
                <span key={i} className={h.matched ? 'word-hit' : 'word-miss'}>
                  {h.word}{' '}
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            정답: <b style={{ color: 'var(--text)' }}>{line.en}</b>
          </div>
          {!last ? (
            <button className="btn btn-soft btn-sm" style={{ marginTop: 10 }} onClick={next}>
              다음 문장 →
            </button>
          ) : (
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
              ✓ 딕테이션 완료!
            </div>
          )}
        </>
      )}
    </div>
  );
}
