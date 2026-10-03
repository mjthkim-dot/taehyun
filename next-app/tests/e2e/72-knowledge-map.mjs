/**
 * 학습 지도(온톨로지) — 흩어진 콘텐츠가 하나의 그래프로 이어진다:
 *   ① 더보기 → 학습 지도: 전체 숙련도·회차/표현/패턴 집계·추천 3개
 *   ② 상황별 탭: 최상위 상황 카드 → 펼치면 하위 상황과 출처가 다른 유닛들이 함께
 *   ③ 회차별 탭: 트랙 진행과 "이어서" 다음 회차
 *   ④ 실전형 탭: 근거(grounding) 있는 유닛만
 *   ⑤ 유닛을 누르면 핸드오프로 그 화면의 그 항목이 바로 펼쳐진다(코스 시나리오)
 *   ⑥ 열람하면 지도에 반영된다(회차 연속 추천이 다음 회차로 바뀐다)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

/* ① 진입 + 요약 */
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("학습 지도")');
await page.waitForSelector('.km-screen', { timeout: 15000 });
const t1 = await page.evaluate(() => document.body.innerText);
check('전체 숙련도가 보인다', /\d+%\s*전체 상황 숙련도/.test(t1.replace(/\n/g, ' ')));
check('회차·표현·패턴 집계가 있다', t1.includes('회차') && t1.includes('만난 표현') && t1.includes('정착 패턴'));
check('레슨까지 포함해 100개 넘는 회차가 그래프에 있다', await page.evaluate(() => { const m = document.body.innerText.match(/(\d+)\/(\d+)\s*회차/); return m && Number(m[2]) > 100; }));
check('추천이 이유와 함께 3개', (await page.locator('.km-recs .km-unit').count()) === 3 && t1.includes('처음 열기'));

/* ② 상황별 */
check('최상위 상황 카드가 여러 개', (await page.locator('.km-sit').count()) >= 8);
await page.click('.km-sit-head:has-text("비용 · FinOps")');
await page.waitForSelector('.km-sit.open .km-unit', { timeout: 5000 });
const finops = await page.evaluate(() => [...document.querySelectorAll('.km-sit.open .km-unit-src')].map((e) => e.textContent));
check('한 상황 아래 출처가 다른 유닛이 섞여 있다', new Set(finops).size >= 2, finops.join(','));

/* ③ 회차별 */
await page.click('.km-tab:has-text("회차별")');
await page.waitForSelector('.km-track', { timeout: 5000 });
const t3 = await page.evaluate(() => document.body.innerText);
check('패턴 5단계·코스 트랙·시리즈가 트랙으로 보인다', t3.includes('1단계 · 뼈대') && t3.includes('비용 리뷰 & FinOps') && t3.includes('Gate 43'));
check('각 트랙에 "1회차 — 시작"이 붙는다', t3.includes('1회차 — 시작'));

/* ④ 실전형 */
await page.click('.km-tab:has-text("실전형")');
await page.waitForSelector('.km-real', { timeout: 5000 });
// 탭 본문만 본다 — 위의 추천 카드에는 패턴/스토리가 정당하게 섞일 수 있다
const t4 = await page.evaluate(() => [...document.querySelectorAll('.km-real')].map((e) => e.innerText).join('\n'));
check('실전형에는 근거가 붙는다', t4.includes('근거 ·') && t4.includes('실전형'));
check('실전형에 패턴/스토리 유닛이 섞이지 않는다', !/\b패턴\b/.test(t4) && !t4.includes('스토리'));

/* ⑤ 핸드오프 — 코스 시나리오를 누르면 코스 화면에서 그 시나리오가 펼쳐진다 */
await page.click('.km-tab:has-text("상황별")');
await page.click('.km-sit-head:has-text("비용 · FinOps")');
await page.waitForSelector('.km-sit.open .km-unit', { timeout: 5000 });
await page.click('.km-sit.open .km-unit:has-text("월간 비용 리뷰 브리핑")');
await page.waitForFunction(() => document.body.innerText.includes('복습 큐에 들어갔어요') || document.body.innerText.includes('월간 비용 리뷰 브리핑'), null, { timeout: 15000 });
const t5 = await page.evaluate(() => document.body.innerText);
check('코스 화면으로 이동해 해당 시나리오가 열려 있다', t5.includes('월간 비용 리뷰 브리핑') && t5.includes('여기어때'));
check('열람이 코스 진행(va_course_seen)에 기록된다', await page.evaluate(() => JSON.parse(localStorage.getItem('va_course_seen') || '[]').includes('finops-1')));
check('핸드오프는 소비 후 지워진다', await page.evaluate(() => localStorage.getItem('va_unit_handoff') === 'null'));

/* ⑥ 지도에 반영 — 회차 연속 추천 */
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("학습 지도")');
await page.waitForSelector('.km-recs .km-unit', { timeout: 15000 });
const t6 = await page.evaluate(() => document.querySelector('.km-recs')?.innerText || '');
check('첫 추천이 "이어서"(같은 트랙 다음 회차)로 바뀐다', t6.includes('1/3 — 이어서'), t6.slice(0, 120));
check('회차 집계가 1 올라간다', await page.evaluate(() => /1\/\d+\s*회차/.test(document.body.innerText)));

await browser.close();
finish();
