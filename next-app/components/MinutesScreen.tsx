'use client';

/**
 * 회의록 영어 화면 — "노션에 회의록이 생기면 → 영어 대화문이 되는" 루프의 얼굴.
 *
 * 위: 만들어진 대화 목록(시드 포함) — 탭하면 DialoguePractice(듣기·역할·암기)가
 *     그 자리에서 열리고, 드릴 핸드오프로 이어진다.
 * 아래: Notion 최근 회의록 — 화면에 들어오면 자동으로 목록을 불러오고,
 *     아직 대화가 없는 문서엔 "새" 배지가 붙는다. 버튼 하나로 변환.
 *
 * 상태 4종: 목록 로드됨 / 미설정(안내) / 오프라인 / 실패(재시도 안내) —
 * Preply 파이프라인과 같은 정직한 폴백 원칙.
 */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import {
  generatedHashes,
  generateFromNote,
  getMinutesDialogues,
  listRemoteMinutes,
  type MinutesDialogue,
  type RemotePage,
} from '../lib/minutes';
import { setDrillQueue } from '../lib/state';
import DialoguePractice from './DialoguePractice';

function timeAgo(iso: string): string {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}분 전`;
  if (m < 1440) return `${Math.round(m / 60)}시간 전`;
  return `${Math.round(m / 1440)}일 전`;
}

type RemoteState =
  | { kind: 'loading' }
  | { kind: 'loaded'; pages: RemotePage[] }
  | { kind: 'unconfigured' }
  | { kind: 'offline' }
  | { kind: 'error' };

export default function MinutesScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [items, setItems] = useState<MinutesDialogue[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [remote, setRemote] = useState<RemoteState>({ kind: 'loading' });
  const [generating, setGenerating] = useState<string | null>(null);
  const [genMsg, setGenMsg] = useState('');

  function refresh() {
    setItems(getMinutesDialogues());
  }

  async function loadRemote() {
    setRemote({ kind: 'loading' });
    const r = await listRemoteMinutes();
    if (r.ok) setRemote({ kind: 'loaded', pages: r.pages || [] });
    else if (r.unconfigured) setRemote({ kind: 'unconfigured' });
    else if (r.error === 'offline') setRemote({ kind: 'offline' });
    else setRemote({ kind: 'error' });
  }

  // 루프의 핵심: 화면에 들어오면 스스로 Notion을 본다 — 버튼을 기다리지 않는다.
  useEffect(() => {
    refresh();
    void loadRemote();
  }, []);

  async function doGenerate(page: RemotePage) {
    if (generating) return;
    setGenerating(page.id);
    setGenMsg('');
    try {
      const r = await generateFromNote(page);
      if (r.ok && r.item) {
        refresh();
        setOpen(r.item.noteId);
        setGenMsg(r.cached ? '회의록이 그대로라 만들어 둔 대화를 다시 열었어요.' : `대화 생성 완료 — 「${r.item.title}」`);
      } else if (r.error === 'fetch') {
        setGenMsg('회의록 본문을 가져오지 못했어요 — 잠시 후 다시 시도해 주세요.');
      } else {
        setGenMsg('대화 생성에 실패했어요 — 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setGenerating(null);
    }
  }

  const hashes = generatedHashes();

  return (
    <div className="study-screen">
      <div className="study-card mn-intro">
        <p className="muted">
          Notion에 <b>업무 회의록</b>이 생기면, 그 회의를 영어로 다시 해보는 <b>롤플레이 대화문</b>으로 바꿔요.
          내가 실제로 한 회의라서 교재 예문보다 훨씬 내 일에 가깝습니다.
        </p>
      </div>

      {genMsg && <p className="pp-imported">💬 {genMsg}</p>}

      {/* ── 만들어진 대화 ── */}
      <div className="mn-sec-title">🎭 연습할 대화 ({items.length})</div>
      {items.map((it, idx) => {
        const isOpen = open === it.noteId;
        return (
          <div key={it.noteId} className={`mn-item${isOpen ? ' open' : ''}`}>
            <button type="button" className="mn-item-head" onClick={() => setOpen(isOpen ? null : it.noteId)}>
              <span className="mn-item-title">{it.title}</span>
              <span className="mn-item-note">
                {it.noteId === 'seed-seobuk' ? '내장 예시 · ' : ''}
                {it.noteTitle}
              </span>
            </button>
            {isOpen && (
              <div className="mn-item-body">
                {it.situation && <p className="mn-situation">{it.situation}</p>}
                <DialoguePractice dialogue={it.dialogue} lessonId={9000 + idx} />
                <button
                  type="button"
                  className="start-drill-btn"
                  onClick={() => {
                    setDrillQueue({
                      label: `회의록 영어 — ${it.title}`,
                      items: it.dialogue.lines.map((l) => ({ en: l.en, kr: l.kr })),
                    });
                    onNavigate('drill');
                  }}
                >
                  🎤 이 대화 문장으로 드릴 →
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Notion 최근 회의록 ── */}
      <div className="mn-sec-title" style={{ marginTop: 20 }}>
        📄 Notion 최근 회의록
        <button type="button" className="mini-btn" disabled={remote.kind === 'loading'} onClick={() => void loadRemote()}>
          {remote.kind === 'loading' ? '불러오는 중…' : '🔄 새로고침'}
        </button>
      </div>

      {remote.kind === 'unconfigured' && (
        <div className="study-card pp-setup">
          <h3>Notion 연동 설정</h3>
          <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.7 }}>
            아직 서버에 Notion 토큰이 없어 <b>내장 예시 대화</b>로 연습할 수 있어요. 회의록 자동 변환을 켜려면:
          </p>
          <ol className="pp-steps">
            <li>notion.so/my-integrations에서 내부 통합(Integration) 생성 → 토큰 복사</li>
            <li>회의록이 있는 Notion 페이지 → ⋯ → 연결 추가로 통합을 초대</li>
            <li>
              Vercel 환경변수 <code>NOTION_API_KEY</code> 설정 후 재배포 (수업 노트와 같은 토큰을 함께 써요)
            </li>
          </ol>
        </div>
      )}
      {remote.kind === 'offline' && <p className="muted pp-msg">오프라인이에요 — 만들어 둔 대화로 계속 연습할 수 있어요.</p>}
      {remote.kind === 'error' && <p className="muted pp-msg">Notion 목록을 가져오지 못했어요 — 새로고침으로 다시 시도해 주세요.</p>}

      {remote.kind === 'loaded' &&
        (remote.pages.length === 0 ? (
          <p className="muted pp-msg">통합에 공유된 문서가 아직 없어요 — Notion에서 페이지에 연결을 추가해 주세요.</p>
        ) : (
          remote.pages.map((p) => {
            const has = p.id in hashes;
            return (
              <div key={p.id} className="mn-page">
                <div className="mn-page-info">
                  <span className="mn-page-title">
                    {p.title}
                    {!has && <span className="mn-badge-new">새</span>}
                  </span>
                  <span className="mn-page-date">{timeAgo(p.editedAt)} 수정</span>
                </div>
                <button
                  type="button"
                  className="mini-btn mn-gen-btn"
                  disabled={generating !== null}
                  onClick={() => void doGenerate(p)}
                >
                  {generating === p.id ? '생성 중…' : has ? '대화 열기' : '✨ 영어 대화 만들기'}
                </button>
              </div>
            );
          })
        ))}
    </div>
  );
}
