/**
 * 드라마 재생 속도 조절(v1.32) — "드라마 재생속도를 조절할 수 있으면 좋겠어요"
 *   ① 고른 속도가 실제 음성 속도로(0.6× < 1× < 1.2×) — 다음 대사부터
 *   ② 예전 '🐢 천천히'를 켜 둔 사용자는 0.75×로 이어받는다
 *   ③ 1.2×면 자동 재생이 1×보다 빨리 흘러간다(대사 사이 시간도 줄어든다)
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const browser = await launch();

async function open(seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript((seed) => {
    localStorage.setItem('va_onboarded', 'true');
    localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: 1 }));
    localStorage.setItem('va_drama_auto', 'true');
    for (const [k, v] of Object.entries(seed)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
    window.__said = [];
    let cur = null;
    const synth = {
      speaking: false, paused: false, pending: false,
      getVoices: () => [],
      cancel() { cur = null; },
      pause() {}, resume() {},
      speak(u) {
        window.__said.push({ text: u.text, rate: u.rate, at: Date.now() });
        cur = u;
        // 실제 기기처럼 빠를수록 짧게 말한다
        setTimeout(() => { if (cur === u) { cur = null; u.onend && u.onend(); } }, 900 / (u.rate || 1));
      },
      addEventListener() {}, removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  }, seed);
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-speed-btn', { timeout: 15000 });
  return { ctx, page };
}

/** n번째 영어 대사가 나올 때까지 걸린 시간(ms) */
async function timeToLines(page, n) {
  await page.waitForFunction((n) => window.__said.length >= n, n, { timeout: 60000 });
  return page.evaluate((n) => window.__said[n - 1].at - window.__said[0].at, n);
}

/* ① 속도 → 음성 속도 */
{
  const { ctx, page } = await open({ va_drama_speed: '1' });
  await page.waitForFunction(() => window.__said.length >= 1, null, { timeout: 20000 });
  const base = await page.evaluate(() => window.__said[0].rate);
  await page.click('.dr-speed-btn');
  await page.click('.dr-speed-row [role=radio]:has-text("0.6×")');
  const n = await page.evaluate(() => window.__said.length);
  await page.waitForFunction((n) => window.__said.length > n, n, { timeout: 20000 });
  const slow = await page.evaluate(() => window.__said[window.__said.length - 1].rate);
  await page.click('.dr-speed-btn');
  await page.click('.dr-speed-row [role=radio]:has-text("1.2×")');
  const m = await page.evaluate(() => window.__said.length);
  await page.waitForFunction((m) => window.__said.length > m, m, { timeout: 20000 });
  const fast = await page.evaluate(() => window.__said[window.__said.length - 1].rate);
  check('0.6× < 1× < 1.2× — 고른 속도가 다음 대사 음성에 반영', slow < base && base < fast, JSON.stringify({ slow, base, fast }));
  check('1.2× 설정 저장', await page.evaluate(() => JSON.parse(localStorage.getItem('va_drama_speed')) === 1.2));
  check('속도 버튼에 ⚡ 1.2× 표시', (await page.textContent('.dr-speed-btn')).includes('1.2×'));
  await ctx.close();
}

/* ② 예전 '천천히' 설정 이어받기 */
{
  const { ctx, page } = await open({ va_drama_slow: 'true' });
  check('예전 🐢 천천히 → 0.75×로 시작', (await page.textContent('.dr-speed-btn')).includes('0.75×'));
  await ctx.close();
}

/* ③ 빠를수록 자동 재생이 빨리 흐른다 */
{
  const a = await open({ va_drama_speed: '1' });
  const tNormal = await timeToLines(a.page, 3);
  await a.ctx.close();
  const b = await open({ va_drama_speed: '1.2' });
  const tFast = await timeToLines(b.page, 3);
  await b.ctx.close();
  check('1.2×는 1×보다 대사 3줄이 빨리 지나간다', tFast < tNormal, `${tFast}ms vs ${tNormal}ms`);
}

await browser.close();
finish('82-drama-speed');
