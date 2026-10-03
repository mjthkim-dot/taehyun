/** 메모리 localStorage + 최소 window — lib/state.ts의 load/store와 전역 이벤트가 그대로 돌게 한다 */
class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = new MemStorage();
g.window = { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {}, localStorage: g.localStorage };
