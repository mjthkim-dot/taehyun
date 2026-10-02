/**
 * 드라마 재생 속도 조절(v1.32) — "드라마 재생속도를 조절할 수 있으면 좋겠어요"
 *   ① 고른 속도가 실제 음성 속도로(0.6× < 1× < 1.2×) — 다음 대사부터
 *   ② 예전 '🐢 천천히'를 켜 둔 사용자는 0.75×로 이어받는다
 *   ③ 1.2×면 자동 재생이 1×보다 빨리 흘러간다(대사 사이 시간도 줄어든다)
 *   ④ M3 키 없는 날의 속도 사다리 — 홈 '🎧 EP n 0.9×로 다시 듣기' → 그 속도로 자막 없이 재생(설정은 저장 안 함),
 *      0.9·1.0을 통과한 날 1.2×를 이해도 60% 이상으로 마치면 엔딩에 '귀 뚫림 ✓'(사다리 3단 표시)
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
    // M2: 역할극 장면(태오 대사)에서는 자동 흐름이 멈춘다 — 이 검사는 자동 재생 said 순서를 보므로 rolePlay off 경로로 고정(역할극은 83-roleplay)
    localStorage.setItem('va_flags', JSON.stringify({ rolePlay: false }));
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

/* ④ 속도 사다리(M3) — 키 없이 원고 7화를 다 본 날 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('va_onboarded', 'true');
    localStorage.setItem('va_mode', JSON.stringify('focus'));
    localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: 1 }));
    localStorage.setItem('va_drama_auto', 'true');
    localStorage.setItem('va_flags', JSON.stringify({ rolePlay: false }));
    const done = {};
    const score = {};
    for (let n = 1; n <= 7; n++) {
      done[n] = `2026-09-0${n}`;
      score[n] = n === 1 ? 40 : 80;
    }
    localStorage.setItem('va_drama', JSON.stringify({ done, score }));
    window.__ladderToday = today;
  });
  await page.addInitScript(() => {
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
        setTimeout(() => { if (cur === u) { cur = null; u.onend && u.onend(); } }, 300 / (u.rate || 1));
      },
      addEventListener() {}, removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.dr-card .dr-go', { timeout: 15000 });
  check("키 없는 날 홈 주 버튼 = '🎧 EP 1 0.9×로 다시 듣기'", (await page.textContent('.dr-card .dr-go')).includes('EP 1 0.9×로 다시 듣기'));
  check("발화 줄 첫 점은 '다시 듣기'(에피소드 대신)", (await page.getAttribute('.dr-card .rc-dots', 'aria-label')).startsWith('다시 듣기'));
  // 0.9·1.0은 오늘 이미 통과했다(시드) → 1.2×
  await page.evaluate(() => localStorage.setItem('va_drama_ladder', JSON.stringify({ date: window.__ladderToday, no: 1, step: 2 })));
  await page.reload();
  await page.waitForSelector('.dr-card .dr-go', { timeout: 15000 });
  check('두 단을 통과한 날 = 1.2×', (await page.textContent('.dr-card .dr-go')).includes('1.2×로 다시 듣기'));
  await page.click('.dr-card .dr-go');
  await page.waitForSelector('.dr-speed-btn', { timeout: 15000 });
  check('그 속도(1.2×)로 시작 · 자막 꺼짐', (await page.textContent('.dr-speed-btn')).includes('1.2×') && (await page.locator('.dr-top button', { hasText: /^자막$/ }).getAttribute('aria-pressed')) === 'false');
  // EP1 문항은 정답으로(이해도 100), 따라 말하기(플래그 off의 speak 장면)는 넘어간다
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    if (await page.locator('.dr-end').count()) break;
    const ok = page.locator('.dr-act .dr-opt', { hasText: /^Yes, it's my first day\.$|조금만 버텨 봐요/ });
    if (await ok.count()) await ok.first().click();
    else if (await page.locator('.dr-act .dr-opt').count()) await page.locator('.dr-act .dr-opt').first().click();
    else if (await page.locator('.dr-skip:not([disabled])').count()) await page.click('.dr-skip:not([disabled])');
    else if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(200);
  }
  await page.waitForSelector('.rc-ladder', { timeout: 20000 });
  const lad = await page.evaluate(() => ({
    done: !!document.querySelector('.rc-ladder.done'),
    steps: [...document.querySelectorAll('.rc-ladder-step.ok')].map((e) => e.textContent),
    msg: document.querySelector('.rc-ladder-msg')?.textContent || '',
    score: document.querySelector('.dr-end-score')?.textContent || '',
  }));
  check("사다리 0.9→1.0→1.2 통과 — 엔딩에 '귀 뚫림 ✓'", lad.done && lad.steps.length === 3 && lad.msg.includes('귀 뚫림'), JSON.stringify(lad));
  check('사다리 속도는 설정에 저장하지 않는다', await page.evaluate(() => localStorage.getItem('va_drama_speed') === null));
  await page.click('.dr-cliff .dr-go');
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.dr-card', { timeout: 15000 });
  check("홈 카드에 '👂 귀 뚫림 ✓'", (await page.textContent('.dr-card .rc-fuel')).includes('귀 뚫림'));
  await ctx.close();
}

await browser.close();
finish('82-drama-speed');
