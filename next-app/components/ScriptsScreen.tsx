'use client';

/**
 * 미팅 스크립트 — 직무 어휘를 '실제 대화'로 굴리는 화면.
 *
 * 어휘 화면이 낱개 표현을 다룬다면 여기서는 **상황 전체의 흐름**을 다룬다:
 * 단계별 목적 → 그 단계에서 쓰는 표현 → 흔한 실수 → 모범 대화 →
 * 같은 상황으로 AI와 롤플레이. 마지막 단계가 핵심이라, 읽고 끝나지 않는다.
 */
import { useState } from 'react';
import { SALES_SCENARIOS, type SalesScenario } from '../lib/salesScenarios';
import { setTalkContext } from '../lib/dailyMission';
import { addPhrase, setDrillQueue } from '../lib/state';
import SpeakButton from './SpeakButton';
import Note from './Note';
import ContextAsk from './ContextAsk';
import type { Mode } from './NavBar';

export default function ScriptsScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showDialogue, setShowDialogue] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);

  const scenario = SALES_SCENARIOS.find((s) => s.key === openKey) ?? null;

  function save(en: string, kr: string) {
    addPhrase({ en, kr, lesson: `script:${openKey}` });
    setSaved((prev) => (prev.includes(en) ? prev : [...prev, en]));
  }

  /** 같은 상황을 AI와 연습 — 회화 탭이 이 상황을 상대 역할로 물고 시작한다 */
  function practice(s: SalesScenario) {
    setTalkContext({
      title: s.label,
      desc: s.talkPrompt,
      examples: s.steps.flatMap((st) => st.lines).slice(0, 3).map((l) => ({ en: l.en, kr: l.kr })),
      checklist: s.checklist,
    });
    onNavigate('talk');
  }

  if (scenario) {
    return (
      <div className="study-screen">
        <button className="btn ghost script-back" onClick={() => { setOpenKey(null); setShowDialogue(false); }}>
          ← 목록으로
        </button>

        <div className="study-card">
          <h3>
            {scenario.icon} {scenario.label}
          </h3>
          <div className="script-situation">{scenario.situation}</div>
          <div className="script-goal">
            <span className="script-goal-label">이 대화의 목표</span>
            {scenario.goal}
          </div>

          <button className="btn primary script-practice" onClick={() => practice(scenario)}>
            이 상황으로 AI와 연습하기 →
          </button>
          <button
            className="btn ghost script-drill"
            onClick={() => {
              // 표현을 입에 붙이는 단계 — 이 상황의 표현 전체를 드릴 큐로 넘긴다
              setDrillQueue({
                label: `미팅 스크립트 — ${scenario.label}`,
                items: scenario.steps.flatMap((st) => st.lines).map((l) => ({ en: l.en, kr: l.kr })),
              });
              onNavigate('drill');
            }}
          >
            표현 드릴로 입에 붙이기 →
          </button>
        </div>

        {scenario.steps.map((step, i) => (
          <div className="study-card" key={step.label}>
            <h3>
              <span className="script-step-no">{i + 1}</span> {step.label}
            </h3>
            <div className="script-purpose">{step.purpose}</div>
            {step.lines.map((line) => (
              <div className="script-line" key={line.en}>
                <div className="script-en">
                  <span>{line.en}</span> <SpeakButton text={line.en} /> <SpeakButton text={line.en} slow />
                </div>
                <div className="script-kr">{line.kr}</div>
                {line.note && (
                  <div className="script-note">
                    <Note text={line.note} />
                  </div>
                )}
                <button className="script-save" onClick={() => save(line.en, line.kr)} disabled={saved.includes(line.en)}>
                  {saved.includes(line.en) ? '저장됨' : '표현장에 저장'}
                </button>
              </div>
            ))}
            {/* 이 단계의 목적·표현을 문맥으로 자유 질문 */}
            <ContextAsk
              ctx={{
                title: step.label,
                lessonTitle: `미팅 스크립트 — ${scenario.label}`,
                body: [step.purpose, ...step.lines.map((l) => `${l.en} (${l.kr})${l.note ? `\n${l.note}` : ''}`)].join('\n\n'),
              }}
            />
          </div>
        ))}

        <div className="study-card">
          <h3>흔한 실수</h3>
          <ul className="script-pitfalls">
            {scenario.pitfalls.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>

        <div className="study-card">
          <h3>모범 대화</h3>
          <p className="muted" style={{ fontSize: '0.78rem', lineHeight: 1.6, marginBottom: 10 }}>
            먼저 직접 말해본 뒤 열어보세요 — 답을 먼저 보면 기억에 남지 않습니다.
          </p>
          {!showDialogue ? (
            <button className="btn ghost" style={{ width: '100%' }} onClick={() => setShowDialogue(true)}>
              모범 대화 펼치기
            </button>
          ) : (
            <div className="script-dialogue">
              {scenario.dialogue.map((d, i) => (
                <div className={`script-turn ${d.sp === 'A' ? 'me' : 'you'}`} key={i}>
                  <div className="script-sp">{d.sp === 'A' ? '나' : '상대'}</div>
                  <div className="script-turn-body">
                    <div className="script-turn-en">
                      <span>{d.en}</span> <SpeakButton text={d.en} />
                    </div>
                    <div className="script-turn-kr">{d.kr}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn primary script-practice" style={{ width: '100%' }} onClick={() => practice(scenario)}>
          이 상황으로 AI와 연습하기 →
        </button>
      </div>
    );
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>미팅 스크립트</h3>
        <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.6, marginBottom: 4 }}>
          IT 영업 상황을 흐름 단위로 연습합니다. 단계별 목적과 표현을 익힌 뒤,
          같은 상황으로 <b>AI와 롤플레이</b>까지 이어집니다.
        </p>
      </div>

      {SALES_SCENARIOS.map((s) => (
        <button className="script-card" key={s.key} onClick={() => setOpenKey(s.key)}>
          <div className="script-card-ic">{s.icon}</div>
          <div className="script-card-body">
            <div className="script-card-label">{s.label}</div>
            <div className="script-card-desc">{s.situation}</div>
            <div className="script-card-meta">
              {s.steps.length}단계 · 표현 {s.steps.reduce((n, st) => n + st.lines.length, 0)}개
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
