'use client';

/**
 * 성장(성숙도 커리큘럼) 화면 — 이 앱의 글로벌 커리큘럼 홈.
 * 원어민스러움 5단계 중 현재 단계의 문장(엠블럼·진행 링·승급 조건)과
 * 이 단계에서 정착시킬 원어민 패턴 커리큘럼을 보여준다.
 * 패턴을 탭하면 그 예문이 원어민 사다리로 곧장 넘어가고, 완주가 "정착"으로
 * 기록돼 자동 승급의 재료가 된다.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Mode } from './NavBar';
import { computeMaturity, donePatterns, settledNativeCount, STAGE_PATTERNS, STAGES, type MaturityState } from '../lib/maturity';
import { setLadderSeed } from '../lib/nativeLadder';
import { getMistakes, mistakesForDrill, patternUseTotal } from '../lib/transfer';
import { duePatternRecalls } from '../lib/reviewEngine';
import { setDrillQueue } from '../lib/state';
import { speakText } from './SpeakButton';
import { SpeakerIcon } from './icons';
import { Confetti } from './Fx';

/** 단계 엠블럼 — 이중 링 + 틱 마크 + 단계 숫자. 민트 그라디언트로 은은히 빛난다. */
function StageEmblem({ n, progress, size = 116 }: { n: number; progress: number; size?: number }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const ticks = Array.from({ length: 5 }, (_, i) => i);
  return (
    <svg width={size} height={size} viewBox="0 0 112 112" className="mx-emblem" aria-hidden="true">
      <defs>
        <linearGradient id="mx-g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary-light)" />
        </linearGradient>
      </defs>
      {/* 바깥 헤어라인 링 */}
      <circle cx="56" cy="56" r="52" fill="none" stroke="var(--border-strong)" strokeWidth="1" />
      {/* 단계 틱 — 5단계 중 지나온 단계가 채워진다 */}
      {ticks.map((i) => {
        const a = -90 + i * 72;
        const rad = (a * Math.PI) / 180;
        const x1 = 56 + Math.cos(rad) * 48;
        const y1 = 56 + Math.sin(rad) * 48;
        const x2 = 56 + Math.cos(rad) * 52;
        const y2 = 56 + Math.sin(rad) * 52;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i < n ? 'var(--primary)' : 'var(--border-strong)'} strokeWidth="2" strokeLinecap="round" />;
      })}
      {/* 진행 링 */}
      <circle cx="56" cy="56" r={R} fill="none" stroke="var(--surface2)" strokeWidth="5" />
      <circle
        cx="56" cy="56" r={R} fill="none" stroke="url(#mx-g)" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - progress)).toFixed(1)}
        transform="rotate(-90 56 56)" style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)' }}
      />
      <text x="56" y="64" textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--text)">{n}</text>
      <text x="56" y="80" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--text-muted)" letterSpacing="2">STAGE</text>
    </svg>
  );
}

export default function MaturityScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [mx, setMx] = useState<MaturityState | null>(null);
  const [settled, setSettled] = useState(0);
  const [doneKeys, setDoneKeys] = useState<string[]>([]);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [usedTotal, setUsedTotal] = useState(0);
  const [dueRecalls, setDueRecalls] = useState(0);

  useEffect(() => {
    setMx(computeMaturity());
    setSettled(settledNativeCount());
    setDoneKeys(donePatterns());
    setMistakeCount(getMistakes().length);
    setUsedTotal(patternUseTotal());
    setDueRecalls(duePatternRecalls(10).length);
  }, []);

  const patterns = useMemo(() => (mx ? STAGE_PATTERNS[mx.stage.n] || [] : []), [mx]);

  if (!mx) return <div className="screen-loading" aria-label="불러오는 중" />;

  const { stage, progress, criteria, promoted } = mx;

  function practice(patternKey: string, ex: string) {
    setLadderSeed({ text: ex, patternKey });
    onNavigate('ladder');
  }

  return (
    <div className="study-screen mx-screen">
      {/* 단계 히어로 — 이 화면의 무게 중심 */}
      <div className="mx-hero">
        {promoted && <Confetti burstId={stage.n} />}
        {promoted && <div className="mx-promoted">✦ {stage.name} 단계로 올라섰어요</div>}
        <StageEmblem n={stage.n} progress={progress} />
        <div className="mx-hero-name">{stage.name}</div>
        <div className="mx-hero-motto">“{stage.motto}”</div>
        <div className="mx-hero-meta">
          성숙도 {stage.n}/5 · CEFR {stage.cefr} 앵커
          {settled > 0 && <> · 정착한 원어민 표현 {settled}개</>}
          {usedTotal > 0 && <> · 실전 사용 {usedTotal}회</>}
        </div>
        <p className="mx-hero-desc">{stage.desc}</p>
      </div>

      {/* 지나온 길 — 5단계 여정 */}
      <div className="mx-path">
        {STAGES.map((s) => (
          <div key={s.n} className={`mx-path-step${s.n < stage.n ? ' done' : s.n === stage.n ? ' now' : ''}`}>
            <i>{s.n < stage.n ? '✓' : s.n}</i>
            <span>{s.name}</span>
          </div>
        ))}
      </div>

      {/* 자동 승급 조건 — 매일의 연습이 여기 쌓인다 */}
      {criteria.length > 0 && (
        <div className="mx-card">
          <div className="mx-label">다음 단계 · 자동 승급 조건</div>
          {criteria.map((c) => (
            <div className="mx-crit" key={c.label}>
              <div className="mx-crit-top">
                <span className={c.ok ? 'ok' : ''}>{c.ok ? '✓ ' : ''}{c.label}</span>
                <b>{Math.min(c.now, c.need)}/{c.need}</b>
              </div>
              <div className="mx-bar"><i style={{ width: `${Math.min(1, c.now / c.need) * 100}%` }} /></div>
            </div>
          ))}
          <p className="mx-crit-note">조건이 모두 차면 자동으로 다음 성숙도로 올라갑니다 — 시험도, 버튼도 없어요.</p>
        </div>
      )}
      {criteria.length === 0 && (
        <div className="mx-card">
          <div className="mx-label">최고 단계</div>
          <p className="mx-crit-note">원어민의 결에 도달했어요 — 이제 사다리와 회화로 결을 더 다듬는 여정입니다.</p>
        </div>
      )}

      {/* 리콜 러시 — 밀린 패턴 리콜이 2개 이상이면 몰아서 정리하는 통로 */}
      {dueRecalls >= 2 && (
        <div className="mx-card mx-rush">
          <div className="mx-label">밀린 리콜 {dueRecalls}개</div>
          <p className="mx-crit-note" style={{ marginTop: 0 }}>
            복습 시점이 지난 패턴들이 기다리고 있어요 — 몰아서 꺼내면 간격 반복이 다시 굴러갑니다.
          </p>
          <button type="button" className="mx-practice-btn" style={{ marginTop: 10 }} onClick={() => onNavigate('recallrush')}>
            🧠 리콜 러시 시작 →
          </button>
        </div>
      )}

      {/* 맞춤 훈련 — 회화에서 축적된 교정을 드릴로 되돌린다(약점이 훈련이 되는 루프) */}
      {mistakeCount >= 2 && (
        <div className="mx-card mx-mistakes">
          <div className="mx-label">맞춤 훈련 — 회화에서 틀렸던 문장</div>
          <p className="mx-crit-note" style={{ marginTop: 0 }}>
            AI 교정에서 잡힌 문장 {mistakeCount}개가 쌓여 있어요. 고친 문장을 소리 내어 말하면 같은 실수가 줄어듭니다.
          </p>
          <button
            type="button"
            className="mx-practice-btn"
            style={{ marginTop: 10 }}
            onClick={() => {
              setDrillQueue({ label: '자주 틀리는 문장', items: mistakesForDrill() });
              onNavigate('drill');
            }}
          >
            🔁 고친 문장으로 드릴 →
          </button>
        </div>
      )}

      {/* 단계 커리큘럼 — 정착시킬 원어민 패턴 */}
      <div className="mx-label mx-label-loose">{stage.name} 커리큘럼 — 원어민 패턴 {patterns.filter((p) => doneKeys.includes(p.key)).length}/{patterns.length} 정착</div>
      {patterns.map((p) => {
        const done = doneKeys.includes(p.key);
        return (
          <div key={p.key} className={`mx-pattern${done ? ' done' : ''}`}>
            <div className="mx-pattern-top">
              <b className="mx-pattern-en">{p.en}</b>
              <button
                type="button"
                className="speak-mini"
                aria-label={`${p.ex} 듣기`}
                onClick={() => speakText(p.ex, 'en-US')}
              >
                <SpeakerIcon />
              </button>
            </div>
            <div className="mx-pattern-why">{p.why}</div>
            <div className="mx-pattern-foot">
              {done ? (
                <span className="mx-done-chip">✓ 정착</span>
              ) : (
                <button type="button" className="mx-practice-btn" onClick={() => practice(p.key, p.ex)}>
                  🪜 사다리로 연습 →
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
