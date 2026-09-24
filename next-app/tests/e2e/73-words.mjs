/**
 * 상황별 단어 — "단어를 최대한 많이, 여러 상황을 고려해서":
 *   ① 주 탭 '단어' → 허브: 전체 단어 수·오늘 신규/복습·상황 팩 덱
 *   ② 하루 할당량 선택(10/20/30/50)이 큐를 바꾼다
 *   ③ 세션: 3D 플립 카드(앞=영어, 탭→뒤=뜻·예문) → 뜻 고르기 4지선다
 *   ④ 오답은 3문제 뒤 재출제, 정답이면 다음
 *   ⑤ 완주 → 요약, 기록(va_words) 저장, 허브 진행률 반영
 *   ⑥ 팩 상세: 단어 목록 + 팩 제외 토글이 큐에 반영
 *   ⑦ AI로 팩 늘리기(모킹)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const AI_WORDS = JSON.stringify({ words: [
  { w: 'cost anomaly detection', pos: 'n', kr: '비용 이상 탐지', lv: 'C1', ex: 'Cost anomaly detection flagged the spike.', exKr: '비용 이상 탐지가 급증을 잡아냈어요.' },
  { w: 'commitment utilization', pos: 'n', kr: '약정 활용률', lv: 'C1', ex: 'Commitment utilization is at 95%.', exKr: '약정 활용률이 95%예요.' },
] });

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: AI_WORDS } }] }) }));
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

/* ① 허브 */
check('주 탭에 단어가 있다', (await page.locator('.mode-tab:has-text("단어")').count()) === 1);
await page.click('.mode-tab:has-text("단어")');
await page.waitForSelector('.wd-hero', { timeout: 15000 });
const h = await page.evaluate(() => document.body.innerText);
check('전체 500개 이상', (() => { const m = h.match(/\/\s*(\d+)/); return m && Number(m[1]) >= 500; })(), (h.match(/\/\s*\d+/) || [])[0]);
check('오늘 20개 새로(기본 할당량)', h.includes('오늘 20개 새로'));
check('상황 팩이 19개 이상', (await page.locator('.wd-pack').count()) >= 19);

/* ② 할당량 */
await page.click('.wd-chip:has-text("10")');
check('할당량 10으로 큐가 줄어든다', await page.evaluate(() => document.querySelector('.wd-cta')?.textContent.includes('(10)')));

/* ③ 세션 — 첫 카드 */
await page.click('.wd-cta');
await page.waitForSelector('.wd-flip', { timeout: 8000 });
check('처음엔 앞면(영어)', await page.evaluate(() => !document.querySelector('.wd-flip')?.classList.contains('flipped')));
await page.click('.wd-flip');
check('탭하면 3D로 뒤집힌다', await page.evaluate(() => document.querySelector('.wd-flip')?.classList.contains('flipped')));
check('뒷면에 뜻과 예문', await page.evaluate(() => !!document.querySelector('.wd-back .wd-kr')?.textContent && !!document.querySelector('.wd-back .wd-ex')?.textContent));
const firstWord = await page.evaluate(() => document.querySelector('.wd-word')?.textContent);
await page.click('.wd-next');
await page.waitForSelector('.wd-opt', { timeout: 8000 });
check('확인 문제는 뜻 고르기 4지선다', (await page.locator('.wd-opt').count()) === 4 && (await page.evaluate(() => document.querySelector('.wd-q-text')?.textContent)) === firstWord);

/* ④ 오답 → 재출제 예약 */
// 뒷면에서 본 뜻과 다른 보기(=오답)를 고른다
const opts = await page.$$eval('.wd-opt', (bs) => bs.map((b) => b.textContent));
const meaning = await page.evaluate(() => document.querySelector('.wd-back .wd-kr')?.textContent);
const wrong = opts.findIndex((o) => o !== meaning);
await page.locator('.wd-opt').nth(wrong).click();
await page.waitForSelector('.wd-opt.wrong', { timeout: 3000 });
check('오답이 표시되고 정답이 드러난다', (await page.locator('.wd-opt.right').count()) === 1 && (await page.locator('.wd-reveal').count()) === 1);
await page.waitForFunction(() => /2\/11/.test(document.querySelector('.wd-count')?.textContent || ''), null, { timeout: 5000 });
check('오답 단어가 큐 뒤에 한 번 더 들어간다(10 → 11)', true);

/* ⑤ 끝까지 — 신규 카드는 넘기고, 문제는 정답을 고른다 */
for (let guard = 0; guard < 40; guard++) {
  if (await page.locator('.wd-done').count()) break;
  if (await page.locator('.wd-next').count()) {
    await page.click('.wd-flip');
    await page.click('.wd-next');
    await page.waitForSelector('.wd-opt', { timeout: 5000 });
  }
  if (await page.locator('.wd-opt:not([disabled])').count()) {
    // 정오와 무관하게 첫 보기 — 오답이면 재출제되고 그것도 결국 소진된다
    await page.locator('.wd-opt').first().click();
    await page.waitForTimeout(1700);
  } else {
    await page.waitForTimeout(300);
  }
}
await page.waitForSelector('.wd-done', { timeout: 15000 });
const d = await page.evaluate(() => document.body.innerText);
check('완료 요약: 새 단어 10', /10\s*새 단어/.test(d.replace(/\n/g, ' ')));
check('기록이 저장된다(10개)', await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('va_words') || '{}')).length === 10));
await page.click('.wd-cta');
await page.waitForSelector('.wd-hero', { timeout: 5000 });
check('허브에 진행률 반영(10/…)', await page.evaluate(() => /^10\s*\//.test(document.querySelector('.wd-ring-num')?.innerText.replace(/\n/g, ' ') || '')));
check('오늘 할당량 소진 → 신규 0', await page.evaluate(() => document.body.innerText.includes('오늘 0개 새로')));

/* ⑥ 팩 상세 + 토글 */
await page.click('.wd-pack-main:has-text("비용 · FinOps")');
await page.waitForSelector('.wd-list', { timeout: 5000 });
check('팩 단어 목록이 보인다', (await page.locator('.wd-row').count()) >= 30);
/* ⑦ AI로 늘리기 */
const before = await page.locator('.wd-row').count();
await page.click('.wd-gen');
await page.waitForFunction(() => document.body.innerText.includes('새 단어 2개'), null, { timeout: 10000 });
check('AI 단어가 팩에 추가된다(+2, AI 배지)', (await page.locator('.wd-row').count()) === before + 2 && (await page.locator('.wd-ai').count()) === 2);
await page.click('.mini-btn:has-text("단어 홈")');
await page.waitForSelector('.wd-packs', { timeout: 5000 });
await page.locator('.wd-pack-toggle').first().click();
check('팩을 빼면 선택 상태가 저장된다', await page.evaluate(() => (JSON.parse(localStorage.getItem('va_words_cfg') || '{}').packs || []).length > 0));

await browser.close();
finish();
