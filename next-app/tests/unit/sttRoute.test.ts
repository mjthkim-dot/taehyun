import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * STT 라우트 — detail(none/segments/words)에 따른 verbose_json·timestamp_granularities[],
 * language auto(upstream 미전달), Groq 429의 Retry-After 전달, 앱 자체 한도의 Retry-After.
 */
type Seen = { fields: Record<string, string[]> };
let seen: Seen[] = [];
let upstream: () => Response = () => new Response(JSON.stringify({ text: 'Hello there.' }), { status: 200 });

beforeEach(() => {
  seen = [];
  process.env.GROQ_API_KEY = 'server-key';
  vi.resetModules();
  vi.stubGlobal('fetch', async (_url: string, init: { body: FormData }) => {
    const fields: Record<string, string[]> = {};
    for (const [k, v] of init.body.entries()) {
      (fields[k] ||= []).push(typeof v === 'string' ? v : `<file:${(v as File).name}>`);
    }
    seen.push({ fields });
    return upstream();
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GROQ_API_KEY;
});

let ipSeq = 1;
const req = (fields: Record<string, string>, ip = `10.1.${ipSeq++ % 250}.${Math.floor(Math.random() * 250)}`) => {
  const form = new FormData();
  form.append('audio', new File([new Uint8Array(4096)], 'speech.webm', { type: 'audio/webm' }), 'speech.webm');
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return {
    headers: new Headers({ 'x-forwarded-for': ip }),
    formData: async () => form,
    nextUrl: new URL('http://localhost/app/api/stt'),
  } as unknown as Parameters<typeof import('../../app/api/stt/route').POST>[0];
};

const VERBOSE = {
  text: 'We found the reason.',
  duration: 2.4,
  words: [
    { word: 'We', start: 0.1, end: 0.3 },
    { word: 'found', start: 0.35, end: 0.6 },
  ],
  segments: [{ id: 0, seek: 0, start: 0, end: 2.4, text: ' We found the reason.', tokens: [1, 2, 3], temperature: 0, avg_logprob: -0.2, compression_ratio: 1.3, no_speech_prob: 0.01 }],
};

describe('detail 필드', () => {
  test('기본(none) — response_format json, granularities 없음, 응답은 {text}만(현행 호환)', async () => {
    const { POST } = await import('../../app/api/stt/route');
    const r = await POST(req({}));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ text: 'Hello there.' });
    expect(seen[0].fields.response_format).toEqual(['json']);
    expect(seen[0].fields['timestamp_granularities[]']).toBeUndefined();
    expect(seen[0].fields.language).toEqual(['en']);
  });

  test('segments — verbose_json + segment, 응답에 segments(게이트 필드만)·duration', async () => {
    upstream = () => new Response(JSON.stringify(VERBOSE), { status: 200 });
    const { POST } = await import('../../app/api/stt/route');
    const r = await POST(req({ detail: 'segments' }));
    const body = await r.json();
    expect(seen[0].fields.response_format).toEqual(['verbose_json']);
    expect(seen[0].fields['timestamp_granularities[]']).toEqual(['segment']);
    expect(body.text).toBe('We found the reason.');
    expect(body.duration).toBe(2.4);
    expect(body.words).toBeUndefined();
    expect(body.segments).toEqual([{ start: 0, end: 2.4, text: 'We found the reason.', avg_logprob: -0.2, no_speech_prob: 0.01, compression_ratio: 1.3 }]);
  });

  test('words — segment + word 둘 다, 응답에 words', async () => {
    upstream = () => new Response(JSON.stringify(VERBOSE), { status: 200 });
    const { POST } = await import('../../app/api/stt/route');
    const r = await POST(req({ detail: 'words', temperature: '0' }));
    const body = await r.json();
    expect(seen[0].fields['timestamp_granularities[]']).toEqual(['segment', 'word']);
    expect(seen[0].fields.temperature).toEqual(['0']);
    expect(body.words).toEqual(VERBOSE.words);
    expect(body.segments).toHaveLength(1);
  });

  test('모르는 detail 값은 none으로', async () => {
    const { POST } = await import('../../app/api/stt/route');
    await POST(req({ detail: 'everything' }));
    expect(seen[0].fields.response_format).toEqual(['json']);
  });
});

describe('language', () => {
  test('auto면 upstream에 language를 보내지 않는다', async () => {
    const { POST } = await import('../../app/api/stt/route');
    await POST(req({ language: 'auto' }));
    expect(seen[0].fields.language).toBeUndefined();
  });
  test('ko는 그대로, 모르는 값은 en', async () => {
    const { POST } = await import('../../app/api/stt/route');
    await POST(req({ language: 'ko' }));
    await POST(req({ language: 'fr' }));
    expect(seen[0].fields.language).toEqual(['ko']);
    expect(seen[1].fields.language).toEqual(['en']);
  });
});

describe('429', () => {
  test('Groq 429 → 상태 429 유지 + Retry-After 전달', async () => {
    upstream = () => new Response(JSON.stringify({ error: { message: 'Rate limit reached' } }), { status: 429, headers: { 'retry-after': '7' } });
    const { POST } = await import('../../app/api/stt/route');
    const r = await POST(req({}));
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('7');
    expect((await r.json()).error.message).toBe('Rate limit reached');
  });

  test('앱 자체 한도(분당 40) — 41번째는 429 + Retry-After 5', async () => {
    const { POST } = await import('../../app/api/stt/route');
    const ip = '10.9.9.9';
    let last: Response | null = null;
    for (let i = 0; i < 41; i++) last = await POST(req({}, ip));
    expect(last!.status).toBe(429);
    expect(last!.headers.get('Retry-After')).toBe('5');
    expect(seen).toHaveLength(40); // 41번째는 upstream에 가지 않는다
  });
});
