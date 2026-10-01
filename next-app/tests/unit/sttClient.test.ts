import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * lib/stt.ts 클라이언트 — 429면 Retry-After(≤8초)만큼 한 번 기다렸다 재시도, 그래도 429면 'busy'.
 * 객체 옵션 호출은 words·segments·quality를 돌려주고, 문자열 호출(예전 시그니처)은 text만.
 */
let responses: (() => Response)[] = [];
let sent: FormData[] = [];

beforeEach(() => {
  responses = [];
  sent = [];
  vi.resetModules();
  vi.stubGlobal('fetch', async (_url: string, init: { body: FormData }) => {
    sent.push(init.body);
    const next = responses.shift();
    return next ? next() : new Response(JSON.stringify({ text: 'ok' }), { status: 200 });
  });
  localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

const blob = () => new Blob([new Uint8Array(2048)], { type: 'audio/webm' });
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => () => new Response(JSON.stringify(body), { status, headers });

describe('retryAfterMs', () => {
  test('초 → ms, 상한 8초, 없으면 기본 3초', async () => {
    const { retryAfterMs } = await import('../../lib/stt');
    expect(retryAfterMs('2')).toBe(2000);
    expect(retryAfterMs('30')).toBe(8000);
    expect(retryAfterMs(null)).toBe(3000);
    expect(retryAfterMs('garbage')).toBe(3000);
    expect(retryAfterMs('0')).toBe(0);
  });
});

describe('transcribe', () => {
  test('429 → Retry-After만큼 한 번 기다렸다 재시도해 성공', async () => {
    vi.useFakeTimers();
    responses = [json({ error: { message: 'busy' } }, 429, { 'Retry-After': '2' }), json({ text: 'Second try.' })];
    const { transcribe } = await import('../../lib/stt');
    const p = transcribe(blob(), { detail: 'none' });
    await vi.advanceTimersByTimeAsync(2000);
    const out = await p;
    expect(out.text).toBe('Second try.');
    expect(out.reason).toBe('ok');
    expect(sent).toHaveLength(2);
  });

  test('429가 두 번이면 reason busy, quality.reason busy(객체 호출) / SttError(문자열 호출)', async () => {
    vi.useFakeTimers();
    responses = [json({}, 429, { 'Retry-After': '1' }), json({}, 429, { 'Retry-After': '1' })];
    const { transcribe, SttError } = await import('../../lib/stt');
    const p = transcribe(blob(), { detail: 'segments' });
    await vi.advanceTimersByTimeAsync(1000);
    const out = await p;
    expect(out.reason).toBe('busy');
    expect(out.quality).toEqual({ ok: false, reason: 'busy', logprobMean: 0 });

    responses = [json({}, 429), json({}, 429)];
    const p2 = transcribe(blob(), 'hint').catch((e) => e);
    await vi.advanceTimersByTimeAsync(3000);
    const err = await p2;
    expect(err).toBeInstanceOf(SttError);
    expect((err as Error).message).toBe('busy');
  });

  test('객체 옵션 — detail·language·temperature·prompt를 form에 싣고 words·segments·quality를 돌려준다', async () => {
    responses = [
      json({
        text: 'We found the reason.',
        duration: 2.4,
        words: [{ word: 'We', start: 0.1, end: 0.3 }, { word: 'found', start: 0.9, end: 1.2 }],
        segments: [{ start: 0, end: 2.4, avg_logprob: -0.2, no_speech_prob: 0.01, compression_ratio: 1.3 }],
      }),
    ];
    const { transcribe, STT_PROPER_NOUNS } = await import('../../lib/stt');
    const out = await transcribe(blob(), { detail: 'words', language: 'auto', temperature: 0, prompt: STT_PROPER_NOUNS });
    const f = sent[0];
    expect(f.get('detail')).toBe('words');
    expect(f.get('language')).toBe('auto');
    expect(f.get('temperature')).toBe('0');
    expect(f.get('prompt')).toBe('Taeo, Maya, Jun, Diane, Mr. Grant, Nimbus.');
    expect(f.get('key')).toBe('gsk_test_key');
    expect((f.get('audio') as File).name).toBe('speech.webm');
    expect(out.words).toHaveLength(2);
    expect(out.segments).toHaveLength(1);
    expect(out.duration).toBe(2.4);
    expect(out.quality).toEqual({ ok: true, reason: null, logprobMean: -0.2 });
  });

  test('lastTtsText와 전사가 같으면 quality echo', async () => {
    responses = [json({ text: 'Who made the mistake with the servers?', segments: [{ start: 0, end: 2, avg_logprob: -0.2, no_speech_prob: 0.01, compression_ratio: 1.2 }] })];
    const { transcribe } = await import('../../lib/stt');
    const out = await transcribe(blob(), { detail: 'segments', lastTtsText: 'Who made the mistake with the servers?' });
    expect(out.quality.reason).toBe('echo');
  });

  test('문자열 호출(예전 시그니처)은 text만 돌려주고 detail을 보내지 않는다', async () => {
    responses = [json({ text: 'Plain text.' })];
    const { transcribe } = await import('../../lib/stt');
    expect(await transcribe(blob(), 'This is a microphone test.', 'en')).toBe('Plain text.');
    expect(sent[0].get('detail')).toBeNull();
    expect(sent[0].get('language')).toBe('en');
  });

  test('STT_PROPER_NOUNS — 고유명사 6개뿐(목표 문장 금지)', async () => {
    const { STT_PROPER_NOUNS } = await import('../../lib/stt');
    expect(STT_PROPER_NOUNS.split(',').map((s) => s.trim()).filter(Boolean)).toHaveLength(6);
  });
});
