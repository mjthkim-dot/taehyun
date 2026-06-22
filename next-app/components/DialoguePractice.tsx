'use client';

/**
 * 회차별 대화문 연습 — 레슨에 dialogue가 있을 때(예: 4회차 카페 회화)만 등장하는 맥락 특화 기능.
 * 글로벌 영어회화 앱들의 검증된 학습법을 벤치마크해 비용 없이(또는 Groq TTS만으로) 구현했다:
 *   1) 듣기 & 따라하기(Shadowing) — Cake/Speak: 줄별·전체 재생, 화자별 다른 목소리, 속도 조절
 *   2) 역할 연습(Role-play) — Busuu/LingoDeer + ELSA: 내 역할 대사를 가리고 말하면 단어별 발음 채점
 *   3) 암기 체크(Recall) — Pimsleur/Anki: 한글 보고 영어 떠올린 뒤 자가채점, 틀리면 SRS 복습으로 자동 등록
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dialogue } from '../lib/lessons';
import { computeAccuracy, type WordDiff } from '../store/useLessonStore';
import { addWeakItem, groqKey, markPracticedToday } from '../lib/state';
import { speakText, stopSpeaking, primeAudio, fetchGroqTTS, playUrl, SPEAKER_GROQ_VOICE, GROQ_TTS_VOICE } from './SpeakButton';

const ROLEPLAY_PASS = 60; // 이 점수 미만이면 SRS 복습 항목으로 등록

function voiceFor(sp: string) {
  return SPEAKER_GROQ_VOICE[sp] || GROQ_TTS_VOICE;
}

interface StopRef {
  stopped: boolean;
  cleanup?: () => void;
}

/** 폴백: 브라우저 speechSynthesis 큐로 fromIdx부터 끝까지 한 번에 등록해 재생한다. */
function playViaBrowserQueue(
  dialogue: Dialogue,
  rate: number,
  onLineStart: ((i: number) => void) | undefined,
  onDone: (() => void) | undefined,
  fromIdx: number,
  ref: StopRef
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onDone?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const enVoices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  const voiceA = enVoices[0];
  const voiceB = enVoices[1] || enVoices[0];
  const last = dialogue.lines.length - 1;
  // Chrome/모바일에서 긴 재생이 ~15초 후 멈추는 버그 방지 keep-alive.
  const keepAlive = setInterval(() => {
    if (ref.stopped || !synth.speaking) return;
    synth.resume();
  }, 10000);
  ref.cleanup = () => clearInterval(keepAlive);
  for (let i = fromIdx; i <= last; i++) {
    const line = dialogue.lines[i];
    const u = new SpeechSynthesisUtterance(line.en);
    u.lang = 'en-US';
    u.rate = rate;
    const v = line.sp === 'A' ? voiceA : voiceB;
    if (v) u.voice = v;
    u.onstart = () => { if (!ref.stopped) onLineStart?.(i); };
    u.onend = () => { if (i === last && !ref.stopped) { clearInterval(keepAlive); onDone?.(); } };
    u.onerror = () => { if (i === last) clearInterval(keepAlive); };
    synth.speak(u);
  }
}

/**
 * 대화문 전체를 순차 재생한다 — 듣기 탭과 숙제/레슨 화면의 "전체 재생" 버튼에서 재사용한다.
 * 반환값은 재생을 중단하는 함수.
 *
 * Groq 키가 있으면 화자별 신경망 음성(실제 사람에 가까운 목소리)으로 한 줄씩 재생하고
 * 다음 줄을 미리 받아 끊김을 줄인다. 클릭 순간 primeAudio()로 오디오를 언락하므로 iOS에서도
 * 비동기 재생이 막히지 않는다. 키가 없거나 합성에 실패하면 브라우저 음성 큐로 폴백한다.
 */
export function playDialogueAudio(
  dialogue: Dialogue,
  rate = 1,
  onLineStart?: (i: number) => void,
  onDone?: () => void
): () => void {
  if (typeof window === 'undefined' || !dialogue.lines.length) {
    onDone?.();
    return () => {};
  }
  primeAudio(); // 사용자 제스처 안에서 동기 언락
  const ref: StopRef = { stopped: false };
  const stop = () => {
    ref.stopped = true;
    ref.cleanup?.();
    stopSpeaking();
  };

  if (!groqKey()) {
    playViaBrowserQueue(dialogue, rate, onLineStart, onDone, 0, ref);
    return stop;
  }

  const last = dialogue.lines.length - 1;
  const playFrom = async (i: number) => {
    if (ref.stopped) return;
    if (i > last) { onDone?.(); return; }
    const line = dialogue.lines[i];
    const url = await fetchGroqTTS(line.en, voiceFor(line.sp));
    if (ref.stopped) return;
    if (!url) { playViaBrowserQueue(dialogue, rate, onLineStart, onDone, i, ref); return; }
    onLineStart?.(i);
    if (i + 1 <= last) {
      const n = dialogue.lines[i + 1];
      fetchGroqTTS(n.en, voiceFor(n.sp)); // 다음 줄 미리 받기
    }
    try {
      await playUrl(url, rate, () => playFrom(i + 1));
    } catch {
      if (!ref.stopped) playViaBrowserQueue(dialogue, rate, onLineStart, onDone, i, ref);
    }
  };
  onLineStart?.(0); // 첫 음성을 받는 동안 즉시 UI 반영(중복 클릭 방지)
  playFrom(0);
  return stop;
}

function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  return (
    window.SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ||
    null
  );
}

type Tab = 'listen' | 'roleplay' | 'memorize';

export default function DialoguePractice({ dialogue, lessonId }: { dialogue: Dialogue; lessonId: number }) {
  const [tab, setTab] = useState<Tab>('listen');
  const [slow, setSlow] = useState(false);
  const rate = slow ? 0.7 : 1;

  // 전체 재생 상태를 부모에서 관리해 상단 버튼과 듣기 탭 버튼이 같은 상태를 공유한다.
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const stopAll = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setPlayingIdx(null);
  }, []);

  const playAll = useCallback(() => {
    stopRef.current?.();
    stopRef.current = playDialogueAudio(dialogue, slow ? 0.7 : 1, setPlayingIdx, () => setPlayingIdx(null));
  }, [dialogue, slow]);

  // 컴포넌트가 사라질 때 정리.
  useEffect(() => () => { stopRef.current?.(); stopSpeaking(); }, []);
  // 탭을 바꾸면 진행 중인 전체 재생을 멈춘다.
  useEffect(() => {
    stopAll();
  }, [tab, stopAll]);

  const playing = playingIdx !== null;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: 2 }}>💬 {dialogue.title}</div>
      <p className="muted" style={{ fontSize: '0.74rem', marginBottom: 12, lineHeight: 1.5 }}>
        이 회차 대화문을 듣고 · 역할로 말하고 · 외워보세요. 영어회화 앱들의 핵심 학습법을 담았어요.
      </p>

      {/* 상단 전체 음성 재생 — 탭에 들어가지 않고도 대화문 전체를 바로 들을 수 있다. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn primary" style={{ flex: 1 }} onClick={playing ? stopAll : playAll}>
          {playing ? `⏹ 멈추기 (${(playingIdx ?? 0) + 1}/${dialogue.lines.length})` : '▶ 전체 음성 재생'}
        </button>
        <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => setSlow((v) => !v)}>
          {slow ? '🐢 천천히' : '🔊 보통 속도'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([
          ['listen', '👂 듣기·따라하기'],
          ['roleplay', '🎭 역할 연습'],
          ['memorize', '🧠 암기 체크'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: 9,
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: `1px solid ${tab === t ? 'var(--primary)' : 'var(--border)'}`,
              background: tab === t ? 'var(--primary)' : 'var(--surface2)',
              color: tab === t ? '#fff' : 'var(--text-muted)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'listen' && (
        <ListenMode
          dialogue={dialogue}
          rate={rate}
          playingIdx={playingIdx}
          onPlayAll={playAll}
          onStopAll={stopAll}
        />
      )}
      {tab === 'roleplay' && <RolePlayMode key="roleplay" dialogue={dialogue} lessonId={lessonId} rate={rate} />}
      {tab === 'memorize' && <MemorizeMode key="memorize" dialogue={dialogue} lessonId={lessonId} rate={rate} />}
    </div>
  );
}

/* ── 1) 듣기 & 따라하기 (Shadowing) ── */
function ListenMode({
  dialogue,
  rate,
  playingIdx,
  onPlayAll,
  onStopAll,
}: {
  dialogue: Dialogue;
  rate: number;
  playingIdx: number | null;
  onPlayAll: () => void;
  onStopAll: () => void;
}) {
  return (
    <div>
      <button
        className="btn primary"
        style={{ width: '100%', marginBottom: 10 }}
        onClick={playingIdx !== null ? onStopAll : onPlayAll}
      >
        {playingIdx !== null ? '⏹ 멈추기' : '▶ 처음부터 전체 재생'}
      </button>

      {dialogue.lines.map((line, i) => (
        <div
          key={i}
          style={{
            background: playingIdx === i ? 'rgba(255,90,54,0.12)' : 'var(--surface2)',
            border: `1px solid ${playingIdx === i ? 'var(--primary)' : 'transparent'}`,
            borderRadius: 10,
            padding: '9px 11px',
            marginBottom: 7,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary-light)', flex: '0 0 auto', marginTop: 2 }}>{line.sp}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 600, lineHeight: 1.5 }}>{line.en}</div>
            <div className="muted" style={{ fontSize: '0.76rem', lineHeight: 1.5, marginTop: 1 }}>{line.kr}</div>
          </div>
          <button
            type="button"
            className="speak-mini"
            title="이 줄 듣기"
            onClick={() => speakText(line.en, 'en-US', rate, undefined, voiceFor(line.sp))}
            style={{ flex: '0 0 auto' }}
          >
            🔊
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── 2) 역할 연습 (Role-play + 발음 채점) ── */
interface LineResult {
  score: number;
  diff: WordDiff[];
  spoken: string;
}

function RolePlayMode({ dialogue, lessonId, rate }: { dialogue: Dialogue; lessonId: number; rate: number }) {
  const speakers = Array.from(new Set(dialogue.lines.map((l) => l.sp)));
  const [myRole, setMyRole] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<Record<number, LineResult>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');

  const recogRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef('');
  const stepRef = useRef(0);
  stepRef.current = step;
  const supported = getSpeechRecognition() !== null;

  // 음성 인식기 1회 생성
  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    const r = new SR();
    r.lang = 'en-US';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e: SpeechRecognitionEvent) => {
      let itm = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current += res[0].transcript + ' ';
        else itm += res[0].transcript;
      }
      setInterim((finalRef.current + itm).trim());
    };
    r.onend = () => {
      setListening(false);
      const spoken = finalRef.current.trim();
      if (!spoken) return;
      const idx = stepRef.current;
      const line = dialogue.lines[idx];
      const { score, diff } = computeAccuracy(line.en, spoken);
      setResults((prev) => ({ ...prev, [idx]: { score, diff, spoken } }));
      setRevealed((prev) => ({ ...prev, [idx]: true }));
      if (score < ROLEPLAY_PASS) {
        addWeakItem({ en: line.en, kr: line.kr, lesson: lessonId, cat: 'dialogue' });
      }
      markPracticedToday();
    };
    r.onerror = () => setListening(false);
    recogRef.current = r;
    return () => {
      r.onresult = null;
      r.onend = null;
      r.onerror = null;
      try {
        r.stop();
      } catch {
        /* noop */
      }
    };
  }, [dialogue, lessonId]);

  const line = dialogue.lines[step];
  const isMine = myRole != null && line?.sp === myRole;

  // 상대 대사로 넘어오면 자동으로 음성 재생
  useEffect(() => {
    if (myRole == null || !line) return;
    if (line.sp !== myRole) {
      speakText(line.en, 'en-US', rate, undefined, voiceFor(line.sp));
    }
    setInterim('');
  }, [step, myRole, line, rate]);

  function startMic() {
    const r = recogRef.current;
    if (!r || listening) return;
    finalRef.current = '';
    setInterim('');
    stopSpeaking();
    try {
      r.start();
      setListening(true);
    } catch {
      /* 이미 시작됨 */
    }
  }

  function pickRole(role: string) {
    setMyRole(role);
    setStep(0);
    setResults({});
    setRevealed({});
    setInterim('');
  }

  if (myRole == null) {
    const myLineCount = (role: string) => dialogue.lines.filter((l) => l.sp === role).length;
    return (
      <div>
        <p style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10 }}>어떤 역할을 맡을까요? 상대 대사는 AI가 읽어주고, 내 대사는 직접 말해요.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {speakers.map((sp) => (
            <button key={sp} className="btn primary" style={{ flex: 1 }} onClick={() => pickRole(sp)}>
              🎭 {sp} 역할 ({myLineCount(sp)}줄)
            </button>
          ))}
        </div>
        {!supported && (
          <p style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 10 }}>이 브라우저는 음성 인식을 지원하지 않아요. (Chrome/Edge 권장)</p>
        )}
      </div>
    );
  }

  const myLineIdxs = dialogue.lines.map((l, i) => (l.sp === myRole ? i : -1)).filter((i) => i >= 0);
  const scored = myLineIdxs.filter((i) => results[i] != null);
  const done = step >= dialogue.lines.length;

  if (done) {
    const avg = scored.length ? Math.round(scored.reduce((a, i) => a + results[i].score, 0) / scored.length) : 0;
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: '2rem' }}>{avg >= 80 ? '🎉' : avg >= 60 ? '👍' : '💪'}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, margin: '4px 0' }}>역할 연습 완료!</div>
        <div style={{ fontSize: '0.9rem', color: avg >= 80 ? 'var(--green)' : avg >= 60 ? 'var(--yellow)' : 'var(--red)', fontWeight: 800 }}>
          내 대사 평균 발음 정확도 {avg}점 · {scored.length}/{myLineIdxs.length}줄
        </div>
        <p className="muted" style={{ fontSize: '0.76rem', marginTop: 6 }}>
          60점 미만 대사는 복습 카드에 자동 추가됐어요.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => setMyRole(null)}>역할 바꾸기</button>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => pickRole(myRole)}>다시 연습</button>
        </div>
      </div>
    );
  }

  const res = results[step];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary-light)' }}>내 역할: {myRole}</span>
        <span className="muted" style={{ fontSize: '0.72rem' }}>{step + 1} / {dialogue.lines.length}</span>
      </div>

      <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: isMine ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 5 }}>
          {line.sp} {isMine ? '(나)' : '(상대 — AI 음성)'}
        </div>

        {isMine ? (
          <>
            <div className="muted" style={{ fontSize: '0.82rem', lineHeight: 1.5, marginBottom: 4 }}>🗣 이렇게 말해보세요: {line.kr}</div>
            {revealed[step] ? (
              <div style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.5 }}>{line.en}</div>
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', letterSpacing: 1 }}>{line.en.replace(/[A-Za-z]/g, '·')}</div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.5 }}>{line.en}</div>
            <div className="muted" style={{ fontSize: '0.78rem', lineHeight: 1.5, marginTop: 2 }}>{line.kr}</div>
          </>
        )}
      </div>

      {isMine ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              className={listening ? 'btn' : 'btn primary'}
              style={{ flex: 1, ...(listening ? { background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' } : {}) }}
              disabled={!supported}
              onClick={listening ? () => recogRef.current?.stop() : startMic}
            >
              {listening ? '⏹ 멈추기' : res ? '🎤 다시 말하기' : '🎤 말하기'}
            </button>
            <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => setRevealed((p) => ({ ...p, [step]: true }))}>
              👀 정답
            </button>
            <button className="speak-mini" title="모범 발음 듣기" onClick={() => speakText(line.en, 'en-US', rate, undefined, voiceFor(line.sp))}>🔊</button>
          </div>
          {(interim || res) && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>내 발화: {res?.spoken || interim}</div>
          )}
          {res && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 800, color: res.score >= 80 ? 'var(--green)' : res.score >= 50 ? 'var(--yellow)' : 'var(--red)' }}>
                발음 정확도 {res.score}점
              </div>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.7, marginTop: 3 }}>
                {res.diff.map((d, i) => (
                  <span key={i} style={{ color: d.ok ? 'var(--green)' : 'var(--red)', textDecoration: d.ok ? 'none' : 'underline', marginRight: 5 }}>{d.w}</span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      <div style={{ display: 'flex', gap: 8 }}>
        {step > 0 && (
          <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => setStep((s) => s - 1)}>← 이전</button>
        )}
        <button className="btn primary" style={{ flex: 1 }} onClick={() => setStep((s) => s + 1)}>
          {step + 1 >= dialogue.lines.length ? '연습 끝내기' : isMine && !res ? '건너뛰고 다음 →' : '다음 →'}
        </button>
      </div>
    </div>
  );
}

/* ── 3) 암기 체크 (Recall) ── */
function MemorizeMode({ dialogue, lessonId, rate }: { dialogue: Dialogue; lessonId: number; rate: number }) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [remembered, setRemembered] = useState(0);
  const [done, setDone] = useState(false);

  const line = dialogue.lines[idx];

  function grade(ok: boolean) {
    if (!ok) addWeakItem({ en: line.en, kr: line.kr, lesson: lessonId, cat: 'dialogue' });
    else setRemembered((n) => n + 1);
    markPracticedToday();
    if (idx + 1 >= dialogue.lines.length) {
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setShown(false);
    }
  }

  function restart() {
    setIdx(0);
    setShown(false);
    setRemembered(0);
    setDone(false);
  }

  if (done) {
    const total = dialogue.lines.length;
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: '2rem' }}>{remembered === total ? '🏆' : '📚'}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, margin: '4px 0' }}>암기 체크 완료!</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--green)' }}>{remembered} / {total}줄 외웠어요</div>
        <p className="muted" style={{ fontSize: '0.76rem', marginTop: 6 }}>못 외운 줄은 복습 카드에 추가됐어요.</p>
        <button className="btn primary" style={{ width: '100%', marginTop: 12 }} onClick={restart}>다시 외우기</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary-light)' }}>{line.sp}의 대사</span>
        <span className="muted" style={{ fontSize: '0.72rem' }}>{idx + 1} / {dialogue.lines.length}</span>
      </div>

      <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 14px', marginBottom: 10, minHeight: 84 }}>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>아래 한국어를 영어로 말해보세요 👇</div>
        <div style={{ fontSize: '0.92rem', fontWeight: 700, lineHeight: 1.5 }}>{line.kr}</div>
        {shown && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--green)', lineHeight: 1.5 }}>
              {line.en} <button className="speak-mini" title="듣기" onClick={() => speakText(line.en, 'en-US', rate, undefined, voiceFor(line.sp))}>🔊</button>
            </div>
          </div>
        )}
      </div>

      {!shown ? (
        <button className="btn primary" style={{ width: '100%' }} onClick={() => setShown(true)}>👀 정답 확인</button>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ flex: 1, borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => grade(false)}>🔁 다시 (복습)</button>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => grade(true)}>✅ 외웠어요</button>
        </div>
      )}
    </div>
  );
}
