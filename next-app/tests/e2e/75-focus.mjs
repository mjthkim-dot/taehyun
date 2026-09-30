/**
 * 집중 모드 — "기능이 너무 많아 뭐부터 해야 할지 모르겠다":
 *   ① 새 사용자는 집중 모드가 기본: 홈 = 시작 가이드(레벨 진단 → 코스 시작 → 첫 레슨)
 *   ② 하단 탭 4개(홈·단어·회화·더보기) — 드릴 숨김, 더보기엔 '내 성장'만
 *   ③ 진단을 마치면 가이드가 2단계로 넘어가고 레벨·코스 카드가 나타난다
 *   ④ 코스를 시작하면 3단계(첫 레슨) — 레슨 카드가 주 행동
 *   ⑤ 첫 레슨을 마치면 가이드가 사라지고 레슨만 남는다
 *   ⑥ '모든 기능 보기' ↔ '집중 모드 켜기' 전환이 저장된다
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const browser = await launch();
// 별도 컨텍스트 — helpers의 '모든 기능' 시드를 받지 않는 진짜 신규 사용자
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.addInitScript(() => {
  localStorage.setItem('va_onboarded', 'true');
  localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
});
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
await page.goto(`${BASE}/app`);

/* ① */
await page.waitForSelector('.fg-card', { timeout: 15000 });
const t1 = await page.evaluate(() => document.querySelector('.app-content')?.innerText || '');
check('시작 가이드 1단계 = 레벨 진단', t1.includes('1단계 · 레벨 진단'));
check('가이드는 2단계(레벨 진단 → 드라마 1화)', (await page.locator('.fg-step').count()) === 2);
check('집중 홈엔 미션·경로·드릴이 없다', (await page.locator('.mission-card, .path-node, .start-drill-btn, .hs-card').count()) === 0);
check('진단 전엔 레벨·에피소드 카드도 숨긴다(순서대로)', (await page.locator('.cf-badge, .dr-card').count()) === 0);

/* ② */
const tabs = await page.$$eval('.mode-tab', (bs) => bs.map((b) => b.textContent.trim()));
check('하단 탭 4개: 홈·단어·회화·더보기', tabs.join(',') === '홈,단어,회화,더보기', tabs.join(','));
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet', { timeout: 5000 });
check('더보기엔 내 성장 2 + 드라마·문법 + 백업 + 모든 기능 버튼', (await page.locator('.more-sheet .feat-card').count()) === 5 && (await page.locator('.more-sheet .feat-card:has-text("드라마 레슨")').count()) === 1 && (await page.locator('.more-sheet .feat-card:has-text("백업")').count()) === 1 && (await page.locator('.more-mode').count()) === 1);
check('더보기 = 대화상자(열면 첫 항목에 포커스, Esc로 닫힘)', await page.evaluate(() => document.querySelector('.more-sheet')?.getAttribute('role') === 'dialog' && document.activeElement?.classList.contains('feat-card')));
await page.keyboard.press('Escape');
check('Esc로 닫고 더보기 탭으로 포커스 복귀', (await page.locator('.more-sheet').count()) === 0 && (await page.evaluate(() => document.activeElement?.textContent?.includes('더보기'))));
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 5000 });
await page.click('.more-sheet-overlay', { position: { x: 10, y: 10 } });

/* ③ 진단 완료(시드) → 2단계 */
await page.evaluate(() => localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() })));
await page.reload();
await page.waitForSelector('.fg-card', { timeout: 15000 });
check('2단계(드라마 1화)로 넘어간다', await page.evaluate(() => document.querySelector('.fg-title')?.textContent.includes('2단계 · 드라마 1화 보기')));
await page.waitForSelector('.cf-badge', { timeout: 10000 });
check('레벨 카드가 나타난다', true);

/* ⑤ 1화를 봤다(시드) → 가이드가 사라지고 에피소드가 주인공 */
await page.evaluate(() => localStorage.setItem('va_drama', JSON.stringify({ done: { 1: '2026-01-01' }, score: { 1: 100 } })));
await page.reload();
await page.waitForSelector('.dr-card-title', { timeout: 15000 });
check('가이드가 사라진다', (await page.locator('.fg-card').count()) === 0);
check('오늘의 에피소드 EP 2', await page.evaluate(() => document.querySelector('.dr-card-title')?.textContent.includes('EP 2')));
check('집중 모드엔 12주 레슨 카드 없음(하루 한 편만)', (await page.locator('.pg-card').count()) === 0);

/* ⑥ 전환 */
await page.click('.fg-all');
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.waitForSelector('.path-node', { timeout: 15000 });
check('모든 기능: 미션·경로가 돌아온다', (await page.locator('.path-node').count()) > 0);
check('모든 기능: 탭 5개', (await page.locator('.mode-tab').count()) === 5);
check('모드가 저장된다', await page.evaluate(() => JSON.parse(localStorage.getItem('va_mode')) === 'full'));
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-mode', { timeout: 5000 });
await page.click('.more-mode');
await page.waitForSelector('.fg-foot', { timeout: 10000 });
check('집중 모드로 다시 전환', (await page.locator('.mode-tab').count()) === 4 && (await page.locator('.mission-card').count()) === 0);

await browser.close();
finish();
