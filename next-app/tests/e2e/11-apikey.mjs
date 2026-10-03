/**
 * AI 키 등록 화면 — 기능 탭에서 직접 키를 넣고/교체하고/지울 수 있다.
 * 핵심 계약: 거부된 키는 저장되지 않고(조용한 401 사고 재발 방지),
 * 유효한 키만 기기에 저장되며, 삭제도 이 화면에서 끝난다.
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

let keyVerdict = false; // 첫 시도는 '거부', 이후 '유효'로 바꿔 두 경로를 모두 본다
await page.route('**/app/api/groq/validate', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(keyVerdict ? { valid: true } : { valid: false, status: 401 }) })
);
await page.route('**/app/api/groq', (route) => {
  if (route.request().method() === 'GET') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasServerKey: false }) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
});

await page.goto(`${BASE}/app`);
await page.waitForTimeout(800);
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-card', { timeout: 8000 });
check('기능 탭에 AI 키 등록 카드', await page.evaluate(() => Array.from(document.querySelectorAll('.feat-card')).some((c) => c.textContent.includes('AI 키 등록'))));

await page.click('.feat-card:has-text("AI 키 등록")');
await page.waitForSelector('.key-status', { timeout: 8000 });
check('키 없을 때 상태 안내', (await page.evaluate(() => document.querySelector('.key-status-head')?.textContent)) === 'AI 기능이 꺼져 있어요');

// gsk_ 접두어가 아니면 네트워크를 쓰지 않고 즉시 거절
await page.fill('.text-input', 'not-a-key');
await page.click('.key-save');
await page.waitForSelector('.key-msg.bad', { timeout: 5000 });
check('형식이 틀린 키 거절', (await page.evaluate(() => document.querySelector('.key-msg.bad')?.textContent)).includes('gsk_'));
check('형식 오류는 저장 안 됨', (await page.evaluate(() => localStorage.getItem('va_groq_key'))) === null);

// Groq가 거부하는 키 → 저장 금지
await page.fill('.text-input', 'gsk_expired_key_value');
await page.click('.key-save');
await page.waitForFunction(() => document.querySelector('.key-msg.bad')?.textContent.includes('거부'), { timeout: 8000 });
check('Groq가 거부한 키는 저장하지 않음', (await page.evaluate(() => localStorage.getItem('va_groq_key'))) === null);

// 유효한 키 → 저장 + 상태 전환
keyVerdict = true;
await page.fill('.text-input', 'gsk_valid_key_value');
await page.click('.key-save');
await page.waitForSelector('.key-msg.ok', { timeout: 8000 });
check('유효한 키 저장', (await page.evaluate(() => localStorage.getItem('va_groq_key'))) === JSON.stringify('gsk_valid_key_value'));
check('상태가 기기 키로 전환', (await page.evaluate(() => document.querySelector('.key-status-head')?.textContent)) === '현재 기기 키로 동작 중');
check('상태 카드가 활성 스타일', await page.evaluate(() => !!document.querySelector('.key-status.on')));
check('키는 마스킹 표시', await page.evaluate(() => !document.querySelector('.key-status-list').textContent.includes('valid_key_value')));

// 삭제도 이 화면에서
await page.click('.key-remove');
await page.waitForTimeout(200);
check('기기 키 삭제', (await page.evaluate(() => localStorage.getItem('va_groq_key'))) === JSON.stringify(''));
check('삭제 후 상태 원복', (await page.evaluate(() => document.querySelector('.key-status-head')?.textContent)) === 'AI 기능이 꺼져 있어요');

await browser.close();
finish('11-apikey');
