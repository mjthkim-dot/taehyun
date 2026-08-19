/**
 * 면접 답변 가이드 — "내 상황에 맞는 가이드라인"의 계약:
 *   ① 기본은 접힘(먼저 스스로) — 토글로 연다
 *   ② Workato 질문엔 맞춤 가이드: 뼈대 + 내 커리어 재료(25만 달러·메가존) + 첫 문장
 *   ③ 질문이 넘어가면 가이드는 다시 접히고, 다음 질문은 다른 가이드
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
await page.route('**/app/api/groq', (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const sys = String(body.messages?.[0]?.content || '');
  const content = sys.includes('짧은 자연스러운 반응') ? JSON.stringify({ reaction: 'Thanks.', followUp: null }) : '{}';
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("면접")');
await page.waitForSelector('.iv-role', { timeout: 10000 });
await page.click('button:has-text("면접 시작")');
await page.waitForSelector('.iv-q', { timeout: 10000 });

/* ① 기본 접힘 */
check('가이드는 기본 접힘', (await page.locator('.iv-guide').count()) === 0 && (await page.locator('.iv-guide-toggle').count()) === 1);

/* ② 맞춤 내용 (질문 세트 로테이션과 무관하게 공통 재료 확인) */
await page.click('.iv-guide-toggle');
await page.waitForSelector('.iv-guide', { timeout: 8000 });
const g = await page.evaluate(() => document.querySelector('.iv-guide')?.innerText || '');
check('뼈대·내 재료·첫 문장이 있다', g.includes('뼈대') && g.includes('내 재료') && g.includes('첫 문장'), g.slice(0, 60));
check('내 커리어 재료가 실려 있다', /메가존|25만 달러|씨피랩스|AM 네트워크|커버리지|로드맵|블랙박스|하이퍼스케일러|우선순위 리스트|넥서스/.test(g), g.slice(0, 120));

/* ③ 다음 질문에서 접힘 + 내용 변경 */
await page.fill('.iv-answer', 'This is my detailed answer with numbers like two hundred fifty thousand dollars.');
await page.click('button:has-text("답변 제출")');
await page.waitForFunction(() => document.body.innerText.includes('질문 2/5'), null, { timeout: 15000 });
check('질문이 바뀌면 가이드는 다시 접힘', (await page.locator('.iv-guide').count()) === 0);
await page.click('.iv-guide-toggle');
await page.waitForSelector('.iv-guide', { timeout: 8000 });
const g2 = await page.evaluate(() => document.querySelector('.iv-guide')?.innerText || '');
check('다음 질문은 다른 가이드', g2 !== g && g2.includes('첫 문장'), g2.slice(0, 60));

await browser.close();
finish();
