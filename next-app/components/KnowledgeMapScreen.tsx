'use client';

/**
 * 학습 지도 — 온톨로지 그래프를 사람이 읽는 화면.
 *
 * 세 가지 축으로 같은 그래프를 본다:
 *   상황별  어떤 상황의 영어가 내 것이 됐고 어디가 비었는가(숙련도)
 *   회차별  시작한 트랙을 어디까지 왔고 다음 회차는 무엇인가(연속성)
 *   실전형  실제 메일·경력·JD에서 온 유닛만 — 2·3단계의 훈련장
 * 맨 위엔 플래너의 추천 3개 — "다음에 이걸 하세요"가 이유와 함께.
 * 유닛을 누르면 핸드오프로 그 화면의 그 항목이 바로 펼쳐진다.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Mode } from './NavBar';
import { lessonsNow } from '../lib/lessonData';
import { wordStatsBySituation } from '../lib/words';
import { overall as cefrOverall } from '../lib/cefrGrowth';
import {
  buildLearnerModel,
  childSituations,
  getGraph,
  recommend,
  rootOf,
  rootSituations,
  setUnitHandoff,
  sourceLabel,
  type Graph,
  type LearnerModel,
  type Recommendation,
  type Track,
  type Unit,
} from '../lib/ontology';

type Tab = 'situation' | 'track' | 'real';

function Bar({ v }: { v: number }) {
  return (
    <span className="km-bar" aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
    </span>
  );
}

export default function KnowledgeMapScreen({ onNavigate, onSelectLesson }: { onNavigate: (m: Mode) => void; onSelectLesson: (id: number) => void }) {
  const [tab, setTab] = useState<Tab>('situation');
  const [openRoot, setOpenRoot] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const g: Graph = useMemo(() => getGraph({ lessons: lessonsNow() }), []);
  const m: LearnerModel = useMemo(() => buildLearnerModel(g), [g, tick]);
  const recs: Recommendation[] = useMemo(() => {
    const o = cefrOverall();
    return recommend(g, m, { max: 3, level: { current: o.level, target: o.next } });
  }, [g, m]);
  // 상황별 단어 숙련 — 같은 상황 id로 단어 팩이 그래프에 붙는다
  const wordsBySit = useMemo(() => wordStatsBySituation(rootOf), [tick]);
  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const roots = rootSituations();
  const touched = g.units.filter((u) => m.unit[u.id]?.touched).length;
  const exprMet = Object.keys(m.expression).length;
  const patDone = g.patterns.filter((p) => m.pattern[p.key] > 0).length;
  const overall = (() => {
    const rs = roots.map((r) => m.root[r.id]).filter((r) => r && r.unitsTotal > 0);
    const ut = rs.reduce((a, r) => a + r.unitsTotal, 0);
    return ut ? Math.round(rs.reduce((a, r) => a + r.score * r.unitsTotal, 0) / ut) : 0;
  })();

  function open(u: Unit) {
    if (u.source === 'lesson' || u.source === 'library') {
      onSelectLesson(Number(u.ref.key));
      onNavigate('study');
      return;
    }
    setUnitHandoff(u.ref);
    onNavigate(u.mode);
  }

  function UnitRow({ u, reason }: { u: Unit; reason?: string }) {
    const um = m.unit[u.id];
    return (
      <button type="button" className={`km-unit${um?.touched ? ' done' : ''}`} onClick={() => open(u)}>
        <span className="km-unit-src">{sourceLabel(u.source)}</span>
        <span className="km-unit-body">
          <span className="km-unit-title">{u.title}</span>
          {reason ? <span className="km-unit-why">{reason}</span> : u.subtitle ? <span className="km-unit-why">{u.subtitle}</span> : null}
          <span className="km-unit-meta muted">
            {u.level} · {u.minutes}분{u.real ? ' · 실전형' : ''}
            {um && um.exprTotal > 0 ? ` · 표현 ${um.exprMastered}/${um.exprTotal}` : ''}
          </span>
        </span>
        <span className="km-unit-go">{um?.touched ? '다시' : '열기'} →</span>
      </button>
    );
  }

  return (
    <div className="screen km-screen">
      {/* 요약 */}
      <div className="study-card">
        <div className="pg-kicker">학습 지도</div>
        <div className="km-overall">
          <b>{overall}%</b>
          <span className="muted">전체 상황 숙련도</span>
        </div>
        <Bar v={overall} />
        <div className="km-stats">
          <div>
            <b>
              {touched}/{g.units.length}
            </b>
            <span className="muted">회차</span>
          </div>
          <div>
            <b>
              {exprMet}/{g.expressions.length}
            </b>
            <span className="muted">만난 표현</span>
          </div>
          <div>
            <b>
              {patDone}/{g.patterns.length}
            </b>
            <span className="muted">정착 패턴</span>
          </div>
          <div>
            <b>{g.tracks.length}</b>
            <span className="muted">트랙</span>
          </div>
        </div>
      </div>

      {/* 추천 */}
      <div className="pg-sec-h">다음에 할 것</div>
      <div className="km-recs">
        {recs.map((r) => (
          <UnitRow key={r.unit.id} u={r.unit} reason={r.reason} />
        ))}
        {recs.length === 0 && <p className="muted">모든 유닛을 한 번씩 만났어요 — 약한 상황부터 다시 돌아보세요.</p>}
      </div>

      {/* 탭 */}
      <div className="km-tabs" role="tablist">
        {(
          [
            ['situation', '상황별'],
            ['track', '회차별'],
            ['real', '실전형'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`km-tab${tab === k ? ' on' : ''}`} onClick={() => { setTab(k); setOpenRoot(null); }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'situation' && (
        <div className="km-grid">
          {roots.map((r) => {
            const rm = m.root[r.id];
            if (!rm || rm.unitsTotal === 0) return null;
            const isOpen = openRoot === r.id;
            return (
              <div key={r.id} className={`study-card km-sit${isOpen ? ' open' : ''}`}>
                <button type="button" className="km-sit-head" onClick={() => setOpenRoot(isOpen ? null : r.id)}>
                  <span className="km-sit-icon">{r.icon}</span>
                  <span className="km-sit-body">
                    <span className="km-sit-name">{r.name}</span>
                    <Bar v={rm.score} />
                    <span className="km-sit-meta muted">
                      {rm.score}% · 회차 {rm.unitsTouched}/{rm.unitsTotal}
                      {rm.weak > 0 ? ` · 약한 표현 ${rm.weak}` : ''}
                      {rm.patternsTotal > 0 ? ` · 패턴 ${rm.patternsDone}/${rm.patternsTotal}` : ''}
                      {wordsBySit[r.id] ? ` · 단어 ${wordsBySit[r.id].seen}/${wordsBySit[r.id].total}` : ''}
                    </span>
                  </span>
                  <span className="km-sit-arrow">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div className="km-sit-kids">
                    {[r, ...childSituations(r.id)].map((c) => {
                      const ids = g.unitsBySituation[c.id] || [];
                      if (!ids.length) return null;
                      const cm = m.situation[c.id];
                      return (
                        <div key={c.id} className="km-kid">
                          {c.id !== r.id && (
                            <div className="km-kid-head">
                              <span>{c.name}</span>
                              <span className="muted">
                                {cm?.score ?? 0}% · {cm?.unitsTouched ?? 0}/{ids.length}
                              </span>
                            </div>
                          )}
                          {ids.map((id) => (
                            <UnitRow key={id} u={g.unitById[id]} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'track' &&
        (['회차', '실전', '상황'] as Track['kind'][]).map((kind) => {
          const ts = g.tracks.filter((t) => t.kind === kind && t.unitIds.length);
          if (!ts.length) return null;
          return (
            <div key={kind}>
              <div className="pg-sec-h">
                {kind === '회차' ? '순서대로 가는 트랙' : kind === '실전' ? '실전 데이터 트랙' : '상황 묶음'}
              </div>
              {ts.map((t) => {
                const units = t.unitIds.map((id) => g.unitById[id]);
                const done = units.filter((u) => m.unit[u.id]?.touched).length;
                const next = units.find((u) => !m.unit[u.id]?.touched);
                return (
                  <div key={t.id} className="study-card km-track">
                    <div className="km-track-head">
                      <span className="km-sit-icon">{t.icon}</span>
                      <span className="km-sit-body">
                        <span className="km-sit-name">{t.name}</span>
                        <Bar v={units.length ? (done / units.length) * 100 : 0} />
                        <span className="km-sit-meta muted">
                          {done}/{units.length} 회차{t.desc ? ` · ${t.desc}` : ''}
                        </span>
                      </span>
                    </div>
                    {next ? (
                      <UnitRow u={next} reason={done > 0 ? `${done + 1}회차 — 이어서` : '1회차 — 시작'} />
                    ) : (
                      <p className="muted km-track-done">트랙 완주 · 아무 회차나 눌러 복습</p>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

      {tab === 'real' &&
        roots.map((r) => {
          const units = g.units.filter((u) => u.real && u.situations.some((s) => rootOf(s) === r.id));
          if (!units.length) return null;
          return (
            <div key={r.id} className="study-card">
              <div className="km-track-head">
                <span className="km-sit-icon">{r.icon}</span>
                <span className="km-sit-name">{r.name}</span>
              </div>
              {units.map((u) => (
                <div key={u.id} className="km-real">
                  <UnitRow u={u} />
                  {u.grounding && <div className="km-grounding muted">근거 · {u.grounding}</div>}
                </div>
              ))}
            </div>
          );
        })}
    </div>
  );
}
