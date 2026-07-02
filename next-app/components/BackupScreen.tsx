'use client';

/**
 * 백업 · 복원 — 학습 데이터(진도·표현장·복습 카드·질문 기록 등)를 JSON 파일로
 * 내보내고, 다른 기기/브라우저에서 그 파일로 복원한다. 로직은 lib/backup.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { downloadBackup, restoreBackup, dataSummary } from '../lib/backup';

export default function BackupScreen() {
  const [ready, setReady] = useState(false);
  const [summary, setSummary] = useState({ phrases: 0, weak: 0, askHistory: 0, days: 0, sessions: 0, chatLogs: 0 });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSummary(dataSummary());
    setReady(true);
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
  }

  const stats: { label: string; value: number }[] = [
    { label: '학습한 날', value: summary.days },
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
      </div>
    </div>
  );
}
