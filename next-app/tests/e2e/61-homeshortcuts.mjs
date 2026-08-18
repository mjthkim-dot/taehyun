/**
 * 홈 "이어서 하기" — 기능이 홈에 자연스럽게 녹는 구조의 계약:
 *   ① 홈에 진행 상태가 실린 숏컷 카드들이 뜬다(복습 due는 강조되어 맨 앞)
 *   ② 상태가 진짜 데이터다 — 코스 2/18, 면접 최근 점수, 복습 대기 수
 *   ③ 카드 탭 한 번으로 해당 화면에 도착한다(몰입 스토리, 전체 도구)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await seedKey(page);
await page.addInitScript(() => {
  localStorage.setItem('va_weak', JSON.stringify([{ en: 'Could you send the file?', kr: '파일 보내주시겠어요?', box: 1, lapses: 0, due: 0 }]));
  localStorage.setItem('va_course_seen', JSON.stringify(['finops-1', 'finops-2']));
  localStorage.setItem('va_interview_history', JSON.stringify([{ date: '2026-08-17T09:00:00Z', role: 'Workato', score: 78 }]));
});
await page.goto(`${BASE}/app`);
await page.waitForSelector('.hs-card', { timeout: 15000 });

/* ①② 카드 + 진짜 상태 */
const cards = await page.evaluate(() => [...document.querySelectorAll('.hs-card')].map((c) => c.innerText.replace(/\n/g, ' ')));
check('이어서 하기 섹션이 홈에 뜬다', await page.evaluate(() => document.querySelector('.hs-title')?.textContent === '이어서 하기'));
check('복습 due가 강조 카드로 맨 앞', cards[0].includes('복습') && cards[0].includes('1개 대기') && (await page.evaluate(() => document.querySelector('.hs-card')?.classList.contains('hot'))), cards[0]);
check('실전 코스 진행률이 실린다', cards.some((c) => c.includes('2/18')), String(cards));
check('면접 최근 점수가 실린다', cards.some((c) => c.includes('최근 78점')));
check('몰입 스토리 다음 화가 실린다', cards.some((c) => c.includes('몰입 스토리') && c.includes('1화')));

/* ③ 1탭 진입 */
await page.click('.hs-card:has-text("몰입 스토리")');
await page.waitForSelector('.rc-head', { timeout: 15000 });
check('숏컷 탭 한 번으로 몰입 스토리 도착', await page.evaluate(() => document.body.innerText.includes('The Message from Gate 43')));

await page.click('.mode-tab:has-text("홈")');
await page.waitForSelector('.hs-card', { timeout: 15000 });
await page.click('.hs-card:has-text("전체 도구")');
await page.waitForSelector('.feat-grid .feat-card', { timeout: 15000 });
check('전체 도구 카드 → 기능 화면', (await page.locator('.feat-grid .feat-card').count()) > 10);

await browser.close();
finish();
