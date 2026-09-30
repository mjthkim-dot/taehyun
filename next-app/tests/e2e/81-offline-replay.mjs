/**
 * v1.31 감사 회귀 — 검증 에이전트 요청:
 *   ① 오프라인 첫 재실행: 첫 방문만 하고 인터넷 없이 다시 열어도 앱이 뜬다(폴백 안내가 아니라)
 *   ② 다시 듣기: 자동 재생 중 지난 말풍선을 누르면, 끊긴 지금 대사를 이어서 들려준다
 *   ③ v1.29 이전: AI 4화를 본 사용자 → 홈은 원고 4화 + 안내, 복습은 그때 배운 표현을 묻는다
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const browser = await launch();

/* ① 오프라인 첫 재실행 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('va_onboarded', 'true'));
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  const ready = await page
    .waitForFunction(
      async () => {
        if (!navigator.serviceWorker?.controller && !(await navigator.serviceWorker?.getRegistration())) return false;
        await navigator.serviceWorker.ready;
        const c = await caches.open('app-pages');
        return !!(await c.match('/app'));
      },
      null,
      { timeout: 20000, polling: 500 }
    )
    .then(() => true)
    .catch(() => false);
  check('첫 방문에 앱 문서를 캐시해 둔다(app-pages)', ready);
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
  const tabs = await page.waitForSelector('.mode-tab', { timeout: 15000 }).then(() => true).catch(() => false);
  check('인터넷 없이 다시 열어도 앱이 뜬다', tabs && !(await page.evaluate(() => document.body.innerText.includes('오프라인 상태'))));
  await ctx.setOffline(false);
  await ctx.close();
}

/* ② 다시 듣기가 지금 대사를 끊지 않는다 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(() => {
    localStorage.setItem('va_onboarded', 'true');
    localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: 1 }));
    localStorage.setItem('va_drama_auto', 'true');
    window.__said = [];
    let cur = null;
    const synth = {
      speaking: false, paused: false, pending: false,
      getVoices: () => [],
      cancel() { cur = null; },
      pause() {}, resume() {},
      speak(u) {
        window.__said.push(u.text);
        cur = u;
        setTimeout(() => { if (cur === u) { cur = null; u.onend && u.onend(); } }, 900);
      },
      addEventListener() {}, removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  // 두 번째 대사가 시작된 순간(아직 끝나기 전)에 첫 대사 말풍선을 누른다
  await page.waitForFunction(() => (window.__said || []).some((t) => t.includes('Is it')), null, { timeout: 20000 });
  const firstBubble = page.locator('.dr-log > .dr-line .dr-bub').first();
  const firstText = (await firstBubble.locator('.dr-en').textContent()).trim();
  await firstBubble.click();
  await page.waitForTimeout(3500);
  const said = await page.evaluate(() => window.__said);
  const i = said.lastIndexOf(firstText);
  const after = said.slice(i + 1);
  check('다시 들은 뒤 끊긴 지금 대사를 이어서 들려준다', i >= 0 && after[0] && after[0].includes('Is it'), JSON.stringify(said.slice(-5)));
  await ctx.close();
}

/* ③ v1.29 → v1.30 이전 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(() => {
    if (localStorage.getItem('va_seeded')) return;
    localStorage.setItem('va_seeded', '1');
    localStorage.setItem('va_onboarded', 'true');
    localStorage.setItem('va_drama_mute', 'true');
    localStorage.setItem('va_drama_auto', 'false');
    localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: 1 }));
    localStorage.setItem('va_drama', JSON.stringify({ done: { 1: '2026-09-25', 2: '2026-09-26', 3: '2026-09-27', 4: '2026-09-28' }, score: { 4: 90 } }));
    const ai4 = {
      no: 4, level: 'A2', title: 'Friday Face-off', titleKr: '금요일의 대면', recap: '', cliff: 'CEO Diane이 왜 전화했을까?', ai: true,
      scenes: [{ type: 'narr', kr: '금요일.' }],
      learn: [{ en: 'That makes sense.', kr: '이해가 돼요.', note: '' }, { en: 'I found the problem.', kr: '문제를 찾았어요.', note: '' }],
    };
    localStorage.setItem('va_drama_eps', JSON.stringify([ai4]));
    localStorage.setItem('va_weak', JSON.stringify([
      { en: 'That makes sense.', kr: '이해가 돼요.', cat: '드라마', lesson: 'drama:4', box: 0, lapses: 0, due: 0 },
      { en: 'I found the problem.', kr: '문제를 찾았어요.', cat: '드라마', lesson: 'drama:4', box: 0, lapses: 0, due: 0 },
    ]));
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.dr-card', { timeout: 15000 });
  check('홈 카드 = 원고 4화(AI 4화 기록은 정리)', await page.evaluate(() => document.querySelector('.dr-card-title')?.textContent.includes('EP 4') && document.querySelector('.dr-card-title')?.textContent.includes('빨간 폴더')));
  check('4~7화가 새 원고로 바뀌었다는 안내', await page.evaluate(() => document.querySelector('.dr-card')?.textContent.includes('새 원고')));
  check('그때 배운 표현은 출처만 바뀌어 복습에 남는다', await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak')).every((w) => w.lesson === 'drama:ai-4')));
  await page.click('.dr-card .dr-go');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  for (let g = 0; g < 5 && !(await page.locator('.dr-act').count()); g++) {
    if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(100);
  }
  const ask = await page.evaluate(() => document.querySelector('.dr-ask')?.textContent || '');
  check('원고 4화 첫머리 복습 = 그때 배운 표현', /이해가 돼요|문제를 찾았어요/.test(ask), ask);
  await ctx.close();
}

await browser.close();
finish('81-offline-replay');
