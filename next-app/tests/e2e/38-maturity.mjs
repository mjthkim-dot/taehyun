/**
 * 성숙도 커리큘럼(성장) — "글로벌 커리큘럼 + 나에 맞는 성숙도별 성장"의 계약:
 *   ① 연습 증거(GSE·사다리 완주·패턴 정착)가 기준에 닿으면 자동 승급된다
 *   ② 승급은 고정된다(내려가지 않음) + 승급 순간 축하가 뜬다
 *   ③ 홈 성장 카드가 현재 성숙도와 진행도를 보여준다
 *   ④ 커리큘럼 패턴 탭 → 원어민 사다리로 그 예문이 곧장 넘어간다
 *   ⑤ 사다리를 완주하면 그 패턴이 "정착"으로 기록된다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const LADDER = JSON.stringify({
  rungs: [
    { level: '기본', en: 'We plan to expand into Japan next year.', kr: '내년에 일본 진출을 계획합니다.', note: '정확하지만 딱딱한 표현이에요.' },
    { level: '자연스럽게', en: "We're looking to expand into Japan next year.", kr: '내년에 일본 진출을 보고 있어요.', note: 'looking to로 구어의 결이 살았어요.' },
    { level: '원어민', en: "We're looking to break into the Japanese market next year.", kr: '내년에 일본 시장 진입을 노리고 있어요.', note: 'break into라는 관용 표현을 살렸어요.' },
  ],
});

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: LADDER } }] }) })
);
await seedKey(page);
// 1단계 승급 조건(GSE 32·사다리 2·뼈대 패턴 4)을 넘는 증거를 심는다 → 자동 승급 기대
await page.addInitScript(() => {
  localStorage.setItem('va_profile', JSON.stringify({ cefr: 'B1', gse: 38, scaffolding: 1 }));
  localStorage.setItem('va_ladder_done', JSON.stringify(['s1', 's2', 's3', 's4']));
  localStorage.setItem('va_maturity_patterns', JSON.stringify(['id-like', 'could-you', 'get-back', 'that-works']));
});

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

/* ── ③ 홈 성장 카드 ── */
await page.waitForSelector('.growth-card', { timeout: 8000 });
const homeCard = await page.evaluate(() => document.querySelector('.growth-card')?.innerText || '');
check('홈 카드가 자동 승급된 성숙도 2를 보여준다', homeCard.includes('성숙도 2'), homeCard.replace(/\n/g, ' '));

/* ── ① 자동 승급 + ② 고정·축하 ── */
const storedStage = await page.evaluate(() => JSON.parse(localStorage.getItem('va_maturity') || '{}').stage);
check('승급이 저장소에 고정된다 (stage=2)', storedStage === 2, String(storedStage));

await page.click('.growth-card');
await page.waitForSelector('.mx-hero', { timeout: 10000 });
const hero = await page.evaluate(() => document.querySelector('.mx-hero')?.innerText || '');
check('성장 화면이 구어의 감(2단계)을 보여준다', hero.includes('구어의 감'));
check('승급 조건 체크리스트가 보인다', (await page.locator('.mx-crit').count()) === 3);
const pathState = await page.evaluate(() => ({
  done: document.querySelectorAll('.mx-path-step.done').length,
  now: document.querySelector('.mx-path-step.now')?.innerText || '',
}));
check('지나온 단계는 완료로, 현재 단계는 강조로', pathState.done === 1 && pathState.now.includes('구어의 감'), JSON.stringify(pathState));

/* ── ④ 패턴 → 사다리 핸드오프 ── */
const firstPractice = page.locator('.mx-pattern:not(.done) .mx-practice-btn').first();
await firstPractice.click();
await page.waitForSelector('.ld-rung.active', { timeout: 15000 });
check('패턴 예문이 사다리로 곧장 넘어간다', (await page.evaluate(() => document.querySelector('.ld-head')?.innerText || '')).length > 0);

/* ── ⑤ 완주(건너뛰기 3회) → 패턴 정착 기록 ── */
await page.click('.ld-skip');
await page.waitForTimeout(300);
await page.click('.ld-skip');
await page.waitForTimeout(300);
await page.click('.ld-skip');
await page.waitForSelector('.ld-finish', { timeout: 8000 });
const patterns = await page.evaluate(() => JSON.parse(localStorage.getItem('va_maturity_patterns') || '[]'));
check('사다리 완주가 패턴 정착으로 기록된다', patterns.length === 5, JSON.stringify(patterns));
check('정착 패턴은 2단계 커리큘럼의 것이다', patterns.some((k) => ['looking-to', 'turns-out', 'thing-is', 'wondering-if', 'do-you-mind', 'kind-of', 'touch-base', 'how-sound'].includes(k)), JSON.stringify(patterns));

/* 성장 화면으로 돌아가면 정착 수가 늘어 있다 */
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-grid .feat-card:has-text("성장")', { timeout: 8000 });
await page.click('.feat-grid .feat-card:has-text("성장")');
await page.waitForSelector('.mx-hero', { timeout: 10000 });
const doneChips = await page.locator('.mx-done-chip').count();
check('성장 화면에 정착 칩이 표시된다', doneChips >= 1, String(doneChips));

await browser.close();
finish();
