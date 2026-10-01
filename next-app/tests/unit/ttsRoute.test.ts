import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * TTS 라우트 — Groq가 특정 인물 목소리를 거부하면 같은 성별의 다른 목소리로 대신하고,
 * 그걸 기억해 다음 줄부터는 바로 대체 목소리로(감사 v1.31 G46).
 */
type Call = { voice: string };
let calls: Call[] = [];
beforeEach(() => {
  calls = [];
  process.env.GROQ_API_KEY = 'server-key';
  vi.resetModules();
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { voice: string };
    calls.push({ voice: body.voice });
    if (body.voice === 'diana') return new Response(JSON.stringify({ error: { message: 'voice diana is not available' } }), { status: 400 });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/wav' } });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GROQ_API_KEY;
});

const req = (voice: string) =>
  ({
    headers: new Headers({ 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 200)}` }),
    json: async () => ({ text: 'Hello there.', voice }),
    nextUrl: new URL('http://localhost/app/api/tts'),
  }) as unknown as Parameters<typeof import('../../app/api/tts/route').POST>[0];

describe('인물 목소리 대체', () => {
  test('거부된 목소리(diana)는 같은 성별(hannah)로 대신하고, 다음 줄은 바로 대체 목소리', async () => {
    const { POST } = await import('../../app/api/tts/route');
    const r1 = await POST(req('diana'));
    expect(r1.status).toBe(200);
    expect(calls.map((c) => c.voice)).toEqual(['diana', 'hannah']);
    calls = [];
    const r2 = await POST(req('diana'));
    expect(r2.status).toBe(200);
    expect(calls.map((c) => c.voice)).toEqual(['hannah']); // 기억한 대체 목소리로 한 번에
  });
  test('목록에 없는 목소리는 기본(austin)으로', async () => {
    const { POST } = await import('../../app/api/tts/route');
    await POST(req('robot9000'));
    expect(calls[0].voice).toBe('austin');
  });
});

describe('M1 — 한도(429)는 Retry-After를 그대로 전달', () => {
  test('Groq가 429 + Retry-After 7이면 클라이언트도 429 + Retry-After 7', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: { message: 'Rate limit reached' } }), { status: 429, headers: { 'Retry-After': '7' } }));
    const { POST } = await import('../../app/api/tts/route');
    const r = await POST(req('austin'));
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('7');
  });
  test('Retry-After가 없으면 기본 2초', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: { message: 'Rate limit reached' } }), { status: 429 }));
    const { POST } = await import('../../app/api/tts/route');
    const r = await POST(req('austin'));
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('2');
  });
});
