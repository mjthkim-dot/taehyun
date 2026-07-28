/** 홈 기본 진입 + 오늘의 미션 카드 핵심 플로우(표현·저장·완료·링 갱신). */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

check('기본 화면이 홈', (await page.evaluate(() => document.querySelector('.app-header h1')?.textContent)) === '홈');
check('미션 제목 표시', !!(await page.evaluate(() => document.querySelector('.mission-title')?.textContent)));
check('핵심 표현 5개', (await page.evaluate(() => document.querySelectorAll('.mission-phrase-en').length)) === 5);

await page.click('.mission-phrase:first-child .mission-phrase-main');
await page.waitForTimeout(200);
check('표현 탭 → 한국어 뜻', !!(await page.evaluate(() => document.querySelector('.mission-phrase-kr'))));

await page.click('.mission-phrase:first-child .mission-ic:last-child');
await page.waitForTimeout(200);
check('표현장 저장', (await page.evaluate(() => JSON.parse(localStorage.getItem('va_phrases') || '[]').length)) === 1);

check('말하기 연습 임베드', !!(await page.evaluate(() => document.querySelector('.mission-practice .speaking-practice'))));

const ringBefore = await page.evaluate(() => document.querySelector('svg text')?.textContent);
await page.click('.mission-complete');
await page.waitForTimeout(300);
check('완료 배너', !!(await page.evaluate(() => document.querySelector('.mission-done-banner'))));
const ringAfter = await page.evaluate(() => document.querySelector('svg text')?.textContent);
check('목표 링 즉시 갱신', ringBefore !== ringAfter, `${ringBefore} → ${ringAfter}`);

await browser.close();
finish('01-home-mission');
