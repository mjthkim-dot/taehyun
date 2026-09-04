'use client';

/**
 * 첫 실행 온보딩 — 처음 열었을 때 "무엇부터 해야 하는지"를 정해준다.
 *
 * 지금까지는 앱을 열면 곧바로 홈이 나왔다. 그런데 AI 키가 없으면 회화·음성·
 * 질문이 전부 조용히 막히고, 레벨 진단을 안 하면 커리큘럼이 어디서 시작해야
 * 할지 알 수 없다. 그 두 가지를 첫 화면에서 처리하고, 하루 목표를 정하게 해
 * '오늘 할 일'이 있는 상태로 홈에 도착하게 만든다.
 *
 * 원칙: 건너뛸 수 있어야 한다. 온보딩이 벽이 되면 안 된다.
 */
import { useState } from 'react';
import { APP_NAME_KO, APP_TAGLINE_KO } from '../lib/brand';
import { saveGroqKey, store, load } from '../lib/state';
import { validateGroqKey } from '../lib/groq';

export const ONBOARDED_KEY = 'va_onboarded';

/** 온보딩을 이미 마쳤는지 — 마쳤거나 건너뛰었으면 다시 띄우지 않는다. */
export function needsOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return !load<boolean>(ONBOARDED_KEY, false);
}

const GOALS = [
  { value: 10, label: '가볍게', desc: '하루 10문장 · 5분' },
  { value: 20, label: '꾸준히', desc: '하루 20문장 · 10분' },
  { value: 40, label: '집중', desc: '하루 40문장 · 20분' },
];

export default function Onboarding({ onDone, onPlacement }: { onDone: () => void; onPlacement: () => void }) {
  const [step, setStep] = useState(0);
  const [key, setKey] = useState('');
  const [checking, setChecking] = useState(false);
  const [keyErr, setKeyErr] = useState('');
  const [keyOk, setKeyOk] = useState(false);
  const [goal, setGoal] = useState(20);

  function finish(startPlacement: boolean) {
    store(ONBOARDED_KEY, true);
    store('va_daily_goal', goal);
    if (startPlacement) onPlacement();
    else onDone();
  }

  async function saveKey() {
    const k = key.trim();
    if (!k || checking) return;
    setKeyErr('');
    if (!k.startsWith('gsk_')) {
      setKeyErr('Groq 키는 gsk_ 로 시작해요. 복사한 값을 그대로 붙여넣어 주세요.');
      return;
    }
    setChecking(true);
    const valid = await validateGroqKey(k);
    setChecking(false);
    if (valid === false) {
      setKeyErr('이 키는 Groq에서 거부됐어요. console.groq.com에서 새로 발급해 주세요.');
      return;
    }
    saveGroqKey(k);
    setKeyOk(true);
    setStep(2);
  }

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="onb-dots" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="onb-logo">EC</div>
            <h2>{APP_NAME_KO}</h2>
            <p className="onb-lead">{APP_TAGLINE_KO}</p>
            <p className="onb-body">
              읽고 끝나는 영어가 아니라 <b>소리 내어 말하는</b> 연습을 매일 이어가는 앱입니다.
              CEFR 48단계 커리큘럼, IT 영업 실무 어휘, AI 롤플레이가 하나로 이어집니다.
            </p>
            <button className="btn primary onb-next" onClick={() => setStep(1)}>
              시작하기
            </button>
            <button className="onb-skip" onClick={() => finish(false)}>
              둘러보기만 할게요
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h2>AI 연결</h2>
            <p className="onb-body">
              무료 Groq 키를 넣으면 <b>AI 회화·발음 인식·즉석 질문</b>이 모두 켜집니다.
              키는 이 기기에만 저장되고 서버나 백업 파일에 담기지 않아요.
            </p>
            <ol className="onb-steps">
              <li>
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                  console.groq.com/keys
                </a>{' '}
                접속 후 로그인
              </li>
              <li>Create API Key → 생성된 값 복사</li>
            </ol>
            {keyErr && <div className="onb-err">{keyErr}</div>}
            <div className="onb-keyrow">
              <input
                className="text-input"
                type="password"
                placeholder="gsk_..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveKey()}
              />
              <button className="btn primary onb-keysave" onClick={saveKey} disabled={checking || !key.trim()}>
                {checking ? '확인 중…' : '연결'}
              </button>
            </div>
            <button className="onb-skip" onClick={() => setStep(2)}>
              나중에 할게요 — 기능 탭에서 언제든 등록할 수 있어요
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2>하루 목표</h2>
            {keyOk && <div className="onb-ok">AI 연결 완료 — 회화·음성이 켜졌어요.</div>}
            <p className="onb-body">
              목표는 <b>소리 내어 말한 문장 수</b>로 셉니다. 나중에 바꿀 수 있어요.
            </p>
            <div className="onb-goals">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  className={`onb-goal${goal === g.value ? ' on' : ''}`}
                  onClick={() => setGoal(g.value)}
                >
                  <b>{g.label}</b>
                  <span>{g.desc}</span>
                </button>
              ))}
            </div>
            <button className="btn primary onb-next" onClick={() => finish(true)}>
              레벨 진단하고 시작하기
            </button>
            <button className="onb-skip" onClick={() => finish(false)}>
              진단 없이 바로 시작
            </button>
          </>
        )}
      </div>
    </div>
  );
}
