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
        <h2 className="cf-hero-q">먼저 내 레벨을 확인하세요</h2>
        <p className="muted cf-hero-p">국제 표준 CEFR(A1~C2) 기준 · 18문항 · 약 5분</p>
        <button type="button" className="btn primary cf-cta" onClick={() => onNavigate('placement')}>
          5분 레벨 진단 시작
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
          <div className="pg-kicker">내 레벨 · CEFR</div>
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
        // 홈의 주 행동은 '오늘의 레슨' 하나 — 레벨 과제는 보조 버튼으로 둔다
        <button type="button" className="btn cf-cta" onClick={() => goAction(top, onNavigate, onSelectLesson)}>
          <span className="cf-cta-main">다음 레벨 과제 · {top.title.replace(/^\S+\s/, '').replace(/\(.*\)/, '').trim()}</span>
          <span className="cf-cta-sub">{top.detail}</span>
        </button>
      )}
      <button type="button" className="cf-more" onClick={() => onNavigate('cefr')}>
        레벨 리포트 보기
      </button>
    </div>
  );
}
