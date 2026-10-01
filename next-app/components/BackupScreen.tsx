'use client';

// 화면 전용 스타일 — 이 화면을 처음 열 때 함께 받는다(홈 첫 로딩의 렌더 차단 CSS에서 분리)
import '../app/screens.css';

/**
 * 백업 · 복원 — 학습 데이터(진도·표현장·복습 카드·질문 기록 등)를 JSON 파일로
 * 내보내고, 다른 기기/브라우저에서 그 파일로 복원한다. 로직은 lib/backup.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { downloadBackup, restoreBackup, dataSummary, eraseAllData, BACKUP_SCOPE_NOTE } from '../lib/backup';
import { flagList, resetFlags, setFlag } from '../lib/flags';

/**
 * '고급 ▾' 접힘(M1) — 설정류는 집중 모드에 새 화면을 만들지 않고 전부 이 한 섹션(#adv-section) 안에 둔다.
 * 지금은 '실험 기능 되돌리기' 토글 목록. M0의 '소리 점검' 버튼도 같은 섹션에 들어온다(통합 시 합친다).
 */
function AdvancedSection() {
  const [flags, setFlags] = useState(() => flagList());
  const changed = flags.filter((f) => f.on !== f.def).length;
  const toggle = (key: string, on: boolean) => {
    setFlag(key, on);
    setFlags(flagList());
  };
  return (
    <details className="bk-adv" id="adv-section">
      <summary className="bk-adv-sum">고급 ▾{changed ? <span className="bk-adv-badge">{changed}개 꺼짐</span> : null}</summary>
      <div className="bk-adv-body">
        <div className="bk-adv-title">🧪 실험 기능 되돌리기</div>
        <p className="bk-adv-desc">새로 들어온 말하기 기능이 불편하면 하나씩 끌 수 있어요. 끄면 예전 방식으로 돌아갑니다.</p>
        <ul className="bk-flags" aria-label="실험 기능">
          {flags.map((f) => (
            <li key={f.key} className="bk-flag">
              <label className="bk-flag-label">
                <input type="checkbox" role="switch" checked={f.on} aria-checked={f.on} onChange={(e) => toggle(f.key, e.target.checked)} />
                <span>{f.label}</span>
              </label>
            </li>
          ))}
        </ul>
        {changed > 0 && (
          <button
            type="button"
            className="btn bk-btn bk-btn-outline bk-flags-reset"
            onClick={() => {
              resetFlags();
              setFlags(flagList());
            }}
          >
            모두 기본값으로
          </button>
        )}
      </div>
    </details>
  );
}

export default function BackupScreen() {
  const [ready, setReady] = useState(false);
  const [summary, setSummary] = useState({ episodes: 0, words: 0, grammar: 0, phrases: 0, weak: 0, askHistory: 0, days: 0, sessions: 0, chatLogs: 0 });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 브라우저가 기록을 지울 수 있는 상태인가(영구 저장 거부) — 그렇다면 백업을 더 권한다
  const [volatile, setVolatile] = useState(false);
  useEffect(() => {
    setSummary(dataSummary());
    setReady(true);
    try {
      void navigator.storage?.persisted?.().then((p) => setVolatile(!p)).catch(() => undefined);
    } catch {
      /* 미지원 */
    }
  }, []);

  if (!ready) return null;

  function onExport() {
    downloadBackup();
    setMsg({ ok: true, text: '백업 파일을 내려받았어요. 안전한 곳에 보관하세요.' });
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    if (!window.confirm('백업 파일의 데이터로 현재 데이터를 덮어쓸까요? (파일에 없는 항목은 그대로 유지됩니다)')) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const text = await file.text();
    const result = restoreBackup(text);
    setMsg({ ok: result.ok, text: result.message });
    if (result.ok) setSummary(dataSummary());
    if (fileRef.current) fileRef.current.value = '';
    // 복원한 값으로 앱 전체(모드·탭·진도)를 다시 읽도록 — 예전엔 새로고침 전까지 옛 상태 그대로였다
    if (result.ok) setTimeout(() => window.location.reload(), 1200);
  }

  const stats: { label: string; value: number }[] = [
    { label: '학습한 날', value: summary.days },
    { label: '본 드라마', value: summary.episodes },
    { label: '공부한 단어', value: summary.words },
    { label: '문법 유닛', value: summary.grammar },
    { label: '저장한 표현', value: summary.phrases },
    { label: '복습 카드', value: summary.weak },
    { label: '질문 기록', value: summary.askHistory },
    { label: '회화 세션', value: summary.sessions },
    { label: '대화 기록', value: summary.chatLogs },
  ];

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>💾 백업 · 복원</h3>
        <div className="bk-desc">
          학습 데이터는 이 브라우저에만 저장돼요. 브라우저 데이터를 지우거나 기기를 바꾸면 사라지니, 가끔 백업해 두세요.
        </div>
        {volatile && (
          <div className="bk-desc" role="note">
            ⚠️ 이 브라우저는 저장 공간이 부족하거나 오래 열지 않으면 기록을 지울 수 있어요. 홈 화면에 추가(설치)하고, 가끔 아래 버튼으로 파일을 받아 두세요.
          </div>
        )}

        <div className="bk-stats">
          {stats.map((s) => (
            <div className="bk-stat" key={s.label}>
              <div className="bk-stat-num">{s.value}</div>
              <div className="bk-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {msg && <div className={`bk-msg${msg.ok ? '' : ' err'}`}>{msg.ok ? '✅' : '❌'} {msg.text}</div>}

        <button type="button" className="btn primary bk-btn" onClick={onExport}>
          ⬇️ 백업 파일 내려받기
        </button>
        <button type="button" className="btn bk-btn bk-btn-outline" onClick={() => fileRef.current?.click()}>
          ⬆️ 백업 파일에서 복원
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => onImportFile(e.target.files?.[0])}
        />

        <div className="bk-note">
          🔑 Groq API 키는 보안을 위해 백업 파일에 포함되지 않아요 — 복원 후 회화 탭에서 한 번만 다시 등록하면 됩니다.
        </div>
        <div className="bk-note bk-note-rec">{BACKUP_SCOPE_NOTE}</div>

        <button
          type="button"
          className="btn bk-btn bk-btn-danger"
          onClick={() => {
            if (!window.confirm('학습 데이터 전체(진도·표현장·복습 카드·설정·API 키)를 삭제할까요? 되돌릴 수 없어요.')) return;
            if (!window.confirm('정말 삭제할까요? 백업 파일을 먼저 내려받는 것을 권장합니다.')) return;
            eraseAllData();
            window.location.reload();
          }}
        >
          🗑 모든 데이터 삭제
        </button>

        <AdvancedSection />
      </div>
    </div>
  );
}
