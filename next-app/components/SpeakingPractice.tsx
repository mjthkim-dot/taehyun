'use client';

/**
 * 프롬프트 3 — 실시간 음성 인식 회화 연습 컴포넌트
 *
 * 브라우저 Web Speech API(SpeechRecognition)로 마이크 입력을 실시간 텍스트로
 * 변환하고, 그 결과를 Zustand 스토어(userSpeech)에 반영한다. 발화가 확정되면
 * 목표 문장 대비 정확도를 계산해 표시한다.
 *
 * 타입: npm i -D @types/dom-speech-recognition
 */
import { useCallback, useEffect, useRef } from 'react';
import { useLessonStore } from '../store/useLessonStore';
import { speakText } from './SpeakButton';
import { haptic } from '../lib/haptics';

// 벤더 프리픽스 대응
function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  return (
    window.SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
      .webkitSpeechRecognition ||
    null
  );
}

interface SpeakingPracticeProps {
  /** 연습할 목표 문장. 전달하면 마운트 시 스토어에 세팅한다. */
  sentence?: string;
  lang?: string;
}

export default function SpeakingPractice({
  sentence,
  lang = 'en-US',
}: SpeakingPracticeProps) {
  const currentSentence = useLessonStore((s) => s.currentSentence);
  const userSpeech = useLessonStore((s) => s.userSpeech);
  const accuracyScore = useLessonStore((s) => s.accuracyScore);
  const wordDiff = useLessonStore((s) => s.wordDiff);
  const attempts = useLessonStore((s) => s.attempts);
  const isListening = useLessonStore((s) => s.isListening);
  const setCurrentSentence = useLessonStore((s) => s.setCurrentSentence);
  const setUserSpeech = useLessonStore((s) => s.setUserSpeech);
  const evaluateSpeech = useLessonStore((s) => s.evaluateSpeech);
  const setListening = useLessonStore((s) => s.setListening);
  const clearAttempt = useLessonStore((s) => s.clearAttempt);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef('');
  const langRef = useRef(lang);
  langRef.current = lang;

  // 채점 결과가 나오면 점수대별 햅틱 — 높으면 성공, 낮으면 오답 진동
  const scoreFxRef = useRef(0);
  useEffect(() => {
    if (accuracyScore > 0 && accuracyScore !== scoreFxRef.current) {
      scoreFxRef.current = accuracyScore;
      haptic(accuracyScore >= 80 ? 'success' : accuracyScore >= 50 ? 'light' : 'error');
    }
  }, [accuracyScore]);

  // 목표 문장 주입
  useEffect(() => {
    if (sentence && sentence !== currentSentence) {
      setCurrentSentence(sentence);
    }
  }, [sentence, currentSentence, setCurrentSentence]);

  // 발화 1회마다 새 SpeechRecognition 인스턴스를 만든다.
  // iOS Safari 등 webkit 기반 브라우저는 onend 이후 같은 인스턴스를 재사용해
  // start()를 호출하면 내부 상태가 멈춰 다시 인식되지 않는 문제가 있다.
  const createRecognition = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return null;

    const recog = new SR();
    recog.lang = langRef.current;
    recog.continuous = true;
    recog.interimResults = true;
    recog.maxAlternatives = 1;

    recog.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = res[0].transcript;
        if (res.isFinal) {
          finalRef.current += txt + ' ';
        } else {
          interim += txt;
        }
      }
      // 확정 + 임시 텍스트를 합쳐 실시간으로 스토어에 반영
      const live = (finalRef.current + interim).trim();
      setUserSpeech(live);
    };

    recog.onend = () => {
      setListening(false);
      // 최종 발화로 정확도 평가
      const finalText = finalRef.current.trim();
      if (finalText) evaluateSpeech(finalText);
    };

    recog.onerror = () => {
      setListening(false);
    };

    return recog;
  }, [setUserSpeech, setListening, evaluateSpeech]);

  // 컴포넌트가 사라질 때 진행 중인 인식을 정리
  useEffect(() => {
    return () => {
      const recog = recognitionRef.current;
      if (!recog) return;
      recog.onresult = null;
      recog.onend = null;
      recog.onerror = null;
      try {
        recog.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  const start = useCallback(() => {
    if (isListening) return;
    // 이전 인스턴스가 남아있다면 핸들러를 떼고 정리한 뒤 새로 만든다.
    const prev = recognitionRef.current;
    if (prev) {
      prev.onresult = null;
      prev.onend = null;
      prev.onerror = null;
      try {
        prev.abort();
      } catch {
        /* noop */
      }
    }
    const recog = createRecognition();
    if (!recog) return;
    recognitionRef.current = recog;
    finalRef.current = '';
    clearAttempt();
    haptic('tap');
    try {
      recog.start();
      setListening(true);
    } catch {
      /* 이미 시작된 경우 무시 */
    }
  }, [isListening, clearAttempt, setListening, createRecognition]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const supported = getSpeechRecognition() !== null;

  return (
    <div className="speaking-practice">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <p className="target" style={{ flex: 1, margin: 0 }}>🎯 {currentSentence || '문장을 선택하세요'}</p>
        {currentSentence && (
          <>
            <button type="button" className="speak-mini" title="듣기" onClick={() => speakText(currentSentence, lang)}>🔊</button>
            <button type="button" className="speak-mini" title="느리게 듣기" onClick={() => speakText(currentSentence, lang, 0.6)}>🐢</button>
          </>
        )}
      </div>

      {!supported && (
        <p className="warn">
          이 브라우저는 음성 인식을 지원하지 않습니다. (Chrome/Edge 권장)
        </p>
      )}

      <button
        type="button"
        onClick={isListening ? stop : start}
        disabled={!supported || !currentSentence}
        className={isListening ? 'mic listening' : 'mic'}
      >
        {isListening ? '⏹ 멈추기' : attempts > 0 ? '🎤 다시 말하기' : '🎤 말하기'}
      </button>

      <div className="transcript">
        <span className="label">내 발화</span>
        <p>{userSpeech || '…'}</p>
      </div>

      {accuracyScore > 0 && (
        <>
          <div
            key={attempts}
            className={`score ${accuracyScore >= 50 ? 'score-pop' : 'score-shake'}`}
            data-tier={
              accuracyScore >= 80 ? 'high' : accuracyScore >= 50 ? 'mid' : 'low'
            }
          >
            {accuracyScore >= 80 ? '🎉 ' : ''}정확도 {accuracyScore}점{attempts > 1 ? ` · ${attempts}번째 시도` : ''}
          </div>
          {wordDiff.length > 0 && (
            <div className="word-diff" style={{ fontSize: '0.88rem', lineHeight: 1.7, marginTop: 6 }}>
              {wordDiff.map((d, i) => (
                <span
                  key={i}
                  style={{
                    color: d.ok ? 'var(--green)' : 'var(--red)',
                    textDecoration: d.ok ? 'none' : 'underline',
                    marginRight: 5,
                  }}
                >
                  {d.w}
                </span>
              ))}
            </div>
          )}
          {accuracyScore < 80 && (
            <p className="muted" style={{ fontSize: '0.76rem', marginTop: 6 }}>
              🔴 빨간 단어를 다시 듣고 발음해 보세요 — 🐢 느리게 듣기로 정확한 발음을 확인할 수 있어요.
            </p>
          )}
        </>
      )}
    </div>
  );
}
