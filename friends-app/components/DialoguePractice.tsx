'use client';

/**
 * 대화 롤플레이 — 장면의 연습 대화를 듣고, 배역을 골라 그 대사를 직접 말한다.
 *
 * 모드 ① 듣기: 라인별 재생 + 전체 재생.
 * 모드 ② 롤플레이: 배역 선택 → 내 대사 차례에 마이크로 말하면 단어 매칭 채점.
 * STT 미지원 브라우저에서는 롤플레이 대신 안내를 보여 준다(무음 실패 금지).
 */
import { useEffect, useRef, useState } from 'react';
import type { DialogueLine, CharacterId } from '../lib/types';
import { CHARACTERS, characterLabel } from '../lib/characters';
import { speak, stopSpeaking, startListening, sttSupported, type SttSession } from '../lib/speech';
import { scoreAttempt, scoreComment, type ScoreResult } from '../lib/scoring';
import SpeakButton from './SpeakButton';
import { MicIcon, PlayIcon } from './Icon';

interface LineScore {
  result: ScoreResult;
  transcript: string;
}

export default function DialoguePractice({ dialogue }: { dialogue: DialogueLine[] }) {
  const [myRole, setMyRole] = useState<CharacterId | null>(null);
  const [listeningIdx, setListeningIdx] = useState<number | null>(null);
  const [interim, setInterim] = useState('');
  const [scores, setScores] = useState<Record<number, LineScore>>({});
  const [error, setError] = useState<string | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const sessionRef = useRef<SttSession | null>(null);
  const cancelledRef = useRef(false);

  // 화면 이탈 시 재생/인식 정리 — 다른 탭으로 소리·마이크가 새지 않게.
  useEffect(
    () => () => {
      cancelledRef.current = true;
      stopSpeaking();
      sessionRef.current?.stop();
    },
    [],
  );

  const roles = [...new Set(dialogue.map((l) => l.speaker))];

  async function playAll() {
    if (playingAll) {
      cancelledRef.current = true;
      stopSpeaking();
      setPlayingAll(false);
      return;
    }
    cancelledRef.current = false;
    setPlayingAll(true);
    for (const line of dialogue) {
      if (cancelledRef.current) break;
      await speak(line.en);
    }
    setPlayingAll(false);
  }

  function listen(idx: number, target: string) {
    if (listeningIdx !== null) {
      sessionRef.current?.stop();
      return;
    }
    setError(null);
    setInterim('');
    setListeningIdx(idx);
    let lastTranscript = '';
    sessionRef.current = startListening({
      onResult: (r) => {
        lastTranscript = r.transcript;
        setInterim(r.transcript);
      },
      onEnd: () => {
        setListeningIdx(null);
        setInterim('');
        if (lastTranscript) {
          setScores((prev) => ({
            ...prev,
            [idx]: { result: scoreAttempt(target, lastTranscript), transcript: lastTranscript },
          }));
        }
      },
      onError: (message) => setError(message),
    });
    if (!sessionRef.current) setListeningIdx(null);
  }

  const roleplayReady = sttSupported();

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <button className="btn btn-soft btn-sm" onClick={playAll}>
          <PlayIcon size={14} />
          {playingAll ? '전체 재생 멈추기' : '전체 대화 듣기'}
        </button>
        {roleplayReady ? (
          <>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>내 배역:</span>
            {roles.map((r) => (
              <button
                key={r}
                className={`chip${myRole === r ? ' active' : ''}`}
                onClick={() => setMyRole(myRole === r ? null : r)}
              >
                {CHARACTERS[r].nameKr}
              </button>
            ))}
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            🎙 말하기 롤플레이는 Chrome/Edge에서 지원돼요.
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: 'var(--red-soft)',
            color: 'var(--red)',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {dialogue.map((line, idx) => {
        const mine = myRole !== null && line.speaker === myRole;
        const ch = CHARACTERS[line.speaker];
        const score = scores[idx];
        return (
          <div key={idx} className="dialogue-line">
            <div className="avatar" style={{ background: ch.color }}>
              {ch.initial}
            </div>
            <div className={`bubble${line.expressionId ? ' highlight' : ''}${mine ? ' mine' : ''}`}>
              <div className="speaker">
                {characterLabel(line.speaker, line.speakerLabel)}
                {mine && ' · 내 대사'}
              </div>
              {/* 채점 후에는 단어별 적중을 색으로 보여 준다 */}
              {score ? (
                <div className="en">
                  {score.result.hits.map((h, i) => (
                    <span key={i} className={h.matched ? 'word-hit' : 'word-miss'}>
                      {h.word}{' '}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="en">{line.en}</div>
              )}
              <div className="kr">{line.kr}</div>

              <div className="line-actions">
                <SpeakButton text={line.en} />
                <SpeakButton text={line.en} slow />
                {mine && (
                  <button
                    className={`icon-btn mic-btn${listeningIdx === idx ? ' listening' : ''}`}
                    onClick={() => listen(idx, line.en)}
                    aria-label={listeningIdx === idx ? '녹음 멈추기' : '이 대사 말해 보기'}
                  >
                    <MicIcon />
                  </button>
                )}
              </div>

              {listeningIdx === idx && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                  🎙 듣고 있어요… {interim && <em>“{interim}”</em>}
                </div>
              )}

              {score && (
                <div className="score-banner">
                  <div className="score-num num">{score.result.score}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {scoreComment(score.result.score)}
                    {score.result.missed.length > 0 && (
                      <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                        놓친 단어: {score.result.missed.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
