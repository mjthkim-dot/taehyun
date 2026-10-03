/**
 * 실전 코스(Gmail 90일 분석 콘텐츠 팩) — 계약:
 *   ① 분석 헤더(245 스레드·6트랙·18대화)와 상위 고객 칩이 뜬다
 *   ② 트랙 → 시나리오 → DialoguePractice가 열리고 근거(grounding)가 보인다
 *   ③ 시나리오를 열면 그 시나리오의 수확 표현만 SRS(cat '실전')에 등록된다
 *      (한꺼번에 쏟아붓지 않음) + 문서 단위 멱등
 *   ④ 진행률(연습함 ✓, n/18)이 갱신되고 재방문에도 유지된다
 *   ⑤ 드릴 핸드오프가 동작한다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

async function gotoCourse(page) {
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("실전 코스")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("실전 코스")');
  await page.waitForSelector('.rc-head', { timeout: 10000 });
}

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await seedKey(page);
await gotoCourse(page);

/* ① 분석 헤더 */
const stats = await page.evaluate(() => Array.from(document.querySelectorAll('.rc-stat b')).map((b) => b.textContent));
check('분석 헤더: 245 스레드·6트랙·18대화', stats[0] === '245' && stats[1] === '6' && stats[2] === '18', JSON.stringify(stats));
check('상위 고객 칩이 뜬다', await page.evaluate(() => document.body.innerText.includes('여기어때 33') && document.body.innerText.includes('씨피랩스 17')));
check('트랙 6개가 뜬다', (await page.locator('.mn-item').count()) === 6);

/* ② 트랙 → 시나리오 → 연습 */
await page.click('.mn-item:has-text("비용 리뷰") .mn-item-head');
await page.waitForSelector('.rc-sc', { timeout: 8000 });
check('트랙 안에 시나리오 3개', (await page.locator('.rc-sc').count()) === 3);
await page.click('.rc-sc:has-text("월간 비용 리뷰 브리핑") .rc-sc-head');
await page.waitForSelector('.rc-sc-body', { timeout: 8000 });
check('근거 스레드가 표시된다', await page.evaluate(() => document.body.innerText.includes('근거: 여기어때 5월 SBR')));
check('DialoguePractice가 열린다', await page.evaluate(() => document.body.innerText.includes('역할 연습') && document.body.innerText.includes('Let me walk you through')));

/* ③ 표현 등록 — 연 시나리오 것만 */
const expr1 = await page.evaluate(() => ({
  weak: JSON.parse(localStorage.getItem('va_weak') || '[]').filter((w) => w.cat === '실전').length,
  imported: JSON.parse(localStorage.getItem('va_minutes_expr') || '[]'),
}));
check('연 시나리오의 표현 4개만 등록된다', expr1.weak === 4 && expr1.imported.includes('course-finops-1') && expr1.imported.length === 1, JSON.stringify(expr1));
check('등록 안내 메시지가 뜬다', await page.evaluate(() => document.body.innerText.includes('표현 4개가 복습 큐에')));

/* ④ 진행률 */
check('진행률 1/18 + 트랙 1/3 + 연습함 표시', await page.evaluate(() =>
  document.body.innerText.includes('1/18') && document.body.innerText.includes('1/3') && document.body.innerText.includes('연습함 ✓')
));

/* ⑤ 드릴 핸드오프 */
await page.click('button:has-text("이 대화 문장으로 드릴")');
await page.waitForSelector('.drill-source', { timeout: 10000 });
check('드릴 큐로 넘어간다', (await page.evaluate(() => document.querySelector('.drill-source')?.textContent || '')).includes('실전 코스'));

/* 멱등 + 진행 유지: 재방문해서 같은 시나리오 다시 열기 */
await gotoCourse(page);
check('재방문에도 진행률 유지', await page.evaluate(() => document.body.innerText.includes('1/18')));
await page.click('.mn-item:has-text("비용 리뷰") .mn-item-head');
await page.waitForSelector('.rc-sc', { timeout: 8000 });
await page.click('.rc-sc:has-text("월간 비용 리뷰 브리핑") .rc-sc-head');
await page.waitForSelector('.rc-sc-body', { timeout: 8000 });
const expr2 = await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]').filter((w) => w.cat === '실전').length);
check('같은 시나리오 재열람은 중복 등록 없음(멱등)', expr2 === 4, String(expr2));
await page.click('.rc-sc:has-text("비용 급증 원인 분석") .rc-sc-head');
await page.waitForSelector('.rc-sc:has-text("비용 급증 원인 분석") .rc-sc-body', { timeout: 8000 });
const expr3 = await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]').filter((w) => w.cat === '실전').length);
check('두 번째 시나리오를 열면 4개 추가(8)', expr3 === 8, String(expr3));
check('진행률 2/18로 갱신', await page.evaluate(() => document.body.innerText.includes('2/18')));

await browser.close();
finish();
