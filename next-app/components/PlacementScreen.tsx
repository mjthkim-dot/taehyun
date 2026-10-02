'use client';

// 화면 전용 스타일 — 이 화면을 처음 열 때 함께 받는다(홈 첫 로딩의 렌더 차단 CSS에서 분리)
import '../app/screens.css';

/**
 * CEFR 배치고사 — voice-assistant/index.html 의 renderPlacement()/gradePlacement() 포팅.
 * 18문항(A1~C2 각 3문항) 객관식으로 레벨을 추정하고 프로필/스킬 시작점을 설정한다.
 */
import { isFocusMode } from '../lib/focus';
import { requestDramaAutoplay } from '../lib/homeLite';
import { primeAudio } from './SpeakButton';
import type { Mode } from './NavBar';
import { syncCefr } from '../lib/cefrGrowth';
import { useState } from 'react';
import dynamic from 'next/dynamic';

// M10 말하기 기준선 — 결과 화면에서만 필요하니 문항 화면 청크에 넣지 않는다(녹음·STT·저장소를 끌고 온다)
const BaselineStep = dynamic(() => import('./BaselineStep'), { ssr: false });
import { CEFR_GSE, CEFR_ORDER, type Cefr } from '../lib/cefr';
import { getProfile, getSkillStats, saveProfile, scaffoldFor, SKILLS, store } from '../lib/state';

const PLACEMENT_Q: { lv: Cefr; q: string; o: string[]; a: number }[] = [
  { lv: 'A1', q: '___ name is Mina.', o: ['My', 'Me', 'I', 'Mine'], a: 0 },
  { lv: 'A1', q: 'She ___ a teacher.', o: ['are', 'is', 'am', 'be'], a: 1 },
  { lv: 'A1', q: 'There ___ two cats on the sofa.', o: ['is', 'am', 'are', 'be'], a: 2 },
  { lv: 'A2', q: 'I ___ to the gym yesterday.', o: ['go', 'goes', 'went', 'going'], a: 2 },
  { lv: 'A2', q: 'This bag is ___ than that one.', o: ['cheap', 'cheaper', 'cheapest', 'more cheap'], a: 1 },
  { lv: 'A2', q: 'We ___ watch a movie tonight.', o: ['are going to', 'goes to', 'is going', 'go to'], a: 0 },
  { lv: 'B1', q: 'I have lived here ___ 2019.', o: ['for', 'since', 'from', 'during'], a: 1 },
  { lv: 'B1', q: 'If it rains, we ___ stay home.', o: ['will', 'would', 'are', 'have'], a: 0 },
  { lv: 'B1', q: 'You ___ smoke here — it is not allowed.', o: ["mustn't", "don't have to", 'might not', 'needn\'t'], a: 0 },
  { lv: 'B2', q: 'By next year, she ___ here for a decade.', o: ['will work', 'will have worked', 'works', 'worked'], a: 1 },
  { lv: 'B2', q: 'The report, ___ was due Monday, is still missing.', o: ['who', 'which', 'that', 'what'], a: 1 },
  { lv: 'B2', q: 'I wish I ___ more time to prepare.', o: ['have', 'had', 'will have', 'am having'], a: 1 },
  { lv: 'C1', q: '___ had I arrived when the meeting started.', o: ['No sooner', 'Hardly', 'Scarcely', 'Rarely'], a: 1 },
  { lv: 'C1', q: 'Choose the best fit: "Her argument was ___ and hard to refute."', o: ['cogent', 'cozy', 'candid', 'curt'], a: 0 },
  { lv: 'C1', q: 'He spoke as though he ___ the whole story.', o: ['knows', 'knew', 'had known', 'has known'], a: 2 },
  { lv: 'C2', q: 'The proposal was, to put it ___, dead on arrival.', o: ['mildly', 'bluntly', 'vaguely', 'fondly'], a: 1 },
  { lv: 'C2', q: 'Pick the idiom: "They decided to ___ the issue rather than confront it."', o: ['skirt', 'skim', 'ski', 'skip'], a: 0 },
  { lv: 'C2', q: '"Notwithstanding the setbacks, the team ___ undeterred."', o: ['remain', 'remains', 'remained', 'is remaining'], a: 2 },
];

const CEFR_LABEL: Record<Cefr, string> = {
  A1: '입문 (Beginner)',
  A2: '기초 (Elementary)',
  B1: '중급 (Intermediate)',
  B2: '중상급 (Upper-Int.)',
  C1: '고급 (Advanced)',
  C2: '원어민급 (Mastery)',
};

interface Result {
  cefr: Cefr;
  gse: number;
  correct: number;
}

export default function PlacementScreen({ onDone, onNavigate }: { onDone?: () => void; onNavigate?: (m: Mode) => void }) {
  const focus = isFocusMode();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);

  function pick(i: number, j: number) {
    setAnswers((a) => ({ ...a, [i]: j }));
  }

  function grade() {
    const byLv: Record<Cefr, { correct: number; total: number }> = {} as never;
    CEFR_ORDER.forEach((c) => (byLv[c] = { correct: 0, total: 0 }));
    PLACEMENT_Q.forEach((item, i) => {
      byLv[item.lv].total++;
      if (answers[i] === item.a) byLv[item.lv].correct++;
    });
    let passed: Cefr = 'A1';
    for (const c of CEFR_ORDER) {
      if (byLv[c].total && byLv[c].correct / byLv[c].total >= 0.6) passed = c;
    }
    const totalCorrect = Object.values(byLv).reduce((a, b) => a + b.correct, 0);
    const band = CEFR_GSE[passed];
    const gse = Math.min(90, band.min + Math.round((band.max - band.min) * Math.min(1, totalCorrect / PLACEMENT_Q.length + 0.2)));

    const prof = getProfile();
    prof.cefr = passed;
    prof.gse = gse;
    prof.scaffolding = scaffoldFor(passed);
    saveProfile(prof);
    const stats = getSkillStats();
    SKILLS.forEach((sk) => {
      stats[sk.key] = { gse, sessions: stats[sk.key]?.sessions || 0 };
    });
    store('va_skill_stats', stats);
    store('va_placed', { cefr: passed, gse, ts: Date.now() });
    syncCefr(); // 배치 결과가 4기능의 출발점(사전값)이 된다

    setResult({ cefr: passed, gse, correct: totalCorrect });
  }

  if (result) {
    return (
      <div className="study-screen">
        <div className="study-card" style={{ textAlign: 'center', border: '1px solid var(--primary)', padding: 22 }}>
          <div className="muted" style={{ fontSize: '0.8rem' }}>당신의 추정 레벨</div>
          <div style={{ fontSize: '2.6rem', fontWeight: 900, color: 'var(--primary-light)', margin: '4px 0' }}>{result.cefr}</div>
          {/* GSE 숫자는 뺐다 — 레벨 카드의 GSE(입증 진척 기반)와 계산이 달라 화면마다 숫자가 달랐다 */}
          <div className="muted" style={{ fontSize: '0.82rem' }}>{CEFR_LABEL[result.cefr]}</div>
          <div style={{ fontSize: '0.78rem', marginTop: 8 }}>
            정답 {result.correct} / {PLACEMENT_Q.length}
          </div>
        </div>
        {/* M10 — 마지막 한 단계: 자유 발화로 말하기 레벨 보정(건너뛰기 가능) */}
        <BaselineStep level={result.cefr} />
        {focus ? (
          // 집중 모드 — 숨긴 기능(레슨 로드맵·청해·독해)을 안내하지 않는다. 다음 할 일은 하나.
          <div className="study-card" style={{ fontSize: '0.86rem', lineHeight: 1.7 }}>
            <b>다음 단계</b>
            <br />
            이제 <b>드라마 1화(5분)</b>만 보면 첫날 학습이 끝나요.
          </div>
        ) : (
          <div className="study-card" style={{ fontSize: '0.82rem', lineHeight: 1.7 }}>
            <b>다음 단계 추천</b>
            <br />
            📖 레슨 로드맵에서 <b style={{ color: 'var(--primary-light)' }}>{result.cefr}</b> 유닛부터 시작
            <br />
            🎧 청해 · 📖 독해 · ✍️ 작문도 {result.cefr} 레벨로 자동 설정됨
          </div>
        )}
        <button
          className="start-drill-btn"
          onClick={() => {
            // 집중 모드: 홈을 한 번 더 거치지 않고 바로 1화 재생(탭 안이라 오디오도 언락된다)
            if (focus && onNavigate) {
              primeAudio();
              requestDramaAutoplay();
              onNavigate('drama');
              return;
            }
            onDone?.();
          }}
        >
          {focus ? '바로 1화 보기 →' : '📖 내 레벨 로드맵 보기 →'}
        </button>
        <button
          className="btn"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => {
            setAnswers({});
            setResult(null);
          }}
        >
          ↻ 다시 풀기
        </button>
      </div>
    );
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>🧭 CEFR 배치고사</h3>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          18문항 · 내 레벨(A1~C2)을 진단해 학습 경로를 맞춥니다. 문법·어휘 객관식입니다. 모르면 찍지 말고
          비워두세요(정확한 진단을 위해). 끝까지 풀고 <b>채점</b>을 누르면 CEFR 레벨과 4대 영역 시작점이
          설정됩니다.
        </p>
      </div>

      {PLACEMENT_Q.map((item, i) => (
        <div className="study-card" key={i}>
          <div id={`pl-q-${i}`} style={{ fontSize: '0.86rem', fontWeight: 700, marginBottom: 9 }}>
            <span style={{ color: 'var(--primary)' }}>Q{i + 1}.</span> {item.q}
          </div>
          {/* 보기 = 라디오 그룹(스크린리더가 '선택됨'을 읽는다), 누르기 쉬운 48px 높이·10px 간격 */}
          <div role="radiogroup" aria-labelledby={`pl-q-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {item.o.map((opt, j) => {
              const on = answers[i] === j;
              return (
                <button
                  key={j}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(i, j)}
                  style={{
                    textAlign: 'left',
                    minHeight: 48,
                    padding: '10px 12px',
                    borderRadius: 10,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    border: `${on ? 2 : 1}px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                    background: on ? 'var(--primary)' : 'var(--surface2)',
                    color: on ? 'var(--on-primary)' : 'var(--text)',
                    fontWeight: on ? 800 : 500,
                  }}
                >
                  {on ? '✓ ' : ''}
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button className="start-drill-btn" onClick={grade}>📊 채점하고 내 레벨 보기</button>
    </div>
  );
}
