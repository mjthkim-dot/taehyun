'use client';

/**
 * 오늘의 레슨 — 홈의 중심 카드.
 *
 * Speak·Ringle처럼 학습을 "코스 › 유닛 › 레슨"으로 보여준다. 12주 프로그램의 주차가
 * 유닛, 그 주의 훈련일이 레슨이다. 오늘 할 4단계(복습 → 핵심 표현 → 말하기 → 실전)를
 * 한 줄 스텝으로 보여주고, 누를 버튼은 하나만 둔다. 설명 문구는 최소화한다.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import {
  checkOffBlock,
  DAYS_PER_WEEK,
  programNudge,
  programState,
  startProgram,
  syncProgramDay,
  todayPlan,
  TOTAL_DAYS,
  TOTAL_WEEKS,
  uncheckBlock,
  type TodayBlock,
  type TodayPlan,
} from '../lib/program';
import { setUnitHandoff } from '../lib/ontology/handoff';

const MINUTE_CHOICES = [
  { value: 15, label: '15분', desc: '가볍게' },
  { value: 25, label: '25분', desc: '권장' },
  { value: 40, label: '40분', desc: '집중' },
];

/** 시작 전 — 하루 시간과 목표 한 줄만 받는다 */
function StartCourse({ onStart }: { onStart: () => void }) {
  const [why, setWhy] = useState('');
  const [minutes, setMinutes] = useState(25);
  return (
    <section className="study-card pg-card pg-pledge" aria-label="12주 코스 시작">
      <div className="pg-kicker">12주 코스</div>
      <h2 className="pg-title">매일 한 레슨, 12주 완성</h2>
      <p className="pg-lede">복습 → 핵심 표현 → 말하기 → 실전. 레슨 순서는 앱이 정합니다.</p>

      <label className="pg-sec" htmlFor="pg-why">
        목표 한 줄
      </label>
      <textarea
        id="pg-why"
        className="text-input pg-why"
        rows={2}
        placeholder="예) 외국계 세일즈로 이직하기"
        value={why}
        onChange={(e) => setWhy(e.target.value)}
      />

      <div className="pg-sec">하루 학습 시간</div>
      <div className="pg-mins" role="radiogroup">
        {MINUTE_CHOICES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={minutes === m.value}
            className={`pg-min${minutes === m.value ? ' on' : ''}`}
            onClick={() => setMinutes(m.value)}
          >
            <b>{m.label}</b>
            <span>{m.desc}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn primary pg-start"
        disabled={!why.trim()}
        onClick={() => {
          startProgram({ why, minutes });
          onStart();
        }}
      >
        코스 시작하기
      </button>
    </section>
  );
}

export default function ProgramCard({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [started, setStarted] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => {
    const s = programState();
    setStarted(!!s);
    if (!s) return;
    syncProgramDay();
    setPlan(todayPlan());
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  if (started === null) return <div className="pg-card" style={{ minHeight: 180 }} aria-hidden="true" />;
  if (!started) return <StartCourse onStart={refresh} />;
  if (!plan) return null;

  const nudge = programNudge();
  const next = plan.blocks.find((b) => !b.done);
  const doneCount = plan.blocks.filter((b) => b.done).length;
  const totalMin = plan.blocks.reduce((a, b) => a + b.minutes, 0);
  const go = (b: TodayBlock) => {
    if (b.unitRef) setUnitHandoff(b.unitRef);
    onNavigate(b.mode);
  };

  return (
    <section className="study-card pg-card" data-tilt aria-label="오늘의 레슨">
      <div className="pg-head">
        <div>
          <div className="pg-kicker">
            Unit {plan.week}/{TOTAL_WEEKS} · Lesson {plan.dayInWeek}/{DAYS_PER_WEEK}
            {plan.isCheckpoint && <span className="pg-badge">측정일</span>}
          </div>
          <h2 className="pg-lesson-title">{plan.plan.focus}</h2>
          <div className="pg-meta">
            {plan.phase.n}단계 {plan.phase.name} · 약 {totalMin}분 · Day {plan.day}/{TOTAL_DAYS}
          </div>
        </div>
        <button type="button" className="mini-btn pg-more" onClick={() => onNavigate('program')} aria-label="코스 전체 보기">
          코스
        </button>
      </div>

      {/* 오늘의 4단계 — 한눈에 보이는 스텝 */}
      <ol className="pg-steps" aria-label={`오늘 ${doneCount}/4 완료`}>
        {plan.blocks.map((b, i) => (
          <li key={b.key} className={`pg-step${b.done ? ' done' : ''}${next?.key === b.key ? ' now' : ''}`}>
            <span className="pg-step-dot">{b.done ? '✓' : i + 1}</span>
            <span className="pg-step-name">{b.key === 'field' ? '실전' : b.title}</span>
          </li>
        ))}
      </ol>

      {plan.recorded ? (
        <div className="pg-done">
          <b>오늘 레슨 완료</b>
          <p className="muted">내일 Lesson {plan.dayInWeek === DAYS_PER_WEEK ? 1 : plan.dayInWeek + 1}이 열립니다.</p>
        </div>
      ) : next ? (
        <>
          <button type="button" className="pg-next" onClick={() => go(next)}>
            <span className="pg-next-label">{doneCount === 0 ? '레슨 시작' : `이어서 · ${doneCount}/4`}</span>
            <span className="pg-next-title">{next.title}</span>
            <span className="pg-next-why">{next.why}</span>
            <span className="pg-next-go">
              {next.minutes}분{next.goal ? ` · ${next.goal}` : ''} →
            </span>
          </button>
          {next.key === 'output' && (
            <div className="pg-meter">
              오늘 {plan.spoken}/{plan.spokenTarget}문장
              <span className="pg-meter-bar">
                <span style={{ width: `${Math.min(100, Math.round((plan.spoken / plan.spokenTarget) * 100))}%` }} />
              </span>
            </div>
          )}
        </>
      ) : null}

      <button type="button" className="pg-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? '단계 접기' : '단계별 보기'}
      </button>

      {open && (
        <ul className="pg-blocks">
          {plan.blocks.map((b) => (
            <li key={b.key} className={`pg-block${b.done ? ' done' : ''}`}>
              <button
                type="button"
                className="pg-check"
                aria-label={b.done ? `${b.title} 완료 해제` : `${b.title} 완료로 표시`}
                onClick={() => {
                  if (b.auto) return;
                  b.done ? uncheckBlock(b.key) : checkOffBlock(b.key);
                  refresh();
                }}
                disabled={b.auto}
                title={b.auto ? '학습 기록으로 자동 확인됨' : '직접 완료로 표시'}
              >
                {b.done ? '✓' : ''}
              </button>
              <button type="button" className="pg-block-main" onClick={() => go(b)}>
                <span className="pg-block-title">
                  {b.title} <em className="muted">{b.minutes}분</em>
                  {b.auto && <span className="pg-auto">자동 확인</span>}
                </span>
                <span className="pg-block-why">{b.why}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {nudge && nudge.tone === 'back' && <p className="pg-nudge back">{nudge.text}</p>}
    </section>
  );
}
