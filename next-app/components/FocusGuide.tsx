'use client';

/**
 * 시작 가이드 — 처음 온 사람에게 "무엇부터"를 순서로 알려준다.
 * ① 레벨 진단(5분, 한 번) → ② 드라마 1화 보기(5분). 두 단계를 마치면 사라지고,
 * 그 뒤로 홈은 '오늘의 에피소드' 하나만 권한다.
 */
import type { Mode } from './NavBar';
import { requestDramaAutoplay } from '../lib/homeLite';
import { primeAudio } from './SpeakButton';

export interface GuideState {
  placed: boolean;
  firstEpisode: boolean;
}

const STEPS = [
  { key: 'placed', title: '레벨 진단', desc: '18문항 · 5분 · 한 번만', cta: '레벨 진단 시작' },
  { key: 'firstEpisode', title: '드라마 1화 보기', desc: '5분 · 대화를 따라가며 표현 2개', cta: '1화 보기' },
] as const;

export function guideDone(s: GuideState): boolean {
  return s.placed && s.firstEpisode;
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
      <button
        type="button"
        className="btn primary fg-cta"
        onClick={() => {
          if (step.key === 'placed') onNavigate('placement');
          else {
            primeAudio(); // 탭 안에서 오디오 언락(iOS 첫 대사 무음 방지)
            requestDramaAutoplay();
            onNavigate('drama');
          }
        }}
      >
        {step.cta}
      </button>
    </section>
  );
}
