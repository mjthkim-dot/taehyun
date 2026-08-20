'use client';

/**
 * 면접 시뮬레이션 화면 — 실제 면접의 리듬을 그대로:
 * 준비(역할 선택·이력) → 진행(면접관 음성 질문 → 내 답변(음성/텍스트, 타이머)
 * → 짧은 반응 → 얕은 답엔 즉석 후속 질문) → 리포트(점수·강점·교정·모범 답변).
 *
 * 교정은 va_mistakes로 들어가 돌발 모드·실전 콘텐츠 생성에 재사용되고,
 * 모범 답변은 드릴로 핸드오프한다 — "면접 준비"가 앱의 훈련 루프에 합류한다.
 */
import { useEffect, useRef, useState } from 'react';
import type { Mode } from './NavBar';
import {
  DEFAULT_QUESTIONS,
  deliveryMetrics,
  draftAnswer,
  evaluateInterview,
  generateQuestions,
  GENERIC_GUIDE,
  interviewHistory,
  reactToAnswer,
  ROLE_PRESETS,
  type AnswerGuide,
  type InterviewReport,
  type InterviewStep,
} from '../lib/interview';
import { recordAndTranscribe, whisperAvailable } from '../lib/stt';
import { setDrillQueue, groqKey } from '../lib/state';
import { speakText, stopSpeaking } from './SpeakButton';
import {
  nextWorkatoHrQuestions,
  nextWorkatoQuestions,
  WORKATO_ANSWERS,
  WORKATO_HR_BRIEF,
  WORKATO_HR_ROLE,
  WORKATO_JD_BRIEF,
  WORKATO_ROLE,
} from '../lib/workatoPrep';

type Phase = 'setup' | 'running' | 'evaluating' | 'report';

export default function InterviewScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  // 기본 선택은 임박한 라운드(월요일 HR 미팅) — 끝나면 심층 프리셋으로 바꿔 쓰면 된다
  const [role, setRole] = useState<string>(WORKATO_HR_ROLE);
  const [customRole, setCustomRole] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);
  const [starting, setStarting] = useState(false);
  const [fallbackSet, setFallbackSet] = useState(false);

  const [steps, setSteps] = useState<InterviewStep[]>([]);
  const [idx, setIdx] = useState(0);
  const [awaitingFollowUp, setAwaitingFollowUp] = useState(false);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  // AI 즉석 예시 답변 — 후속 질문·AI 생성 질문처럼 내장 예시가 없을 때
  const [aiSample, setAiSample] = useState<{ en: string; kr: string } | null>(null);
  const [drafting, setDrafting] = useState(false);
  // 답변 직후의 전달력 확인 단계 — 다음/다시 답하기를 사용자가 고른다
  const [pause, setPause] = useState<null | { reaction?: string }>(null);
  const lastDurationRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState('');
  const stopRecRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | null>(null);

  const [report, setReport] = useState<InterviewReport | null>(null);
  const [evalError, setEvalError] = useState('');

  const history = interviewHistory();
  const activeRole = role === '__custom' ? customRole.trim() || '글로벌 포지션' : role;
  const isWorkato = role === WORKATO_ROLE;
  const isWorkatoHr = role === WORKATO_HR_ROLE;
  // JD 문맥 — Workato 프리셋이면 후속 질문·평가가 JD 기준으로 파고든다.
  // HR 라운드는 라운드 성격(TA 파트너·간결·조건 확인)까지 얹는다.
  const jdContext = isWorkatoHr ? WORKATO_HR_BRIEF : isWorkato ? WORKATO_JD_BRIEF : undefined;

  // 답변 타이머 — 실전 면접의 감각(60~90초 권장)을 만든다
  useEffect(() => {
    if (phase !== 'running') return;
    setElapsed(0);
    setShowGuide(false); // 질문이 바뀌면 가이드는 접는다 — 먼저 스스로 생각하게
    setAiSample(null);
    setDrafting(false);
    setPause(null);
    timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [phase, idx, awaitingFollowUp]);

  useEffect(
    () => () => {
      stopRecRef.current?.();
      stopSpeaking();
    },
    []
  );

  function ask(text: string) {
    stopSpeaking();
    speakText(text, 'en-US');
  }

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      // Workato 프리셋은 JD 기반 큐레이션 세트 — AI 생성 없이 즉시, 항상 JD 적중.
      // HR 라운드는 별도 세트(적합성·동기·조건 8문항 로테이션).
      const r = isWorkatoHr
        ? { questions: nextWorkatoHrQuestions(), fallback: false }
        : isWorkato
          ? { questions: nextWorkatoQuestions(), fallback: false }
          : groqKey()
            ? await generateQuestions(activeRole)
            : { questions: DEFAULT_QUESTIONS, fallback: true };
      setFallbackSet(r.fallback);
      setSteps(
        r.questions.map((q) => ({
          q: q.q,
          qKr: q.qKr,
          // 큐레이션 세트(Workato)는 질문별 맞춤 가이드, 그 외엔 최소한 뼈대라도
          guide: (q as { guide?: AnswerGuide }).guide ?? GENERIC_GUIDE,
        }))
      );
      setIdx(0);
      setAwaitingFollowUp(false);
      setDraft('');
      setReport(null);
      setEvalError('');
      setPhase('running');
      ask(r.questions[0].q);
    } finally {
      setStarting(false);
    }
  }

  async function submitAnswer() {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft('');
    setInterim('');
    const cur = steps[idx];

    if (awaitingFollowUp) {
      // 후속 질문에 대한 답 — 기록하고 다음 질문으로
      const next = steps.slice();
      next[idx] = { ...cur, followUpAnswer: text };
      setSteps(next);
      setAwaitingFollowUp(false);
      advance(next);
      return;
    }

    // 전달력 지표 — STT 전사에서 결정적으로(벤치마크: Yoodli의 WPM·필러,
    // Warmup의 talking-points). 텍스트 입력은 WPM 없이 나머지만.
    const metrics = deliveryMetrics(text, lastDurationRef.current);
    lastDurationRef.current = null;

    const next = steps.slice();
    next[idx] = { ...cur, answer: text, metrics };
    setSteps(next);

    if (groqKey()) {
      setThinking(true);
      try {
        const r = await reactToAnswer(activeRole, cur.q, text, jdContext);
        const withReaction = next.slice();
        withReaction[idx] = { ...withReaction[idx], reaction: r.reaction, followUp: r.followUp || undefined };
        setSteps(withReaction);
        if (r.followUp) {
          setAwaitingFollowUp(true);
          ask(`${r.reaction} ${r.followUp}`);
          return;
        }
        ask(r.reaction);
        // 바로 다음으로 넘기지 않는다 — 전달력 미터를 보고 "다시 답하기"를
        // 고를 기회(Warmup의 re-answer 루프). 다음은 사용자가 누른다.
        setPause({ reaction: r.reaction });
      } finally {
        setThinking(false);
      }
    } else {
      setPause({});
    }
  }

  /** 다시 답하기 — 같은 질문을 새로 답한다(이전 답·지표는 버림) */
  function retryAnswer() {
    const next = steps.slice();
    next[idx] = { ...next[idx], answer: undefined, metrics: undefined, reaction: undefined };
    setSteps(next);
    setPause(null);
    setDraft('');
    ask(steps[idx].q);
  }

  function advance(cur: InterviewStep[]) {
    if (idx + 1 < cur.length) {
      const ni = idx + 1;
      setIdx(ni);
      ask(cur[ni].q);
    } else {
      void finish(cur);
    }
  }

  async function finish(finalSteps: InterviewStep[]) {
    stopSpeaking();
    if (!groqKey()) {
      // 키 없이도 연습은 되지만 평가는 AI가 필요하다 — 정직하게 알린다
      setEvalError('평가 리포트는 AI 키가 필요해요 — 기능 → AI 키 등록 후 다시 시도해 주세요. (연습 자체는 완료!)');
      setPhase('report');
      return;
    }
    setPhase('evaluating');
    const r = await evaluateInterview(activeRole, finalSteps, jdContext);
    if (r) {
      setReport(r);
    } else {
      setEvalError('평가 생성에 실패했어요 — 잠시 후 다시 시도해 주세요.');
    }
    setPhase('report');
  }

  async function toggleMic() {
    if (recording) {
      stopRecRef.current?.();
      return;
    }
    setRecording(true);
    try {
      const { text, durationMs } = await recordAndTranscribe({
        onPartial: (t) => setInterim(t),
        // 면접 답변은 길다 — 생각하는 침묵에 끊기지 않게 수동 종료
        silenceMs: 0,
        maxMs: 120000,
        registerStop: (fn) => {
          stopRecRef.current = fn;
        },
      });
      if (text) {
        setDraft((d) => (d ? `${d} ${text}` : text));
        // WPM 계산용 — 이어 말하기(여러 번 녹음)면 합산
        lastDurationRef.current = (lastDurationRef.current || 0) + (durationMs || 0);
      }
    } finally {
      setRecording(false);
      setInterim('');
      stopRecRef.current = null;
    }
  }

  /* ── 화면 ── */

  if (phase === 'setup') {
    return (
      <div className="study-screen">
        <div className="study-card rc-head">
          <div className="rc-head-title">🎤 면접 시뮬레이션</div>
          <p className="muted rc-method">
            AI 면접관이 직무 맞춤 질문 5개를 던지고, 얕은 답에는 <b>즉석 후속 질문</b>으로 파고듭니다. 끝나면
            점수·교정·모범 답변 리포트를 받아요. 교정은 복습 루프로, 모범 답변은 드릴로 이어집니다.
          </p>
          {history.length > 0 && (
            <div className="iv-history">
              {history.slice(-5).map((h, i) => (
                <span key={i} className="rc-cust-chip" title={h.role}>
                  {h.date.slice(5, 10)} · {h.score}점
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="study-card">
          <div className="pp-sec" style={{ marginTop: 0 }}>지원 직무</div>
          <button type="button" className={`iv-role${isWorkatoHr ? ' on' : ''}`} onClick={() => setRole(WORKATO_HR_ROLE)}>
            {WORKATO_HR_ROLE} <span className="mn-badge-new">월요일 미팅</span>
            <span className="iv-role-sub">TA 파트너와 30~45분 — 동기·이직 사유·연봉·노티스·역질문 8문항</span>
          </button>
          <button type="button" className={`iv-role${isWorkato ? ' on' : ''}`} onClick={() => setRole(WORKATO_ROLE)}>
            {WORKATO_ROLE} <span className="mn-badge-new">내 지원 포지션</span>
            <span className="iv-role-sub">심층 라운드용 — JD 기반 질문 10개 로테이션 · 핵심 답변 카드 9장</span>
          </button>
          {ROLE_PRESETS.map((r) => (
            <button key={r} type="button" className={`iv-role${role === r ? ' on' : ''}`} onClick={() => setRole(r)}>
              {r}
            </button>
          ))}
          <button type="button" className={`iv-role${role === '__custom' ? ' on' : ''}`} onClick={() => setRole('__custom')}>
            직접 입력
          </button>
          {role === '__custom' && (
            <input
              className="text-input"
              style={{ marginTop: 8 }}
              placeholder="예: 외국계 보험사 B2B 세일즈 매니저"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
            />
          )}
          <button type="button" className="start-drill-btn" style={{ marginTop: 14 }} disabled={starting} onClick={() => void start()}>
            {starting ? '질문 준비 중…' : '🎬 면접 시작'}
          </button>
          <p className="muted" style={{ fontSize: '0.72rem', marginTop: 8, lineHeight: 1.6 }}>
            답변은 마이크(권장) 또는 입력창으로. 한 답변은 60~90초를 목표로 해보세요.
          </p>
        </div>

        {isWorkato && (
          <div className="study-card">
            <button type="button" className="iv-answers-toggle" onClick={() => setShowAnswers((v) => !v)}>
              📌 핵심 답변 카드 {showAnswers ? '접기 ▲' : `펼치기 (${WORKATO_ANSWERS.length}장) ▼`}
            </button>
            {showAnswers && (
              <>
                <p className="muted" style={{ fontSize: '0.74rem', lineHeight: 1.6, margin: '8px 0 10px' }}>
                  GitLab 최종 면접에서 검증된 서사를 Workato JD에 맞게 옮긴 답변들이에요. 시뮬레이션 전에 소리
                  내어 읽고, 드릴로 입에 붙이세요.
                </p>
                {WORKATO_ANSWERS.map((a, i) => (
                  <div className="pp-sent" key={i}>
                    <div className="iv-model-q">{a.topic}</div>
                    <div className="pp-sent-en">
                      {a.en}
                      <button type="button" className="speak-mini" aria-label="듣기" onClick={() => speakText(a.en, 'en-US')}>
                        🔊
                      </button>
                    </div>
                    <div className="pp-sent-kr">{a.kr}</div>
                  </div>
                ))}
                <button
                  type="button"
                  className="start-drill-btn"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    setDrillQueue({
                      label: '면접 핵심 답변 — Workato EAE',
                      items: WORKATO_ANSWERS.map((a) => ({ en: a.en, kr: a.kr })),
                    });
                    onNavigate('drill');
                  }}
                >
                  🎤 핵심 답변으로 드릴 →
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  if (phase === 'evaluating') {
    return (
      <div className="study-screen">
        <div className="study-card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: '2rem', marginBottom: 10 }}>📝</div>
          <b>면접관이 평가를 작성하고 있어요…</b>
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>점수·교정·모범 답변을 정리하는 중</p>
        </div>
      </div>
    );
  }

  if (phase === 'report') {
    return (
      <div className="study-screen">
        {evalError && <p className="muted pp-msg">{evalError}</p>}
        {report && (
          <>
            <div className="study-card rc-head" style={{ textAlign: 'center' }}>
              <div className="iv-score">{report.score}</div>
              <div className="muted" style={{ fontSize: '0.72rem', fontWeight: 800 }}>/ 100</div>
              <p style={{ fontSize: '0.84rem', lineHeight: 1.7, marginTop: 10 }}>{report.summary}</p>
            </div>

            {report.strengths.length > 0 && (
              <div className="study-card">
                <div className="pp-sec" style={{ marginTop: 0 }}>💪 잘한 점</div>
                <ul className="pp-list">{report.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}

            {/* 전달력 종합 — 클라이언트 계산(벤치마크: Yoodli 스타일 딜리버리 리포트) */}
            {(() => {
              const ms = steps.map((s) => s.metrics).filter((m): m is NonNullable<typeof m> => !!m);
              if (!ms.length) return null;
              const avgWords = Math.round(ms.reduce((a, m) => a + m.words, 0) / ms.length);
              const wpms = ms.map((m) => m.wpm).filter((w): w is number => w !== null);
              const avgWpm = wpms.length ? Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length) : null;
              const fillers = ms.reduce((a, m) => a + m.fillerCount, 0);
              const points = ms.reduce((a, m) => a + (m.hasNumber ? 1 : 0) + (m.hasOwnership ? 1 : 0) + (m.hasResult ? 1 : 0), 0);
              const tips: string[] = [];
              if (avgWpm !== null && avgWpm < 100) tips.push('말 속도가 느린 편이에요 — 문장을 짧게 끊으면 속도가 붙습니다.');
              if (avgWpm !== null && avgWpm > 160) tips.push('조금 빠릅니다 — 핵심 숫자 앞에서 반 박자 쉬어보세요.');
              if (fillers > ms.length * 2) tips.push('필러가 잦아요 — "um" 대신 조용한 1초 멈춤이 더 프로답게 들립니다.');
              if (points < ms.length * 2) tips.push('답변마다 숫자·내 역할·결과 중 2개 이상을 넣는 걸 목표로.');
              if (!tips.length) tips.push('전달력이 안정적이에요 — 이 리듬을 유지하세요.');
              return (
                <div className="study-card">
                  <div className="pp-sec" style={{ marginTop: 0 }}>🎙 전달력 종합</div>
                  <div className="iv-meter-row">
                    <span className="iv-meter">평균 {avgWords}단어</span>
                    {avgWpm !== null && <span className="iv-meter">평균 {avgWpm} WPM</span>}
                    <span className={`iv-meter${fillers > ms.length * 2 ? ' warn' : ''}`}>필러 총 {fillers}회</span>
                    <span className="iv-meter">포인트 {points}/{ms.length * 3}</span>
                  </div>
                  <ul className="pp-list" style={{ marginTop: 8 }}>{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              );
            })()}

            {report.improvements.length > 0 && (
              <div className="study-card">
                <div className="pp-sec" style={{ marginTop: 0 }}>🔧 교정 (복습 루프에 등록됨)</div>
                {report.improvements.map((m, i) => (
                  <div className="pp-sent" key={i}>
                    <div className="iv-wrong">{m.wrong}</div>
                    <div className="pp-sent-en">→ {m.right}</div>
                    <div className="pp-sent-kr">{m.note}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="study-card">
              <div className="pp-sec" style={{ marginTop: 0 }}>⭐ 모범 답변</div>
              {report.modelAnswers.map((m, i) => (
                <div className="pp-sent" key={i}>
                  {m.q && <div className="iv-model-q">{m.q}</div>}
                  <div className="pp-sent-en">{m.en}</div>
                  <div className="pp-sent-kr">{m.kr}</div>
                </div>
              ))}
              <button
                type="button"
                className="start-drill-btn"
                style={{ marginTop: 10 }}
                onClick={() => {
                  setDrillQueue({
                    label: `면접 모범 답변 — ${activeRole}`,
                    items: report.modelAnswers.map((m) => ({ en: m.en, kr: m.kr })),
                  });
                  onNavigate('drill');
                }}
              >
                🎤 모범 답변으로 드릴 →
              </button>
            </div>
          </>
        )}
        <button type="button" className="btn primary" style={{ width: '100%', marginTop: 4 }} onClick={() => setPhase('setup')}>
          새 면접 보기
        </button>
      </div>
    );
  }

  // running
  const cur = steps[idx];
  const question = awaitingFollowUp && cur.followUp ? cur.followUp : cur.q;
  return (
    <div className="study-screen">
      <div className="iv-progress">
        질문 {idx + 1}/{steps.length}
        {awaitingFollowUp && <span className="mn-badge-new" style={{ marginLeft: 6 }}>후속</span>}
        {fallbackSet && <span className="muted" style={{ marginLeft: 8, fontSize: '0.68rem' }}>기본 질문 세트</span>}
        <span className={`iv-timer${elapsed > 90 ? ' over' : ''}`}>⏱ {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
      </div>

      <div className="study-card iv-q-card">
        <div className="iv-q-label">👔 면접관</div>
        <div className="iv-q">
          {question}
          <button type="button" className="mini-btn" style={{ marginLeft: 8 }} onClick={() => ask(question)}>
            🔊 다시 듣기
          </button>
        </div>
        {!awaitingFollowUp && cur.qKr && <div className="pp-sent-kr" style={{ marginTop: 6 }}>{cur.qKr}</div>}
        {awaitingFollowUp && cur.reaction && <div className="iv-reaction">{cur.reaction}</div>}

        {/* 답변 가이드 — 본체는 "그대로 소리 내어 읽을 수 있는 영어 답변".
            내장 예시가 없는 질문(후속·AI 생성)은 버튼 한 번으로 내 커리어
            사실 기반 영어 답변을 즉석 생성한다("어떻게 답할지 모르겠어" 탈출구). */}
        <button type="button" className="iv-guide-toggle" onClick={() => setShowGuide((v) => !v)}>
          💡 영어로 어떻게 말하지? {showGuide ? '접기 ▲' : '보기 ▼'}
        </button>
        {showGuide && (
          <div className="iv-guide">
            {(() => {
              const sample = !awaitingFollowUp && cur.guide?.sample ? cur.guide.sample : aiSample;
              if (sample) {
                return (
                  <>
                    <div className="iv-guide-sec">🗣 이렇게 말해보세요</div>
                    <div className="iv-sample-en">
                      {sample.en}
                      <button type="button" className="mini-btn" style={{ marginLeft: 6 }} onClick={() => ask(sample.en)}>
                        🔊
                      </button>
                    </div>
                    <div className="iv-sample-kr">{sample.kr}</div>
                    <button type="button" className="mini-btn" style={{ marginTop: 8 }} onClick={() => setDraft(sample.en)}>
                      ✍️ 답변란에 넣고 고쳐 쓰기
                    </button>
                  </>
                );
              }
              return (
                <button
                  type="button"
                  className="start-drill-btn iv-draft-btn"
                  disabled={drafting}
                  onClick={async () => {
                    if (drafting) return;
                    setDrafting(true);
                    try {
                      const q = awaitingFollowUp && cur.followUp ? cur.followUp : cur.q;
                      const r = await draftAnswer(activeRole, q, { context: jdContext, previousAnswer: cur.answer });
                      if (r) setAiSample(r);
                    } finally {
                      setDrafting(false);
                    }
                  }}
                >
                  {drafting ? '내 경력으로 답변 쓰는 중…' : '✨ 내 경력으로 영어 답변 만들어줘'}
                </button>
              );
            })()}
            {!awaitingFollowUp && cur.guide && (
              <>
                <div className="iv-guide-sec">뼈대</div>
                <ol className="iv-guide-list">
                  {cur.guide.structure.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </div>

      {thinking ? (
        <p className="muted pp-msg">면접관이 답변을 듣고 있어요…</p>
      ) : pause ? (
        /* 전달력 체크포인트 — 답변 직후 미터를 보고 다시 답하거나 다음으로 */
        <div className="study-card">
          <div className="pp-sec" style={{ marginTop: 0 }}>🎙 방금 답변의 전달력</div>
          {(() => {
            const m = steps[idx].metrics;
            if (!m) return null;
            return (
              <>
                <div className="iv-meter-row">
                  <span className="iv-meter">
                    단어 {m.words}
                    {m.words < 30 ? ' · 짧아요' : m.words > 160 ? ' · 길어요' : ' ✓'}
                  </span>
                  {m.wpm !== null && (
                    <span className={`iv-meter${m.wpm >= 100 && m.wpm <= 160 ? '' : ' warn'}`}>
                      속도 {m.wpm} WPM{m.wpm < 100 ? ' · 더 자신 있게' : m.wpm > 160 ? ' · 천천히' : ' ✓'}
                    </span>
                  )}
                  <span className={`iv-meter${m.fillerCount > 3 ? ' warn' : ''}`}>
                    필러 {m.fillerCount}회{m.fillers.length ? ` (${m.fillers.slice(0, 3).join(', ')})` : ''}
                  </span>
                </div>
                <div className="iv-meter-row">
                  <span className={`iv-point${m.hasNumber ? ' on' : ''}`}>숫자 {m.hasNumber ? '✓' : '✗'}</span>
                  <span className={`iv-point${m.hasOwnership ? ' on' : ''}`}>내 역할 {m.hasOwnership ? '✓' : '✗'}</span>
                  <span className={`iv-point${m.hasResult ? ' on' : ''}`}>결과 {m.hasResult ? '✓' : '✗'}</span>
                </div>
              </>
            );
          })()}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn" style={{ flex: 1 }} onClick={retryAnswer}>
              ↺ 다시 답하기
            </button>
            <button type="button" className="btn primary" style={{ flex: 1 }} onClick={() => { setPause(null); advance(steps); }}>
              다음 질문 →
            </button>
          </div>
        </div>
      ) : (
        <div className="study-card">
          <textarea
            className="text-input iv-answer"
            rows={4}
            placeholder={recording ? '듣고 있어요 — 말씀하세요…' : '영어로 답변하세요 (마이크 권장)'}
            value={recording && interim ? `${draft} ${interim}`.trim() : draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={recording}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {whisperAvailable() && (
              <button type="button" className={`btn${recording ? ' primary' : ''}`} style={{ flex: 1 }} onClick={() => void toggleMic()}>
                {recording ? '⏹ 답변 끝내기' : '🎙 말로 답변'}
              </button>
            )}
            <button type="button" className="btn primary" style={{ flex: 1 }} disabled={!draft.trim() || recording} onClick={() => void submitAnswer()}>
              답변 제출 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
