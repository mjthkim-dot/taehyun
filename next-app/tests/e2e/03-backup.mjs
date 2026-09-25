/** 백업·복원: 내보내기(API 키 제외) → 빈 브라우저 복원 → 불량 파일 거부. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BASE, check, finish, launch } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());
await page.addInitScript(() => {
  localStorage.setItem('va_groq_key', JSON.stringify('gsk_secret_must_not_leak'));
  localStorage.setItem('va_phrases', JSON.stringify([{ en: 'break a leg', kr: '행운을 빌어' }]));
  localStorage.setItem('va_days', JSON.stringify(['2026-01-01', '2026-01-02']));
});
await page.goto(`${BASE}/app`);
await page.waitForTimeout(1200);

// 더보기 → 기능 → 백업
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-card', { timeout: 8000 });
await page.click('.feat-card:has-text("백업")');
await page.waitForSelector('.bk-stats', { timeout: 8000 });

const tmp = path.join(os.tmpdir(), `bk-test-${process.pid}.json`);
const [download] = await Promise.all([page.waitForEvent('download'), page.click('.bk-btn:has-text("내려받기")')]);
await download.saveAs(tmp);
const backup = JSON.parse(fs.readFileSync(tmp, 'utf8'));
check('백업에 표현장 포함', 'va_phrases' in backup.data);
check('백업에서 API 키 제외', !('va_groq_key' in backup.data));

// 빈 컨텍스트에서 복원
const page2 = await browser.newPage();
page2.on('dialog', (d) => d.accept());
await page2.goto(`${BASE}/app`);
await page2.waitForTimeout(1200);
await page2.click('.mode-tab:has-text("더보기")');
await page2.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page2.click('.more-sheet .feat-card:has-text("기능")');
await page2.waitForSelector('.feat-card', { timeout: 8000 });
await page2.click('.feat-card:has-text("백업")');
await page2.waitForSelector('.bk-stats', { timeout: 8000 });
await page2.setInputFiles('input[type=file]', tmp);
await page2.waitForTimeout(500);
check('복원 성공 메시지', !!(await page2.evaluate(() => document.querySelector('.bk-msg')?.textContent?.includes('복원'))));
check('복원 후 표현장 데이터', (await page2.evaluate(() => JSON.parse(localStorage.getItem('va_phrases') || '[]').length)) === 1);
check('복원해도 키는 안 들어옴', (await page2.evaluate(() => localStorage.getItem('va_groq_key'))) === null);

// 불량 파일 거부
const bad = tmp.replace('.json', '-bad.json');
fs.writeFileSync(bad, JSON.stringify({ app: 'other-app', data: { va_phrases: '[]' } }));
await page2.setInputFiles('input[type=file]', bad);
await page2.waitForTimeout(400);
check('타 앱 백업 거부', !!(await page2.evaluate(() => document.querySelector('.bk-msg.err'))));

fs.rmSync(tmp, { force: true });
fs.rmSync(bad, { force: true });
await browser.close();
finish('03-backup');
