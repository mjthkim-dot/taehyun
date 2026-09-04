'use client';

/**
 * 실전 영어 화면 — "회의록·고객 메일이 생기면 → 영어 대화문이 되는" 루프의 얼굴.
 *
 * 위: 만들어진 대화 목록(시드 2편 포함) — 탭하면 DialoguePractice(듣기·역할·암기)가
 *     그 자리에서 열리고, 드릴 핸드오프로 이어진다. 약점 반영(focus)·수확 표현
 *     칩으로 피드백 루프가 눈에 보인다.
 * 아래: Notion 회의록 / Gmail 고객 메일 두 소스 — 화면에 들어오면 자동으로
 *     목록을 불러오고, 아직 대화가 없는 문서엔 "새" 배지가 붙는다. 1탭 변환.
 *
 * 상태 4종(소스별 독립): 로드됨 / 미설정(안내) / 오프라인 / 실패(재시도) —
 * Preply 파이프라인과 같은 정직한 폴백 원칙.
 */
import { useEffect, useState } from 'react';
import type { Mode } from './NavBar';
import {
  generatedHashes,
  generateFromNote,
  getMinutesDialogues,
  importAllExpressions,
  listRemoteMinutes,
  type MinutesDialogue,
  type RemotePage,
  type SourceKind,
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

const SOURCE_ICON: Record<string, string> = { notion: '🗂', gmail: '📧', seed: '⭐' };

export default function MinutesScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [items, setItems] = useState<MinutesDialogue[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [notion, setNotion] = useState<RemoteState>({ kind: 'loading' });
  const [gmail, setGmail] = useState<RemoteState>({ kind: 'loading' });
  const [generating, setGenerating] = useState<string | null>(null);
  const [genMsg, setGenMsg] = useState('');
  const [exprMsg, setExprMsg] = useState('');

  function refresh() {
    setItems(getMinutesDialogues());
  }

  async function loadRemote(kind: SourceKind) {
    const set = kind === 'notion' ? setNotion : setGmail;
    set({ kind: 'loading' });
    const r = await listRemoteMinutes(kind);
    if (r.ok) set({ kind: 'loaded', pages: r.pages || [] });
    else if (r.unconfigured) set({ kind: 'unconfigured' });
    else if (r.error === 'offline') set({ kind: 'offline' });
    else set({ kind: 'error' });
  }

  // 루프의 핵심: 화면에 들어오면 스스로 두 소스를 본다 — 버튼을 기다리지 않는다.
  useEffect(() => {
    refresh();
    // 수확 표현(시드 포함)을 SRS로 — 멱등이라 재방문해도 안 겹친다
    const n = importAllExpressions();
    if (n > 0) setExprMsg(`실전 표현 ${n}개가 복습 큐에 새로 들어갔어요.`);
    void loadRemote('notion');
    void loadRemote('gmail');
  }, []);

  async function doGenerate(page: RemotePage, kind: SourceKind) {
    if (generating) return;
    setGenerating(page.id);
    setGenMsg('');
    try {
      const r = await generateFromNote(page, kind);
      if (r.ok && r.item) {
        refresh();
        setOpen(r.item.noteId);
        if (r.cached) setGenMsg('원문이 그대로라 만들어 둔 대화를 다시 열었어요.');
        else
          setGenMsg(
            `대화 생성 완료 — 「${r.item.title}」` +
              (r.expressionsAdded ? ` · 표현 ${r.expressionsAdded}개 복습 큐 등록` : '')
          );
      } else if (r.error === 'fetch') {
        setGenMsg('문서 본문을 가져오지 못했어요 — 잠시 후 다시 시도해 주세요.');
      } else {
        setGenMsg('대화 생성에 실패했어요 — 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setGenerating(null);
    }
  }

  const hashes = generatedHashes();

  function renderRemote(kind: SourceKind, state: RemoteState) {
    return (
      <>
        {state.kind === 'unconfigured' &&
          (kind === 'notion' ? (
            <div className="study-card pp-setup">
              <h3>Notion 연동 설정</h3>
              <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.7 }}>
                아직 서버에 Notion 토큰이 없어요. 회의록 자동 변환을 켜려면:
              </p>
              <ol className="pp-steps">
                <li>notion.so/my-integrations에서 내부 통합(Integration) 생성 → 토큰 복사</li>
                <li>회의록이 있는 Notion 페이지 → ⋯ → 연결 추가로 통합을 초대</li>
                <li>
                  Vercel 환경변수 <code>NOTION_API_KEY</code> 설정 후 재배포 (수업 노트와 같은 토큰을 함께 써요)
                </li>
              </ol>
            </div>
          ) : (
            <div className="study-card pp-setup">
              <h3>Gmail 연동 설정</h3>
              <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.7 }}>
                아직 서버에 Gmail 인증 정보가 없어요. 고객 메일 자동 변환을 켜려면:
              </p>
              <ol className="pp-steps">
                <li>console.cloud.google.com에서 OAuth 클라이언트(데스크톱) 생성 + Gmail API 사용 설정</li>
                <li>
                  OAuth Playground(developers.google.com/oauthplayground)에서{' '}
                  <code>gmail.readonly</code> 범위로 리프레시 토큰 발급
                </li>
                <li>
                  Vercel 환경변수 <code>GMAIL_CLIENT_ID</code> · <code>GMAIL_CLIENT_SECRET</code> ·{' '}
                  <code>GMAIL_REFRESH_TOKEN</code> 설정 후 재배포
                </li>
              </ol>
            </div>
          ))}
        {state.kind === 'offline' && <p className="muted pp-msg">오프라인이에요 — 만들어 둔 대화로 계속 연습할 수 있어요.</p>}
        {state.kind === 'error' && <p className="muted pp-msg">목록을 가져오지 못했어요 — 새로고침으로 다시 시도해 주세요.</p>}
        {state.kind === 'loaded' &&
          (state.pages.length === 0 ? (
            <p className="muted pp-msg">
              {kind === 'notion'
                ? '통합에 공유된 문서가 아직 없어요 — Notion에서 페이지에 연결을 추가해 주세요.'
                : '최근 메일 스레드가 없어요.'}
            </p>
          ) : (
            state.pages.map((p) => {
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
                    onClick={() => void doGenerate(p, kind)}
                  >
                    {generating === p.id ? '생성 중…' : has ? '대화 열기' : '✨ 영어 대화 만들기'}
                  </button>
                </div>
              );
            })
          ))}
      </>
    );
  }

  return (
    <div className="study-screen">
      <div className="study-card mn-intro">
        <p className="muted">
          Notion <b>회의록</b>과 Gmail <b>고객 메일</b>이 생기면, 그 실물을 영어로 다시 해보는 <b>롤플레이 대화문</b>으로
          바꿔요. 회화에서 교정받은 <b>내 약점이 다음 대화에 반영</b>되고, 소스에서 수확한 표현은 복습 큐로 들어갑니다 —
          쓸수록 나에게 맞게 학습돼요.
        </p>
      </div>

      {genMsg && <p className="pp-imported">💬 {genMsg}</p>}
      {exprMsg && <p className="pp-imported">✅ {exprMsg}</p>}

      {/* ── 만들어진 대화 ── */}
      <div className="mn-sec-title">🎭 연습할 대화 ({items.length})</div>
      {items.map((it, idx) => {
        const isOpen = open === it.noteId;
        return (
          <div key={it.noteId} className={`mn-item${isOpen ? ' open' : ''}`}>
            <button type="button" className="mn-item-head" onClick={() => setOpen(isOpen ? null : it.noteId)}>
              <span className="mn-item-title">
                {SOURCE_ICON[it.source || 'notion']} {it.title}
              </span>
              <span className="mn-item-note">
                {it.source === 'seed' ? '내장 예시 · ' : ''}
                {it.noteTitle}
              </span>
              {(it.focus?.length ?? 0) > 0 && (
                <span className="mn-focus">🎯 내 약점 반영: {it.focus!.join(' · ')}</span>
              )}
            </button>
            {isOpen && (
              <div className="mn-item-body">
                {it.situation && <p className="mn-situation">{it.situation}</p>}
                {(it.expressions?.length ?? 0) > 0 && (
                  <div className="mn-exprs">
                    <div className="pp-sec">💡 이 소스에서 수확한 표현 (복습 큐 자동 등록)</div>
                    {it.expressions!.map((x, i) => (
                      <div className="pp-sent" key={i}>
                        <div className="pp-sent-en">{x.en}</div>
                        <div className="pp-sent-kr">{x.kr}</div>
                      </div>
                    ))}
                  </div>
                )}
                <DialoguePractice dialogue={it.dialogue} lessonId={9000 + idx} />
                <button
                  type="button"
                  className="start-drill-btn"
                  onClick={() => {
                    setDrillQueue({
                      label: `실전 영어 — ${it.title}`,
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

      {/* ── 소스: Notion 회의록 ── */}
      <div className="mn-sec-title" style={{ marginTop: 20 }}>
        🗂 Notion 회의록
        <button type="button" className="mini-btn" disabled={notion.kind === 'loading'} onClick={() => void loadRemote('notion')}>
          {notion.kind === 'loading' ? '불러오는 중…' : '🔄 새로고침'}
        </button>
      </div>
      {renderRemote('notion', notion)}

      {/* ── 소스: Gmail 고객 메일 ── */}
      <div className="mn-sec-title" style={{ marginTop: 20 }}>
        📧 Gmail 고객 메일
        <button type="button" className="mini-btn" disabled={gmail.kind === 'loading'} onClick={() => void loadRemote('gmail')}>
          {gmail.kind === 'loading' ? '불러오는 중…' : '🔄 새로고침'}
        </button>
      </div>
      {renderRemote('gmail', gmail)}
    </div>
  );
}
