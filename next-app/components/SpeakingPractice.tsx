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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLessonStore } from '../store/useLessonStore';
import { speakText } from './SpeakButton';
import { MicIcon, SpeakerIcon } from './icons';
import { haptic } from '../lib/haptics';
import { recordAndTranscribe, whisperAvailable } from '../lib/stt';
import dynamic from 'next/dynamic';

/** 발음 훈련(최소대립쌍 49쌍)은 진단이 뜬 뒤에야 필요하다 — 첫 진입 번들에서 뺀다.
 *  dynamic()의 옵션은 인라인 리터럴이어야 한다(변수로 빼면 Next가 빌드에서 거부). */
const PronDrillCard = dynamic(() => import('./PronDrillCard'), { ssr: false });
import SpeechRatePicker, { rateLabel, useSlowRate } from './SpeechRate';
import { Confetti, ComboBadge, FloatUp, useCountUp } from './Fx';
import VoiceCompare from './MyVoice';

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
  /** 한국어 뜻 — hideTarget 모드에서 문제로 보여준다(한국어 보고 영어로 말하기). */
  prompt?: string;
  /** true면 영어 목표 문장을 숨기고 한국어(prompt)를 문제로 낸다. 발화하거나
   * "영어 보기"를 누르면 영어가 드러나 발음을 확인할 수 있다. */
  hideTarget?: boolean;
  /** 학습 이력 로그에 남길 출처 — session·drill·ladder·recall 등 */
  source?: string;
  /** 커리큘럼 패턴 연습이면 그 키(이력 로그용) */
  patternKey?: string;
}

export default function SpeakingPractice({
  sentence,
  lang = 'en-US',
  prompt,
  hideTarget = false,
  source,
  patternKey,
}: SpeakingPracticeProps) {
  const currentSentence = useLessonStore((s) => s.currentSentence);
  const userSpeech = useLessonStore((s) => s.userSpeech);
  const accuracyScore = useLessonStore((s) => s.accuracyScore);
  const wordDiff = useLessonStore((s) => s.wordDiff);
  const pronIssues = useLessonStore((s) => s.pronIssues);
  const combo = useLessonStore((s) => s.combo);
  // 느리게 듣기 배속 — 사용자가 고른 값을 앱 전체가 함께 쓴다
  const slow = useSlowRate();
  const [rateOpen, setRateOpen] = useState(false);
  /** 방금 녹음한 내 소리 — 원어민 음성과 번갈아 들어보는 데 쓴다 */
  const [clip, setClip] = useState<Blob | null>(null);
  /** 방금 시도의 발화 개시 지연(ms) — 자동화 훈련의 체감 지표. 측정 불가면 null */
  const [lastOnset, setLastOnset] = useState<number | null>(null);
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

  // Whisper 경로의 단계 — 녹음 중인지, 변환(서버 왕복) 중인지 버튼에 드러낸다.
  const [sttState, setSttState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  /** 인식 결과가 비었을 때의 안내 — 아무 반응이 없으면 고장으로 보인다 */
  const [sttHint, setSttHint] = useState('');
  /** 녹음 중 마이크 입력 레벨(0~1) — 소리가 잡히는지 눈으로 확인시켜 준다 */
  const [micLevel, setMicLevel] = useState(0);
  /** 녹음을 밖에서 멈추기 위한 핸들(사용자가 '멈추기'를 누를 때) */
  const stopWhisperRef = useRef<(() => void) | null>(null);

  // hideTarget 모드에서 영어 정답을 드러냈는지. 문장이 바뀌면 다시 숨긴다.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
    // 다른 문장으로 넘어가면 이전 녹음·지연 표시는 비교 대상이 아니다
    setClip(null);
    setLastOnset(null);
  }, [sentence]);

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
      // isListening은 전역 스토어 값이라, 듣는 중에 다음 문장으로 넘어가면(언마운트)
      // 여기서 false로 되돌리지 않으면 true로 고착돼 다음 문장의 새 컴포넌트가
      // start()를 막아버린다(드릴에서 첫 문장만 인식되던 원인) — 반드시 풀어준다.
      setListening(false);
      const recog = recognitionRef.current;
      if (!recog) return;
      recog.onresult = null;
      recog.onend = null;
      recog.onerror = null;
      try {
        recog.abort();
      } catch {
        /* noop */
      }
    };
  }, [setListening]);

  /**
   * Whisper 경로 — 녹음(무음 감지로 자동 종료) → 서버 프록시 → 텍스트.
   * 실패하면 조용히 브라우저 내장 인식으로 물러난다(학습을 막지 않는 것이 우선).
   */
  const startWhisper = useCallback(async () => {
    clearAttempt();
    haptic('tap');
    setSttHint('');
    setListening(true);
    setSttState('recording');
    try {
      const { text, reason, peak, audio, durationMs, voiceOnsetMs } = await recordAndTranscribe({
        prompt: currentSentence,
        onState: (st) => setSttState(st),
        onLevel: (rms) => setMicLevel(Math.min(1, rms * 12)),
        // 말하는 동안 글자가 흐르게 — 채점은 아래 Whisper 결과로만 한다
        onPartial: (t) => setUserSpeech(t),
        registerStop: (fn) => {
          stopWhisperRef.current = fn;
        },
      });
      setSttState('idle');
      setListening(false);
      setMicLevel(0);
      stopWhisperRef.current = null;
      setClip(audio ?? null);
      if (text) {
        setSttHint('');
        setUserSpeech(text);
        // 발화 개시 지연 — 절대 기준과 비교하지 않는다(기기 편차). 본인 추이용 기록 + 표시만.
        setLastOnset(typeof voiceOnsetMs === 'number' ? voiceOnsetMs : null);
        evaluateSpeech(text, { latencyMs: voiceOnsetMs, durationMs, src: source, patternKey });
        return true;
      }
      // 결과가 비었다 — 원인을 구분해 안내하고, 마이크는 잡혔는데 인식만 실패한
      // 경우에는 브라우저 내장 인식으로 한 번 더 시도한다(여기서 포기하지 않는다).
      if (reason === 'empty-result') {
        setSttHint('말소리는 잡혔는데 인식하지 못했어요 — 조금 더 또렷하게 다시 말해보세요.');
        return false; // 폴백 경로로 재시도
      }
      setSttHint(
        (peak ?? 0) > 0.001
          ? '소리가 너무 작아요 — 마이크에 가까이서 다시 말해보세요.'
          : '마이크에서 소리가 잡히지 않았어요 — 권한과 음소거를 확인해 주세요.'
      );
      return true;
    } catch (err) {
      setSttState('idle');
      setListening(false);
      setMicLevel(0);
      stopWhisperRef.current = null;
      // 원인을 숨기지 않는다 — 권한 거부와 서버 오류는 대처가 다르다
      const msg = (err as Error)?.message || '';
      setSttHint(
        /NotAllowed|Permission/i.test(msg)
          ? '마이크 권한이 거부됐어요 — 브라우저 설정에서 허용해 주세요.'
          : msg
            ? `음성 인식 오류: ${msg}`
            : ''
      );
      return false;
    }
  }, [clearAttempt, currentSentence, setListening, setUserSpeech, evaluateSpeech, source, patternKey]);

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
    if (whisperAvailable()) {
      // 실패 시(권한 거부 등) 곧바로 브라우저 인식으로 재시도한다
      startWhisper().then((ok) => {
        if (ok) return;
        const fb = createRecognition();
        if (!fb) return;
        recognitionRef.current = fb;
        finalRef.current = '';
        try {
          fb.start();
          setListening(true);
        } catch {
          /* 이미 시작됨 */
        }
      });
      return;
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
  }, [isListening, clearAttempt, setListening, createRecognition, startWhisper]);

  const stop = useCallback(() => {
    // Whisper 녹음 중이면 그걸 멈추고, 아니면 브라우저 인식을 멈춘다
    if (stopWhisperRef.current) {
      stopWhisperRef.current();
      return;
    }
    recognitionRef.current?.stop();
  }, []);

  // Whisper 경로가 안 되는 기기(마이크 권한 거부·미지원)에서도 학습이 멈추지 않도록
  // 브라우저 내장 인식이 있으면 그걸로 물러난다. 둘 다 없을 때만 안내를 띄운다.
  const supported = whisperAvailable() || getSpeechRecognition() !== null;

  // hideTarget 모드: 발화해서 점수가 나오거나(accuracyScore>0) "영어 보기"를 누르기
  // 전까지는 영어 정답·듣기 버튼을 숨겨, 한국어만 보고 영어로 말하게 한다.
  const showTarget = !hideTarget || revealed || accuracyScore > 0;

  return (
    <div className="speaking-practice">
      {/* 문장이 이 화면의 주인공 — 한 줄 전체를 크게 쓰고, 듣기·배속 같은 도구
          버튼은 아래 줄로 분리해 문장과 시선 경쟁을 하지 않게 한다. */}
      <p className="target">
        {showTarget ? currentSentence || '문장을 선택하세요' : prompt || '뜻을 보고 영어로 말해보세요'}
      </p>
      {/* 뜻(한국어)은 항상 함께 — 뜻 모르고 따라 읽으면 소리 연습이지 학습이
          아니다("win you back이 무슨 뜻인지는 알아야" 피드백). hideTarget
          모드는 공개 후에만(정답 노출 방지), 일반 모드는 처음부터 보인다. */}
      {showTarget && prompt && (
        <div className="muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>{prompt}</div>
      )}
      <div className="sp-tools">
        {currentSentence && showTarget && (
          <>
            <button type="button" className="speak-mini" title="듣기" onClick={() => speakText(currentSentence, lang)}><SpeakerIcon /> 듣기</button>
            <button type="button" className="speak-mini" title={`${rateLabel(slow)} 느리게 듣기`} onClick={() => speakText(currentSentence, lang, slow)}><span className="speak-mini-slow">{rateLabel(slow)}</span></button>
          </>
        )}
        {/* 배속 고르기는 소리를 내지 않으므로 정답을 가린 모드에서도 열어 둔다 —
            듣기 버튼에 묶어 두면 '뜻 보고 말하기'에서는 설정 자체에 닿을 수 없다.
            평소엔 접혀 있다(매번 펼쳐 두면 문장보다 설정이 커진다). */}
        {currentSentence && (
          <button
            type="button"
            className="speak-mini rate-open"
            aria-label="느리게 듣기 속도 바꾸기"
            aria-expanded={rateOpen}
            onClick={() => setRateOpen((v) => !v)}
          >
            속도
          </button>
        )}
        {!showTarget && (
          <button type="button" className="speak-mini" title="영어 정답 보기" onClick={() => setRevealed(true)}>정답</button>
        )}
      </div>

      {rateOpen && <SpeechRatePicker compact />}

      {!supported && (
        <p className="warn">
          이 브라우저는 음성 인식을 지원하지 않습니다. (Chrome/Edge 권장)
        </p>
      )}

      <button
        type="button"
        onClick={isListening ? stop : start}
        disabled={!supported || !currentSentence || sttState === 'transcribing'}
        className={isListening ? 'mic listening' : 'mic'}
      >
        <MicIcon size={20} />
        {sttState === 'transcribing' ? '인식 중…' : isListening ? '멈추기' : attempts > 0 ? '다시 말하기' : '말하기'}
      </button>

      {sttState === 'recording' && (
        <div className="mic-level" aria-hidden="true">
          <i style={{ transform: `scaleX(${Math.max(0.02, micLevel)})` }} />
        </div>
      )}

      {sttHint && (
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6, lineHeight: 1.55 }}>{sttHint}</p>
      )}

      {/* 말하는 동안에도 글자가 보여야 한다 — Whisper는 녹음이 끝나야 결과를 주므로
          그때까지 화면이 비어 있으면 인식이 죽은 것처럼 보인다. 내장 인식 미리보기가
          되는 브라우저에서는 실시간 자막이, 안 되는 곳에서는 상태 문구가 그 자리를 채운다. */}
      <div className={`transcript${isListening ? ' live' : ''}`}>
        <span className="label">
          {sttState === 'transcribing' ? '인식 중' : isListening ? '듣는 중' : '내 발화'}
        </span>
        <p>
          {userSpeech ||
            (sttState === 'transcribing' ? '방금 말한 내용을 옮기는 중…' : isListening ? '말씀하세요…' : '…')}
        </p>
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
            {/* 통과 순간의 보상 연출(스픽 벤치마크) — 실패에는 아무것도 터뜨리지 않는다 */}
            {accuracyScore >= 80 && <Confetti burstId={attempts} />}
            {accuracyScore >= 80 && <FloatUp id={attempts} text="+1 문장" />}
            정확도 <ScoreNumber score={accuracyScore} />점{attempts > 1 ? ` · ${attempts}번째 시도` : ''}
            {lastOnset != null && (
              <span className="lat-badge" title="말하기 버튼을 누르고 입이 떨어지기까지 걸린 시간 — 짧아질수록 자동화되고 있다는 뜻">
                ⚡ {(lastOnset / 1000).toFixed(1)}초
              </span>
            )}
            <ComboBadge combo={combo} />
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
          {/* 진단을 읽는 것보다 두 소리를 붙여 듣는 편이 차이를 빨리 잡는다 */}
          <VoiceCompare sentence={currentSentence} clip={clip} lang={lang} />

          {pronIssues.length > 0 && (
            <div className="pron-diag">
              <div className="pron-diag-head">발음 진단</div>
              {pronIssues.map((p) => (
                <div className="pron-issue" key={p.key}>
                  <div className="pron-issue-top">
                    <span className="pron-chip">{p.label}</span>
                    <span className="pron-pair">
                      <b>{p.target}</b>
                      {p.heard ? (
                        <>
                          {' → '}
                          <i>{p.heard}</i>
                          {' 로 들렸어요'}
                        </>
                      ) : (
                        ' — 들리지 않았어요'
                      )}
                    </span>
                    <button
                      type="button"
                      className="speak-mini pron-play"
                      aria-label={`${p.target} 느리게 듣기`}
                      onClick={() => speakText(p.target, lang, slow)}
                    >
                      <SpeakerIcon />
                    </button>
                  </div>
                  <div className="pron-tip">{p.tip}</div>
                  {/* 이미 드릴 안이므로 여기서는 귀 훈련(듣고 구분하기)까지만 —
                      드릴 큐로 넘기는 통로는 주간 리포트가 맡는다 */}
                  <PronDrillCard lapseKey={p.key} label={p.label} />
                </div>
              ))}
            </div>
          )}
          {accuracyScore < 80 && (
            <p className="muted" style={{ fontSize: '0.76rem', marginTop: 6 }}>
              빨간 단어를 다시 듣고 발음해 보세요 — {rateLabel(slow)} 느리게 듣기로 정확한 발음을 확인할 수 있어요.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** 점수 카운트업 — 훅 규칙 때문에 조건부 렌더 밖의 별도 컴포넌트로 둔다. */
function ScoreNumber({ score }: { score: number }) {
  const value = useCountUp(score);
  return <b className="score-num">{value}</b>;
}
