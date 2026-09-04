/**
 * 면접 D-day — "준비의 마감이 보여야 매일 연습한다"의 계약:
 *   ① 면접 셋업에서 날짜·라벨을 저장하면 D-n 배너가 뜬다
 *   ② 홈 이어서 하기의 면접 카드가 D-n 상태가 되고, D-3 이내면 강조된다
 *   ③ 삭제하면 원래 상태(최근 점수/첫 시뮬레이션)로 돌아간다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

function dstr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("면접")');
await page.waitForSelector('.iv-role', { timeout: 10000 });

/* ① 설정 → D-n 배너 */
await page.fill('input[type="date"]', dstr(2));
await page.fill('input[placeholder*="Workato HR"]', 'Workato HR 미팅');
await page.click('button:has-text("D-day 설정")');
await page.waitForSelector('.iv-dday', { timeout: 8000 });
check('D-2 배너가 뜬다', await page.evaluate(() => document.querySelector('.iv-dday')?.textContent.includes('D-2')));
check('라벨이 함께 보인다', await page.evaluate(() => document.querySelector('.iv-dday')?.textContent.includes('Workato HR 미팅')));

/* ② 홈 카드 D-day + 강조 */
await page.click('.mode-tab:has-text("홈")');
await page.waitForSelector('.hs-card', { timeout: 15000 });
const ivCard = await page.evaluate(() => {
  const c = [...document.querySelectorAll('.hs-card')].find((x) => x.innerText.includes('면접'));
  return { text: c?.innerText.replace(/\n/g, ' ') || '', hot: c?.classList.contains('hot') || false };
});
check('홈 면접 카드가 D-day 상태', ivCard.text.includes('D-2') && ivCard.text.includes('Workato HR'), ivCard.text);
check('D-3 이내라 강조된다', ivCard.hot);

/* ③ 삭제 → 원복 */
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("면접")');
await page.waitForSelector('.iv-dday', { timeout: 10000 });
await page.click('.iv-dday .fb-del');
await page.waitForSelector('.iv-dday-set', { timeout: 8000 });
check('삭제하면 설정 UI로 돌아온다', true);

await browser.close();
finish();
