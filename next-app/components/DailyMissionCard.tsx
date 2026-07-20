'use client';

/**
 * 오늘의 비즈니스 미션 — 홈 최상단 히어로. 앱을 열면 '오늘 할 딱 한 가지'가 여기 있다.
 * 실무 회화 상황 1개 = 핵심 표현 5개(듣기·저장) → 한 문장 말하기 도전(발음 채점) →
 * 실전 대화 듣기 → AI와 자유 대화. 하루 15분 안에 끝나고, 매일 새로운 상황이 뜬다.
 */
import { useMemo, useState } from 'react';
import { getTodayMission, nextMission, isMissionDoneToday, markMissionDone, type BusinessMission } from '../lib/dailyMission';
import { addPhrase, markPracticedToday } from '../lib/state';
import { speakText } from './SpeakButton';
import { playDialogueAudio } from './DialoguePractice';
import SpeakingPractice from './SpeakingPractice';
import type { Mode } from './NavBar';

export default function DailyMissionCard({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [mission, setMission] = useState<BusinessMission>(() => getTodayMission());
  const [done, setDone] = useState(() => isMissionDoneToday());
  const [openPhrase, setOpenPhrase] = useState<number | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [showDialogue, setShowDialogue] = useState(false);

  function shuffle() {
    setMission(nextMission());
    setOpenPhrase(null);
    setPracticeIdx(0);
    setShowDialogue(false);
  }

  function save(en: string, kr: string) {
    addPhrase({ en, kr });
    setSaved((s) => ({ ...s, [en]: true }));
  }

  function complete() {
    markMissionDone();
    markPracticedToday();
    setDone(true);
  }

  const practicePhrase = mission.phrases[practiceIdx] || mission.phrases[0];

  return (
    <div className={`mission-card${done ? ' done' : ''}`}>
      <div className="mission-top">
        <div className="mission-label">🎯 오늘의 비즈니스 미션 {done && <span className="mission-done-tag">완료 ✓</span>}</div>
        <button className="mission-shuffle" onClick={shuffle} title="다른 상황 보기">
          🎲 다른 상황
        </button>
      </div>
      <div className="mission-title">{mission.title}</div>
      <div className="mission-goal">{mission.goal}</div>

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

      {/* 4) AI와 실전 */}
      <button className="mission-cta" onClick={() => onNavigate('talk')}>🗣 이 상황으로 AI와 대화하기 →</button>

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
  // 재생 정지 핸들을 로컬 상태로 — 카드가 사라지면 브라우저가 정리한다.
  const [stop, setStop] = useState<null | (() => void)>(null);
  const playing = playingIdx !== null;

  function toggle() {
    if (playing && stop) {
      stop();
      setStop(null);
      setPlayingIdx(null);
      return;
    }
    const s = playDialogueAudio(
      mission.dialogue,
      slow ? 0.7 : 1,
      setPlayingIdx,
      () => {
        setPlayingIdx(null);
        setStop(null);
      }
    );
    setStop(() => s);
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
