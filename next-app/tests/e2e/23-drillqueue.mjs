/**
 * 어휘·스크립트 → 드릴 직결 — 표현장을 거치지 않고 곧바로 말하기 훈련으로 넘긴다.
 * 계약: ① 넘긴 표현이 드릴 큐가 된다 ② 출처가 화면에 표시된다 ③ 큐는 1회만 소비된다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await seedKey(page);

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-card', { timeout: 8000 });

/* ── 직무 어휘 → 드릴 ── */
await page.click('.feat-card:has-text("직무 어휘")');
await page.waitForSelector('.vocab-card', { timeout: 8000 });
await page.click('.vocab-tab:has-text("IT 영업")');
await page.waitForTimeout(250);
await page.click('.vocab-actions .btn.ghost');
await page.waitForSelector('.drill-screen', { timeout: 10000 });
check('어휘 → 드릴 이동', (await page.evaluate(() => document.querySelector('.app-header h1')?.textContent)) === '드릴');
check('출처 배지 표시', (await page.evaluate(() => document.querySelector('.drill-source')?.textContent || '')).includes('IT 영업'));
// 드릴 기본은 '한국어 보고 영어로 말하기'라 화면에 한국어 뜻이 뜬다 —
// 큐에 실린 것이 IT 영업 도메인 예문인지 그 한국어로 확인한다.
const first = await page.evaluate(() => document.body.textContent || '');
check('어휘 예문이 큐에 실림', /파이프라인|제안요청서|견적|수주|갱신|검증/.test(first), first.slice(0, 60));
check('큐는 소비 후 비워짐', (await page.evaluate(() => JSON.parse(localStorage.getItem('va_drill_queue') || 'null'))) === null);

/* ── 미팅 스크립트 → 드릴 ── */
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-card', { timeout: 8000 });
await page.click('.feat-card:has-text("미팅 스크립트")');
await page.waitForSelector('.script-card', { timeout: 8000 });
await page.click('.script-card:has-text("가격 반론")');
await page.waitForSelector('.script-drill', { timeout: 8000 });
await page.click('.script-drill');
await page.waitForSelector('.drill-screen', { timeout: 10000 });
check('스크립트 → 드릴 이동', (await page.evaluate(() => document.querySelector('.app-header h1')?.textContent)) === '드릴');
check('스크립트 출처 표시', (await page.evaluate(() => document.querySelector('.drill-source')?.textContent || '')).includes('가격 반론'));

// 다른 레슨으로 갔다 오면 핸드오프가 남아있지 않아야 한다(1회 소비)
await page.click('.mode-tab:has-text("레슨")');
await page.waitForTimeout(300);
await page.click('.mode-tab:has-text("드릴")');
await page.waitForSelector('.drill-screen', { timeout: 10000 });
check('재방문 시 출처 배지 사라짐', (await page.evaluate(() => !document.querySelector('.drill-source'))));

await browser.close();
finish('23-drillqueue');
