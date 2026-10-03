'use client';

/**
 * 실전 영어 루프 — Notion 회의록·Gmail 고객 메일이 생기면 그 실물을 재료로
 * 영어 롤플레이 대화문을 만든다. "오늘 실제로 했던 회의·주고받은 메일을
 * 영어로 다시 해보는" 훈련이라, 교재 예문보다 전이가 훨씬 직접적이다.
 *
 * 흐름: 소스 목록(/api/notion/minutes | /api/gmail/threads) → 문서 선택 →
 *       본문(?id=) → Groq 구조화(aiGuard) → Dialogue → DialoguePractice
 *
 * ── 피드백 루프(계속 학습되는 구조) ──
 *  ① 생성 시 내 약점(va_mistakes 유형·최근 교정)을 프롬프트에 주입한다 —
 *     새 대화의 내 대사에 그 약점의 올바른 사용이 들어간다(focus로 표시).
 *  ② 소스에서 바로 쓸 원어민 표현을 함께 수확해 SRS(cat '실전')에 자동
 *     등록한다 — 세션 워밍업·복습 큐에 스스로 나타난다.
 *  ③ 연습(역할연습·드릴)의 교정·실수는 다시 va_mistakes로 쌓인다 →
 *     다음 생성이 그걸 다시 읽는다. 루프가 닫힌다.
 *
 * 저장: va_minutes — Record<noteId, 생성된 대화>. 원문 해시를 함께 저장해
 * 문서가 안 바뀌었으면 AI를 다시 부르지 않는다(비용 O(신규·변경분)).
 * 시드 2편(서북 면담·씨피랩스 EDP 메일) — 토큰 없이도 기능이 비어 보이지
 * 않는 바닥이다.
 */
import type { Dialogue } from './lessons';
import { load, store, addPhrase, addWeakItem } from './state';
import { groqKoJson, hasHangul } from './aiGuard';
import { getMistakes, mistakeTypeCounts, MISTAKE_TYPE_LABEL } from './transfer';

export type SourceKind = 'notion' | 'gmail';

export interface MinutesDialogue {
  noteId: string;
  /** 원본 문서 제목(회의록 제목·메일 제목) */
  noteTitle: string;
  /** 대화 제목(AI가 뽑은 상황 한 줄, 한국어) */
  title: string;
  /** 상황 설명 한 줄(한국어) */
  situation: string;
  /** 어느 소스에서 왔나 — v1.1 저장분에는 없다(= notion으로 취급) */
  source?: SourceKind | 'seed';
  /** 원문 djb2 해시 — 재생성 판단 근거 */
  hash: number;
  createdAt: string;
  dialogue: Dialogue;
  /** 이번 대화에 반영된 내 약점(한국어 라벨) — 피드백 루프의 가시화 */
  focus?: string[];
  /** 소스에서 수확한 원어민 표현 — SRS(cat '실전') 자동 등록 대상 */
  expressions?: { en: string; kr: string }[];
}

const STORE_KEY = 'va_minutes';
const EXPR_IMPORTED_KEY = 'va_minutes_expr';

export const SEED_MINUTES: MinutesDialogue = {
  noteId: 'seed-seobuk',
  noteTitle: '8/4 서북 – MSP 파트너 전환 관련 최종 면담 회의록',
  title: '떠나는 고객과의 마지막 면담',
  situation: '3년 함께한 고객이 경쟁 MSP로 옮기겠다고 통보한 자리 — 사과, 재고 요청, 인수인계, 그리고 윈백의 문을 열어두는 대화',
  source: 'seed',
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
  expressions: [
    { en: "I'm sorry we fell short.", kr: '기대에 못 미쳐 죄송합니다.' },
    { en: 'a clean handover', kr: '깔끔한 인수인계' },
    { en: 'win you back', kr: '(떠난 고객을) 다시 모셔오다' },
  ],
};

/** 실제 씨피랩스 EDP 미소진 협의 메일 스레드(8/14)를 영어로 재구성한 시드. */
export const SEED_MAIL: MinutesDialogue = {
  noteId: 'seed-cplabs',
  noteTitle: '씨피랩스 EDP 미소진 금액 리뷰 메일 스레드',
  title: '미소진 잔액 전환 협상',
  situation: 'EDP 계약 만료(8/31)를 앞두고 미소진 잔액 전액을 RI·Savings Plans 구매로 전환하려는 고객 CTO와 산출 기준·발주 일정·분납 조건을 맞추는 대화',
  source: 'seed',
  hash: 0,
  createdAt: '2026-08-15T09:00:00.000Z',
  dialogue: {
    title: '미소진 잔액 전환 협상',
    lines: [
      { sp: 'A', en: "I've updated the simulation based on August eleventh usage, with the CP8 account excluded.", kr: '8월 11일 사용량 기준으로, CP8 계정은 제외하고 시뮬레이션을 다시 산출했습니다.' },
      { sp: 'B', en: 'We reviewed the details, and we have no objection to the calculation basis.', kr: '상세 내역을 검토했고, 산출 기준에 이견 없습니다.' },
      { sp: 'B', en: "Before the contract expires on August thirty-first, we'd like to convert the entire unspent balance into RI and Savings Plans purchases.", kr: '8월 31일 계약 만료 전에, 미소진 잔액 전액을 RI와 Savings Plans 구매로 전환하고 싶습니다.' },
      { sp: 'A', en: 'That works. The full purchase will count toward your EDP commitment, as we confirmed earlier.', kr: '가능합니다. 앞서 확인드린 대로, 이번 구매 전액이 EDP 약정 소진으로 인정됩니다.' },
      { sp: 'B', en: 'Could you give us your best estimate of the final unspent amount by August twenty-fifth?', kr: '8월 25일까지 최종 미소진 예상액의 최선 추정치를 주실 수 있을까요?' },
      { sp: 'A', en: "Our billing team is finalizing the number. I'll share it with you as soon as I hear back.", kr: '정산팀이 수치를 확정하는 중입니다. 회신받는 대로 바로 공유드리겠습니다.' },
      { sp: 'B', en: "One more thing — we'd like to keep the thirty-six-month installment plan regardless of the collateral type.", kr: '한 가지 더 — 담보 형태와 무관하게 36개월 분납 조건은 그대로 유지하고 싶습니다.' },
      { sp: 'A', en: "Understood. Let me check with our finance team and confirm the terms in writing before the purchase.", kr: '알겠습니다. 재무팀에 확인해서, 구매 전에 조건을 서면으로 확정드리겠습니다.' },
      { sp: 'B', en: "Great. Then let's target August twenty-eighth for the final order.", kr: '좋습니다. 그럼 8월 28일 최종 발주를 목표로 하죠.' },
      { sp: 'A', en: "Sounds good. I'll send you a summary of today's discussion by end of day.", kr: '좋습니다. 오늘 논의 요약은 퇴근 전까지 보내드리겠습니다.' },
    ],
  },
  expressions: [
    { en: 'the unspent balance', kr: '미소진 잔액' },
    { en: 'count toward the commitment', kr: '약정 소진으로 인정되다' },
    { en: 'our best estimate', kr: '최선 추정치' },
    { en: 'confirm the terms in writing', kr: '조건을 서면으로 확정하다' },
  ],
};

/* ── 저장/조회 ── */

type MinutesStore = Record<string, MinutesDialogue>;

function getStore(): MinutesStore {
  return load<MinutesStore>(STORE_KEY, {});
}

/** 화면이 보는 목록 — 생성한 대화(최신 먼저) + 시드 2편. */
export function getMinutesDialogues(): MinutesDialogue[] {
  const stored = Object.values(getStore()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [...stored, SEED_MAIL, SEED_MINUTES];
}

/** 이미 대화를 만든 문서의 id → 해시 (목록의 "대화 있음/새 문서" 배지 근거) */
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

/* ── 표현 수확 → SRS (피드백 루프 ②) ── */

/** 수확 표현을 SRS(cat '실전')·표현장에 등록 — 문서 단위 멱등.
 *  실전 코스(lib/realCourse.ts)도 같은 통로를 쓴다 — 필요한 최소 형태만 받는다. */
export function importExpressions(item: Pick<MinutesDialogue, 'noteId' | 'title' | 'expressions'>): number {
  if (!item.expressions?.length) return 0;
  const done = load<string[]>(EXPR_IMPORTED_KEY, []);
  if (done.includes(item.noteId)) return 0;
  let added = 0;
  for (const x of item.expressions) {
    if (!x.en?.trim()) continue;
    addPhrase({ en: x.en.trim(), kr: (x.kr || '').trim(), lesson: `실전:${item.title}` });
    addWeakItem({ en: x.en.trim(), kr: (x.kr || '').trim(), lesson: `실전:${item.title}`, cat: '실전' });
    added += 1;
  }
  store(EXPR_IMPORTED_KEY, [...done, item.noteId]);
  return added;
}

/** 아직 안 들어간 표현 전부 등록(시드 포함) — 화면 진입 시 호출. */
export function importAllExpressions(): number {
  let n = 0;
  for (const item of getMinutesDialogues()) n += importExpressions(item);
  return n;
}

/* ── 약점 주입 (피드백 루프 ①) ── */

/**
 * 내 약점 요약 — 회화·드릴에서 축적된 교정(va_mistakes)을 생성 프롬프트에
 * 넣을 한국어 브리핑으로 만든다. 약점이 없으면 빈 문자열(프롬프트 오염 금지).
 */
export function weaknessBrief(): string {
  const mistakes = getMistakes();
  if (!mistakes.length) return '';
  const lines: string[] = [];
  const counts = mistakeTypeCounts().filter((c) => c.count >= 2).slice(0, 3);
  if (counts.length) {
    lines.push(`자주 틀리는 유형: ${counts.map((c) => `${MISTAKE_TYPE_LABEL[c.type] || c.type}(${c.count}회)`).join(', ')}`);
  }
  for (const m of mistakes.slice(-2)) {
    if (m.wrong && m.right) lines.push(`최근 교정: "${m.wrong}" → "${m.right}"`);
  }
  return lines.join('\n');
}

/* ── 서버 라우트 통신 ── */

const ENDPOINT: Record<SourceKind, string> = {
  notion: '/app/api/notion/minutes',
  gmail: '/app/api/gmail/threads',
};

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

/** 소스 문서 목록 — 지수 백오프(1s, 3s)로 총 3회. 미설정(501)은 실패가 아니다. */
export async function listRemoteMinutes(kind: SourceKind = 'notion'): Promise<ListResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, error: 'offline' };
  const delays = [0, 1000, 3000];
  let lastErr = '';
  for (const d of delays) {
    if (d) await new Promise((r) => setTimeout(r, d));
    try {
      const resp = await fetch(ENDPOINT[kind]);
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

async function fetchNoteText(kind: SourceKind, id: string): Promise<{ id: string; title: string; raw: string } | null> {
  const resp = await fetch(`${ENDPOINT[kind]}?id=${encodeURIComponent(id)}`);
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
  /** 이번에 SRS로 들어간 수확 표현 수 */
  expressionsAdded?: number;
  error?: 'fetch' | 'ai';
}

const SOURCE_DESC: Record<SourceKind, string> = {
  notion: '업무 회의록',
  gmail: '고객과 주고받은 이메일 스레드([나]는 사용자, [상대(...)]는 고객이다)',
};

/**
 * 문서 하나 → 영어 롤플레이 대화 + 표현 수확. 원문 해시가 저장본과 같으면
 * AI를 부르지 않고 기존 대화를 돌려준다 — 비용은 새·바뀐 문서만 문다.
 */
export async function generateFromNote(page: { id: string; title: string }, kind: SourceKind = 'notion'): Promise<GenerateResult> {
  const note = await fetchNoteText(kind, page.id);
  if (!note) return { ok: false, error: 'fetch' };

  const h = hashText(note.raw);
  const existing = getStore()[page.id];
  if (existing && existing.hash === h) return { ok: true, cached: true, item: existing };

  const weakness = weaknessBrief();
  const sys = [
    `너는 ${SOURCE_DESC[kind]}를 영어 회화 연습용 롤플레이 대화문으로 바꾸는 도우미다.`,
    '사용자 Taehyun은 한국 클라우드 MSP의 영업 담당(account manager)이다. 아래 JSON만 출력한다:',
    '{"title":"대화 제목 한 줄(한국어)","situation":"이 대화의 상황 설명 한 줄(한국어)",',
    ' "lines":[{"sp":"A 또는 B","en":"영어 대사","kr":"한국어 뜻"} — 8~10줄],',
    ' "expressions":[{"en":"이 상황에서 바로 쓸 수 있는 원어민 비즈니스 표현","kr":"한국어 뜻"} — 3~5개],',
    ' "focus":["대화에 반영한 사용자 약점 유형(한국어)"] — 약점 정보가 없으면 빈 배열}',
    '규칙: A는 Taehyun(영업 담당), B는 상대(고객·파트너·동료). en은 영어로만, kr·title·situation은 반드시 한국어.',
    '원문의 실제 쟁점·숫자·결정 사항을 대화에 반영한다. 자연스러운 비즈니스 구어체로 쓴다.',
    '원문에 없는 사실을 지어내지 않는다.',
    ...(weakness
      ? [
          '',
          '사용자 약점 정보(회화·드릴에서 축적된 실제 교정 기록):',
          weakness,
          'A(사용자)의 대사에 위 약점을 올바르게 사용한 문장을 최소 2개 자연스럽게 포함하고, 반영한 약점 유형을 focus에 적어라.',
        ]
      : []),
  ].join('\n');

  const picked = await groqKoJson<{
    title: string;
    situation: string;
    lines: { sp: string; en: string; kr: string }[];
    expressions: { en: string; kr: string }[];
    focus: string[];
  }>(
    [
      { role: 'system', content: sys },
      { role: 'user', content: `문서 제목: ${note.title}\n\n원문:\n${note.raw.slice(0, 3500)}` },
    ],
    { temperature: 0.4, maxTokens: 1200 },
    (data) => {
      const o = (data ?? {}) as { title?: unknown; situation?: unknown; lines?: unknown; expressions?: unknown; focus?: unknown };
      const lines = (Array.isArray(o.lines) ? (o.lines as RawLine[]) : [])
        .filter(isValidLine)
        .map((l) => ({ sp: l.sp, en: l.en.trim(), kr: l.kr.trim() }))
        .slice(0, 12);
      // 대화가 성립하려면 양쪽 화자가 최소 6줄 — 미달이면 재시도(aiGuard가 1회 더 묻는다)
      if (lines.length < 6 || !lines.some((l) => l.sp === 'A') || !lines.some((l) => l.sp === 'B')) return null;
      if (!hasHangul(o.title)) return null;
      // 표현·focus는 보너스 — 검증 실패해도 대화 생성 자체는 살린다
      const expressions = (Array.isArray(o.expressions) ? (o.expressions as RawLine[]) : [])
        .filter((x) => typeof x.en === 'string' && x.en.trim() && !hasHangul(x.en) && hasHangul(x.kr))
        .map((x) => ({ en: String(x.en).trim(), kr: String(x.kr).trim() }))
        .slice(0, 5);
      const focus = (Array.isArray(o.focus) ? o.focus : [])
        .map(String)
        .filter((f) => f.trim() && hasHangul(f))
        .slice(0, 3);
      return {
        title: String(o.title).trim(),
        situation: hasHangul(o.situation) ? String(o.situation).trim() : '',
        lines,
        expressions,
        focus,
      };
    }
  );
  if (!picked) return { ok: false, error: 'ai' };

  const item: MinutesDialogue = {
    noteId: page.id,
    noteTitle: note.title || page.title,
    title: picked.title,
    situation: picked.situation,
    source: kind,
    hash: h,
    createdAt: new Date().toISOString(),
    dialogue: { title: picked.title, lines: picked.lines },
    focus: picked.focus,
    expressions: picked.expressions,
  };
  const s = getStore();
  s[page.id] = item;
  store(STORE_KEY, s);
  if (existing) {
    // 문서가 바뀌어 다시 만든 경우 — 새로 수확된 표현이 들어갈 수 있게 멱등
    // 표시를 푼다(같은 표현은 addWeakItem이 en 기준으로 걸러 이중 등록 없음).
    const done = load<string[]>(EXPR_IMPORTED_KEY, []);
    store(EXPR_IMPORTED_KEY, done.filter((x) => x !== page.id));
  }
  const expressionsAdded = importExpressions(item);
  return { ok: true, item, expressionsAdded };
}
