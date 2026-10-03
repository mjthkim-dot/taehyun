/**
 * 튜터 교차 세션 기억(P1-A) — 회화가 초면으로 시작하지 않는 계약:
 *   ① 저장된 기억(지난 대화 + 최근 교정)이 새 세션의 시스템 프롬프트에 실린다
 *   ② 대화가 진행되면 기억 스냅숏이 갱신된다
 *   ③ 기억이 없으면 프롬프트에 기억 블록이 없다(빈 값 오염 금지)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();

/* ── ①② 기억 주입 + 갱신 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  let sysSeen = '';
  await page.route('**/app/api/groq', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.stream) {
      sysSeen = String(body.messages?.[0]?.content || '');
      const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Welcome back! How did the pilot go?' } }] })}\n\ndata: [DONE]\n\n`;
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
  });
  await seedKey(page);
  await page.addInitScript(() => {
    localStorage.setItem('va_tutor_memory', JSON.stringify({ date: '2026-08-12', lines: ['U: I met a new customer today.', 'A: How did it go?'] }));
    localStorage.setItem('va_mistakes', JSON.stringify([
      { wrong: 'I go there yesterday', right: 'I went there yesterday.', note: '시제', t: 1, type: 'tense' },
    ]));
  });
  await page.goto(`${BASE}/app`);
  await page.waitForTimeout(1200);
  await page.click('.mode-tab:has-text("회화")');
  await page.waitForSelector('input.text-input', { timeout: 8000 });
  await page.fill('input.text-input', 'Good morning!');
  await page.click('button.round-btn.send');
  await page.waitForFunction(() => document.body.textContent.includes('Welcome back'), null, { timeout: 10000 });

  check('지난 세션 대화가 프롬프트에 실린다', sysSeen.includes('지난 세션 기억') && sysSeen.includes('I met a new customer'), sysSeen.slice(-80));
  check('최근 교정도 함께 실린다', sysSeen.includes('최근 교정받은 실수') && sysSeen.includes('I went there yesterday'));
  check('억지 언급 금지 지시가 붙는다', sysSeen.includes('억지로 언급하지 마라'));

  const mem = await page.evaluate(() => JSON.parse(localStorage.getItem('va_tutor_memory') || '{}'));
  check('대화 후 기억이 갱신된다', mem.lines?.some((l) => l.includes('Good morning')) && mem.lines?.some((l) => l.includes('Welcome back')), JSON.stringify(mem.lines));
  await page.close();
}

/* ── ③ 기억 없음 → 블록 없음 ── */
{
  const page = await browser.newPage();
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  let sysSeen = '';
  await page.route('**/app/api/groq', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.stream) {
      sysSeen = String(body.messages?.[0]?.content || '');
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"choices":[{"delta":{"content":"Hi!"}}]}\n\ndata: [DONE]\n\n' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
  });
  await seedKey(page);
  await page.goto(`${BASE}/app`);
  await page.waitForTimeout(1200);
  await page.click('.mode-tab:has-text("회화")');
  await page.waitForSelector('input.text-input', { timeout: 8000 });
  await page.fill('input.text-input', 'Hello');
  await page.click('button.round-btn.send');
  await page.waitForFunction(() => document.body.textContent.includes('Hi!'), null, { timeout: 10000 });
  check('기억이 없으면 기억 블록이 없다', !sysSeen.includes('지난 세션 기억'));
  await page.close();
}

await browser.close();
finish();
