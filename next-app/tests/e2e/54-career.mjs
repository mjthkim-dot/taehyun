/**
 * 커리어 영어(관심 주제 콘텐츠 팩) — 계약:
 *   ① 3트랙 9편이 뜨고, 시나리오 열면 DialoguePractice + 실제 커리어 근거가 보인다
 *   ② 연 시나리오의 표현만 SRS(cat '실전') 등록 + 멱등
 *   ③ 진행률(n/9) 갱신·유지, 드릴 핸드오프
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

async function gotoCareer(page) {
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("커리어 영어")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("커리어 영어")');
  await page.waitForSelector('.rc-head', { timeout: 10000 });
}

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await seedKey(page);
await gotoCareer(page);

/* ① 구조 */
const stats = await page.evaluate(() => Array.from(document.querySelectorAll('.rc-stat b')).map((b) => b.textContent));
check('헤더: 3트랙·9대화', stats[0] === '3' && stats[1] === '9', JSON.stringify(stats));
check('트랙 3개(자기소개·인터뷰·네트워킹)', (await page.locator('.mn-item').count()) === 3);

await page.click('.mn-item:has-text("이직 인터뷰") .mn-item-head');
await page.waitForSelector('.rc-sc', { timeout: 8000 });
check('인터뷰 트랙에 시나리오 3개', (await page.locator('.rc-sc').count()) === 3);
await page.click('.rc-sc:has-text("어려운 고객") .rc-sc-head');
await page.waitForSelector('.rc-sc-body', { timeout: 8000 });
check('실제 커리어 근거(서북 면담)가 보인다', await page.evaluate(() => document.body.innerText.includes('서북 MSP 전환 최종 면담')));
check('STAR 대화가 연습 가능하다', await page.evaluate(() => document.body.innerText.includes('역할 연습') && document.body.innerText.includes('Tell me about a time')));

/* ② 표현 등록 + 멱등 */
const e1 = await page.evaluate(() => ({
  weak: JSON.parse(localStorage.getItem('va_weak') || '[]').filter((w) => w.cat === '실전').length,
  imported: JSON.parse(localStorage.getItem('va_minutes_expr') || '[]'),
}));
check('연 시나리오 표현 4개만 등록', e1.weak === 4 && e1.imported.length === 1 && e1.imported[0] === 'career-interview-1', JSON.stringify(e1));

/* ③ 진행률 + 드릴 */
check('진행률 1/9 + 연습함 표시', await page.evaluate(() => document.body.innerText.includes('1/9') && document.body.innerText.includes('연습함 ✓')));
await page.click('button:has-text("이 대화 문장으로 드릴")');
await page.waitForSelector('.drill-source', { timeout: 10000 });
check('드릴 핸드오프', (await page.evaluate(() => document.querySelector('.drill-source')?.textContent || '')).includes('커리어 영어'));

await gotoCareer(page);
check('재방문에도 진행률 유지', await page.evaluate(() => document.body.innerText.includes('1/9')));
await page.click('.mn-item:has-text("이직 인터뷰") .mn-item-head');
await page.waitForSelector('.rc-sc', { timeout: 8000 });
await page.click('.rc-sc:has-text("어려운 고객") .rc-sc-head');
await page.waitForSelector('.rc-sc-body', { timeout: 8000 });
const e2 = await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]').filter((w) => w.cat === '실전').length);
check('재열람은 중복 등록 없음(멱등)', e2 === 4, String(e2));

await browser.close();
finish();
