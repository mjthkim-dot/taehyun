'use client';

/**
 * Preply 수업 노트 파이프라인 — 진옥 선생님 수업 노트(Notion)를 앱의 SRS로 잇는다.
 * (누적 정리 페이지의 지시 "앱의 SRS 복습에 약점 표현으로 등록"의 이행)
 *
 * 2계층 설계(docs/PLAN.md):
 *  L1 시드: data/preplyNotes.json — 실사 스냅숏. 토큰 설정 없이도 즉시 동작하고
 *     오프라인 폴백의 최종 바닥이다.
 *  L2 동기화: /app/api/notion/preply → 성공 시 va_preply_notes에 캐시.
 *     화면이 보는 데이터는 항상 캐시 ?? 시드 (merge가 아니라 대체 — 서버가
 *     항상 전체 목록을 준다).
 *
 * 실패 정책: 지수 백오프 2회 재시도 → 그래도 실패면 조용히 폴백하되 상태
 * 라벨로 정직하게 알린다(silent failure 금지 원칙).
 */
import seed from '../data/preplyNotes.json';
import { load, store, addPhrase, addWeakItem } from './state';
import { groqKoJson, hasHangul } from './aiGuard';

export interface PreplyNote {
  id: string;
  round: number;
  date: string;
  title: string;
  grammar: string[];
  sentences: { en: string; kr: string }[];
  pron: string[];
  homework: string[];
  weakPoints: string[];
}

const CACHE_KEY = 'va_preply_notes';
const SYNCED_KEY = 'va_preply_synced_at';
const IMPORTED_KEY = 'va_preply_imported';

export type PreplySource = 'synced' | 'cache' | 'seed';

export function getPreplyNotes(): { notes: PreplyNote[]; source: PreplySource; syncedAt: string | null } {
  // 주의: load()는 기본값과 저장값의 배열 여부가 다르면 기본값을 돌려준다(손상 방어).
  // 그래서 기본값은 null이 아니라 빈 배열이어야 캐시가 읽힌다.
  const cached = load<PreplyNote[]>(CACHE_KEY, []);
  const syncedAt = load<string>(SYNCED_KEY, '');
  if (cached.length) {
    return { notes: cached, source: syncedAt ? 'synced' : 'cache', syncedAt: syncedAt || null };
  }
  return { notes: (seed as { notes: PreplyNote[] }).notes, source: 'seed', syncedAt: null };
}

export interface SyncResult {
  ok: boolean;
  /** 서버에 토큰이 설정돼 있지 않음 — 실패가 아니라 미설정 상태 */
  unconfigured?: boolean;
  count?: number;
  error?: string;
}

/* ── AI 구조화 — 자유 서식 노트 원문 → PreplyNote ──
 * 노트별 원문 해시로 캐시한다: 같은 노트를 두 번 추출하지 않는다(토큰 비용
 * O(신규·변경 노트 수)). 추출 실패한 노트는 건너뛴다 — 부분 성공 우선. */

interface RawNote {
  id: string;
  title: string;
  raw: string;
}

const EXTRACT_KEY = 'va_preply_extract';

type ExtractCache = Record<string, { hash: number; note: PreplyNote }>;

function hashText(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}

async function extractNote(rawNote: RawNote, fallbackRound: number): Promise<PreplyNote | null> {
  const sys = [
    '너는 영어 수업 노트를 학습 카드로 구조화하는 도우미다. 주어진 노트 원문에서 아래 JSON만 출력한다:',
    '{"title":"이 회차의 핵심 주제 한 줄(한국어)","date":"YYYY-MM-DD (원문에 있으면, 없으면 빈 문자열)",',
    ' "grammar":["배운 문법 포인트 (한국어, 최대 4개)"],',
    ' "sentences":[{"en":"수업에서 연습한/연습할 영어 문장","kr":"한국어 뜻"} — 3~6개, 실제 원문에 있는 것만],',
    ' "pron":["발음 포인트 (한국어, 최대 3개)"], "homework":["숙제 (한국어, 최대 4개)"],',
    ' "weakPoints":["약점·보강 필요 지점 (한국어, 최대 3개)"]}',
    '규칙: en은 영어로만. kr·나머지는 반드시 한국어. 원문에 없는 내용을 지어내지 않는다. 없으면 빈 배열.',
  ].join('\n');
  const round = Number((rawNote.title.match(/(\d+)\s*회/) || [])[1]) || fallbackRound;
  const picked = await groqKoJson<Omit<PreplyNote, 'id' | 'round'>>(
    [
      { role: 'system', content: sys },
      { role: 'user', content: `노트 제목: ${rawNote.title}\n\n원문:\n${rawNote.raw.slice(0, 3500)}` },
    ],
    { temperature: 0.2, maxTokens: 900 },
    (data) => {
      const o = (data ?? {}) as Partial<PreplyNote>;
      const sentences = (Array.isArray(o.sentences) ? o.sentences : [])
        .filter((s) => s && typeof s.en === 'string' && s.en.trim() && !hasHangul(s.en) && hasHangul(s.kr))
        .map((s) => ({ en: s.en.trim(), kr: String(s.kr).trim() }))
        .slice(0, 6);
      if (!sentences.length || !hasHangul(o.title)) return null;
      const arr = (v: unknown, max: number) =>
        (Array.isArray(v) ? v : []).map(String).filter((x) => x.trim()).slice(0, max);
      return {
        title: String(o.title).trim(),
        date: typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : '',
        grammar: arr(o.grammar, 4),
        sentences,
        pron: arr(o.pron, 3),
        homework: arr(o.homework, 4),
        weakPoints: arr(o.weakPoints, 3),
      };
    }
  );
  if (!picked) return null;
  return { id: rawNote.id, round, ...picked };
}

/** 한 번의 fetch + 구조화 시도 — 라우트는 { configured, notes:[{id,title,raw}] }를 준다. */
async function fetchOnce(): Promise<SyncResult> {
  const resp = await fetch('/app/api/notion/preply');
  if (resp.status === 501) return { ok: false, unconfigured: true };
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = (await resp.json()) as { notes?: RawNote[] };
  const raws = Array.isArray(data.notes) ? data.notes.filter((n) => n && n.id && n.raw) : [];
  if (!raws.length) throw new Error('빈 응답');

  const cache = load<ExtractCache>(EXTRACT_KEY, {});
  const notes: PreplyNote[] = [];
  let changed = false;
  for (let i = 0; i < raws.length; i++) {
    const r = raws[i];
    const h = hashText(r.raw);
    const hit = cache[r.id];
    if (hit && hit.hash === h) {
      notes.push(hit.note);
      continue;
    }
    const note = await extractNote(r, i + 1);
    if (note) {
      cache[r.id] = { hash: h, note };
      notes.push(note);
      changed = true;
    } else if (hit) {
      notes.push(hit.note); // 재추출 실패 시 이전 추출본 유지
    }
  }
  if (!notes.length) throw new Error('구조화 실패');
  notes.sort((a, b) => a.round - b.round);
  if (changed) store(EXTRACT_KEY, cache);
  store(CACHE_KEY, notes);
  store(SYNCED_KEY, new Date().toISOString());
  return { ok: true, count: notes.length };
}

/** 동기화 — 지수 백오프(1s, 3s)로 총 3회 시도. 오프라인이면 즉시 폴백. */
export async function syncPreply(): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, error: 'offline' };
  }
  const delays = [0, 1000, 3000];
  let lastErr = '';
  for (const d of delays) {
    if (d) await new Promise((r) => setTimeout(r, d));
    try {
      // 미설정(501)은 fetchOnce가 정상 반환한다 — 재시도 대상은 throw(5xx·네트워크)뿐
      return await fetchOnce();
    } catch (e) {
      lastErr = (e as Error)?.message || String(e);
    }
  }
  return { ok: false, error: lastErr };
}

/* ── SRS 카드 파이프라인 ── */

/** 이미 SRS로 보낸 노트 id들 — 멱등성의 근거 */
export function importedNoteIds(): string[] {
  return load<string[]>(IMPORTED_KEY, []);
}

/**
 * 노트의 문장을 SRS(약점 노트)와 표현장에 등록한다. 노트 단위 멱등 —
 * 같은 노트를 두 번 넣지 않는다. addWeakItem 자체도 en 기준 중복을 걸러
 * 이중 방어가 된다.
 */
export function importNoteToSrs(note: PreplyNote): number {
  const imported = importedNoteIds();
  if (imported.includes(note.id)) return 0;
  let added = 0;
  for (const s of note.sentences) {
    if (!s.en?.trim()) continue;
    addPhrase({ en: s.en.trim(), kr: (s.kr || '').trim(), lesson: `preply:${note.round}` });
    addWeakItem({ en: s.en.trim(), kr: (s.kr || '').trim(), lesson: `preply:${note.round}`, cat: '수업' });
    added += 1;
  }
  store(IMPORTED_KEY, [...imported, note.id]);
  return added;
}

/** 아직 안 들어간 노트를 전부 등록 — "수업 노트 → SRS 자동 파이프라인"의 실체. */
export function importAllNew(): { notes: number; sentences: number } {
  const { notes } = getPreplyNotes();
  const imported = new Set(importedNoteIds());
  let n = 0;
  let s = 0;
  for (const note of notes) {
    if (imported.has(note.id)) continue;
    s += importNoteToSrs(note);
    n += 1;
  }
  return { notes: n, sentences: s };
}
