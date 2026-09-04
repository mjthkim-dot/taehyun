'use client';

/**
 * 프로그램 화면 — 12주 전체 지도.
 *
 * 홈 카드가 "오늘"이라면 이 화면은 "여정"이다. 지금 어디쯤 왔는지, 앞으로 무엇이
 * 기다리는지, 그리고 왜 시작했는지를 한 화면에서 본다. 학습이 흔들리는 순간은
 * 대개 오늘이 힘들어서가 아니라 이게 어디로 가는지 안 보일 때다.
 */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import {
  DAYS_PER_WEEK,
  PHASES,
  PROGRAM_WEEKS,
  programStats,
  programState,
  resetProgram,
  todayPlan,
  TOTAL_DAYS,
  updatePledge,
  type ProgramStats,
  type ProgramState,
  type TodayPlan,
} from '../lib/program';

export default function ProgramScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [s, setS] = useState<ProgramState | null>(null);
  const [stats, setStats] = useState<ProgramStats | null>(null);
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [editing, setEditing] = useState(false);
  const [why, setWhy] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  function refresh() {
    const st = programState();
    setS(st);
    setStats(programStats());
    setPlan(todayPlan());
    setWhy(st?.why || '');
  }
  useEffect(refresh, []);

  if (!s || !stats || !plan) {
    return (
      <div className="screen">
        <div className="study-card">
          <p className="muted">아직 프로그램을 시작하지 않았습니다.</p>
          <button type="button" className="btn primary" onClick={() => onNavigate('master')}>
            홈에서 시작하기 →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen pg-screen">
      {/* 현재 위치 */}
      <div className="study-card">
        <div className="pg-kicker">
          {plan.phase.n}단계 · {plan.phase.name}
        </div>
        <div className="pg-day">
          Day {plan.day}
          <span className="muted"> / {TOTAL_DAYS}</span>
        </div>
        <div className="pg-bar">
          <span style={{ width: `${stats.percent}%` }} />
        </div>
        <div className="pg-stats">
          <div>
            <b>{stats.completed}일</b>
            <span className="muted">완료</span>
          </div>
          <div>
            <b>{stats.remaining}일</b>
            <span className="muted">남음</span>
          </div>
          <div>
            <b>{stats.recentDensity}일</b>
            <span className="muted">최근 2주</span>
          </div>
          <div>
            <b>약 {stats.projectedWeeks}주</b>
            <span className="muted">완주 예상</span>
          </div>
        </div>
        <p className="muted pg-fine">
          시작한 지 {stats.elapsedDays}일째 · 진도는 달력이 아니라 훈련을 마친 날로만 셉니다.
          쉰 날이 있어도 프로그램은 밀리지 않아요.
        </p>
      </div>

      {/* 서약 */}
      <div className="study-card pg-pledge-card">
        <div className="pg-sec">내가 시작한 이유</div>
        {editing ? (
          <>
            <textarea className="text-input pg-why" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1 }}
                onClick={() => {
                  updatePledge({ why });
                  setEditing(false);
                  refresh();
                }}
              >
                저장
              </button>
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditing(false)}>
                취소
              </button>
            </div>
          </>
        ) : (
          <>
            <blockquote className="pg-quote">{s.why || '(적어두지 않으셨어요)'}</blockquote>
            <div className="pg-pledge-meta">
              <span className="muted">하루 약속 {s.minutes}분</span>
              <button type="button" className="mini-btn" onClick={() => setEditing(true)}>
                고쳐 쓰기
              </button>
            </div>
          </>
        )}
      </div>

      {/* 3단계 */}
      <div className="pg-sec-h">3단계로 갑니다</div>
      {PHASES.map((p) => (
        <div key={p.n} className={`study-card pg-phase${p.n === plan.phase.n ? ' now' : ''}`}>
          <div className="pg-phase-head">
            <b>
              {p.n}단계 · {p.name}
            </b>
            <span className="muted">{p.weeks}</span>
          </div>
          <p className="pg-phase-promise">{p.promise}</p>
          {p.n === plan.phase.n && <div className="pg-phase-now">지금 여기</div>}
        </div>
      ))}

      {/* 주차 로드맵 */}
      <div className="pg-sec-h">12주 로드맵</div>
      <div className="study-card">
        <ul className="pg-weeks">
          {PROGRAM_WEEKS.map((w) => {
            const state = w.week < plan.week ? 'done' : w.week === plan.week ? 'now' : 'future';
            return (
              <li key={w.week} className={`pg-week ${state}`}>
                <span className="pg-week-n">{w.week}주</span>
                <span className="pg-week-body">
                  <span className="pg-week-focus">{w.focus}</span>
                  <span className="pg-week-meta muted">
                    하루 {w.spokenTarget}문장 · {w.field.title.replace('실전 · ', '')}
                  </span>
                </span>
                {state === 'now' && (
                  <span className="pg-week-prog">
                    {stats.weekDone}/{DAYS_PER_WEEK}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* 다시 시작 */}
      <div className="study-card">
        <div className="pg-sec">프로그램 다시 시작</div>
        <p className="muted pg-fine">
          진행 기록(완료한 훈련일과 서약)이 지워집니다. 학습 데이터(복습·발화 기록)는 그대로 남습니다.
        </p>
        {confirmReset ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn primary"
              style={{ flex: 1 }}
              onClick={() => {
                resetProgram();
                setConfirmReset(false);
                onNavigate('master');
              }}
            >
              정말 초기화
            </button>
            <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setConfirmReset(false)}>
              취소
            </button>
          </div>
        ) : (
          <button type="button" className="mini-btn" onClick={() => setConfirmReset(true)}>
            초기화
          </button>
        )}
      </div>
    </div>
  );
}
