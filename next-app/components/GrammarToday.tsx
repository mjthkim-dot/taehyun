'use client';

/**
 * 홈의 '오늘의 문법' 카드 + 업데이트 안내.
 * 문법 시뮬레이션이 레슨 안(2단계)이나 더보기 속에만 있으면 홈에선 "달라진 게 없어" 보인다
 * (실제 피드백). 홈에서 바로 보이고 한 번에 들어가게 한다.
 */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import { pickTodayGrammar, grammarProgress, type GrammarUnit } from '../lib/grammar';
import { overall } from '../lib/cefrGrowth';
import { setUnitHandoff } from '../lib/ontology/handoff';
import { load, store } from '../lib/state';
import { APP_VERSION } from '../lib/version';

export function GrammarTodayCard({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [u, setU] = useState<GrammarUnit | null>(null);
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => {
    const unit = pickTodayGrammar(overall().level);
    setU(unit);
    setBest(grammarProgress()[unit.id]?.best ?? null);
  }, []);
  if (!u) return <div className="study-card gm-today" style={{ minHeight: 150 }} aria-hidden="true" />;
  return (
    <section className="study-card gm-today" aria-label="오늘의 문법">
      <div className="pg-kicker">
        오늘의 문법 · {u.level} · {u.point}
      </div>
      <h3 className="gm-today-title">{u.title}</h3>
      <p className="muted gm-today-scene">{u.scene}</p>
      <div className="gm-today-steps">사고 → 판단 → 조립 → 실전 대화 · 약 8분{best !== null ? ` · 최고 ${best}점` : ''}</div>
      <button
        type="button"
        className="btn gm-today-go"
        onClick={() => {
          setUnitHandoff({ source: 'grammar', key: u.id });
          onNavigate('grammar');
        }}
      >
        문법 시뮬레이션 시작
      </button>
    </section>
  );
}

const SEEN_KEY = 'va_seen_whatsnew';
/** 이 버전에서 알릴 것 — 버전이 바뀌면 다시 한 번 뜬다 */
const WHATS_NEW = {
  title: '이제 매번 다른 수업이에요',
  body: '같은 문법이라도 두 번째부터는 AI가 새 상황(호텔 체크인, 가격 협상, 임원 보고…)과 새 문제로 만들어요. 못 끝낸 문법은 하루 쉬었다가 다시 나오고, 레슨 제목도 매일 그날 배울 내용으로 바뀌어요.',
};

export function WhatsNew({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(load<string>(SEEN_KEY, '') !== APP_VERSION), []);
  if (!show) return null;
  const close = () => {
    store(SEEN_KEY, APP_VERSION);
    setShow(false);
  };
  return (
    <div className="wn-card" role="status">
      <div className="wn-top">
        <span className="wn-badge">v{APP_VERSION}</span>
        <b>{WHATS_NEW.title}</b>
      </div>
      <p>{WHATS_NEW.body}</p>
      <div className="wn-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            close();
            onNavigate('grammar');
          }}
        >
          바로 해보기
        </button>
        <button type="button" className="btn ghost" onClick={close}>
          닫기
        </button>
      </div>
    </div>
  );
}
