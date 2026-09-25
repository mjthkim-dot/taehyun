/**
 * 회화 이중언어 — "버튼 없이 한국어로 말해도 된다"의 계약:
 *   ① 시스템 프롬프트에 이중언어 규칙(한국어→답+영어 문장+영어로 계속)이 실린다
 *   ② 한국어 입력이 막히지 않고 정상 전송되며, 한·영 혼합 응답이 렌더된다
 *   ③ 입력창이 한국어 가능을 안내한다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
let sysSeen = '';
await page.route('**/app/api/groq', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (body.stream) {
    sysSeen = String(body.messages?.[0]?.content || '');
    const reply = '아, 계약 연장을 부탁하고 싶으시군요. 영어로는 이렇게 말해요: Could we extend the contract by one more year? Now you try — how would you ask me?';
    const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\ndata: [DONE]\n\n`;
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
});
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForTimeout(1200);
await page.click('.mode-tab:has-text("회화")');
await page.waitForSelector('input.text-input', { timeout: 8000 });

/* ③ 안내 */
check('입력창이 한국어 가능을 안내한다', await page.evaluate(() => document.querySelector('input.text-input')?.placeholder.includes('한국어')));

/* ①② 한국어 발화 → 이중언어 응답 */
await page.fill('input.text-input', '계약 연장하고 싶다고 어떻게 말해?');
await page.click('button.round-btn.send');
await page.waitForFunction(() => document.body.textContent.includes('Could we extend the contract'), null, { timeout: 10000 });
check('이중언어 규칙이 프롬프트에 실린다', sysSeen.includes('한국어 발화 처리') && sysSeen.includes('영어로는 이렇게 말해요'));
check('한국어 발화는 교정 대상이 아니라는 지시', sysSeen.includes('교정 대상이 아닙니다'));
check('한·영 혼합 응답이 렌더된다', await page.evaluate(() => document.body.innerText.includes('영어로는 이렇게 말해요')));

await browser.close();
finish();
