'use client';

/**
 * 시작 가이드 — 처음 온 사람에게 "무엇부터"를 순서로 알려준다.
 * ① 레벨 진단(5분, 한 번) → ② 12주 코스 시작(목표·시간) → ③ 첫 레슨 완료.
 * 세 단계를 마치면 사라지고, 그 뒤로 홈은 '오늘의 레슨' 하나만 권한다.
 */
import type { Mode } from './NavBar';

export interface GuideState {
  placed: boolean;
  started: boolean;
  firstLessonDone: boolean;
}

const STEPS = [
  { key: 'placed', title: '레벨 진단', desc: '18문항 · 5분 · 한 번만', cta: '레벨 진단 시작', mode: 'placement' as Mode },
  { key: 'started', title: '12주 코스 시작', desc: '목표 한 줄과 하루 학습 시간', cta: '아래에서 코스 시작', mode: null },
  { key: 'firstLessonDone', title: '첫 레슨 완료', desc: '복습 → 문법 → 말하기 → 실전', cta: '아래 오늘의 레슨으로', mode: null },
] as const;

export function guideDone(s: GuideState): boolean {
  return s.placed && s.started && s.firstLessonDone;
}

export default function FocusGuide({ state, onNavigate }: { state: GuideState; onNavigate: (m: Mode) => void }) {
  const cur = STEPS.findIndex((st) => !state[st.key]);
  if (cur < 0) return null;
  const step = STEPS[cur];
  return (
    <section className="study-card fg-card" aria-label="시작 가이드">
      <div className="pg-kicker">처음이라면 이 순서대로</div>
      <h2 className="fg-title">
        {cur + 1}단계 · {step.title}
      </h2>
      <ol className="fg-steps">
        {STEPS.map((st, i) => (
          <li key={st.key} className={`fg-step${state[st.key] ? ' done' : ''}${i === cur ? ' now' : ''}`}>
            <span className="fg-dot">{state[st.key] ? '✓' : i + 1}</span>
            <span className="fg-body">
              <b>{st.title}</b>
              <span>{st.desc}</span>
            </span>
          </li>
        ))}
      </ol>
      {step.mode && (
        <button type="button" className="btn primary fg-cta" onClick={() => onNavigate(step.mode as Mode)}>
          {step.cta}
        </button>
      )}
    </section>
  );
}
