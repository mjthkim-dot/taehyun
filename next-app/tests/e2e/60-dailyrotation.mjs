/**
 * 오늘의 패턴 날짜 로테이션 — "매일 똑같은 I'd like가 뜬다" 재발 방지 계약:
 *   ① 미정착 패턴 중에서도 날짜 시드로 고른다(fresh[0] 고정 금지) —
 *      오늘 기대 패턴 = fresh[daySeed % fresh.length]
 *   ② 오늘 패턴을 정착 처리하면 다음 선택은 다른 패턴이 된다
 *      (같은 날 안에서도 완료 시 반복 안 됨 → 내일은 시드가 바뀌어 또 다름)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

// lib/maturity.ts STAGE_PATTERNS[1]과 동일한 순서 — 바뀌면 이 테스트도 같이 갱신
const STAGE1 = [
  { key: 'id-like', stem: "I'd like to" },
  { key: 'could-you', stem: 'Could you' },
  { key: 'get-back', stem: 'get back to you' },
  { key: 'didnt-catch', stem: "I didn't catch that" },
  { key: 'just-to-confirm', stem: 'Just to confirm' },
  { key: 'that-works', stem: 'That works for me' },
  { key: 'im-afraid', stem: "I'm afraid" },
  { key: 'thanks-time', stem: 'Thanks for your time' },
];
function daySeed() {
  const d = new Date();
  return Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`);
}

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await seedKey(page);

/* ① 전부 미정착일 때 — 날짜 시드가 고른다 */
await page.goto(`${BASE}/app`);
await page.waitForSelector('.session-cta', { timeout: 15000 });
await page.waitForFunction(() => (document.querySelector('.session-cta')?.textContent || '').includes('오늘의 패턴'), null, { timeout: 10000 });
const expected = STAGE1[daySeed() % STAGE1.length];
const cta1 = await page.evaluate(() => document.querySelector('.session-cta')?.innerText || '');
check('오늘 패턴 = 날짜 시드 선택(고정 1번이 아님)', cta1.includes(expected.stem), `기대 "${expected.stem}" / CTA: ${cta1.replace(/\n/g, ' ').slice(0, 80)}`);

/* ② 오늘 패턴을 정착 처리 → 다른 패턴으로 넘어간다 */
await page.evaluate((key) => {
  localStorage.setItem('va_maturity_patterns', JSON.stringify([key]));
}, expected.key);
await page.reload();
await page.waitForSelector('.session-cta', { timeout: 15000 });
await page.waitForFunction(() => (document.querySelector('.session-cta')?.textContent || '').includes('오늘의 패턴'), null, { timeout: 10000 });
const remain = STAGE1.filter((p) => p.key !== expected.key);
const expected2 = remain[daySeed() % remain.length];
const cta2 = await page.evaluate(() => document.querySelector('.session-cta')?.innerText || '');
check('정착하면 같은 날에도 다음 패턴으로', cta2.includes(expected2.stem) && !cta2.includes(expected.stem === expected2.stem ? '§' : expected.stem), `기대 "${expected2.stem}" / CTA: ${cta2.replace(/\n/g, ' ').slice(0, 80)}`);

await browser.close();
finish();
