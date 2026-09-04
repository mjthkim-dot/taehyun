'use client';

/**
 * 홈의 첫 카드 — 12주 프로그램의 "오늘".
 *
 * 이 카드가 존재하는 이유: 홈에 좋은 기능이 너무 많아서 매일 무엇을 할지 고르는
 * 일 자체가 부담이었다. 그래서 이 카드는 선택지를 주지 않는다. 오늘 채워야 할
 * 4블록을 순서대로 보여주고, 다음에 할 것 하나를 크게 띄운다. 나머지는 아래에
 * 접혀 있다 — 고르는 게 아니라 따라가는 화면.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import {
  checkOffBlock,
  programNudge,
  programState,
  startProgram,
  syncProgramDay,
  todayPlan,
  TOTAL_DAYS,
  uncheckBlock,
  type TodayPlan,
} from '../lib/program';

const MINUTE_CHOICES = [
  { value: 15, label: '15분', desc: '바쁜 시즌에도 지킬 수 있는 최소선' },
  { value: 25, label: '25분', desc: '권장 — 4블록이 제 분량으로 돕니다' },
  { value: 40, label: '40분', desc: '속도를 내고 싶을 때' },
];

/** 시작 전 — 서약을 받는다. "왜"를 본인 말로 남기는 것이 이 프로그램의 유일한 강제. */
function Pledge({ onStart }: { onStart: () => void }) {
  const [why, setWhy] = useState('');
  const [minutes, setMinutes] = useState(25);
  return (
    <div className="study-card pg-card pg-pledge">
      <div className="pg-kicker">12주 트레이닝 프로그램</div>
      <h2 className="pg-title">기능을 고르는 대신, 프로그램을 따라갑니다</h2>
      <p className="pg-lede">
        하루 4블록(복습 → 패턴 → 발화 → 실전)을 12주간 반복합니다. 주 5일, 총 60일.
        무엇을 할지는 앱이 정하고, <b>하셔야 할 일은 시작 버튼을 누르는 것뿐</b>입니다.
      </p>

      <div className="pg-sec">왜 영어를 제대로 하려고 하시나요?</div>
      <p className="muted pg-hint">
        흔들리는 날 이 문장을 다시 보여드립니다. 남에게 보일 글이 아니니 솔직하게 적으세요.
      </p>
      <textarea
        className="text-input pg-why"
        rows={3}
        placeholder="예) 외국계 세일즈로 옮기고 싶다. 영어 때문에 기회를 놓치는 게 분하다."
        value={why}
        onChange={(e) => setWhy(e.target.value)}
      />

      <div className="pg-sec">하루에 낼 수 있는 시간</div>
      <div className="pg-mins">
        {MINUTE_CHOICES.map((m) => (
          <button
            key={m.value}
            type="button"
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
        {why.trim() ? 'Day 1 시작하기 →' : '먼저 이유를 적어주세요'}
      </button>
      <p className="muted pg-fine">
        약속을 못 지킨 날이 있어도 프로그램은 밀리지 않습니다 — 진도는 날짜가 아니라
        <b> 실제로 훈련을 마친 날</b>로만 셉니다.
      </p>
    </div>
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
    syncProgramDay(); // 4블록이 다 찼으면 조용히 오늘을 훈련일로 확정
    setPlan(todayPlan());
  }, []);

  useEffect(() => {
    refresh();
    // 다른 화면에서 훈련하고 홈으로 돌아오면 즉시 반영되어야 한다
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  if (started === null) return <div className="pg-card" style={{ minHeight: 180 }} aria-hidden="true" />;
  if (!started) return <Pledge onStart={refresh} />;
  if (!plan) return null;

  const nudge = programNudge();
  const next = plan.blocks.find((b) => !b.done);
  const doneCount = plan.blocks.filter((b) => b.done).length;

  return (
    <div className="study-card pg-card">
      <div className="pg-head">
        <div>
          <div className="pg-kicker">
            {plan.phase.n}단계 · {plan.phase.name} <span className="muted">({plan.plan.week}주차)</span>
          </div>
          <div className="pg-day">
            Day {plan.day}
            <span className="muted"> / {TOTAL_DAYS}</span>
            {plan.isCheckpoint && <span className="pg-badge">측정일</span>}
          </div>
        </div>
        <button type="button" className="mini-btn pg-more" onClick={() => onNavigate('program')}>
          로드맵
        </button>
      </div>

      <div className="pg-bar" role="progressbar" aria-valuenow={plan.completed} aria-valuemin={0} aria-valuemax={TOTAL_DAYS}>
        <span style={{ width: `${Math.round((plan.completed / TOTAL_DAYS) * 100)}%` }} />
      </div>
      <div className="pg-focus">🎯 이번 주 — {plan.plan.focus}</div>

      {plan.recorded ? (
        <div className="pg-done">
          <b>오늘 훈련 완료</b>
          <p className="muted">
            Day {plan.day} 채웠습니다. 내일 이 자리에서 Day {Math.min(TOTAL_DAYS, plan.day + 1)}이 열려요.
          </p>
        </div>
      ) : next ? (
        <>
          <button type="button" className="pg-next" onClick={() => onNavigate(next.mode)}>
            <span className="pg-next-label">
              다음 {doneCount > 0 && <em>({doneCount}/4 완료)</em>}
            </span>
            <span className="pg-next-title">{next.title}</span>
            <span className="pg-next-why">{next.why}</span>
            <span className="pg-next-go">
              {next.minutes}분{next.goal ? ` · 목표 ${next.goal}` : ''} · 시작하기 →
            </span>
          </button>
          {next.key === 'output' && (
            <div className="pg-meter">
              오늘 발화 {plan.spoken} / {plan.spokenTarget}문장
              <span className="pg-meter-bar">
                <span style={{ width: `${Math.min(100, Math.round((plan.spoken / plan.spokenTarget) * 100))}%` }} />
              </span>
            </div>
          )}
        </>
      ) : null}

      <button type="button" className="pg-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '오늘 4블록 접기' : `오늘 4블록 보기 (${doneCount}/4)`}
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
                  // 자동으로 잡힌 완료는 되돌리지 않는다 — 사실을 지울 수는 없다
                  if (b.auto) return;
                  b.done ? uncheckBlock(b.key) : checkOffBlock(b.key);
                  refresh();
                }}
                disabled={b.auto}
                title={b.auto ? '학습 기록으로 자동 확인된 항목입니다' : '직접 완료로 표시'}
              >
                {b.done ? '✓' : ''}
              </button>
              <button type="button" className="pg-block-main" onClick={() => onNavigate(b.mode)}>
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

      {nudge && <p className={`pg-nudge ${nudge.tone}`}>{nudge.text}</p>}
    </div>
  );
}
