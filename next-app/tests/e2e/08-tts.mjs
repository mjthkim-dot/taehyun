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

await browser.close();
finish('08-tts');
