'use client';

/**
 * 수업 노트 화면 — 진옥 선생님 수업(Preply)이 앱 훈련으로 이어지는 입구.
 * 회차 목록 → 상세(문법·문장·발음·숙제·약점) → 문장은 자동으로 SRS에 들어가
 * 세션 워밍업에 나타나고, 버튼 하나로 그 회차 드릴을 돌 수 있다.
 *
 * 상태 설계(4종): 동기화됨(시각 표시) / 시드 스냅숏 / 오프라인 / 미설정(안내).
 */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import { getPreplyNotes, importAllNew, importedNoteIds, syncPreply, type PreplyNote, type PreplySource } from '../lib/preply';
import { setDrillQueue } from '../lib/state';
import { speakText } from './SpeakButton';
import { SpeakerIcon } from './icons';

function timeAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}분 전`;
  if (m < 1440) return `${Math.round(m / 60)}시간 전`;
  return `${Math.round(m / 1440)}일 전`;
}

export default function PreplyScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [data, setData] = useState<{ notes: PreplyNote[]; source: PreplySource; syncedAt: string | null } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [unconfigured, setUnconfigured] = useState(false);
  const [importedMsg, setImportedMsg] = useState('');

  function refresh() {
    setData(getPreplyNotes());
  }

  useEffect(() => {
    refresh();
    // 새 노트의 문장은 자동으로 SRS 파이프라인에 들어간다(노트 단위 멱등)
    const r = importAllNew();
    if (r.sentences > 0) setImportedMsg(`이번에 문장 ${r.sentences}개가 복습 큐에 새로 들어갔어요.`);
  }, []);

  async function doSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg('');
    try {
      const r = await syncPreply();
      if (r.ok) {
        setSyncMsg(`동기화 완료 — 노트 ${r.count}개`);
        refresh();
        const imp = importAllNew();
        if (imp.sentences > 0) setImportedMsg(`새 문장 ${imp.sentences}개가 복습 큐에 들어갔어요.`);
      } else if (r.unconfigured) {
        setUnconfigured(true);
      } else if (r.error === 'offline') {
        setSyncMsg('오프라인이에요 — 저장된 노트로 계속 공부할 수 있어요.');
      } else {
        setSyncMsg('동기화에 실패했어요 — 저장된 노트를 그대로 쓸 수 있어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSyncing(false);
    }
  }

  if (!data) return <div className="screen-loading" aria-label="불러오는 중" />;

  const imported = new Set(importedNoteIds());
  const srcLabel =
    data.source === 'synced' && data.syncedAt
      ? `Notion 동기화 · ${timeAgo(data.syncedAt)}`
      : data.source === 'cache'
        ? '저장된 노트'
        : '시드 스냅숏 (2026-08-13 실사)';

  return (
    <div className="study-screen">
      <div className="pp-head">
        <div className="pp-src">📒 {srcLabel}</div>
        <button type="button" className="mini-btn" disabled={syncing} onClick={doSync}>
          {syncing ? '동기화 중…' : '🔄 동기화'}
        </button>
      </div>
      {syncMsg && <p className="muted pp-msg">{syncMsg}</p>}
      {importedMsg && <p className="pp-imported">✅ {importedMsg}</p>}

      {unconfigured && (
        <div className="study-card pp-setup">
          <h3>Notion 연동 설정</h3>
          <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.7 }}>
            아직 서버에 Notion 토큰이 없어 <b>시드 스냅숏</b>으로 동작 중이에요. 실시간 동기화를 켜려면:
          </p>
          <ol className="pp-steps">
            <li>notion.so/my-integrations에서 내부 통합(Integration) 생성 → 토큰 복사</li>
            <li>Notion의 "영어 진옥" 페이지 → ⋯ → 연결 추가로 통합을 초대</li>
            <li>Vercel 환경변수 <code>NOTION_API_KEY</code>, <code>NOTION_PREPLY_PAGE_ID</code> 설정 후 재배포</li>
          </ol>
        </div>
      )}

      {data.notes.length === 0 ? (
        <div className="study-card">
          <p className="muted">표시할 수업 노트가 없어요 — 동기화를 눌러 가져오세요.</p>
        </div>
      ) : (
        data.notes.map((n) => {
          const isOpen = open === n.id;
          return (
            <div key={n.id} className={`pp-note${isOpen ? ' open' : ''}`}>
              <button type="button" className="pp-note-head" onClick={() => setOpen(isOpen ? null : n.id)}>
                <span className="pp-round">{n.round}회차</span>
                <span className="pp-title">{n.title}</span>
                <span className="pp-date">{n.date}</span>
              </button>
              {isOpen && (
                <div className="pp-body">
                  {n.grammar.length > 0 && (
                    <>
                      <div className="pp-sec">📖 문법</div>
                      <ul className="pp-list">{n.grammar.map((g, i) => <li key={i}>{g}</li>)}</ul>
                    </>
                  )}
                  <div className="pp-sec">
                    🗣 연습 문장 {imported.has(n.id) && <span className="pp-chip">SRS 등록됨 ✓</span>}
                  </div>
                  {n.sentences.map((s, i) => (
                    <div className="pp-sent" key={i}>
                      <div className="pp-sent-en">
                        {s.en}
                        <button type="button" className="speak-mini" aria-label="듣기" onClick={() => speakText(s.en, 'en-US')}>
                          <SpeakerIcon />
                        </button>
                      </div>
                      <div className="pp-sent-kr">{s.kr}</div>
                    </div>
                  ))}
                  {n.pron.length > 0 && (
                    <>
                      <div className="pp-sec">🔊 발음</div>
                      <ul className="pp-list">{n.pron.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </>
                  )}
                  {n.homework.length > 0 && (
                    <>
                      <div className="pp-sec">✅ 숙제</div>
                      <ul className="pp-list">{n.homework.map((h, i) => <li key={i}>{h}</li>)}</ul>
                    </>
                  )}
                  {n.weakPoints.length > 0 && (
                    <>
                      <div className="pp-sec">🎯 보강 포인트</div>
                      <ul className="pp-list pp-weak">{n.weakPoints.map((w, i) => <li key={i}>{w}</li>)}</ul>
                    </>
                  )}
                  <button
                    type="button"
                    className="start-drill-btn"
                    style={{ marginTop: 12 }}
                    onClick={() => {
                      setDrillQueue({ label: `${n.round}회차 수업`, items: n.sentences });
                      onNavigate('drill');
                    }}
                  >
                    🎤 이 회차 문장으로 드릴 →
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
