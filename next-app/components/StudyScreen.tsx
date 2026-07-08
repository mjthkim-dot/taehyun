'use client';

/**
 * 레슨(학습) 화면 — 기존 voice-assistant/index.html 의 renderStudy() 를 React로 포팅.
 * 섹션/포인트/예문/대화문/프리토킹/숙제를 원본과 동일한 순서로 보여준다.
 * TTS(말하기) 연동은 다음 단계 작업 — 지금은 콘텐츠 표시 + 레슨 선택에 집중한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_LESSONS,
  LESSONS,
  MASTER_LESSONS,
  SCENARIO_LIBRARY,
  lessonLabel,
  cefrOf,
  scaffoldFor,
  type Lesson,
  type Dialogue,
} from '../lib/lessons';
import Note from './Note';
import SpeakButton, { stopSpeaking } from './SpeakButton';
import { playDialogueAudio } from './DialoguePractice';
import DialogueVariantPicker from './DialogueVariantPicker';
import { addPhrase } from '../lib/state';

interface StudyScreenProps {
  lessonId: number;
  onSelectLesson: (id: number) => void;
}

export default function StudyScreen({ lessonId, onSelectLesson }: StudyScreenProps) {
  const lesson = useMemo(
    () => ALL_LESSONS.find((l) => l.id === lessonId) ?? LESSONS[LESSONS.length - 1],
    [lessonId]
  );

  const scaffold = scaffoldFor(cefrOf(lesson));
  const scaffoldPct = Math.round(scaffold * 100);

  return (
    <div className="study-screen">
      <LessonPicker selectedId={lesson.id} onSelect={onSelectLesson} />

      {scaffold < 1 && (
        <div className="scaffold-note">
          🪜 <b>스캐폴딩 {scaffoldPct}%</b> — CEFR {cefrOf(lesson)} 단계라 한글 번역 의존을 줄여
          스스로 의미를 잡는 훈련입니다.
        </div>
      )}

      {lesson.preview && (
        <div className="study-card preview-card">
          <h3>🔮 선행학습 — 다음 수업 미리 준비하기</h3>
          <p className="muted">
            아직 PREPLY에서 배우지 않은 내용입니다. 표준 A2 커리큘럼에서 지금 진도의 바로 다음
            단계예요. 미리 익혀두면 실제 수업에서 훨씬 빠르게 흡수됩니다.
          </p>
        </div>
      )}
      {!lesson.preview && lesson.master && (
        <div className="study-card master-card">
          <h3>🗺 마스터 코스 — CEFR {lesson.master}</h3>
          <p className="muted">
            ① 핵심 포인트와 예문을 소리 내어 익히고 → ② 드릴에서 입에 붙인 뒤 → ③ 회화에서
            AI 코치와 실전 연습하세요.
          </p>
        </div>
      )}

      {(lesson.sections ?? []).map((sec, i) => (
        <div className="study-card" key={i}>
          <h3>{sec.title}</h3>
          {sec.intro && <div className="sec-intro">{sec.intro}</div>}
          {sec.points.map((p, j) => (
            <div className="point" key={j}>
              <div className="en">{p.en}</div>
              {p.kr && <div className="kr">{p.kr}</div>}
              {p.note && (
                <div className="note">
                  <Note text={p.note} />
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {!!lesson.examples?.length && (
        <div className="study-card">
          <h3>예문 — 🔊 듣고 따라 말하기</h3>
          {lesson.examples.map((e, i) => (
            <div className="example-row" key={i}>
              <div className="txt">
                <div className="en">{e.en}</div>
                <div className="kr muted">{e.kr}</div>
              </div>
              <SpeakButton text={e.en} />
            </div>
          ))}
        </div>
      )}

      {lesson.dialogue && <DialogueCard dialogue={lesson.dialogue} lessonId={lesson.id} />}

      {lesson.freeTalk && (
        <div className="study-card freetalk-card">
          <h3>🗣 진옥쌤과 프리토킹 — 내 이야기로 말하기</h3>
          {lesson.freeTalk.intro && <div className="sec-intro">{lesson.freeTalk.intro}</div>}
          {lesson.freeTalk.topics.map((t, i) => (
            <div className="point" key={i}>
              <div className="topic-label">🗣 {t.topic}</div>
              <div className="kr strong">{t.kr}</div>
              <div className="en">
                {t.en} <SpeakButton text={t.en} /> <SpeakButton text={t.en} slow /> <SaveBtn en={t.en} kr={t.kr} />
              </div>
              {t.tip && (
                <div className="note">
                  💡 <Note text={t.tip} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lesson.homework && (
        <div className="hw-box">
          📌 <b>{lesson.preview ? '예습 과제' : '숙제'}</b>
          <br />
          {lesson.homework}
        </div>
      )}
    </div>
  );
}

/** 레슨 화면의 대화문 카드 — 줄별 듣기 + 화자별 목소리 전체 재생 + 🎲 새 대화 생성. */
function DialogueCard({ dialogue: original, lessonId }: { dialogue: Dialogue; lessonId: number }) {
  const [slow, setSlow] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const playing = playingIdx !== null;

  // 활성 대화 — 원본 또는 🎲로 생성한 변형. 레슨이 바뀌면 원본으로 리셋.
  const [dialogue, setDialogue] = useState<Dialogue>(original);
  useEffect(() => setDialogue(original), [original]);

  // 연속재생(반복) — ref로 두어 재생 중에 켜고 꺼도 즉시 반영된다.
  const [loop, setLoop] = useState(false);
  const loopRef = useRef(false);
  loopRef.current = loop;

  function stopAll() {
    stopRef.current?.();
    stopRef.current = null;
    setPlayingIdx(null);
  }
  function playAll() {
    stopRef.current?.();
    stopRef.current = playDialogueAudio(
      dialogue,
      slow ? 0.7 : 1,
      setPlayingIdx,
      () => setPlayingIdx(null),
      () => loopRef.current
    );
  }
  useEffect(() => () => { stopRef.current?.(); stopSpeaking(); }, []);

  return (
    <div className="study-card">
      <h3>💬 실전 대화문 — {dialogue.title}</h3>
      <DialogueVariantPicker
        lessonId={lessonId}
        original={original}
        onChange={(d) => {
          stopAll();
          setDialogue(d);
        }}
      />
      <div style={{ display: 'flex', gap: 8, margin: '4px 0 12px' }}>
        <button className="btn primary" style={{ flex: 1 }} onClick={playing ? stopAll : playAll}>
          {playing ? `⏹ 멈추기 (${(playingIdx ?? 0) + 1}/${dialogue.lines.length})` : '▶ 전체 음성 재생'}
        </button>
        <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => setSlow((v) => !v)}>
          {slow ? '🐢 천천히' : '🔊 보통 속도'}
        </button>
        <button
          className={loop ? 'btn primary' : 'btn'}
          style={{ flex: '0 0 auto' }}
          onClick={() => setLoop((v) => !v)}
          title="끝까지 재생 후 처음부터 자동 반복"
        >
          {loop ? '🔁 반복 켜짐' : '🔁 반복'}
        </button>
      </div>
      {dialogue.lines.map((ln, i) => (
        <div
          className="example-row"
          key={i}
          style={playingIdx === i ? { background: 'rgba(255,90,54,0.12)', borderRadius: 8 } : undefined}
        >
          <div className="txt">
            <div className="en">
              <span className={ln.sp === 'A' ? 'sp-a' : 'sp-b'}>{ln.sp}</span> {ln.en}
            </div>
            <div className="kr muted">{ln.kr}</div>
          </div>
          <SpeakButton text={ln.en} />
        </div>
      ))}
    </div>
  );
}

function SaveBtn({ en, kr }: { en: string; kr: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      type="button"
      className="speak-mini"
      title="내 표현장에 저장"
      onClick={() => {
        addPhrase({ en, kr, lesson: undefined });
        setSaved(true);
      }}
    >
      {saved ? '✅' : '📌'}
    </button>
  );
}

function LessonPicker({
  selectedId,
  onSelect,
}: {
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <select
      className="lesson-picker"
      value={selectedId}
      onChange={(e) => onSelect(Number(e.target.value))}
    >
      <optgroup label="회차">
        {LESSONS.map((l) => (
          <option key={l.id} value={l.id}>
            {lessonLabel(l)} · {l.title}
          </option>
        ))}
      </optgroup>
      <optgroup label="마스터 코스">
        {MASTER_LESSONS.map((l) => (
          <option key={l.id} value={l.id}>
            {lessonLabel(l)} · {l.title}
          </option>
        ))}
      </optgroup>
      <optgroup label="시나리오">
        {SCENARIO_LIBRARY.map((l) => (
          <option key={l.id} value={l.id}>
            {lessonLabel(l)} · {l.dialogue?.title ?? ''}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

export function defaultLesson(): Lesson {
  return LESSONS.filter((l) => !l.preview).slice(-1)[0] ?? LESSONS[0];
}
