'use client';

/**
 * 회의록 영어 루프 — Notion에 업무 회의록이 생기면 그 회의록을 재료로
 * 영어 롤플레이 대화문을 만든다. "오늘 실제로 했던 회의를 영어로 다시
 * 해보는" 훈련이라, 교재 예문보다 전이가 훨씬 직접적이다.
 *
 * 흐름: /app/api/notion/minutes(목록) → 회의록 선택 → 본문(?id=) →
 *       Groq 구조화(aiGuard) → Dialogue → DialoguePractice(듣기·역할·암기)
 *
 * 저장: va_minutes — Record<noteId, 생성된 대화>. 원문 해시를 함께 저장해
 * 회의록이 안 바뀌었으면 AI를 다시 부르지 않는다(비용 O(신규·변경분)).
 * 시드: 실제 8/4 서북 면담 회의록을 영어로 재구성한 대화 1편 — Notion
 * 토큰이 없어도 기능이 비어 보이지 않는 바닥이다.
 */
import type { Dialogue } from './lessons';
import { load, store } from './state';
import { groqKoJson, hasHangul } from './aiGuard';

export interface MinutesDialogue {
  noteId: string;
  /** 원본 회의록 제목 */
  noteTitle: string;
  /** 대화 제목(AI가 뽑은 상황 한 줄, 한국어) */
  title: string;
  /** 상황 설명 한 줄(한국어) */
  situation: string;
  /** 원문 djb2 해시 — 재생성 판단 근거 */
  hash: number;
  createdAt: string;
  dialogue: Dialogue;
}

const STORE_KEY = 'va_minutes';

export const SEED_MINUTES: MinutesDialogue = {
  noteId: 'seed-seobuk',
  noteTitle: '8/4 서북 – MSP 파트너 전환 관련 최종 면담 회의록',
  title: '떠나는 고객과의 마지막 면담',
  situation: '3년 함께한 고객이 경쟁 MSP로 옮기겠다고 통보한 자리 — 사과, 재고 요청, 인수인계, 그리고 윈백의 문을 열어두는 대화',
  hash: 0,
  createdAt: '2026-08-14T09:00:00.000Z',
  dialogue: {
    title: '떠나는 고객과의 마지막 면담',
    lines: [
      { sp: 'A', en: "Thank you for making time today. I know this isn't an easy conversation.", kr: '오늘 시간 내주셔서 감사합니다. 쉽지 않은 자리인 걸 압니다.' },
      { sp: 'B', en: "We appreciate everything your team has done, but our decision to move to the new partner stands.", kr: '그동안 해주신 모든 것에 감사드리지만, 새 파트너로 옮기기로 한 결정은 그대로입니다.' },
      { sp: 'A', en: 'I understand. Could you share what drove the decision, so we can learn from it?', kr: '이해합니다. 저희가 배울 수 있도록, 어떤 점이 결정적이었는지 여쭤봐도 될까요?' },
      { sp: 'B', en: "Honestly, we didn't feel enough hands-on support. We ended up handling RI purchases on our own.", kr: '솔직히 밀착 지원이 부족하다고 느꼈어요. RI 구매도 결국 저희가 직접 처리했고요.' },
      { sp: 'A', en: "That's a fair point, and I'm sorry we fell short. We were preparing a dedicated engineer and a ten-thousand-dollar credit.", kr: '맞는 지적이고, 부족했던 점 죄송합니다. 전담 엔지니어와 1만 달러 크레딧을 준비하고 있었습니다.' },
      { sp: 'B', en: 'I hear you, but reversing this now would be difficult for our executives.', kr: '말씀은 알겠지만, 지금 와서 결정을 뒤집는 건 저희 경영진 입장에서 어렵습니다.' },
      { sp: 'A', en: 'Then let me focus on a clean handover. We will verify the organization ownership transfer step by step.', kr: '그렇다면 깔끔한 인수인계에 집중하겠습니다. 조직 오너십 이관을 단계별로 검증하겠습니다.' },
      { sp: 'B', en: 'That would help. What should we prepare on our side?', kr: '그러면 도움이 되겠네요. 저희 쪽에서는 뭘 준비하면 될까요?' },
      { sp: 'A', en: "Please download your billing history as CSV before the handover — those records don't migrate automatically.", kr: '인수인계 전에 청구 내역을 CSV로 내려받아 두세요 — 그 기록은 자동으로 이관되지 않습니다.' },
      { sp: 'B', en: "Got it. Despite everything, I'd like to keep the relationship warm.", kr: '알겠습니다. 이런 상황이지만, 관계는 계속 좋게 이어가고 싶네요.' },
      { sp: 'A', en: "So would I. Let's grab a drink in September — and someday, I'd love to win you back.", kr: '저도요. 9월에 한잔해요 — 그리고 언젠가 꼭 다시 모시고 싶습니다.' },
    ],
  },
};

/* ── 저장/조회 ── */

type MinutesStore = Record<string, MinutesDialogue>;

function getStore(): MinutesStore {
  return load<MinutesStore>(STORE_KEY, {});
}

/** 화면이 보는 목록 — 생성한 대화(최신 먼저) + 시드. */
export function getMinutesDialogues(): MinutesDialogue[] {
  const stored = Object.values(getStore()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [...stored, SEED_MINUTES];
}

/** 이미 대화를 만든 회의록의 id → 해시 (목록의 "대화 있음/새 회의록" 배지 근거) */
export function generatedHashes(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(getStore())) out[id] = v.hash;
  return out;
}

export function removeMinutes(noteId: string) {
  const s = getStore();
  if (!(noteId in s)) return;
  delete s[noteId];
  store(STORE_KEY, s);
}

/* ── 서버 라우트 통신 ── */

export interface RemotePage {
  id: string;
  title: string;
  editedAt: string;
}

export interface ListResult {
  ok: boolean;
  unconfigured?: boolean;
  pages?: RemotePage[];
  error?: string;
}

/** Notion 최근 문서 목록 — 지수 백오프(1s, 3s)로 총 3회. 미설정(501)은 실패가 아니다. */
export async function listRemoteMinutes(): Promise<ListResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, error: 'offline' };
  const delays = [0, 1000, 3000];
  let lastErr = '';
  for (const d of delays) {
    if (d) await new Promise((r) => setTimeout(r, d));
    try {
      const resp = await fetch('/app/api/notion/minutes');
      if (resp.status === 501) return { ok: false, unconfigured: true };
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as { pages?: RemotePage[] };
      return { ok: true, pages: Array.isArray(data.pages) ? data.pages.filter((p) => p && p.id) : [] };
    } catch (e) {
      lastErr = (e as Error)?.message || String(e);
    }
  }
  return { ok: false, error: lastErr };
}

async function fetchNoteText(id: string): Promise<{ id: string; title: string; raw: string } | null> {
  const resp = await fetch(`/app/api/notion/minutes?id=${encodeURIComponent(id)}`);
  if (!resp.ok) return null;
  const data = (await resp.json()) as { note?: { id: string; title: string; raw: string } };
  return data.note && data.note.raw ? data.note : null;
}

/* ── 대화 생성 ── */

function hashText(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}

interface RawLine {
  sp?: string;
  en?: string;
  kr?: string;
}

function isValidLine(l: RawLine): l is { sp: string; en: string; kr: string } {
  return (
    (l.sp === 'A' || l.sp === 'B') &&
    typeof l.en === 'string' && !!l.en.trim() && !hasHangul(l.en) &&
    typeof l.kr === 'string' && hasHangul(l.kr)
  );
}

export interface GenerateResult {
  ok: boolean;
  /** 원문이 그대로라 기존 대화를 재사용했다 */
  cached?: boolean;
  item?: MinutesDialogue;
  error?: 'fetch' | 'ai';
}

/**
 * 회의록 하나 → 영어 롤플레이 대화. 원문 해시가 저장본과 같으면 AI를 부르지
 * 않고 기존 대화를 돌려준다 — "동기화를 눌러도 바뀐 것만 비용이 든다"는
 * Preply 파이프라인과 같은 원칙.
 */
export async function generateFromNote(page: { id: string; title: string }): Promise<GenerateResult> {
  const note = await fetchNoteText(page.id);
  if (!note) return { ok: false, error: 'fetch' };

  const h = hashText(note.raw);
  const existing = getStore()[page.id];
  if (existing && existing.hash === h) return { ok: true, cached: true, item: existing };

  const sys = [
    '너는 실제 업무 회의록을 영어 회화 연습용 롤플레이 대화문으로 바꾸는 도우미다.',
    '사용자 Taehyun은 한국 클라우드 MSP의 영업 담당(account manager)이다. 아래 JSON만 출력한다:',
    '{"title":"대화 제목 한 줄(한국어)","situation":"이 대화의 상황 설명 한 줄(한국어)",',
    ' "lines":[{"sp":"A 또는 B","en":"영어 대사","kr":"한국어 뜻"} — 8~10줄]}',
    '규칙: A는 Taehyun(영업 담당), B는 상대(고객·파트너·동료). en은 영어로만, kr·title·situation은 반드시 한국어.',
    '회의록의 실제 쟁점·숫자·결정 사항을 대화에 반영한다. 자연스러운 비즈니스 구어체로 쓴다.',
    '회의록에 없는 사실을 지어내지 않는다.',
  ].join('\n');

  const picked = await groqKoJson<{ title: string; situation: string; lines: { sp: string; en: string; kr: string }[] }>(
    [
      { role: 'system', content: sys },
      { role: 'user', content: `회의록 제목: ${note.title}\n\n회의록 원문:\n${note.raw.slice(0, 3500)}` },
    ],
    { temperature: 0.4, maxTokens: 1100 },
    (data) => {
      const o = (data ?? {}) as { title?: unknown; situation?: unknown; lines?: unknown };
      const lines = (Array.isArray(o.lines) ? (o.lines as RawLine[]) : [])
        .filter(isValidLine)
        .map((l) => ({ sp: l.sp, en: l.en.trim(), kr: l.kr.trim() }))
        .slice(0, 12);
      // 대화가 성립하려면 양쪽 화자가 최소 6줄 — 미달이면 재시도(aiGuard가 1회 더 묻는다)
      if (lines.length < 6 || !lines.some((l) => l.sp === 'A') || !lines.some((l) => l.sp === 'B')) return null;
      if (!hasHangul(o.title)) return null;
      return {
        title: String(o.title).trim(),
        situation: hasHangul(o.situation) ? String(o.situation).trim() : '',
        lines,
      };
    }
  );
  if (!picked) return { ok: false, error: 'ai' };

  const item: MinutesDialogue = {
    noteId: page.id,
    noteTitle: note.title || page.title,
    title: picked.title,
    situation: picked.situation,
    hash: h,
    createdAt: new Date().toISOString(),
    dialogue: { title: picked.title, lines: picked.lines },
  };
  const s = getStore();
  s[page.id] = item;
  store(STORE_KEY, s);
  return { ok: true, item };
}
