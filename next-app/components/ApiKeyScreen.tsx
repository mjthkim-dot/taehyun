'use client';

/**
 * AI 키 등록 — 회화 화면에 묻혀 있던 키 입력을 기능 탭의 독립 화면으로 뺀 것.
 * 키는 이 기기에만 저장되고(localStorage) 서버로 보관되지 않는다.
 *
 * 상태 표시가 이 화면의 핵심이다: 서버 키(배포 환경변수)와 기기 키가 동시에
 * 존재할 수 있고, 서버 라우트는 서버 키를 우선 쓰지만 클라이언트 게이팅은
 * 기기 키를 먼저 본다 — 그 차이 때문에 "등록했는데 왜 경고가 뜨지?"가 생겼다.
 * 그래서 지금 실제로 어느 키로 동작하는지를 문장으로 명확히 알려준다.
 */
import { useEffect, useState } from 'react';
import { groqKey, saveGroqKey, clearGroqKey, hasServerGroqKey, SERVER_GROQ_SENTINEL } from '../lib/state';
import { validateGroqKey } from '../lib/groq';

export default function ApiKeyScreen() {
  const [ready, setReady] = useState(false);
  const [localKey, setLocalKey] = useState('');
  const [serverKey, setServerKey] = useState(false);
  /** 기기 키 검증 결과 — true 유효 / false 거부 / null 판단 불가(네트워크) */
  const [valid, setValid] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const k = groqKey();
    setLocalKey(k === SERVER_GROQ_SENTINEL ? '' : k);
    setServerKey(hasServerGroqKey());
    setReady(true);
    // 서버가 실제로 키를 갖고 있는지는 런타임 확인이 가장 정확하다
    // (빌드 플래그는 재배포 전이면 뒤처져 있을 수 있다).
    fetch('/app/api/groq')
      .then((r) => r.json())
      .then((j) => setServerKey((prev) => prev || j.hasServerKey === true))
      .catch(() => {
        /* 네트워크 실패는 아래 검증에서 드러난다 */
      });
  }, []);

  // 저장된 기기 키가 아직 살아있는지 화면을 열 때 한 번 확인한다.
  useEffect(() => {
    if (!localKey) return;
    let alive = true;
    validateGroqKey(localKey).then((v) => {
      if (alive) setValid(v);
    });
    return () => {
      alive = false;
    };
  }, [localKey]);

  if (!ready) return null;

  async function save() {
    const k = input.trim();
    if (!k || checking) return;
    setError('');
    setNotice('');
    if (!k.startsWith('gsk_')) {
      setError('Groq 키는 gsk_ 로 시작해요. console.groq.com에서 복사한 값을 그대로 붙여넣어 주세요.');
      return;
    }
    setChecking(true);
    // 무효한 키를 조용히 받아들이면 모든 AI 기능이 소리 없이 401로 죽는다(실제 사고).
    const v = await validateGroqKey(k);
    setChecking(false);
    if (v === false) {
      setError('이 키는 Groq에서 거부됐어요(만료·폐기됐을 수 있음). console.groq.com에서 새 키를 발급해 주세요.');
      return;
    }
    saveGroqKey(k);
    setLocalKey(k);
    setValid(v);
    setInput('');
    setNotice(v === true ? '키 확인 완료 — AI 회화·음성이 활성화됐어요.' : '키를 저장했어요(네트워크 문제로 검증은 건너뜀).');
  }

  function remove() {
    clearGroqKey();
    setLocalKey('');
    setValid(null);
    setNotice(serverKey ? '기기 키를 지웠어요 — 이제 서버에 등록된 키로 동작합니다.' : '기기 키를 지웠어요. AI 기능을 쓰려면 키를 다시 등록해 주세요.');
  }

  /* 지금 실제로 무엇으로 동작하는지 한 줄로 판정한다. */
  const active = localKey && valid !== false ? '기기 키' : serverKey ? '서버 키' : null;

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>AI 키 등록</h3>
        <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.6, marginBottom: 14 }}>
          Groq 무료 API 키를 등록하면 AI 회화·번역·첨삭·신경망 음성이 모두 켜집니다.
          키는 <b>이 기기에만</b> 저장되고 서버나 백업 파일에 포함되지 않아요.
        </p>

        {/* 현재 상태 — 이 화면의 본체 */}
        <div className={`key-status${active ? ' on' : ''}`}>
          <div className="key-status-head">
            {active ? `현재 ${active}로 동작 중` : 'AI 기능이 꺼져 있어요'}
          </div>
          <ul className="key-status-list">
            <li>
              <span>기기 키</span>
              <b>
                {localKey
                  ? `${localKey.slice(0, 7)}… ${valid === true ? '· 유효 확인' : valid === false ? '· Groq에서 거부됨' : '· 확인 중'}`
                  : '없음'}
              </b>
            </li>
            <li>
              <span>서버 키(배포 환경변수)</span>
              <b>{serverKey ? '등록됨' : '없음'}</b>
            </li>
          </ul>
          {localKey && valid === false && serverKey && (
            <div className="key-status-note">
              기기 키는 만료됐지만 서버 키가 살아있어 기능은 정상입니다. 아래 <b>기기 키 삭제</b>를 누르면 경고가 사라져요.
            </div>
          )}
          {localKey && valid === false && !serverKey && (
            <div className="key-status-note bad">
              이 상태에서는 AI 회화·음성이 조용히 실패합니다. 새 키를 발급해 아래에 등록해 주세요.
            </div>
          )}
        </div>

        {error && <div className="key-msg bad">{error}</div>}
        {notice && <div className="key-msg ok">{notice}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            className="text-input"
            type="password"
            inputMode="text"
            autoComplete="off"
            placeholder="gsk_..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <button className="btn primary key-save" style={{ flex: '0 0 auto' }} onClick={save} disabled={checking || !input.trim()}>
            {checking ? '확인 중…' : localKey ? '교체' : '등록'}
          </button>
        </div>

        {localKey && (
          <button className="btn key-remove" style={{ width: '100%', marginTop: 8 }} onClick={remove}>
            기기 키 삭제
          </button>
        )}

        <div className="key-help">
          <div className="key-help-title">키 발급 방법 (무료 · 1분)</div>
          <ol>
            <li>
              <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                console.groq.com/keys
              </a>{' '}
              접속 후 로그인
            </li>
            <li>Create API Key → 이름은 아무거나 → 생성</li>
            <li>
              <b>gsk_</b> 로 시작하는 값을 복사(창을 닫으면 다시 볼 수 없어요)
            </li>
            <li>위 입력창에 붙여넣고 등록 — 저장 시 Groq에 유효성을 즉시 확인합니다</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
