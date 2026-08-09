'use client';

/**
 * 2분 피치 훈련 — 이 앱에 없던 '긴 발화' 층.
 *
 * 훈련은 전부 문장 단위(드릴·쉐도잉)나 한 턴(회화·역할연습)이었다. 그런데 영업에서
 * 실제로 무너지는 지점은 "솔루션을 2분만 설명해 주시겠어요?"다. 문장 100개를 정확히
 * 말해도 2분을 혼자 끌고 가지 못하면 미팅에서는 진다.
 *
 * 흐름은 실제 상황을 그대로 옮겼다: 주제를 받고 → 30초 동안 머리에 뼈대를 세우고 →
 * 멈추지 않고 말한다. 준비 시간을 강제하는 이유는, 준비 없이 말하면 매번 같은
 * 지점에서 막히고 그걸 실력이라고 착각하게 되기 때문이다.
 *
 * 지표(시간·속도·채움말·멈춤)는 기기에서 계산해 키가 없어도 나오고, 구조 판단과
 * 코칭만 AI에 맡긴다.
 */
import { useEffect, useRef, useState } from 'react';
import {
  PITCH_TOPICS,
  analyzePitch,
  buildCoachMessages,
  lastRunFor,
  parseCoach,
  readMetrics,
  savePitchRun,
  type PitchCoach,
  type PitchMetrics,
  type PitchTopic,
} from '../lib/pitch';
import { recordAndTranscribe, whisperAvailable } from '../lib/stt';
import { groqKoJson } from '../lib/aiGuard';
import { addPhrase, bumpSpoken, groqKey, markPracticedToday } from '../lib/state';
import SpeakButton from './SpeakButton';
import type { Mode } from './NavBar';

type Stage = 'pick' | 'prep' | 'speak' | 'result';

/** 준비 시간 — 짧아야 '머리에 뼈대만 세우는' 연습이 된다 */
const PREP_SEC = 30;
/** 목표 발화 시간 */
const TARGET_SEC = 120;
/** 녹음 상한 — 목표보다 넉넉히 두되 요금·용량은 보호한다 */
const MAX_MS = 180_000;

export default function PitchScreen({ onNavigate }: { onNavigate?: (m: Mode) => void } = {}) {
  const [stage, setStage] = useState<Stage>('pick');
  const [topic, setTopic] = useState<PitchTopic>(PITCH_TOPICS[0]);
  const [prepLeft, setPrepLeft] = useState(PREP_SEC);
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState('');
  const [transcribing, setTranscribing] = useState(false);

  const [transcript, setTranscript] = useState('');
  const [metrics, setMetrics] = useState<PitchMetrics | null>(null);
  const [coach, setCoach] = useState<PitchCoach | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [err, setErr] = useState('');
  const [prev, setPrev] = useState<{ covered: number | null; total: number; wpm: number } | null>(null);

  const stopRef = useRef<(() => void) | null>(null);
  const hasKey = groqKey();

  /* 준비 카운트다운 — 끝나면 자동으로 말하기로 넘어간다(실제 상황처럼) */
  useEffect(() => {
    if (stage !== 'prep') return;
    if (prepLeft <= 0) {
      startSpeaking();
      return;
    }
    const t = window.setTimeout(() => setPrepLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, prepLeft]);

  useEffect(() => () => stopRef.current?.(), []);

  function pick(t: PitchTopic) {
    setTopic(t);
    const last = lastRunFor(t.key);
    setPrev(last ? { covered: last.covered, total: last.total, wpm: last.metrics.wpm } : null);
    setPrepLeft(PREP_SEC);
    setTranscript('');
    setMetrics(null);
    setCoach(null);
    setErr('');
    setStage('prep');
  }

  async function startSpeaking() {
    setStage('speak');
    setElapsed(0);
    setLive('');
    setErr('');
    try {
      const res = await recordAndTranscribe({
        // 긴 발화에서는 생각하느라 2~3초 쉬는 것이 정상이다 — 자동 종료를 끄고
        // 사용자가 직접 멈춘다. 안 그러면 문장 중간에 끊긴다.
        silenceMs: 0,
        maxMs: MAX_MS,
        onElapsed: (ms) => setElapsed(Math.floor(ms / 1000)),
        onState: (st) => setTranscribing(st === 'transcribing'),
        onPartial: (t) => setLive(t),
        registerStop: (fn) => {
          stopRef.current = fn;
        },
      });
      stopRef.current = null;
      setTranscribing(false);

      if (!res.text) {
        setErr(
          res.reason === 'empty-result'
            ? '말소리는 잡혔는데 인식하지 못했어요. 조금 더 또렷하게 다시 시도해 주세요.'
            : '마이크에서 소리가 잡히지 않았어요. 권한과 음소거를 확인해 주세요.'
        );
        setStage('prep');
        setPrepLeft(PREP_SEC);
        return;
      }

      const m = analyzePitch(res.text, res.durationMs ?? 0, res.pauses ?? []);
      setTranscript(res.text);
      setMetrics(m);
      setStage('result');
      bumpSpoken();
      markPracticedToday();
      if (hasKey) void runCoach(res.text, m);
      // 코칭 없는 회차는 covered를 비워 둔다 — 0으로 저장하면 가짜 퇴보 추세가 된다
      else savePitchRun({ id: `p-${Date.now()}`, date: new Date().toISOString().slice(0, 10), topicKey: topic.key, topicLabel: topic.label, transcript: res.text, metrics: m, covered: null, total: topic.outline.length });
    } catch (e) {
      stopRef.current = null;
      setTranscribing(false);
      const msg = (e as Error)?.message || '';
      setErr(/NotAllowed|Permission/i.test(msg) ? '마이크 권한이 거부됐어요 — 브라우저 설정에서 허용해 주세요.' : '녹음을 시작하지 못했어요.');
      setStage('prep');
      setPrepLeft(PREP_SEC);
    }
  }

  async function runCoach(text: string, m: PitchMetrics) {
    setCoachBusy(true);
    try {
      // 한국어 코칭이 영어로 오거나 구조가 없으면 parseCoach가 null — 1회 재요청
      const c = await groqKoJson(
        buildCoachMessages(topic, text, m),
        { temperature: 0.4, maxTokens: 1200 },
        (data) => parseCoach(data, topic)
      );
      if (!c) throw new Error('COACH_INVALID');
      setCoach(c);
      savePitchRun({
        id: `p-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        topicKey: topic.key,
        topicLabel: topic.label,
        transcript: text,
        metrics: m,
        covered: c.structure.filter((s) => s.ok).length,
        total: c.structure.length,
      });
    } catch {
      // 코칭이 실패해도 지표는 이미 화면에 있다 — 여기서 무너뜨리지 않는다.
      // covered는 비워 둔다: 실패를 "구조 0칸"으로 저장하면 다음 회차에 가짜 퇴보로 보인다.
      setErr('AI 코칭을 받지 못했어요. 아래 지표는 그대로 유효합니다.');
      savePitchRun({ id: `p-${Date.now()}`, date: new Date().toISOString().slice(0, 10), topicKey: topic.key, topicLabel: topic.label, transcript: text, metrics: m, covered: null, total: topic.outline.length });
    } finally {
      setCoachBusy(false);
    }
  }

  const micOk = whisperAvailable();

  /* ── 주제 고르기 ── */
  if (stage === 'pick') {
    return (
      <div className="study-screen">
        <div className="study-card">
          <h3>2분 피치 훈련</h3>
          <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.65, marginBottom: 12 }}>
            문장은 맞는데 <b>2분을 못 버티는</b> 지점을 훈련합니다. 주제를 고르면 30초 동안
            뼈대를 세우고, 멈추지 않고 말합니다. 끝나면 시간·속도·채움말·멈춤과 구조 충족
            여부를 돌려드립니다.
          </p>
          {!micOk && <p className="warn">이 브라우저에서는 녹음을 쓸 수 없어요. Chrome/Safari 최신 버전을 권장합니다.</p>}
          <div className="pt-topics">
            {PITCH_TOPICS.map((t) => (
              <button className="pt-topic" key={t.key} onClick={() => pick(t)} disabled={!micOk}>
                <div className="pt-topic-label">{t.label}</div>
                <div className="pt-topic-brief">{t.brief}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── 30초 준비 ── */
  if (stage === 'prep') {
    return (
      <div className="study-screen">
        <div className="study-card">
          <button className="btn ghost mt-back" onClick={() => setStage('pick')}>
            ← 주제 바꾸기
          </button>
          <h3>{topic.label}</h3>
          <div className="pt-brief">{topic.brief}</div>

          <div className="pt-countdown" aria-live="polite">
            {prepLeft}
            <span>초 뒤 시작</span>
          </div>

          <div className="mt-sec">이 뼈대로 구성하세요</div>
          <ol className="pt-outline">
            {topic.outline.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ol>

          {prev && (
            <div className="pt-prev">
              지난번: {prev.covered != null ? `구조 ${prev.covered}/${prev.total} 칸 · ` : ''}분당 {prev.wpm}단어
            </div>
          )}
          {err && <p className="warn">{err}</p>}

          <button className="btn primary" style={{ width: '100%', marginTop: 12 }} onClick={startSpeaking}>
            준비됐어요 — 바로 시작
          </button>
        </div>
      </div>
    );
  }

  /* ── 말하기 ── */
  if (stage === 'speak') {
    const over = elapsed > TARGET_SEC;
    return (
      <div className="study-screen">
        <div className="study-card">
          <h3>{topic.label}</h3>
          <div className={`pt-timer${over ? ' over' : ''}`} aria-live="off">
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
            <span> / 목표 02:00</span>
          </div>
          <div className="pt-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (elapsed / TARGET_SEC) * 100)}%` }} />
          </div>

          <ol className="pt-outline compact">
            {topic.outline.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ol>

          {/* 말하는 동안 글자가 보여야 한다 — 침묵하면 인식이 죽은 것처럼 보인다 */}
          <div className="transcript live">
            <span className="label">{transcribing ? '인식 중' : '듣는 중'}</span>
            <p>{live || (transcribing ? '방금 말한 내용을 옮기는 중…' : '말씀하세요…')}</p>
          </div>

          <button
            className="btn primary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => stopRef.current?.()}
            disabled={transcribing}
          >
            {transcribing ? '분석 중…' : '말하기 끝내기'}
          </button>
        </div>
      </div>
    );
  }

  /* ── 결과 ── */
  const m = metrics;
  if (!m) return null;
  const notes = readMetrics(m);
  return (
    <div className="study-screen">
      <div className="study-card">
        <button className="btn ghost mt-back" onClick={() => setStage('pick')}>
          ← 주제 목록
        </button>
        <h3>{topic.label}</h3>

        <div className="pt-metrics">
          <div className="pt-metric">
            <b>
              {Math.floor(m.seconds / 60)}:{String(m.seconds % 60).padStart(2, '0')}
            </b>
            <span>말한 시간</span>
          </div>
          <div className="pt-metric">
            <b>{m.wpm}</b>
            <span>분당 단어</span>
          </div>
          <div className="pt-metric">
            <b>{m.fillers}</b>
            <span>채움말</span>
          </div>
          <div className="pt-metric">
            <b>{m.longPauses}</b>
            <span>3초+ 멈춤</span>
          </div>
        </div>

        <div className="mt-sec">지표 읽기</div>
        {notes.map((n) => (
          <div className="pt-note" key={n}>
            {n}
          </div>
        ))}

        {coachBusy && <div className="pt-note">구조와 내용을 살펴보는 중…</div>}

        {coach && (
          <>
            <div className="mt-sec">
              구조 — {coach.structure.filter((s) => s.ok).length}/{coach.structure.length}칸
              {prev && prev.covered != null && ` (지난번 ${prev.covered}/${prev.total})`}
            </div>
            {coach.structure.map((s) => (
              <div className={`pt-struct${s.ok ? ' ok' : ''}`} key={s.label}>
                <span className="pt-struct-mark">{s.ok ? '✓' : '·'}</span>
                <div>
                  <div className="pt-struct-label">{s.label}</div>
                  {s.note && <div className="pt-struct-note">{s.note}</div>}
                </div>
              </div>
            ))}

            {coach.strengths.length > 0 && (
              <>
                <div className="mt-sec">잘한 것</div>
                {coach.strengths.map((x) => (
                  <div className="pt-note" key={x}>
                    {x}
                  </div>
                ))}
              </>
            )}

            {coach.fixes.length > 0 && (
              <>
                <div className="mt-sec">다음에 고칠 것</div>
                {coach.fixes.map((x) => (
                  <div className="pt-note" key={x}>
                    {x}
                  </div>
                ))}
              </>
            )}

            {coach.betterOpening && (
              <>
                <div className="mt-sec">이렇게 열었다면</div>
                <div className="mt-headline">
                  {coach.betterOpening} <SpeakButton text={coach.betterOpening} />
                </div>
                <button
                  className="btn ghost-accent"
                  style={{ width: '100%', marginTop: 10 }}
                  onClick={() => addPhrase({ en: coach.betterOpening, kr: `${topic.label} 오프닝`, lesson: `pitch:${topic.key}` })}
                >
                  이 오프닝을 표현장에 저장
                </button>
              </>
            )}
          </>
        )}

        {err && <p className="warn">{err}</p>}

        <div className="mt-sec">내가 말한 내용</div>
        <div className="pt-transcript">{transcript}</div>

        <div className="mt-actions">
          <button className="btn primary" onClick={() => pick(topic)}>
            같은 주제로 다시
          </button>
          <button className="btn ghost-accent" onClick={() => setStage('pick')}>
            다른 주제 고르기
          </button>
        </div>
      </div>
    </div>
  );
}
