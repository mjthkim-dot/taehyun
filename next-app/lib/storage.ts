/**
 * IndexedDB 저장소 — 레슨 캐시(v1) + TTS 음성 캐시·녹음 보관(v2, M1).
 *
 * idb 라이브러리(https://github.com/jakearchibald/idb)를 쓴다. 처음엔 '영어 문장 세트(Lesson)'를
 * 오프라인 복습용으로 저장하는 것뿐이었고, 지금은 발화 훈련의 기반 저장소다:
 *   · 'tts'        — Groq Orpheus 합성 결과(Blob)를 문장 단위로 보관. 같은 대사를 다시 들을 때
 *                    합성 호출(무료 한도 10회/분·100회/일)을 쓰지 않게 한다. LRU 300개.
 *   · 'recordings' — 학습자 녹음(기준선·월간·리텔·드라마·오늘 질문). 상한 20개, 종류별 보존 규칙.
 *
 * 원칙: idb 호출은 전부 try/catch — 사파리 사설 모드·저장 공간 차단 환경에서는 IndexedDB가
 * 열리지 않거나 도중에 실패한다. 그때도 앱은 멈추지 않고(캐시 없이 합성, 녹음은 메모리에만) 조용히
 * 비활성화된다. 호출부는 null/false만 보고 폴백한다.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/** 문장 한 개 (한↔영 쌍). 기존 voice-assistant 앱의 데이터 형태와 동일하다. */
export interface Sentence {
  en: string;
  kr: string;
}

/** 학습 단위 = 문장 세트 */
export interface Lesson {
  id: number;
  title: string;
  date: string;
  sentences: Sentence[];
  /** 마지막으로 로컬에 캐싱된 시각(ms). 조회 시 자동 기록된다. */
  cachedAt?: number;
}

/** TTS 캐시 한 칸 — key는 ttsKey()로 만든다 */
export interface TtsEntry {
  key: string;
  blob: Blob;
  mime: string;
  /** 마지막 사용 시각(ms) — LRU 축출 기준(읽을 때마다 갱신) */
  at: number;
}

/** d7 = D+1·D+4·D+7 같은 문장 재녹음(M10) — 드라마 녹음(상한 10, LRU)에 섞으면 일주일 안에 밀려나 따로 둔다 */
export type RecordingKind = 'baseline' | 'monthly' | 'retell' | 'drama' | 'daily-q' | 'd7';

/** 학습자 녹음 한 개 */
export interface Recording {
  id: string;
  kind: RecordingKind;
  /** YYYY-MM-DD */
  date: string;
  /** 연습한 문장(드라마·리텔) */
  en?: string;
  /** 오늘 질문(daily-q)의 질문 */
  question?: string;
  blob: Blob;
  mime: string;
  durationMs: number;
  score?: number;
  wpm?: number;
  epNo?: number;
  /** 저장 시각(ms) — 같은 날 안의 순서·LRU 기준 */
  at: number;
}

/** 보존 규칙을 계산할 때 필요한 최소 필드(블롭 없이) — 순수 함수 테스트용 */
export type RecordingMeta = Pick<Recording, 'id' | 'kind' | 'date' | 'at'> & Partial<Pick<Recording, 'en' | 'score'>>;

interface AppDB extends DBSchema {
  lessons: {
    key: number;
    value: Lesson;
    indexes: { 'by-date': string };
  };
  tts: {
    key: string;
    value: TtsEntry;
    indexes: { 'by-at': number };
  };
  recordings: {
    key: string;
    value: Recording;
    indexes: { 'by-kind': string };
  };
}

// 내부 IndexedDB 식별자 — 사용자에게 보이지 않는 값이라 리브랜딩에서 의도적으로
// 유지한다(이름을 바꾸면 기존 기기의 저장 데이터가 통째로 고아가 된다).
const DB_NAME = 'preply-english-coach';
export const DB_VERSION = 2;
const STORE = 'lessons';
const TTS_STORE = 'tts';
const REC_STORE = 'recordings';

/** TTS 캐시 상한(LRU) — 한 화 15~18조각 × 약 15화분. WAV 한 조각 수백 KB라 300개 ≈ 100MB 안팎 */
export const TTS_CACHE_MAX = 300;
/** 녹음 전체 상한(비평 ⑫: 40개 15MB → 20개) */
export const RECORDING_MAX = 20;
/** 종류별 상한 — baseline·monthly는 영구(상한 없음) */
export const RECORDING_KIND_MAX: Partial<Record<RecordingKind, number>> = { retell: 5, 'daily-q': 3, drama: 10, d7: 3 };
/** 녹음 '통과' 기준 — 드라마 녹음 보존 우선순위에 쓴다(채점 PASS와 같은 70) */
const RECORDING_PASS = 70;

let _dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

/** 싱글턴 DB 핸들. SSR(window 없음) 환경에서는 호출하지 않도록 가드한다. */
function getDB(): Promise<IDBPDatabase<AppDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in the browser'));
  }
  if (!_dbPromise) {
    _dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // v1 → v2: 기존 'lessons' 스토어·데이터는 그대로 두고(지우면 오프라인 레슨이 사라진다)
        // 없는 스토어만 만든다. 처음 여는 기기(oldVersion 0)도 같은 분기로 셋 다 만들어진다.
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('by-date', 'date');
        }
        if (!db.objectStoreNames.contains(TTS_STORE)) {
          const tts = db.createObjectStore(TTS_STORE, { keyPath: 'key' });
          tts.createIndex('by-at', 'at');
        }
        if (!db.objectStoreNames.contains(REC_STORE)) {
          const rec = db.createObjectStore(REC_STORE, { keyPath: 'id' });
          rec.createIndex('by-kind', 'kind');
        }
      },
    });
    // 열기 실패(사설 모드 등)는 다음 호출에서 다시 시도할 수 있게 캐시를 비운다
    _dbPromise.catch(() => {
      _dbPromise = null;
    });
  }
  return _dbPromise;
}

/**
 * 영구 저장 요청 — 브라우저가 '저장 공간 부족·오래 안 열면 지워도 되는 사이트'로 취급하지 않게
 * 한다(녹음·음성 캐시가 통째로 날아가는 일을 줄인다). 한 세션에 한 번만, 거부·미지원은 무해.
 */
let _persist: Promise<boolean> | null = null;
export function requestPersist(): Promise<boolean> {
  if (!_persist) {
    _persist = (async () => {
      try {
        if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
        if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
        return !!(await navigator.storage.persist());
      } catch {
        return false;
      }
    })();
  }
  return _persist;
}

/* ── 레슨 캐시(v1) ── */

/**
 * 문장 세트 배열을 로컬에 저장(upsert)한다.
 * 동일 id 가 있으면 덮어쓴다. 하나의 트랜잭션으로 일괄 처리한다.
 */
export async function saveLessonsToLocal(lessons: Lesson[]): Promise<void> {
  if (!lessons?.length) return;
  const db = await getDB();
  const now = Date.now();
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all([
    ...lessons.map((l) => tx.store.put({ ...l, cachedAt: now })),
    tx.done,
  ]);
}

/**
 * 로컬에 저장된 모든 문장 세트를 date 오름차순으로 반환한다.
 * 특정 id 만 필요하면 getLessonFromLocal(id) 를 사용한다.
 */
export async function getLessonsFromLocal(): Promise<Lesson[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE, 'by-date');
}

/** 단일 문장 세트 조회. 없으면 undefined. */
export async function getLessonFromLocal(id: number): Promise<Lesson | undefined> {
  const db = await getDB();
  return db.get(STORE, id);
}

/** 로컬 캐시 전체 삭제(로그아웃/초기화용). */
export async function clearLocalLessons(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}

/* ── TTS 캐시(v2) ── */

/** 캐시 키 — 목소리·감정 태그 유무·문장. 감정 태그를 뺀 합성(격식체 문서)은 다른 음성이라 따로 둔다 */
export function ttsKey(voice: string, tagless: boolean, text: string): string {
  return `${voice}:${tagless ? 1 : 0}:${text}`;
}

/**
 * LRU 축출 계획(순수 함수) — at 오름차순 키 목록에서 상한을 넘는 만큼 앞(오래된 것)에서 뺀다.
 * idb의 'by-at' 인덱스가 이미 오름차순으로 돌려주므로 정렬은 하지 않는다.
 */
export function lruEvictKeys(keysOldestFirst: string[], max = TTS_CACHE_MAX): string[] {
  const over = keysOldestFirst.length - max;
  return over > 0 ? keysOldestFirst.slice(0, over) : [];
}

/** 캐시된 음성 — 없거나 idb를 쓸 수 없으면 null. 맞으면 마지막 사용 시각을 갱신한다(LRU). */
export async function getTts(key: string): Promise<{ blob: Blob; mime: string; at: number } | null> {
  try {
    const db = await getDB();
    const hit = await db.get(TTS_STORE, key);
    if (!hit || !hit.blob) return null;
    // 사용 시각 갱신은 기다리지 않는다 — 실패해도 재생엔 영향 없음
    void db.put(TTS_STORE, { ...hit, at: Date.now() }).catch(() => undefined);
    return { blob: hit.blob, mime: hit.mime || hit.blob.type || 'audio/wav', at: hit.at };
  } catch {
    return null;
  }
}

/** 합성 결과를 저장하고 상한(300)을 넘는 오래된 것부터 지운다. 저장했으면 true. */
export async function putTts(key: string, blob: Blob, mime = blob.type || 'audio/wav'): Promise<boolean> {
  try {
    const db = await getDB();
    await db.put(TTS_STORE, { key, blob, mime, at: Date.now() });
    void requestPersist();
    // 블롭을 전부 메모리에 올리지 않도록 키만 인덱스 순으로 읽는다
    const keys = await db.getAllKeysFromIndex(TTS_STORE, 'by-at');
    for (const k of lruEvictKeys(keys)) await db.delete(TTS_STORE, k);
    return true;
  } catch {
    return false;
  }
}

/** 캐시 개수(소리 점검 표용) — 못 읽으면 0 */
export async function ttsCacheCount(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count(TTS_STORE);
  } catch {
    return 0;
  }
}

/* ── 녹음 보관(v2) ── */

const localDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 보존 규칙(순수 함수) — 지울 녹음 id 목록을 돌려준다.
 *   · baseline·monthly: 영구(지우지 않는다 — 성장 비교의 기준점) · d7: 최신 3개(D+1·D+4·D+7), 전체 상한에서 제외
 *   · retell 5 · daily-q 3: 최신 우선
 *   · drama 10: LRU이되 '통과한 문장'과 '같은 문장을 2회 이상 녹음한 것'(전후 비교 가능)을 우선 보존
 *   · 전체 상한 20: 그래도 넘치면 영구 종류를 뺀 나머지에서 오래된 것부터
 */
export function pruneRecordingPlan(all: RecordingMeta[], max = RECORDING_MAX): string[] {
  const drop = new Set<string>();
  const byKind = new Map<RecordingKind, RecordingMeta[]>();
  for (const r of all) {
    const arr = byKind.get(r.kind);
    if (arr) arr.push(r);
    else byKind.set(r.kind, [r]);
  }
  const newestFirst = (a: RecordingMeta, b: RecordingMeta) => b.at - a.at;
  for (const [kind, list] of byKind) {
    const cap = RECORDING_KIND_MAX[kind];
    if (cap == null || list.length <= cap) continue;
    let keepOrder: RecordingMeta[];
    if (kind === 'drama') {
      const countEn = new Map<string, number>();
      for (const r of list) if (r.en) countEn.set(r.en, (countEn.get(r.en) || 0) + 1);
      const prio = (r: RecordingMeta) => ((r.score ?? 0) >= RECORDING_PASS ? 2 : 0) + ((r.en && (countEn.get(r.en) || 0) >= 2) ? 1 : 0);
      keepOrder = [...list].sort((a, b) => prio(b) - prio(a) || b.at - a.at);
    } else {
      keepOrder = [...list].sort(newestFirst);
    }
    for (const r of keepOrder.slice(cap)) drop.add(r.id);
  }
  const remaining = all.filter((r) => !drop.has(r.id));
  if (remaining.length > max) {
    // d7(최대 3개)도 전체 상한에서 빼지 않는다 — D+1 vs D+7 비교가 끝나기 전에 밀려나면 카드가 빈다
    const evictable = remaining.filter((r) => r.kind !== 'baseline' && r.kind !== 'monthly' && r.kind !== 'd7').sort((a, b) => a.at - b.at);
    for (const r of evictable.slice(0, remaining.length - max)) drop.add(r.id);
  }
  return [...drop];
}

/** 녹음 저장 — id를 돌려준다(저장 못 하면 null: 호출부는 va_diag recSaveFail을 올리고 조용히 넘어간다) */
export async function putRecording(rec: Omit<Recording, 'id' | 'date' | 'at'> & { id?: string; date?: string; at?: number }): Promise<string | null> {
  try {
    const db = await getDB();
    const at = rec.at ?? Date.now();
    const id = rec.id || `${rec.kind}-${at}-${Math.random().toString(36).slice(2, 7)}`;
    await db.put(REC_STORE, { ...rec, id, at, date: rec.date || localDate(at), mime: rec.mime || rec.blob.type || 'audio/webm' });
    void requestPersist();
    await pruneRecordings();
    return id;
  } catch {
    return null;
  }
}

/** 보존 규칙 적용 — 지운 개수(실패 시 0) */
export async function pruneRecordings(): Promise<number> {
  try {
    const db = await getDB();
    const all = await db.getAll(REC_STORE);
    const ids = pruneRecordingPlan(all);
    for (const id of ids) await db.delete(REC_STORE, id);
    return ids.length;
  } catch {
    return 0;
  }
}

/** 녹음 목록(최신 먼저). kind를 주면 그 종류만. 못 읽으면 빈 배열. */
export async function listRecordings(kind?: RecordingKind): Promise<Recording[]> {
  try {
    const db = await getDB();
    const all = kind ? await db.getAllFromIndex(REC_STORE, 'by-kind', kind) : await db.getAll(REC_STORE);
    return all.filter((r) => r && r.blob).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export async function deleteRecording(id: string): Promise<boolean> {
  try {
    const db = await getDB();
    await db.delete(REC_STORE, id);
    return true;
  } catch {
    return false;
  }
}
