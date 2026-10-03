/**
 * 인앱 피드백 — "거슬린 것을 그 자리에서 기록"의 계약:
 *   ① 더보기 시트에서 1탭 진입, 화면 태그 + 내용 저장(va_feedback)
 *   ② 목록 최신순 표시, 개별 삭제, 재방문에도 유지
 *   ③ 전체 복사 — 클립보드에 마크다운으로 실린다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
// 클립보드는 헤드리스 권한이 까다롭다 — writeText를 스텁해 내용만 검증한다
await page.addInitScript(() => {
  window.__copied = '';
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } },
    configurable: true,
  });
});
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

/* ① 진입 + 저장 */
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("피드백")');
await page.waitForSelector('.fb-input', { timeout: 10000 });
await page.click('.fb-chip:has-text("드릴")');
await page.fill('.fb-input', '정답 소리가 너무 커요');
await page.click('button:has-text("기록하기")');
await page.waitForSelector('.fb-item', { timeout: 8000 });
await page.fill('.fb-input', '홈 카드 순서가 좋아요');
await page.click('.fb-chip:has-text("홈")');
await page.click('button:has-text("기록하기")');
await page.waitForFunction(() => document.querySelectorAll('.fb-item').length === 2, null, { timeout: 8000 });

const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('va_feedback') || '[]'));
check('태그와 함께 저장된다', saved.length === 2 && saved[1].screen === '드릴' && saved[1].text.includes('정답 소리'), JSON.stringify(saved.map((s) => s.screen)));
check('목록이 최신순', await page.evaluate(() => document.querySelector('.fb-item .fb-text')?.textContent.includes('홈 카드 순서')));

/* ③ 전체 복사 */
await page.click('button:has-text("전체 복사")');
await page.waitForFunction(() => document.body.innerText.includes('복사했어요'), null, { timeout: 8000 });
const clip = await page.evaluate(() => window.__copied);
check('클립보드에 마크다운으로 실린다', clip.includes('앱 피드백 2건') && clip.includes('- [드릴] 정답 소리가 너무 커요'), clip.slice(0, 60));

/* ② 삭제 + 유지 */
await page.click('.fb-item >> nth=0 >> .fb-del');
await page.waitForFunction(() => document.querySelectorAll('.fb-item').length === 1, null, { timeout: 8000 });
await page.reload();
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("피드백")');
await page.waitForSelector('.fb-item', { timeout: 10000 });
check('삭제 반영 + 재방문에도 유지', (await page.locator('.fb-item').count()) === 1 && (await page.evaluate(() => document.querySelector('.fb-text')?.textContent.includes('정답 소리'))));

await browser.close();
finish();
