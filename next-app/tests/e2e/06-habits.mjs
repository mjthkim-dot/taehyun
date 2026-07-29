/** 스트릭 프리즈: 하루 공백을 프리즈가 자동으로 메워 스트릭을 지킨다. */
import { BASE, check, finish, launch } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.addInitScript(() => {
  const d = (n) => {
    const t = new Date();
    t.setDate(t.getDate() - n);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  };
  // 그저께까지 연습, 어제 공백, 프리즈 1개 보유 → 열면 어제가 메워져야 한다
  localStorage.setItem('va_days', JSON.stringify([d(3), d(2)]));
  localStorage.setItem('va_freeze', JSON.stringify({ count: 1, earnedFor: 0 }));
});
await page.goto(`${BASE}/app`);
await page.waitForSelector('.home-hero', { timeout: 15000 });
await page.waitForTimeout(500);

check('프리즈 소모 배너 표시', !!(await page.evaluate(() => document.querySelector('.freeze-note'))));
const streakN = await page.evaluate(() => document.querySelector('.home-hero-streak .n')?.textContent || '');
check('스트릭이 3일로 보존(2일 연습+프리즈 1일)', streakN.includes('3'), streakN);
const freezeLeft = await page.evaluate(() => JSON.parse(localStorage.getItem('va_freeze') || '{}').count);
check('프리즈 1개 소모됨(0 남음)', freezeLeft === 0);
const yesterdayFilled = await page.evaluate(() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return JSON.parse(localStorage.getItem('va_days') || '[]').includes(ds);
});
check('어제가 학습일로 메워짐', yesterdayFilled);

await browser.close();
finish('06-habits');
