/**
 * TTS 구조 회귀: Groq Orpheus의 요청당 200자 제한에 맞춰 긴 응답이
 * 자동 분할되어 여러 번 요청되고, 어떤 요청도 200자를 넘지 않는다.
 * ("음성이 안 나온다" — 200자 초과 400 실패의 재발 방지)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

// 긴 한 문장(마침표 없음, ~330자) — 문장 분할이 아니라 길이 분할을 강제한다
const LONG = 'well let me walk you through the entire migration plan for your production workloads and the security review process and the cost optimization strategy that we discussed in our previous meeting because I believe this approach will help your team move faster without adding unnecessary operational risk to the platform overall';
await page.route('**/app/api/groq', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (body.stream) {
    const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: LONG } }] })}\n\ndata: [DONE]\n\n`;
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  } else {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
  }
});
const ttsTexts = [];
await page.route('**/app/api/tts', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  ttsTexts.push(String(body.text || ''));
  await route.fulfill({ status: 404, body: '' }); // 재생은 폴백으로 — 요청 형태만 검증
});
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForTimeout(1200);
await page.click('.mode-tab:has-text("회화")');
await page.waitForSelector('input.text-input', { timeout: 8000 });
await page.fill('input.text-input', 'Tell me the plan');
await page.click('button.round-btn.send');
await page.waitForTimeout(2500);

check('긴 응답이 여러 TTS 요청으로 분할', ttsTexts.length >= 2, `requests=${ttsTexts.length}`);
check('모든 TTS 요청이 200자 이하', ttsTexts.every((t) => t.length <= 200), ttsTexts.map((t) => t.length).join(','));
check('분할 조각을 합치면 원문 커버', ttsTexts.join(' ').length >= LONG.length * 0.9, `${ttsTexts.join(' ').length}/${LONG.length}`);

/* ── M1: 한도(429) → Retry-After 한 번 대기 → 그래도 429면 기기 음성 폴백 + 상단 칩 ── */
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p2 = await ctx.newPage();
p2.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await p2.addInitScript(() => {
  localStorage.setItem('va_onboarded', 'true');
  localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
  localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
  // 소리는 켜 둔다(음소거면 TTS를 아예 부르지 않는다)
});
await p2.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await p2.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
let tts429 = 0;
// 같은 문장의 호출 시각만 묶는다 — 드라마는 여러 대사를 거의 동시에 요청하므로 전체 순서로는 재시도 간격을 잴 수 없다
const ttsByText = new Map();
await p2.route('**/app/api/tts*', (r) => {
  tts429++;
  const t = (() => { try { return r.request().postDataJSON()?.text || ''; } catch { return ''; } })();
  ttsByText.set(t, [...(ttsByText.get(t) || []), Date.now()]);
  return r.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '1' }, body: JSON.stringify({ error: { message: 'Rate limit reached' } }) });
});
await p2.goto(`${BASE}/app`);
await p2.waitForSelector('.fg-cta', { timeout: 15000 });
await p2.click('.fg-cta');
await p2.waitForSelector('.dr-log', { timeout: 15000 });
const chip = await p2.waitForSelector('.tts-chip', { timeout: 20000 }).then(() => true).catch(() => false);
check('429 두 번(재시도 후)이면 상단에 "기기 음성" 칩', chip && (await p2.evaluate(() => document.querySelector('.tts-chip')?.textContent?.includes('기기 음성'))));
const gaps = [...ttsByText.values()].filter((a) => a.length >= 2).map((a) => a[1] - a[0]);
check('Retry-After(1초)만큼 한 번 기다렸다 같은 문장을 재시도한다', tts429 >= 2 && gaps.length >= 1 && gaps.every((g) => g >= 900), `calls=${tts429} gaps=${gaps.join(',')}`);
check('드라마는 멈추지 않는다(폴백 뒤에도 대화 기록이 흐른다)', (await p2.locator('.dr-log .dr-line, .dr-log .dr-narr').count()) >= 1);
check('va_tts_meta에 miss·tts429가 쌓인다', await p2.evaluate(() => {
  const m = JSON.parse(localStorage.getItem('va_tts_meta') || '{}');
  const today = Object.values(m)[0] || {};
  return (today.miss || 0) >= 1 && (today.tts429 || 0) >= 1;
}));
check('va_diag에도 tts429', await p2.evaluate(() => Object.values(JSON.parse(localStorage.getItem('va_diag') || '{}')).some((d) => (d.tts429 || 0) >= 1)));
await ctx.close();

await browser.close();
finish('08-tts');
