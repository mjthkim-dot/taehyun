/**
 * 직무 어휘 — 기능 탭에 이름만 있던 '어휘' 영역이 실제로 동작하는지.
 * 계약: 도메인 4개 전환 · 카드 확장(연어·예문·주의) · 예문 표현장 저장 ·
 * 자기 점검 퀴즈에서 틀리면 복습(SRS) 큐에 쌓인다.
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
check('기능 탭에 직무 어휘 카드', await page.evaluate(() => Array.from(document.querySelectorAll('.feat-card')).some((c) => c.textContent.includes('직무 어휘'))));

await page.click('.feat-card:has-text("직무 어휘")');
await page.waitForSelector('.vocab-card', { timeout: 8000 });

check('도메인 탭 4개', (await page.evaluate(() => document.querySelectorAll('.vocab-tab').length)) === 4);
check('첫 도메인(재무)이 활성', (await page.evaluate(() => document.querySelector('.vocab-tab.active')?.textContent)) === '재무 · 회계');
const firstCount = await page.evaluate(() => document.querySelectorAll('.vocab-card').length);
check('재무 카드 10개', firstCount === 10, String(firstCount));

// 카드 확장 — 연어·예문·주의가 함께 나와야 '단어장'이 아니다
await page.locator('.vocab-card').first().locator('.vocab-head').click();
await page.waitForSelector('.vocab-card.open .vocab-body', { timeout: 5000 });
check('연어 칩 렌더', (await page.evaluate(() => document.querySelectorAll('.vocab-card.open .vocab-collo').length)) >= 3);
check('예문 + 한국어 렌더', await page.evaluate(() => !!document.querySelector('.vocab-card.open .vocab-ex') && !!document.querySelector('.vocab-card.open .vocab-ex-kr')));
check('주의·뉘앙스 노트 렌더', (await page.evaluate(() => document.querySelector('.vocab-card.open .vocab-note')?.textContent?.length || 0)) > 20);
// 콘텐츠의 **볼드** 표기가 리터럴로 새지 않아야 한다(Note 렌더러 경유 확인)
check('마크다운 볼드가 리터럴로 노출되지 않음', !(await page.evaluate(() => document.querySelector('.vocab-card.open .vocab-note')?.textContent || '')).includes('**'));
// 볼드 렌더는 **가 실제로 들어 있는 카드로 확인한다(첫 카드 note에는 볼드가 없다)
await page.locator('.vocab-card:has-text("margin")').first().locator('.vocab-head').click();
await page.waitForSelector('.vocab-card.open .vocab-note', { timeout: 5000 });
check('볼드가 <b>로 렌더', (await page.evaluate(() => document.querySelectorAll('.vocab-card.open .vocab-note b').length)) >= 1);
check('볼드 카드에도 리터럴 ** 없음', !(await page.evaluate(() => document.querySelector('.vocab-card.open .vocab-note')?.textContent || '')).includes('**'));
await page.locator('.vocab-card').first().locator('.vocab-head').click(); // 첫 카드로 되돌림
await page.waitForSelector('.vocab-card.open .vocab-save', { timeout: 5000 });

// 예문 표현장 저장 → 드릴·암기 카드로 이어진다
await page.click('.vocab-card.open .vocab-save');
await page.waitForTimeout(250);
const phrases = await page.evaluate(() => JSON.parse(localStorage.getItem('va_phrases') || '[]'));
check('예문이 표현장에 저장됨', phrases.length === 1 && phrases[0].lesson === 'vocab:finance', JSON.stringify(phrases[0] || {}));
check('저장 후 버튼 잠김', await page.evaluate(() => document.querySelector('.vocab-card.open .vocab-save')?.disabled === true));

// 도메인 전환
await page.click('.vocab-tab:has-text("기술 · 개발")');
await page.waitForTimeout(250);
check('도메인 전환됨', (await page.evaluate(() => document.querySelector('.vocab-tab.active')?.textContent)) === '기술 · 개발');
check('전환 시 카드 접힘', (await page.evaluate(() => document.querySelectorAll('.vocab-card.open').length)) === 0);
const techBody = await page.evaluate(() => document.body.textContent || '');
check('기술 도메인 표제어 렌더', /deploy|latency|technical debt/.test(techBody));

// 자기 점검 퀴즈: 오답 → 복습 큐 적립
await page.click('.btn.ghost-accent');
await page.waitForSelector('.vocab-quiz-opts', { timeout: 5000 });
check('퀴즈 4택 렌더', (await page.evaluate(() => document.querySelectorAll('.vocab-opt').length)) === 4);
check('퀴즈 진행 표시', /1 \/ 5/.test(await page.evaluate(() => document.querySelector('.vocab-quiz-meta')?.textContent || '')));

// 일부러 오답을 고른다(정답이 아닌 첫 옵션)
const wrongIdx = await page.evaluate(() => {
  const q = document.querySelector('.vocab-quiz-q')?.textContent;
  const opts = Array.from(document.querySelectorAll('.vocab-opt')).map((b) => b.textContent);
  window.__Q = q;
  return opts.findIndex((_, i) => i === 0); // 정답 여부는 클릭 후 클래스로 판정
});
await page.locator('.vocab-opt').nth(wrongIdx).click();
await page.waitForTimeout(300);
const wasWrong = await page.evaluate(() => !!document.querySelector('.vocab-opt.wrong'));
check('정답/오답 표시', await page.evaluate(() => !!document.querySelector('.vocab-opt.right')));
if (wasWrong) {
  const weak = await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]'));
  check('오답이 복습 큐에 적립', weak.length === 1 && weak[0].cat === '어휘', JSON.stringify(weak[0] || {}));
} else {
  // 첫 옵션이 정답이었던 경우 — 적립되지 않는 것이 정상
  const weak = await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]'));
  check('정답이면 복습 큐에 쌓지 않음', weak.length === 0, JSON.stringify(weak));
}
check('피드백에 예문 노출', await page.evaluate(() => !!document.querySelector('.vocab-quiz-feedback .ex')));

// 5문항 끝까지 진행 → 목록으로 복귀
for (let i = 0; i < 5; i++) {
  const next = page.locator('.study-card > .btn.primary');
  if (!(await next.count())) break;
  await next.click();
  await page.waitForTimeout(250);
  if (await page.locator('.vocab-card').count()) break;
  await page.locator('.vocab-opt').first().click();
  await page.waitForTimeout(250);
}
check('퀴즈 종료 후 어휘 목록 복귀', (await page.evaluate(() => document.querySelectorAll('.vocab-card').length)) > 0);

await browser.close();
finish('15-vocab');
