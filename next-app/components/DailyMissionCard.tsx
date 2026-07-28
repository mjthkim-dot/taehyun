'use client';

/**
 * 오늘의 비즈니스 미션 — 홈 최상단 히어로. 앱을 열면 '오늘 할 딱 한 가지'가 여기 있다.
 * 실무 회화 상황 1개 = 핵심 표현 5개(듣기·저장) → 한 문장 말하기 도전(발음 채점) →
 * 실전 대화 듣기 → AI와 자유 대화. 하루 15분 안에 끝나고, 매일 새로운 상황이 뜬다.
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
import { GroqError } from '../lib/groq';
import { addPhrase, markPracticedToday, groqKey } from '../lib/state';
import { speakText, stopSpeaking } from './SpeakButton';
import { playDialogueAudio } from './DialoguePractice';
import SpeakingPractice from './SpeakingPractice';
import type { Mode } from './NavBar';

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
  useEffect(() => setCanAi(!!groqKey()), []);

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
        ? '⚡ 회화 탭에서 무료 Groq 키를 등록하면 쓸 수 있어요.'
        : `❌ ${e.message}`);
    } finally {
      setAiBusy(false);
    }
  }

  function save(en: string, kr: string) {
    addPhrase({ en, kr });
    setSaved((s) => ({ ...s, [en]: true }));
  }

  function complete() {
    markMissionDone();
    markPracticedToday();
    setDone(true);
    // 홈의 스트릭·오늘 목표 링이 그 자리에서 갱신되게 부모에게 알린다 —
    // 완료했는데 화면이 그대로면 성취감이 살지 않는다.
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
        <div className="mission-label">🎯 오늘의 비즈니스 미션 {done && <span className="mission-done-tag">완료 ✓</span>}</div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {canAi && (
            <button className="mission-shuffle mission-ai" onClick={aiNewMission} disabled={aiBusy} title="AI가 새 상황을 만들어줘요">
              {aiBusy ? '⏳ 만드는 중…' : '✨ AI 새 상황'}
            </button>
          )}
          <button className="mission-shuffle" onClick={shuffle} title="다른 상황 보기">
            🎲 다른 상황
          </button>
        </div>
      </div>
      <div className="mission-title">{mission.title}</div>
      <div className="mission-goal">{mission.goal}</div>
      {aiError && <div className="dlgv-error">{aiError}</div>}

      {/* 1) 핵심 표현 */}
      <div className="mission-step-label">① 오늘의 핵심 표현 5개</div>
      <div className="mission-phrases">
        {mission.phrases.map((p, i) => (
          <div className="mission-phrase" key={p.en}>
            <button className="mission-phrase-main" onClick={() => setOpenPhrase(openPhrase === i ? null : i)}>
              <span className="mission-phrase-en">{p.en}</span>
              {openPhrase === i && <span className="mission-phrase-kr">{p.kr}</span>}
            </button>
            <button className="mission-ic" title="듣기" onClick={() => speakText(p.en)}>🔊</button>
            <button className="mission-ic" title="표현장에 저장" onClick={() => save(p.en, p.kr)} disabled={!!saved[p.en]}>
              {saved[p.en] ? '✅' : '📌'}
            </button>
          </div>
        ))}
      </div>

      {/* 2) 말하기 도전 */}
      <div className="mission-step-label">
        ② 한 문장 말하기 도전
        {mission.phrases.length > 1 && (
          <button className="mission-mini-next" onClick={() => setPracticeIdx((i) => (i + 1) % mission.phrases.length)}>
            다른 문장 →
          </button>
        )}
      </div>
      <div className="mission-practice">
        <SpeakingPractice key={`${mission.key}:${practiceIdx}`} sentence={practicePhrase.en} prompt={practicePhrase.kr} />
      </div>

      {/* 3) 실전 대화 */}
      <div className="mission-step-label">③ 실전 대화로 감 잡기</div>
      {!showDialogue ? (
        <button className="mission-secondary" onClick={() => setShowDialogue(true)}>💬 대화 보기 · 듣기</button>
      ) : (
        <MissionDialogue mission={mission} />
      )}

      {/* 4) AI와 실전 — 미션 상황을 회화 화면에 그대로 넘긴다 */}
      <button className="mission-cta" onClick={startTalk}>🗣 이 상황으로 AI와 대화하기 →</button>

      {/* 완료 */}
      {!done ? (
        <button className="mission-complete" onClick={complete}>✅ 오늘 미션 완료</button>
      ) : (
        <div className="mission-done-banner">🎉 오늘 미션 완료! 내일 새로운 상황으로 만나요.</div>
      )}
    </div>
  );
}

function MissionDialogue({ mission }: { mission: BusinessMission }) {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);
  // 정지 핸들은 ref로 — '다른 상황' 전환이나 탭 이동으로 이 컴포넌트가 사라져도
  // cleanup에서 확실히 재생을 멈춘다(state로 들고 있으면 언마운트 순간 핸들을 잃어
  // 오디오만 계속 흘러나오는 누수가 생긴다).
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
          <button className="mission-mini" onClick={() => setSlow((v) => !v)}>{slow ? '🐢' : '🔊'}</button>
          <button className="mission-mini" onClick={toggle}>{playing ? `⏹ ${(playingIdx ?? 0) + 1}/${mission.dialogue.lines.length}` : '▶ 재생'}</button>
        </div>
      </div>
      {mission.dialogue.lines.map((ln, i) => (
        <div className={`mission-line${playingIdx === i ? ' active' : ''}`} key={i}>
          <span className={ln.sp === 'A' ? 'sp-a' : 'sp-b'}>{ln.sp}</span>
          <div className="mission-line-txt">
            <div className="en">{ln.en}</div>
            <div className="kr">{ln.kr}</div>
          </div>
          <button className="mission-ic" title="듣기" onClick={() => speakText(ln.en)}>🔊</button>
        </div>
      ))}
    </div>
  );
}
