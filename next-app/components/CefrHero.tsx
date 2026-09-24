'use client';

/**
 * 홈의 주인공 — CEFR 레벨과 "다음 레벨까지 무엇을".
 *
 * 이 앱의 모든 활동은 결국 이 카드의 숫자를 움직이기 위한 것이다. 그래서 홈 맨 위에
 * 둔다: 지금 레벨(증거 기반), 다음 레벨까지 진척, 4기능 각각의 레벨, 그리고 가장
 * 가까운 입증 과제 하나. 측정 전이면 진단부터 권한다.
 */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import { LEVEL_SUMMARY } from '../lib/cefrDescriptors';
import {
  nextActions,
  overall,
  PASSES_NEEDED,
  setLevelPreset,
  SKILL_LABEL,
  syncCefr,
  takePromotion,
  TALK_LESSON_BY_LEVEL,
  type CefrAction,
  type Overall,
} from '../lib/cefrGrowth';

export function goAction(a: CefrAction, onNavigate: (m: Mode) => void, onSelectLesson?: (id: number) => void) {
  if (a.mode === 'talk') {
    onSelectLesson?.(TALK_LESSON_BY_LEVEL[a.level]);
    onNavigate('talk');
    return;
  }
  setLevelPreset(a.skill, a.level);
  onNavigate(a.mode);
}

export default function CefrHero({ onNavigate, onSelectLesson }: { onNavigate: (m: Mode) => void; onSelectLesson?: (id: number) => void }) {
  const [o, setO] = useState<Overall | null>(null);
  const [promo, setPromo] = useState<string | null>(null);
  useEffect(() => {
    // 홈을 여는 순간 감지된 승급(배치고사 재응시·다른 기기 복원 등)도 축하한다
    const now = syncCefr();
    setO(overall());
    setPromo(takePromotion() || now);
  }, []);
  if (!o) return <div className="study-card cf-hero" style={{ minHeight: 220 }} aria-hidden="true" />;

  if (!o.measured) {
    return (
      <div className="study-card cf-hero" data-tilt>
        <div className="pg-kicker">CEFR 레벨</div>
        <h2 className="cf-hero-q">내 영어는 지금 어느 레벨일까요?</h2>
        <p className="muted cf-hero-p">
          국제 표준 CEFR(A1~C2)로 출발점을 잡으면, 앱의 모든 연습이 다음 레벨을 입증하는 과제로 바뀝니다.
        </p>
        <button type="button" className="btn primary cf-cta" onClick={() => onNavigate('placement')}>
          5분 레벨 진단 시작 →
        </button>
      </div>
    );
  }

  const actions = nextActions(o);
  const top = actions[0];
  const pct = Math.round(o.progress * 100);
  return (
    <div className="study-card cf-hero" data-tilt>
      {promo && (
        <div className="cf-promo" role="status">
          🎉 CEFR <b>{promo}</b> 달성! 4기능 중 3개가 {promo}를 입증했어요.
        </div>
      )}
      <div className="cf-hero-row">
        <div className="cf-badge" aria-label={`현재 CEFR ${o.level}`}>
          <span className="cf-badge-lv">{o.level}</span>
          <span className="cf-badge-name">{LEVEL_SUMMARY[o.level].name}</span>
        </div>
        <div className="cf-hero-body">
          <div className="pg-kicker">CEFR · GSE {o.gse}</div>
          <div className="cf-hero-goal">
            {o.level === 'C2' ? '최상급 도달' : (
              <>
                {o.next}까지 <b>{pct}%</b>
              </>
            )}
          </div>
          <div className="cf-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <div className="cf-hero-line muted">{LEVEL_SUMMARY[o.level].line}</div>
        </div>
      </div>

      <div className="cf-skills">
        {o.skills.map((s) => (
          <div key={s.skill} className={`cf-skill${s.skill === o.weakest.skill ? ' weak' : ''}`}>
            <span className="cf-skill-ic">{SKILL_LABEL[s.skill].icon}</span>
            <span className="cf-skill-name">{SKILL_LABEL[s.skill].name}</span>
            <span className="cf-skill-lv">{s.level}</span>
            <span className="cf-skill-bar">
              <span style={{ width: `${Math.round(s.progress * 100)}%` }} />
            </span>
          </div>
        ))}
      </div>

      {top && (
        <button type="button" className="btn primary cf-cta" onClick={() => goAction(top, onNavigate, onSelectLesson)}>
          <span className="cf-cta-main">{top.title}</span>
          <span className="cf-cta-sub">
            {top.detail} · {o.skillsAtNext}/3 기능 도달
          </span>
        </button>
      )}
      <button type="button" className="cf-more" onClick={() => onNavigate('cefr')}>
        CEFR 리포트 · Can-do 체크리스트 →
      </button>
      <p className="cf-rule muted">
        레벨은 증거로만 오릅니다 — 한 단계 위 과제에서 70점 이상 {PASSES_NEEDED}회를 4기능 중 3개가 채우면 승급.
      </p>
    </div>
  );
}
