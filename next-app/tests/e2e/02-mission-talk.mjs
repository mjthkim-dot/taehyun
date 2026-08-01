/** 미션 → 회화 핸드오프: 인트로·시스템 프롬프트에 미션 상황이 실리고, one-shot으로 소비된다. */
import { BASE, check, finish, launch, mockGroq, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
let capturedSystem = '';
await mockGroq(page, { onSystem: (s) => (capturedSystem = s) });
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

const missionTitle = await page.evaluate(() => document.querySelector('.mission-title')?.textContent);
await page.click('.mission-cta');
await page.waitForSelector('.talk-intro', { timeout: 10000 });

const introHead = await page.evaluate(() => document.querySelector('.talk-intro .ti-head')?.textContent || '');
check('회화 인트로가 미션 상황(🎯)', introHead.includes('🎯') && introHead.includes(missionTitle), introHead);

await page.fill('input.text-input', 'Hello, shall we start?');
await page.click('button.round-btn.send');
await page.waitForTimeout(1200);
check('시스템 프롬프트에 미션 상황 포함', capturedSystem.includes(missionTitle));

// one-shot: 홈에 들렀다 다시 회화로 → 미션이 아니라 레슨 시나리오여야 한다.
await page.click('.mode-tab:has-text("홈")');
await page.waitForTimeout(400);
await page.click('.mode-tab:has-text("회화")');
await page.waitForTimeout(700);
const introHead2 = await page.evaluate(() => document.querySelector('.talk-intro .ti-head')?.textContent || '');
check('일반 진입은 레슨 시나리오(one-shot 소비)', !introHead2.includes('🎯'), introHead2);

await browser.close();
finish('02-mission-talk');
