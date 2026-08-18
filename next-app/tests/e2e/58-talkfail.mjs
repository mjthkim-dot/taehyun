/**
 * 회화 AI 실패 UX — "말하면 듣기만 하고 답이 없다" 재발 방지 계약:
 *   ① AI 응답 실패 시 명확한 한국어 안내(진단 경로 포함)가 채팅에 뜬다
 *   ② 실패해도 입력은 살아 있고, 연결이 회복되면 다음 발화는 정상 응답한다
 *   ③ 성공하면 실패 카운터가 리셋된다(핸즈프리 오프 로직의 전제)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
let calls = 0;
await page.route('**/app/api/groq', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (!body.stream) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
  }
  calls++;
  if (calls === 1) {
    // 모델 전멸 시나리오 — 서버 체인이 전부 실패했을 때의 응답
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: '사용 가능한 모델이 없습니다 — model decommissioned' } }) });
  }
  const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Now I am back! How are you?' } }] })}\n\ndata: [DONE]\n\n`;
  return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
});
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForTimeout(1200);
await page.click('.mode-tab:has-text("회화")');
await page.waitForSelector('input.text-input', { timeout: 8000 });

/* ① 실패 → 명확한 안내 */
await page.fill('input.text-input', 'Hello there');
await page.click('button.round-btn.send');
await page.waitForFunction(() => document.body.textContent.includes('AI 응답에 실패했어요'), null, { timeout: 10000 });
check('실패 시 원인 + 다시 시도 안내가 뜬다', await page.evaluate(() => document.body.innerText.includes('다시 말해보세요')));
check('진단 경로를 알려준다', await page.evaluate(() => document.body.innerText.includes('음성 진단')));

/* ② 입력은 살아 있고 회복되면 정상 응답 */
await page.fill('input.text-input', 'Are you back?');
await page.click('button.round-btn.send');
await page.waitForFunction(() => document.body.textContent.includes('Now I am back'), null, { timeout: 10000 });
check('연결 회복 후 다음 발화는 정상 응답', true);
check('실패-회복 왕복에 스트림 2회', calls === 2, String(calls));

await browser.close();
finish();
