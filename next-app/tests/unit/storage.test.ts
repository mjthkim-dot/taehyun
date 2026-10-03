import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * IndexedDB 저장소(M1) — fake-indexeddb가 없어 idb 라이브러리를 메모리 가짜로 대체한다.
 * 가짜는 storage.ts가 쓰는 메서드(get/put/delete/getAll/getAllFromIndex/getAllKeysFromIndex/count/clear/transaction)만 흉내 낸다.
 * 보존 규칙(LRU 300·녹음 상한 20·종류별)은 순수 함수(lruEvictKeys·pruneRecordingPlan)로도 따로 확인한다.
 */
type Row = Record<string, unknown>;
class FakeStore {
  rows = new Map<unknown, Row>();
  indexes = new Map<string, string>();
  constructor(public keyPath: string) {}
  createIndex(name: string, keyPath: string) {
    this.indexes.set(name, keyPath);
  }
}
class FakeDB {
  stores = new Map<string, FakeStore>();
  objectStoreNames = { contains: (n: string) => this.stores.has(n) };
  createObjectStore(name: string, o: { keyPath: string }) {
    const s = new FakeStore(o.keyPath);
    this.stores.set(name, s);
    return s;
  }
  private st(name: string) {
    const s = this.stores.get(name);
    if (!s) throw new Error(`no store ${name}`);
    return s;
  }
  async get(store: string, key: unknown) {
    return this.st(store).rows.get(key);
  }
  async put(store: string, val: Row) {
    const s = this.st(store);
    s.rows.set(val[s.keyPath], val);
    return val[s.keyPath];
  }
  async delete(store: string, key: unknown) {
    this.st(store).rows.delete(key);
  }
  async getAll(store: string) {
    return [...this.st(store).rows.values()];
  }
  async count(store: string) {
    return this.st(store).rows.size;
  }
  async clear(store: string) {
    this.st(store).rows.clear();
  }
  private byIndex(store: string, index: string, query?: unknown) {
    const s = this.st(store);
    const kp = s.indexes.get(index)!;
    const all = [...s.rows.values()].filter((r) => query === undefined || r[kp] === query);
    return { s, kp, all: all.sort((a, b) => ((a[kp] as number) < (b[kp] as number) ? -1 : (a[kp] as number) > (b[kp] as number) ? 1 : 0)) };
  }
  async getAllFromIndex(store: string, index: string, query?: unknown) {
    return this.byIndex(store, index, query).all;
  }
  async getAllKeysFromIndex(store: string, index: string) {
    const { s, all } = this.byIndex(store, index);
    return all.map((r) => r[s.keyPath]);
  }
  transaction(store: string) {
    return { store: { put: (v: Row) => this.put(store, v) }, done: Promise.resolve() };
  }
}

const state: { db: FakeDB | null; oldVersion: number; opens: number; fail: boolean; upgradedFrom: number[] } = { db: null, oldVersion: 0, opens: 0, fail: false, upgradedFrom: [] };
vi.mock('idb', () => ({
  openDB: async (_name: string, version: number, opts: { upgrade: (db: FakeDB, old: number, nu: number) => void }) => {
    state.opens++;
    if (state.fail) throw new Error('InvalidStateError: private mode');
    if (!state.db) state.db = new FakeDB();
    state.upgradedFrom.push(state.oldVersion);
    opts.upgrade(state.db, state.oldVersion, version);
    return state.db;
  },
}));

let t = 1_700_000_000_000;
beforeEach(() => {
  state.db = null;
  state.oldVersion = 0;
  state.opens = 0;
  state.fail = false;
  state.upgradedFrom = [];
  vi.resetModules();
  t = 1_700_000_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => (t += 1));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const blob = (n = 1000) => new Blob([new Uint8Array(n)], { type: 'audio/wav' });
const mod = () => import('../../lib/storage');

describe('v1 → v2 업그레이드', () => {
  test('기존 lessons 스토어·데이터는 그대로 두고 tts·recordings만 추가한다', async () => {
    const db = new FakeDB();
    const lessons = db.createObjectStore('lessons', { keyPath: 'id' });
    lessons.createIndex('by-date', 'date');
    lessons.rows.set(7, { id: 7, title: '옛 레슨', date: '2026-01-01', sentences: [] });
    state.db = db;
    state.oldVersion = 1;
    const s = await mod();
    expect(s.DB_VERSION).toBe(2);
    expect(await s.putTts('austin:0:Hi.', blob())).toBe(true);
    expect(db.objectStoreNames.contains('tts')).toBe(true);
    expect(db.objectStoreNames.contains('recordings')).toBe(true);
    expect((await s.getLessonsFromLocal()).map((l) => l.title)).toEqual(['옛 레슨']);
    expect(state.upgradedFrom).toEqual([1]);
  });
  test('처음 여는 기기(0 → 2)도 세 스토어가 모두 생긴다', async () => {
    const s = await mod();
    await s.putTts('k', blob());
    expect([...state.db!.stores.keys()].sort()).toEqual(['lessons', 'recordings', 'tts']);
  });
});

describe('TTS 캐시', () => {
  test('키 = voice:tagless:text, 저장 → 조회 → 사용 시각 갱신', async () => {
    const s = await mod();
    expect(s.ttsKey('hannah', true, 'Hello.')).toBe('hannah:1:Hello.');
    expect(s.ttsKey('hannah', false, 'Hello.')).toBe('hannah:0:Hello.');
    expect(await s.getTts('hannah:0:Hello.')).toBeNull();
    await s.putTts('hannah:0:Hello.', blob(), 'audio/wav');
    const at0 = (state.db!.stores.get('tts')!.rows.get('hannah:0:Hello.') as { at: number }).at;
    const hit = await s.getTts('hannah:0:Hello.');
    expect(hit?.mime).toBe('audio/wav');
    expect(hit?.blob.size).toBe(1000);
    await Promise.resolve();
    expect((state.db!.stores.get('tts')!.rows.get('hannah:0:Hello.') as { at: number }).at).toBeGreaterThan(at0);
  });
  test('LRU 300 — 301번째를 넣으면 가장 오래 안 쓴 것이 빠진다', async () => {
    const s = await mod();
    for (let i = 0; i < 300; i++) await s.putTts(`k${i}`, blob(300));
    expect(await s.ttsCacheCount()).toBe(300);
    await s.getTts('k0'); // 방금 썼으니 살아남아야 한다
    await Promise.resolve();
    await s.putTts('k300', blob(300));
    expect(await s.ttsCacheCount()).toBe(300);
    expect(await s.getTts('k0')).not.toBeNull();
    expect(await s.getTts('k1')).toBeNull(); // 가장 오래 안 쓴 것
    expect(await s.getTts('k300')).not.toBeNull();
  });
  test('lruEvictKeys(순수): 상한 넘는 만큼 앞(오래된 것)에서', async () => {
    const s = await mod();
    expect(s.lruEvictKeys(['a', 'b', 'c'], 2)).toEqual(['a']);
    expect(s.lruEvictKeys(['a', 'b'], 2)).toEqual([]);
    expect(s.TTS_CACHE_MAX).toBe(300);
  });
});

describe('녹음 보관', () => {
  const rec = (kind: 'baseline' | 'monthly' | 'retell' | 'drama' | 'daily-q' | 'd7', extra: Partial<{ en: string; score: number }> = {}) =>
    ({ kind, blob: blob(10), mime: 'audio/webm', durationMs: 1200, ...extra });
  test('저장하면 id·date가 붙고 목록은 최신 먼저', async () => {
    const s = await mod();
    const id = await s.putRecording(rec('retell', { en: 'a' }));
    expect(id).toMatch(/^retell-/);
    await s.putRecording(rec('retell', { en: 'b' }));
    const list = await s.listRecordings('retell');
    expect(list.map((r) => r.en)).toEqual(['b', 'a']);
    expect(list[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await s.listRecordings()).length).toBe(2);
  });
  test('종류별 상한: retell 5·daily-q 3·drama 10, baseline·monthly는 영구', async () => {
    const s = await mod();
    for (let i = 0; i < 7; i++) await s.putRecording(rec('retell', { en: `r${i}` }));
    for (let i = 0; i < 5; i++) await s.putRecording(rec('daily-q'));
    for (let i = 0; i < 3; i++) await s.putRecording(rec('baseline'));
    for (let i = 0; i < 3; i++) await s.putRecording(rec('monthly'));
    expect((await s.listRecordings('retell')).map((r) => r.en)).toEqual(['r6', 'r5', 'r4', 'r3', 'r2']);
    expect((await s.listRecordings('daily-q')).length).toBe(3);
    expect((await s.listRecordings('baseline')).length).toBe(3);
    expect((await s.listRecordings('monthly')).length).toBe(3);
  });
  test('drama 10 LRU — 통과 문장·같은 문장 2회 이상을 우선 보존', async () => {
    const s = await mod();
    // 오래된 순: pass0(통과) · twice(2회) · 나머지 12개(미통과, 1회)
    await s.putRecording(rec('drama', { en: 'pass0', score: 90 }));
    await s.putRecording(rec('drama', { en: 'twice', score: 30 }));
    await s.putRecording(rec('drama', { en: 'twice', score: 40 }));
    for (let i = 0; i < 12; i++) await s.putRecording(rec('drama', { en: `d${i}`, score: 50 }));
    const list = await s.listRecordings('drama');
    expect(list.length).toBe(10);
    const ens = list.map((r) => r.en);
    expect(ens).toContain('pass0');
    expect(ens.filter((e) => e === 'twice').length).toBe(2);
    expect(ens).not.toContain('d0'); // 오래된 미통과 1회가 먼저 빠진다
    expect(ens).toContain('d11');
  });
  test('전체 상한 20 — 넘치면 영구 종류를 뺀 나머지에서 오래된 것부터', async () => {
    const s = await mod();
    const plan = s.pruneRecordingPlan(
      [
        ...Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, kind: 'baseline' as const, date: '2026-01-01', at: i })),
        ...Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, kind: 'retell' as const, date: '2026-01-02', at: 100 + i })),
        ...Array.from({ length: 3 }, (_, i) => ({ id: `q${i}`, kind: 'daily-q' as const, date: '2026-01-02', at: 50 + i })),
        ...Array.from({ length: 4 }, (_, i) => ({ id: `d${i}`, kind: 'drama' as const, date: '2026-01-02', at: 200 + i })),
      ],
      20
    );
    // 24개 → 4개 지움: 영구(baseline 12)는 두고, 비영구 중 가장 오래된 daily-q 3 + retell 1
    expect(plan.length).toBe(4);
    expect(plan.every((id) => !id.startsWith('b'))).toBe(true);
    expect(plan.sort()).toEqual(['q0', 'q1', 'q2', 'r0']);
    expect(s.RECORDING_MAX).toBe(20);
  });
  test('A10: d7Pair가 가리키는 녹음(D+1)은 d7 최신 3개 정리에서도 남는다', async () => {
    const s = await mod();
    const d7 = Array.from({ length: 5 }, (_, i) => ({ id: `d7-${i}`, kind: 'd7' as const, date: '2026-01-0' + (i + 1), at: i }));
    // 핀 없음 — 가장 오래된 두 개(D+1 포함)가 빠진다
    expect(s.pruneRecordingPlan(d7, 20).sort()).toEqual(['d7-0', 'd7-1']);
    // D+1(d7-0)을 고정 — 남고, 대신 고정 아닌 오래된 것이 빠진다
    const plan = s.pruneRecordingPlan(d7, 20, ['d7-0']);
    expect(plan).not.toContain('d7-0');
    expect(plan.sort()).toEqual(['d7-1', 'd7-2']);
  });
  test('A10: pruneRecordings는 va_growth.d7Pair의 id를 고정한다', async () => {
    const s = await mod();
    const first = await s.putRecording(rec('d7', { en: 'same' }));
    localStorage.setItem('va_growth', JSON.stringify({ d7Pair: { en: 'same', d1Id: first } }));
    for (let i = 0; i < 4; i++) await s.putRecording(rec('d7', { en: 'same' }));
    const ids = (await s.listRecordings('d7')).map((r) => r.id);
    expect(ids.length).toBe(3);
    expect(ids).toContain(first);
  });
  test('persist 요청 — 거부·미지원·예외 모두 무해', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist: async () => Promise.reject(new Error('nope')) } });
    const s = await mod();
    expect(await s.requestPersist()).toBe(false);
    expect(await s.putRecording(rec('baseline'))).toBeTruthy();
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist: async () => true } });
    vi.resetModules();
    const s2 = await mod();
    expect(await s2.requestPersist()).toBe(true);
    expect(await s2.requestPersist()).toBe(true); // 한 세션에 한 번만(캐시)
  });
});

describe('idb를 쓸 수 없을 때(사설 모드) — 조용히 비활성', () => {
  test('모든 호출이 던지지 않고 null/false/빈 배열', async () => {
    state.fail = true;
    const s = await mod();
    expect(await s.getTts('k')).toBeNull();
    expect(await s.putTts('k', blob())).toBe(false);
    expect(await s.putRecording({ kind: 'drama', blob: blob(), mime: 'audio/webm', durationMs: 1 })).toBeNull();
    expect(await s.listRecordings()).toEqual([]);
    expect(await s.pruneRecordings()).toBe(0);
    expect(await s.ttsCacheCount()).toBe(0);
    // 실패한 열기는 캐시하지 않는다 — 다음 호출에서 다시 시도한다
    state.fail = false;
    expect(await s.putTts('k', blob())).toBe(true);
    expect(state.opens).toBeGreaterThanOrEqual(2);
  });
});
