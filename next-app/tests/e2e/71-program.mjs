/**
 * 12주 트레이닝 프로그램 — "영어를 정말 제대로 해보고 싶다"에 대한 구조적 답:
 *   ① 시작 전엔 서약(왜 + 하루 시간)을 받고, 이유 없이는 시작 버튼이 잠긴다
 *   ② 시작하면 홈의 주인공이 프로그램 카드 — 오늘 4블록과 '다음 할 것' 하나
 *   ③ 프로그램 중엔 중복 CTA(오늘 세션 시작)를 감춘다
 *   ④ 완료는 관찰 기반 — 발화 수가 목표를 넘으면 '산출' 블록이 자동 확인된다
 *   ⑤ 수동 체크는 자동 확인된 블록엔 못 쓰고(사실을 지울 수 없다), 나머지는 가능
 *   ⑥ 4블록을 다 채우면 그날이 훈련일로 확정되고 Day가 오른다
 *   ⑦ 로드맵 화면에 3단계·12주·서약이 보이고, 진도는 달력이 아니라 훈련일로 센다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
await seedKey(page);
await page.goto(`${BASE}/app`);

/* ① 서약 */
await page.waitForSelector('.pg-pledge', { timeout: 15000 });
check('시작 전엔 서약 카드가 홈 첫 화면에 뜬다', await page.evaluate(() => document.body.innerText.includes('12주 트레이닝 프로그램')));
check('이유를 안 적으면 시작이 잠긴다', await page.evaluate(() => document.querySelector('.pg-start')?.disabled === true));
await page.fill('.pg-why', '외국계 세일즈로 옮기고 싶다.');
check('이유를 적으면 잠금이 풀린다', await page.evaluate(() => document.querySelector('.pg-start')?.disabled === false));
await page.click('.pg-min:has-text("40분")');
await page.click('.pg-start');

/* ② 시작 직후 — Day 1, 다음 블록 하나 */
await page.waitForSelector('.pg-next', { timeout: 8000 });
const t1 = await page.evaluate(() => document.body.innerText);
check('Day 1 / 60으로 시작한다', t1.includes('Day 1') && t1.includes('60'));
check('1단계·1주차가 표시된다', t1.includes('1단계') && t1.includes('입이 트인다'));
check('다음 할 것은 워밍업·복습 하나만 크게', await page.evaluate(() => document.querySelector('.pg-next-title')?.textContent.includes('워밍업')));
check('40분을 고르면 블록 분량이 커진다', await page.evaluate(() => /8분/.test(document.querySelector('.pg-next-go')?.textContent || '')));
check('서약이 localStorage에 남는다', await page.evaluate(() => JSON.parse(localStorage.getItem('va_program')).why.includes('외국계')));

/* ③ 중복 CTA 억제 */
check('프로그램 중엔 오늘 세션 CTA가 사라진다', !t1.includes('오늘 세션 시작'));

/* ④ 관찰 기반 완료 — 발화 25문장을 채우면 산출 블록이 자동 확인 */
await page.evaluate(() => {
  const d = new Date().toISOString().slice(0, 10);
  localStorage.setItem('va_spoken', JSON.stringify({ date: d, count: 25 }));
});
await page.reload();
await page.waitForSelector('.pg-toggle', { timeout: 10000 });
await page.click('.pg-toggle');
await page.waitForSelector('.pg-blocks', { timeout: 5000 });
check('발화 목표를 넘기면 산출 블록이 자동 확인된다', await page.evaluate(() => {
  const li = [...document.querySelectorAll('.pg-block')].find((e) => e.textContent.includes('산출'));
  return li?.classList.contains('done') && li.textContent.includes('자동 확인');
}));
check('자동 확인된 블록은 체크를 되돌릴 수 없다', await page.evaluate(() => {
  const li = [...document.querySelectorAll('.pg-block')].find((e) => e.textContent.includes('산출'));
  return li?.querySelector('.pg-check')?.disabled === true;
}));

/* ⑤⑥ 나머지 3블록 수동 체크 → 훈련일 확정 */
for (const name of ['워밍업', '코어', '실전']) {
  await page.evaluate((n) => {
    const li = [...document.querySelectorAll('.pg-block')].find((e) => e.textContent.includes(n));
    li?.querySelector('.pg-check')?.click();
  }, name);
}
await page.waitForFunction(() => document.body.innerText.includes('오늘 훈련 완료'), null, { timeout: 8000 });
check('4블록을 채우면 오늘이 훈련일로 확정된다', true);
check('완료 훈련일이 저장된다', await page.evaluate(() => JSON.parse(localStorage.getItem('va_program')).days.length === 1));
await page.reload();
await page.waitForSelector('.pg-card', { timeout: 10000 });
check('다시 열어도 완료 상태가 유지된다', await page.evaluate(() => document.body.innerText.includes('오늘 훈련 완료')));

/* ⑦ 로드맵 화면 */
await page.click('.pg-more');
await page.waitForSelector('.pg-weeks', { timeout: 10000 });
const t2 = await page.evaluate(() => document.body.innerText);
check('3단계가 모두 보인다', t2.includes('입이 트인다') && t2.includes('일이 된다') && t2.includes('압박에서도 된다'));
check('12주 로드맵이 렌더된다', (await page.locator('.pg-week').count()) === 12);
check('현재 주차가 강조된다', (await page.locator('.pg-week.now').count()) === 1);
check('서약이 다시 보인다', t2.includes('외국계 세일즈'));
check('1일 완료로 집계된다', t2.includes('1일'));
check('시작 당일은 1일째로 센다(달력 off-by-one 없음)', t2.includes('시작한 지 1일째'));
check('주차별 발화 목표가 오른다', t2.includes('하루 25문장') && t2.includes('하루 70문장'));

await browser.close();
finish();
