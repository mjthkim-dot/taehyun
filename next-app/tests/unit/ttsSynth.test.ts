import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * 리뷰 B2·B11 — TTS 한도(429) 정책과 메모리 objectURL 캐시 상한.
 *   · Retry-After > 10초 → 기다리지 않고 즉시 null + degradedUntil(그동안 Groq를 부르지 않는다, 미리 받기 포함)
 *   · Retry-After ≤ 10초 → 한 번 기다렸다 재시도, 그래도 429면 최소 15초 쉼
 *   · 헤더 없음 → 60초 쉼
 *   · objectURL 캐시는 최근 60개 — 밀려나는 URL은 revoke, 재생 중인 것은 남긴다
 */
type Synth = typeof import('../../lib/ttsSynth');
let calls: number;
let replies: Array<() => Response>;

beforeEach(() => {
  calls = 0;
  replies = [];
  vi.resetModules();
  vi.stubGlobal('fetch', async () => {
    calls++;
    const r = replies.shift();
    return r ? r() : new Response(new Uint8Array(512), { status: 200, headers: { 'Content-Type': 'audio/wav' } });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const r429 = (ra?: string) => () => new Response('{}', { status: 429, headers: ra == null ? {} : { 'Retry-After': ra } });

function args(m: Synth, text: string, extra: Partial<Parameters<Synth['synthTts']>[0]> = {}) {
  const degraded: boolean[] = [];
  return {
    degraded,
    a: { text, input: text, voice: 'austin', tagless: false, key: 'gsk_x', cache: new Map<string, string>(), cacheKey: `austin:${text}`, playing: () => '', onDegraded: (on: boolean) => degraded.push(on), ...extra },
  };
}

describe('429 정책(degradedUntil)', () => {
  test('Retry-After 60 → 기다리지 않고 즉시 기기 음성 + 다음 줄은 Groq를 부르지 않는다', async () => {
    const m: Synth = await import('../../lib/ttsSynth');
    m.resetTtsPause();
    replies.push(r429('60'));
    const t0 = Date.now();
    const { a, degraded } = args(m, 'Hello there.');
    expect(await m.synthTts(a)).toBeNull();
    expect(Date.now() - t0).toBeLessThan(1000); // 대기 없음
    expect(calls).toBe(1); // 재시도 없음
    expect(degraded).toEqual([true]);
    expect(m.ttsPaused()).toBe(true);
    expect(m.ttsPausedUntil() - Date.now()).toBeGreaterThan(55_000);
    // 다음 줄(미리 받기 포함) — Groq 호출 없이 바로 null
    const next = args(m, 'Next line.');
    expect(await m.synthTts(next.a)).toBeNull();
    expect(calls).toBe(1);
    expect(next.degraded).toEqual([true]);
  });

  test('Retry-After 헤더 없음 → 60초 쉼', async () => {
    const m: Synth = await import('../../lib/ttsSynth');
    m.resetTtsPause();
    expect(m.plan429(null)).toEqual({ pause: 60_000 });
    expect(m.plan429('30')).toEqual({ pause: 30_000 });
    expect(m.plan429('2')).toEqual({ wait: 2000 });
    expect(m.plan429('garbage')).toEqual({ pause: 60_000 });
  });

  test('Retry-After ≤ 10초 → 한 번 재시도, 그래도 429면 최소 15초 쉼', async () => {
    const m: Synth = await import('../../lib/ttsSynth');
    m.resetTtsPause();
    replies.push(r429('0'), r429('1'));
    const { a } = args(m, 'Again.');
    expect(await m.synthTts(a)).toBeNull();
    expect(calls).toBe(2);
    expect(m.ttsPausedUntil() - Date.now()).toBeGreaterThan(14_000);
  });

  test('재시도에서 성공하면 URL을 돌려주고 쉬지 않는다', async () => {
    const m: Synth = await import('../../lib/ttsSynth');
    m.resetTtsPause();
    replies.push(r429('0'));
    const { a, degraded } = args(m, 'Ok now.');
    const url = await m.synthTts(a);
    expect(typeof url).toBe('string');
    expect(calls).toBe(2);
    expect(m.ttsPaused()).toBe(false);
    expect(degraded).toEqual([false]);
    expect(a.cache.get(a.cacheKey)).toBe(url);
  });

  test('쉼이 끝나면 다시 Groq를 부른다', async () => {
    const m: Synth = await import('../../lib/ttsSynth');
    m.resetTtsPause();
    m.pauseTts(-1); // 이미 지난 시각
    const { a } = args(m, 'Back.');
    expect(typeof (await m.synthTts(a))).toBe('string');
    expect(calls).toBe(1);
  });
});

describe('요청 간격(gapMs — HVPT)', () => {
  test('gapMs를 준 연속 요청은 그 간격 이상 띄워 보낸다', async () => {
    const m: Synth = await import('../../lib/ttsSynth');
    m.resetTtsPause();
    const at: number[] = [];
    vi.stubGlobal('fetch', async () => {
      at.push(Date.now());
      return new Response(new Uint8Array(512), { status: 200 });
    });
    await Promise.all([m.synthTts(args(m, 'One.', { gapMs: 300 }).a), m.synthTts(args(m, 'Two.', { gapMs: 300 }).a), m.synthTts(args(m, 'Three.', { gapMs: 300 }).a)]);
    expect(at.length).toBe(3);
    expect(at[1] - at[0]).toBeGreaterThanOrEqual(280);
    expect(at[2] - at[1]).toBeGreaterThanOrEqual(280);
  });
});

describe('메모리 objectURL 캐시 상한', () => {
  test('60개를 넘으면 오래된 것부터 revoke — 재생 중인 URL·방금 넣은 것은 남긴다', async () => {
    const m: Synth = await import('../../lib/ttsSynth');
    const revoked: string[] = [];
    const spy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u: string) => void revoked.push(u));
    const cache = new Map<string, string>();
    for (let i = 0; i < 70; i++) m.rememberUrl(cache, `k${i}`, `blob:u${i}`, 'blob:u0');
    expect(cache.size).toBe(m.TTS_URL_CACHE_MAX);
    expect(cache.has('k0')).toBe(true); // 재생 중
    expect(cache.has('k69')).toBe(true); // 최신
    expect(revoked).toHaveLength(10);
    expect(revoked).not.toContain('blob:u0');
    expect(revoked[0]).toBe('blob:u1');
    // 같은 키를 다시 넣으면 최신으로(LRU) — 다음에 밀려나지 않는다
    m.rememberUrl(cache, 'k11', 'blob:u11', '');
    m.rememberUrl(cache, 'k100', 'blob:u100', '');
    expect(cache.has('k11')).toBe(true);
    spy.mockRestore();
  });
});
