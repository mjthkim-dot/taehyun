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
  const isListening = useLessonStore((s) => s.isListening);
  const setCurrentSentence = useLessonStore((s) => s.setCurrentSentence);
  const setUserSpeech = useLessonStore((s) => s.setUserSpeech);
  const evaluateSpeech = useLessonStore((s) => s.evaluateSpeech);
  const setListening = useLessonStore((s) => s.setListening);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef('');

  // 목표 문장 주입
  useEffect(() => {
    if (sentence && sentence !== currentSentence) {
      setCurrentSentence(sentence);
    }
  }, [sentence, currentSentence, setCurrentSentence]);

  // SpeechRecognition 인스턴스 1회 생성
  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    const recog = new SR();
    recog.lang = lang;
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

    recognitionRef.current = recog;
    return () => {
      recog.onresult = null;
      recog.onend = null;
      recog.onerror = null;
      try {
        recog.stop();
      } catch {
        /* noop */
      }
    };
  }, [lang, setUserSpeech, setListening, evaluateSpeech]);

  const start = useCallback(() => {
    const recog = recognitionRef.current;
    if (!recog || isListening) return;
    finalRef.current = '';
    setUserSpeech('');
    try {
      recog.start();
      setListening(true);
    } catch {
      /* 이미 시작된 경우 무시 */
    }
  }, [isListening, setUserSpeech, setListening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const supported = getSpeechRecognition() !== null;

  return (
    <div className="speaking-practice">
      <p className="target">🎯 {currentSentence || '문장을 선택하세요'}</p>

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
        {isListening ? '⏹ 멈추기' : '🎤 말하기'}
      </button>

      <div className="transcript">
        <span className="label">내 발화</span>
        <p>{userSpeech || '…'}</p>
      </div>

      {accuracyScore > 0 && (
        <div
          className="score"
          data-tier={
            accuracyScore >= 80 ? 'high' : accuracyScore >= 50 ? 'mid' : 'low'
          }
        >
          정확도 {accuracyScore}점
        </div>
      )}
    </div>
  );
}
