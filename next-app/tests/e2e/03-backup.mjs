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
check('복원 뒤 앱을 새 값으로 다시 연다(자동 새로고침)', await page2.waitForEvent('load', { timeout: 6000 }).then(() => true).catch(() => false));
await page2.waitForTimeout(1200);
await page2.click('.mode-tab:has-text("더보기")');
await page2.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page2.click('.more-sheet .feat-card:has-text("기능")');
await page2.waitForSelector('.feat-card', { timeout: 8000 });
await page2.click('.feat-card:has-text("백업")');
await page2.waitForSelector('.bk-stats', { timeout: 8000 });

// 불량 파일 거부
const bad = tmp.replace('.json', '-bad.json');
fs.writeFileSync(bad, JSON.stringify({ app: 'other-app', data: { va_phrases: '[]' } }));
await page2.setInputFiles('input[type=file]', bad);
await page2.waitForTimeout(400);
check('타 앱 백업 거부', !!(await page2.evaluate(() => document.querySelector('.bk-msg.err'))));

/* M1: '고급 ▾' 접힘 하나(#adv-section) 안에 실험 기능 토글 — 기본은 접혀 있고, 녹음 안내 문구가 있다 */
check('녹음은 백업에 포함되지 않음 안내', await page2.evaluate(() => document.body.innerText.includes('녹음') && document.body.innerText.includes('포함되지 않')));
check('고급 ▾ 접힘(#adv-section)이 기본 닫힘', (await page2.locator('#adv-section').count()) === 1 && !(await page2.evaluate(() => document.querySelector('#adv-section')?.open)));
await page2.click('#adv-section summary');
check('펼치면 실험 기능 토글 8개(전부 켜짐)', (await page2.locator('#adv-section .bk-flag input').count()) === 8 && (await page2.evaluate(() => [...document.querySelectorAll('#adv-section .bk-flag input')].every((i) => i.checked))));
await page2.click('#adv-section .bk-flag:has-text("줄거리") input');
check('토글을 끄면 va_flags에 그 키만 저장', await page2.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('va_flags') || '{}')) === '{"retell":false}'));
// M0 소리 레일 — 설정·점검류는 백업 화면 하단 '고급 ▾' 접힘 하나 안에만(새 화면·feat-card 없음)
await page2.waitForSelector('.bk-adv-audiocheck', { timeout: 5000 });
await page2.click('.bk-adv-audiocheck');
await page2.waitForFunction(() => !!document.querySelector('.study-card h3') && document.querySelector('.study-card h3').textContent.includes('음성 진단'), null, { timeout: 8000 });
check("'소리 점검' 버튼이 음성 진단 화면으로 간다", true);

fs.rmSync(tmp, { force: true });
fs.rmSync(bad, { force: true });
await browser.close();
finish('03-backup');
