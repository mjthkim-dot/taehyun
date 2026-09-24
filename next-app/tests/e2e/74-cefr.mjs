/**
 * CEFR가 메인 — 증거 기반 레벨 성장:
 *   ① 측정 전: 홈 맨 위 CEFR 카드가 레벨 진단을 권한다
 *   ② 증거가 있으면: 3D 레벨 배지 · 다음 레벨 진척 · 4기능 레벨 · 가장 가까운 입증 과제
 *   ③ 과제 버튼 → 해당 기능 화면이 목표 레벨(i+1)로 열린다(프리셋)
 *   ④ 채점 결과가 {기능·레벨·점수} 증거로 남고, 0점으로는 레벨이 오르지 않는다(인플레이션 회귀)
 *   ⑤ CEFR 리포트: 4기능 카드 · Can-do 72문항 체크리스트(입증 자동 체크 + 자기평가) · 레벨 기록
 *   ⑥ 3개 기능이 입증하면 승급 축하가 한 번 뜬다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
await seedKey(page);
await page.goto(`${BASE}/app`);

/* ① 측정 전 */
await page.waitForSelector('.cf-hero', { timeout: 15000 });
check('홈 첫 카드가 CEFR', await page.evaluate(() => document.querySelector('.app-content .cf-hero') !== null && [...document.querySelectorAll('.app-content .study-card')][0]?.classList.contains('cf-hero')));
check('측정 전엔 레벨 진단을 권한다', await page.evaluate(() => document.body.innerText.includes('5분 레벨 진단 시작')));

/* ② 증거 시드 */
await page.evaluate(() => {
  const now = Date.now();
  localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: now }));
  const ev = [];
  for (let i = 0; i < 3; i++) ev.push({ t: now - i * 1000, skill: 'listening', level: 'B1', score: 85, src: 'listening', counts: true });
  ev.push({ t: now, skill: 'reading', level: 'B1', score: 80, src: 'reading', counts: true });
  localStorage.setItem('va_cefr_evidence', JSON.stringify(ev));
});
await page.reload();
await page.waitForSelector('.cf-badge', { timeout: 15000 });
const h = await page.evaluate(() => document.querySelector('.cf-hero')?.innerText || '');
check('종합 A2 (듣기만 B1 — 3개 기준이라 그대로)', h.includes('A2') && h.includes('B1까지'));
check('4기능 카드', (await page.locator('.cf-skill').count()) === 4);
check('듣기는 B1로 표시', await page.evaluate(() => [...document.querySelectorAll('.cf-skill')].find((e) => e.textContent.includes('듣기'))?.textContent.includes('B1')));
check('가장 가까운 과제 = B1 읽기', h.includes('B1 읽기') && h.includes('1/3'));
check('레거시 헤더 GSE 문구 제거(히어로가 담당)', !(await page.evaluate(() => document.querySelector('.home-hero-sub')?.textContent.includes('GSE'))));

/* ③ 과제 → 독해가 B1로 열림 */
await page.click('.cf-cta');
await page.waitForFunction(() => document.body.innerText.includes('B1 지문 풀기'), null, { timeout: 15000 });
check('독해 화면이 목표 레벨 B1로 열린다(프리셋)', true);

/* ④ 0점 제출 → 증거는 남고 레벨은 그대로 */
await page.click('button:has-text("B1 지문 풀기")');
await page.waitForSelector('button:has-text("채점하기")', { timeout: 8000 });
await page.click('button:has-text("채점하기")');
await page.waitForTimeout(400);
const ev = await page.evaluate(() => JSON.parse(localStorage.getItem('va_cefr_evidence') || '[]'));
const last = ev[ev.length - 1];
check('채점이 {읽기·B1·점수} 증거로 남는다', last.skill === 'reading' && last.level === 'B1' && last.src === 'reading' && typeof last.score === 'number');
check('프로필 레벨은 증거로만 — A2 유지', await page.evaluate(() => JSON.parse(localStorage.getItem('va_profile')).cefr === 'A2'));

/* ⑤ 리포트 */
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("CEFR 리포트")');
await page.waitForSelector('.cf-screen', { timeout: 15000 });
check('4기능 상세 카드', (await page.locator('.cf-skill-card').count()) === 4);
check('입증 핍(3칸) 표시', (await page.locator('.cf-skill-card .cf-pip').count()) >= 9);
check('Can-do 기본 탭 = 목표 레벨 B1', await page.evaluate(() => document.querySelector('.cf-lv-tab.on')?.textContent === 'B1'));
check('B1 Can-do 12문항', (await page.locator('.cf-cando').count()) === 12);
check('듣기 B1은 입증됨으로 자동 체크', await page.evaluate(() => [...document.querySelectorAll('.cf-cando.on')].filter((e) => e.textContent.includes('입증됨')).length === 3));
const firstUnchecked = page.locator('.cf-cando:not(.on)').first();
await firstUnchecked.click();
check('자기평가 체크가 저장되지만 레벨은 그대로', await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('va_cefr_cando') || '{}')).some(Boolean) && JSON.parse(localStorage.getItem('va_profile')).cefr === 'A2'));
check('레벨 기록에 출발점', await page.evaluate(() => document.querySelector('.cf-hist')?.textContent.includes('A2')));

/* ⑥ 승급 */
await page.evaluate(() => {
  const now = Date.now();
  const ev = JSON.parse(localStorage.getItem('va_cefr_evidence') || '[]');
  for (let i = 0; i < 3; i++) ev.push({ t: now, skill: 'writing', level: 'B1', score: 80, src: 'writing', counts: true });
  for (let i = 0; i < 2; i++) ev.push({ t: now, skill: 'reading', level: 'B1', score: 80, src: 'reading', counts: true });
  localStorage.setItem('va_cefr_evidence', JSON.stringify(ev));
  // 축하 플래그를 심지 않는다 — 홈이 열릴 때 승급을 스스로 감지해야 한다
});
await page.click('.mode-tab:has-text("홈")');
await page.waitForSelector('.cf-promo', { timeout: 15000 });
check('승급 축하가 뜬다', await page.evaluate(() => document.querySelector('.cf-promo')?.textContent.includes('B1')));
check('배지가 B1로', await page.evaluate(() => document.querySelector('.cf-badge-lv')?.textContent === 'B1'));
await page.reload();
await page.waitForSelector('.cf-badge', { timeout: 15000 });
check('축하는 한 번만', (await page.locator('.cf-promo').count()) === 0);

await browser.close();
finish();
