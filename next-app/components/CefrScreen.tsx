'use client';

/**
 * CEFR 리포트 — 레벨의 근거와 다음 레벨의 조건을 전부 보여준다.
 *   ① 종합 레벨·GSE·다음 레벨 진척, 8주 GSE 추세
 *   ② 4기능 카드: 기능별 레벨·입증 횟수·최근 평균 + 바로 도전
 *   ③ Can-do 체크리스트: 레벨별 12문항. 입증된 기능은 자동 체크, 나머지는 자기평가
 *   ④ 어휘 폭: 레벨별 마스터 단어 수(CEFR 어휘 범위 척도의 보조 지표)
 *   ⑤ 승급 기록, 배치고사 다시 보기
 */
import GrowthCard from './GrowthCard';
import { useMemo, useState } from 'react';
import type { Mode } from './NavBar';
import { CEFR_ORDER, type Cefr } from '../lib/cefr';
import { CAN_DOS, LEVEL_SUMMARY, type CanDo } from '../lib/cefrDescriptors';
import { gseTrend, nextActions, overall, PASS_SCORE, PASSES_NEEDED, SKILL_LABEL, cefrState } from '../lib/cefrGrowth';
import { load, store } from '../lib/state';
import { allWords, progress, MASTER_BOX } from '../lib/words';
import { goAction } from './CefrHero';

const SELF_KEY = 'va_cefr_cando';

export default function CefrScreen({ onNavigate, onSelectLesson }: { onNavigate: (m: Mode) => void; onSelectLesson: (id: number) => void }) {
  const o = useMemo(() => overall(), []);
  const actions = useMemo(() => nextActions(o), [o]);
  const trend = useMemo(() => gseTrend(8), []);
  const hist = useMemo(() => cefrState().history, []);
  const [lv, setLv] = useState<Cefr>(o.next);
  const [self, setSelf] = useState<Record<string, boolean>>(() => load<Record<string, boolean>>(SELF_KEY, {}));

  const vocab = useMemo(() => {
    const prog = progress();
    const by: Record<string, { m: number; t: number }> = {};
    for (const w of allWords()) {
      const x = (by[w.lv] ||= { m: 0, t: 0 });
      x.t++;
      if ((prog[w.id]?.b || 0) >= MASTER_BOX) x.m++;
    }
    return by;
  }, []);

  const skillLv = Object.fromEntries(o.skills.map((s) => [s.skill, s.level])) as Record<string, Cefr>;
  const proven = (c: CanDo) => CEFR_ORDER.indexOf(skillLv[c.skill]) >= CEFR_ORDER.indexOf(c.level);
  const toggle = (id: string) => {
    const next = { ...self, [id]: !self[id] };
    setSelf(next);
    store(SELF_KEY, next);
  };
  const maxT = Math.max(...trend.map((t) => t.gse), 1);
  const minT = Math.min(...trend.map((t) => t.gse));

  return (
    <div className="screen cf-screen">
      <div className="study-card cf-hero">
        <div className="cf-hero-row">
          <div className="cf-badge">
            <span className="cf-badge-lv">{o.level}</span>
            <span className="cf-badge-name">{LEVEL_SUMMARY[o.level].name}</span>
          </div>
          <div className="cf-hero-body">
            <div className="pg-kicker">종합 GSE {o.gse}</div>
            <div className="cf-hero-goal">
              {o.level === 'C2' ? '최상급' : (
                <>
                  {o.next}까지 <b>{Math.round(o.progress * 100)}%</b>
                </>
              )}
            </div>
            <div className="cf-bar">
              <span style={{ width: `${Math.round(o.progress * 100)}%` }} />
            </div>
            <div className="cf-hero-line muted">
              {o.next} 도달 기능 {o.skillsAtNext}/4 — 3개면 승급
            </div>
          </div>
        </div>
        <div className="cf-trend" aria-label="최근 8주 GSE 추세">
          {trend.map((t, i) => (
            <div key={i} className="cf-trend-col">
              <span className="cf-trend-bar" style={{ height: `${20 + ((t.gse - minT) / Math.max(1, maxT - minT)) * 60}%` }} title={`GSE ${t.gse}`} />
              <span className="cf-trend-lbl">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pg-sec-h">4기능 — 기능마다 따로 입증합니다</div>
      {o.skills.map((s) => {
        const act = actions.find((a) => a.skill === s.skill);
        return (
          <div key={s.skill} className="study-card cf-skill-card">
            <div className="cf-skill-head">
              <span className="cf-skill-ic big">{SKILL_LABEL[s.skill].icon}</span>
              <span className="cf-skill-title">
                <b>{SKILL_LABEL[s.skill].name}</b>
                <span className="muted">
                  {s.proven ? `${s.proven} 입증` : '배치고사 기준'} · GSE {s.gse}
                </span>
              </span>
              <span className="cf-lv-chip">{s.level}</span>
            </div>
            {s.level !== 'C2' && (
              <>
                <div className="cf-pips" aria-label={`${s.next} 입증 ${s.passes}/${PASSES_NEEDED}`}>
                  {Array.from({ length: PASSES_NEEDED }).map((_, i) => (
                    <span key={i} className={`cf-pip${s.passes >= i + 1 ? ' on' : s.passes > i ? ' half' : ''}`} />
                  ))}
                  <span className="muted cf-pip-txt">
                    {s.next} 과제 {PASS_SCORE}점+ {s.passes}/{PASSES_NEEDED}
                    {s.avg !== null ? ` · 최근 평균 ${s.avg}점` : ''}
                  </span>
                </div>
                {act && (
                  <button type="button" className="btn cf-try" onClick={() => goAction(act, onNavigate, onSelectLesson)}>
                    {act.level} 과제 도전 →
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      <div className="pg-sec-h">Can-do 체크리스트</div>
      <div className="cf-levels" role="tablist">
        {CEFR_ORDER.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={lv === c} className={`cf-lv-tab${lv === c ? ' on' : ''}${c === o.level ? ' cur' : ''}`} onClick={() => setLv(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="study-card">
        <div className="cf-lv-sum">
          <b>
            {lv} {LEVEL_SUMMARY[lv].name}
          </b>{' '}
          — {LEVEL_SUMMARY[lv].line}
        </div>
        {(['listening', 'reading', 'speaking', 'writing'] as const).map((sk) => (
          <div key={sk} className="cf-cando-group">
            <div className="cf-cando-sk">
              {SKILL_LABEL[sk].icon} {SKILL_LABEL[sk].name}
            </div>
            {CAN_DOS.filter((c) => c.level === lv && c.skill === sk).map((c) => {
              const auto = proven(c);
              const on = auto || !!self[c.id];
              return (
                <button key={c.id} type="button" className={`cf-cando${on ? ' on' : ''}`} onClick={() => !auto && toggle(c.id)} aria-pressed={on}>
                  <span className="cf-cando-box">{on ? '✓' : ''}</span>
                  <span className="cf-cando-body">
                    {c.text}
                    <span className="cf-cando-ex">예) {c.example}</span>
                    {auto ? <span className="cf-cando-tag">입증됨</span> : self[c.id] ? <span className="cf-cando-tag self">자기평가</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        <p className="muted cf-fine">입증됨 = 해당 기능이 이 레벨을 과제 점수로 입증. 자기평가는 체크해도 레벨을 올리지 않아요(정직한 기록).</p>
      </div>

      <div className="pg-sec-h">원어민 표현 단계</div>
      <GrowthCard onNavigate={onNavigate} />

      <div className="pg-sec-h">어휘 폭 — 레벨별 마스터 단어</div>
      <div className="study-card cf-vocab">
        {(['A1', 'A2', 'B1', 'B2', 'C1'] as Cefr[]).filter((c) => vocab[c]).map((c) => (
          <div key={c} className="cf-vocab-row">
            <span className="cf-lv-chip sm">{c}</span>
            <span className="cf-bar thin">
              <span style={{ width: `${(vocab[c].m / vocab[c].t) * 100}%` }} />
            </span>
            <span className="muted">
              {vocab[c].m}/{vocab[c].t}
            </span>
          </div>
        ))}
        <button type="button" className="btn cf-try" onClick={() => onNavigate('words')}>
          단어로 어휘 폭 넓히기 →
        </button>
      </div>

      <div className="pg-sec-h">레벨 기록</div>
      <div className="study-card">
        <ul className="cf-hist">
          {hist.map((h, i) => (
            <li key={i}>
              <span className="cf-lv-chip sm">{h.level}</span> {h.date}
              {i === 0 ? ' · 출발' : ' · 승급'}
            </li>
          ))}
        </ul>
        <button type="button" className="btn cf-try" onClick={() => onNavigate('placement')}>
          배치고사 다시 보기
        </button>
      </div>
    </div>
  );
}
