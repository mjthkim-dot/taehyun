/**
 * 신뢰성 — 화면이 죽어도 앱은 살아 있고, 저장이 막히면 조용히 넘어가지 않는다.
 *
 * 배경: 렌더 오류가 나면 React가 트리 전체를 언마운트해 흰 화면만 남았고,
 * localStorage가 가득 차면 store()가 예외를 삼켜 학습 기록이 소리 없이 사라졌다.
 * 둘 다 "앱이 망가졌는데 이유를 모르는" 종류라 반드시 드러나야 한다.
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();

/* ── 저장 용량이 가득 차면 알린다(+ 버릴 수 있는 캐시부터 정리) ── */
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

// setItem이 항상 실패하는 상황(용량 초과)을 만들고 저장을 유발한다
const banner = await page.evaluate(async () => {
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function () {
    throw new DOMException('QuotaExceededError', 'QuotaExceededError');
  };
  try {
    // 표현장 저장을 흉내내는 대신 앱의 저장 경로를 직접 건드린다
    window.dispatchEvent(new Event('x')); // no-op
    const { store } = await import('/app/_next/static/chunks/does-not-exist.js').catch(() => ({}));
    void store;
  } catch {
    /* import 실패는 무시 — 아래에서 UI 조작으로 저장을 유발한다 */
  } finally {
    Storage.prototype.setItem = orig;
  }
  return true;
});
check('테스트 준비', banner === true);

// 실제 저장 경로: 미션 표현을 표현장에 저장 → store() 호출
await page.evaluate(() => {
  Storage.prototype.setItem = function () {
    throw new DOMException('QuotaExceededError', 'QuotaExceededError');
  };
});
await page.locator('.mission-phrase').first().locator('.mission-ic').last().click();
await page.waitForSelector('.storage-full', { timeout: 8000 });
check('저장 실패를 사용자에게 알림', await page.evaluate(() => !!document.querySelector('.storage-full')));
check('안내에 복구 방법 포함', (await page.evaluate(() => document.querySelector('.storage-full')?.textContent || '')).includes('백업'));
await page.click('.storage-full button');
await page.waitForTimeout(200);
check('배너를 닫을 수 있음', await page.evaluate(() => !document.querySelector('.storage-full')));

/* ── 저장소가 손상돼도 앱이 죽지 않는다 ──
   백업 복원 실패·수동 편집·구버전 데이터로 값의 모양이 깨지는 일은 실제로 일어난다.
   예전에는 배열이 아닌 값에 .filter를 부르다 렌더 도중 터져 화면이 백지가 됐다. */
const broken = await browser.newPage();
const crashes = [];
broken.on('pageerror', (e) => crashes.push(e.message));
await broken.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await broken.addInitScript(() => {
  localStorage.setItem('va_onboarded', 'true');
  // 배열이어야 하는 키에 문자열/객체를 넣는다
  localStorage.setItem('va_weak', JSON.stringify('손상된 값'));
  localStorage.setItem('va_phrases', JSON.stringify({ oops: true }));
  localStorage.setItem('va_days', JSON.stringify(42));
  // 객체여야 하는 키에 배열
  localStorage.setItem('va_profile', JSON.stringify([1, 2, 3]));
  localStorage.setItem('va_stats', JSON.stringify('x'));
});
await broken.goto(`${BASE}/app`);
await broken.waitForSelector('.mission-card', { timeout: 15000 });
check('손상된 저장소에서도 홈이 뜬다', await broken.evaluate(() => !!document.querySelector('.mission-card')));
check('렌더 예외 없음', crashes.length === 0, crashes[0] || '');

// 손상된 데이터를 쓰는 화면들도 열려야 한다
for (const [tab, sel] of [['복습', '.study-screen'], ['진도', '.study-screen']]) {
  await broken.click('.mode-tab:has-text("더보기")');
  await broken.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  const label = tab === '복습' ? '간격 반복 복습' : '진도 & 리포트';
  await broken.click('.more-sheet .feat-card:has-text("기능")');
  await broken.waitForSelector('.feat-card', { timeout: 8000 });
  await broken.click(`.feat-card:has-text("${label}")`);
  await broken.waitForSelector(sel, { timeout: 8000 });
  check(`${label} 화면도 정상 렌더`, await broken.evaluate((s) => !!document.querySelector(s), sel));
}
check('전 과정에서 렌더 예외 없음', crashes.length === 0, crashes[0] || '');
check('오류 방어막이 셸 안에 있다', await broken.evaluate(() => !!document.querySelector('.app-content')));

await browser.close();
finish('26-resilience');
