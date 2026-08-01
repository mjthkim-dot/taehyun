'use client';

/**
 * 오늘의 비즈니스 미션 — 홈 최상단 히어로. "보면 끝"이 아니라 "해야 끝"인 완주 루프:
 * 표현마다 ①듣기 ②말하기(발음 채점 통과) ③리콜(뜻만 보고 떠올리기) 3단계를 기록하고,
 * 3개 표현을 완주해야 '오늘 미션 완료'가 열린다. 표현을 탭하면 딥카드(뉘앙스·변형·
 * 흔한 실수·응답 페어·확인 문제)가 펼쳐져 한 표현을 6층 깊이로 소화한다.
 */
import { useEffect, useRef, useState } from 'react';
import {
  getTodayMission,
  nextMission,
  isMissionDoneToday,
  markMissionDone,
  setMissionTalkContext,
  getCustomMissionToday,
  saveCustomMissionToday,
  clearCustomMission,
  generateAiMission,
  type BusinessMission,
} from '../lib/dailyMission';
import { getProgress, markStage, isMastered, masteredCount, REQUIRED_MASTERED, SPEAK_PASS_SCORE, type Stage } from '../lib/missionProgress';
import { recordMissionDay } from '../lib/habits';
import { GroqError } from '../lib/groq';
import { SpeakerIcon, PinIcon, CheckIcon, PlayIcon, StopIcon } from './icons';
import { addPhrase, markPracticedToday, groqKey } from '../lib/state';
import { speakText, stopSpeaking } from './SpeakButton';
import { playDialogueAudio } from './DialoguePractice';
import BuildupPractice from './BuildupPractice';
import PhraseDeepCard from './PhraseDeepCard';
import { useLessonStore } from '../store/useLessonStore';
import type { Mode } from './NavBar';

function micSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
}

export default function DailyMissionCard({ onNavigate, onProgress }: { onNavigate: (m: Mode) => void; onProgress?: () => void }) {
  // 오늘 AI로 만든 미션이 있으면 그걸 이어서, 없으면 날짜 순환 미션을 쓴다.
  const [mission, setMission] = useState<BusinessMission>(() => getCustomMissionToday() ?? getTodayMission());
  const [done, setDone] = useState(() => isMissionDoneToday());
  const [openPhrase, setOpenPhrase] = useState<number | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [showDialogue, setShowDialogue] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [canAi, setCanAi] = useState(false);
  const [hasMic, setHasMic] = useState(true);
  const [earnedFreeze, setEarnedFreeze] = useState(false);
  // 완주 루프 진행 상태 — localStorage(날짜+미션 키)와 동기화
  const [progress, setProgress] = useState<Record<string, Partial<Record<Stage, boolean>>>>({});

  useEffect(() => {
    setCanAi(!!groqKey());
    setHasMic(micSupported());
  }, []);
  useEffect(() => setProgress(getProgress(mission.key)), [mission.key]);

  function mark(en: string, stage: Stage) {
    setProgress({ ...markStage(mission.key, en, stage) });
  }

  // 말하기 단계: 전역 채점 스토어를 구독 — 지금 연습 중인 문장이 통과 점수를 넘으면 기록.
  const accuracyScore = useLessonStore((s) => s.accuracyScore);
  const currentSentence = useLessonStore((s) => s.currentSentence);
  useEffect(() => {
    if (accuracyScore >= SPEAK_PASS_SCORE && mission.phrases.some((p) => p.en === currentSentence)) {
      mark(currentSentence, 'speak');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accuracyScore, currentSentence]);

  function resetView() {
    setOpenPhrase(null);
    setPracticeIdx(0);
    setShowDialogue(false);
    setAiError('');
  }

  function shuffle() {
    clearCustomMission(); // AI 미션에서 벗어나 정적 순환으로 복귀
    setMission(nextMission());
    resetView();
  }

  async function aiNewMission() {
    if (aiBusy) return;
    setAiBusy(true);
    setAiError('');
    try {
      const m = await generateAiMission();
      saveCustomMissionToday(m); // 같은 날 다시 열어도 유지
      setMission(m);
      resetView();
    } catch (err) {
      const e = err as Error;
      setAiError(e instanceof GroqError && e.message === 'NO_GROQ_KEY'
        ? '회화 탭에서 무료 Groq 키를 등록하면 쓸 수 있어요.'
        : e.message);
    } finally {
      setAiBusy(false);
    }
  }

  function save(en: string, kr: string) {
    addPhrase({ en, kr });
    setSaved((s) => ({ ...s, [en]: true }));
  }

  const phraseEns = mission.phrases.map((p) => p.en);
  const mastered = masteredCount(mission.key, phraseEns);
  const canComplete = done || mastered >= REQUIRED_MASTERED;

  function complete() {
    if (!canComplete) return;
    markMissionDone();
    markPracticedToday();
    setDone(true);
    // 미션 완료일 기록 — 3일마다 스트릭 프리즈 1개 적립(최대 2개).
    setEarnedFreeze(recordMissionDay());
    // 홈의 스트릭·목표 링·퀘스트가 그 자리에서 갱신되게 부모에게 알린다.
    onProgress?.();
  }

  function startTalk() {
    setMissionTalkContext(mission); // 회화 화면이 이 상황을 시나리오로 쓰게 전달
    onNavigate('talk');
  }

  const practicePhrase = mission.phrases[practiceIdx] || mission.phrases[0];

  return (
    <div className={`mission-card${done ? ' done' : ''}`}>
      <div className="mission-top">
        <div className="mission-label">오늘의 비즈니스 미션 {done && <span className="mission-done-tag">완료 ✓</span>}</div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {canAi && (
            <button className="mission-shuffle mission-ai" onClick={aiNewMission} disabled={aiBusy} title="AI가 새 상황을 만들어줘요">
              {aiBusy ? '만드는 중…' : 'AI 새 상황'}
            </button>
          )}
          <button className="mission-shuffle" onClick={shuffle} title="다른 상황 보기">
            다른 상황
          </button>
        </div>
      </div>
      <div className="mission-title">{mission.title}</div>
      <div className="mission-goal">{mission.goal}</div>
      {aiError && <div className="dlgv-error">{aiError}</div>}

      {/* 완주 진행 — 몇 개를 끝냈고 완료까지 얼마나 남았는지 */}
      {!done && (
        <div className="mission-progress">
          <div className="mission-progress-bar">
            <div className="mission-progress-fill" style={{ width: `${Math.min(mastered / REQUIRED_MASTERED, 1) * 100}%` }} />
          </div>
          <span className="mission-progress-txt">표현 완주 {mastered}/{REQUIRED_MASTERED}</span>
        </div>
      )}

      {/* 1) 핵심 표현 — 탭하면 딥카드(뉘앙스·변형·실수·응답·체크 + 리콜) */}
      <div className="mission-step-label">① 표현을 깊이 있게 — 탭해서 펼치기</div>
      <div className="mission-phrases">
        {mission.phrases.map((p, i) => {
          const st = progress[p.en] || {};
          const open = openPhrase === i;
          return (
            <div key={p.en}>
              <div className={`mission-phrase${open && !st.recall ? ' recalling' : ''}`}>
                <button className="mission-phrase-main" onClick={() => setOpenPhrase(open ? null : i)}>
                  <span className="mission-phrase-en">{p.en}</span>
                  <span className="mission-stages">
                    <i className={st.listen ? 'on' : ''} title="듣기">듣</i>
                    <i className={st.speak ? 'on' : ''} title="말하기">말</i>
                    <i className={st.recall ? 'on' : ''} title="리콜">암</i>
                    {isMastered(st) && <b className="mission-mastered">완주</b>}
                  </span>
                </button>
                <button
                  className="mission-ic"
                  title="듣기"
                  onClick={() => {
                    speakText(p.en);
                    mark(p.en, 'listen');
                  }}
                >
                  <SpeakerIcon />
                </button>
                <button className="mission-ic" title="표현장에 저장" onClick={() => save(p.en, p.kr)} disabled={!!saved[p.en]}>
                  {saved[p.en] ? <CheckIcon /> : <PinIcon />}
                </button>
              </div>
              {open && (
                <PhraseDeepCard
                  en={p.en}
                  kr={p.kr}
                  missionTitle={mission.title}
                  recallDone={!!st.recall}
                  onRecallDone={() => mark(p.en, 'recall')}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 2) 말하기 도전 — 통과 점수(60점)를 넘기면 해당 표현의 '말' 단계가 채워진다 */}
      <div className="mission-step-label">
        <span>② 빌드업 말하기 · {SPEAK_PASS_SCORE}점 통과</span>
        {mission.phrases.length > 1 && (
          <button className="mission-mini-next" onClick={() => setPracticeIdx((i) => (i + 1) % mission.phrases.length)}>
            다른 문장 →
          </button>
        )}
      </div>
      <div className="mission-practice">
        <BuildupPractice key={`${mission.key}:${practiceIdx}`} sentence={practicePhrase.en} prompt={practicePhrase.kr} />
        {!hasMic && !progress[practicePhrase.en]?.speak && (
          <button className="mission-nomic" onClick={() => mark(practicePhrase.en, 'speak')}>
            마이크를 지원하지 않는 브라우저예요 — 소리 내어 3번 읽었으면 통과 처리
          </button>
        )}
      </div>

      {/* 3) 실전 대화 */}
      <div className="mission-step-label">③ 실전 대화로 감 잡기</div>
      {!showDialogue ? (
        <button className="mission-secondary" onClick={() => setShowDialogue(true)}>대화 보기 · 듣기</button>
      ) : (
        <MissionDialogue mission={mission} />
      )}

      {/* 4) AI와 실전 — 미션 상황을 회화 화면에 그대로 넘긴다 */}
      <button className="mission-cta" onClick={startTalk}>이 상황으로 AI와 대화하기 →</button>

      {/* 완료 — 3개 표현을 실제로 완주해야 열린다 */}
      {!done ? (
        <button className="mission-complete" onClick={complete} disabled={!canComplete}>
          {canComplete ? '오늘 미션 완료' : `표현 ${REQUIRED_MASTERED}개 완주하면 완료할 수 있어요 (${mastered}/${REQUIRED_MASTERED})`}
        </button>
      ) : (
        <div className="mission-done-banner">
          오늘 미션 완료! 내일 새로운 상황으로 만나요.
          {earnedFreeze && <div className="mission-freeze-earned">❄️ 스트릭 프리즈 1개 적립 — 하루 놓쳐도 연속 기록이 보호돼요.</div>}
        </div>
      )}
    </div>
  );
}

function MissionDialogue({ mission }: { mission: BusinessMission }) {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);
  // 정지 핸들은 ref로 — '다른 상황' 전환이나 탭 이동으로 이 컴포넌트가 사라져도
  // cleanup에서 확실히 재생을 멈춘다.
  const stopRef = useRef<null | (() => void)>(null);
  const playing = playingIdx !== null;

  useEffect(
    () => () => {
      stopRef.current?.();
      stopSpeaking();
    },
    []
  );

  function toggle() {
    if (playing && stopRef.current) {
      stopRef.current();
      stopRef.current = null;
      setPlayingIdx(null);
      return;
    }
    stopRef.current = playDialogueAudio(
      mission.dialogue,
      slow ? 0.7 : 1,
      setPlayingIdx,
      () => {
        setPlayingIdx(null);
        stopRef.current = null;
      }
    );
  }

  return (
    <div className="mission-dialogue">
      <div className="mission-dialogue-head">
        <span>{mission.dialogue.title}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="mission-mini" onClick={() => setSlow((v) => !v)}>{slow ? '느리게' : '보통'}</button>
          <button className="mission-mini mission-mini-play" onClick={toggle}>{playing ? <><StopIcon /> {(playingIdx ?? 0) + 1}/{mission.dialogue.lines.length}</> : <><PlayIcon /> 재생</>}</button>
        </div>
      </div>
      {mission.dialogue.lines.map((ln, i) => (
        <div className={`mission-line${playingIdx === i ? ' active' : ''}`} key={i}>
          <span className={ln.sp === 'A' ? 'sp-a' : 'sp-b'}>{ln.sp}</span>
          <div className="mission-line-txt">
            <div className="en">{ln.en}</div>
            <div className="kr">{ln.kr}</div>
          </div>
          <button className="mission-ic" title="듣기" onClick={() => speakText(ln.en)}><SpeakerIcon size={14} /></button>
        </div>
      ))}
    </div>
  );
}
