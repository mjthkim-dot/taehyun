/**
 * 첫 실행 온보딩 — 처음 연 사람이 무엇부터 할지 정해주는 3단계.
 * 계약: ① 첫 실행에만 뜬다 ② 모든 단계에서 건너뛸 수 있다(벽이 되면 안 됨)
 *       ③ 키를 넣으면 검증 후 저장된다 ④ 목표가 홈 지표에 반영된다
 *       ⑤ 한 번 끝내면 다시 뜨지 않는다
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const browser = await launch();

/* ── 첫 실행: 온보딩이 뜨고, 건너뛰면 바로 홈 ── */
const skip = await browser.newPage();
skip.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await skip.addInitScript(() => {
  // 첫 방문에만 초기화 — 그래야 '다시 열면 안 뜬다'를 검증할 수 있다
  if (!sessionStorage.getItem('__onb_cleared')) {
    localStorage.removeItem('va_onboarded');
    sessionStorage.setItem('__onb_cleared', '1');
  }
});
await skip.goto(`${BASE}/app`);
await skip.waitForSelector('.onb-card', { timeout: 15000 });
check('첫 실행에 온보딩 표시', await skip.evaluate(() => !!document.querySelector('.onb-card')));
check('단계 표시(3단계)', (await skip.evaluate(() => document.querySelectorAll('.onb-dots i').length)) === 3);
await skip.click('.onb-skip'); // 둘러보기만 할게요
await skip.waitForSelector('.mission-card', { timeout: 10000 });
check('건너뛰면 홈으로', await skip.evaluate(() => !!document.querySelector('.mission-card')));
check('건너뛴 것도 완료로 기록', (await skip.evaluate(() => localStorage.getItem('va_onboarded'))) === 'true');
await skip.reload();
await skip.waitForSelector('.mission-card', { timeout: 10000 });
check('다시 열어도 온보딩이 뜨지 않음', await skip.evaluate(() => !document.querySelector('.onb-card')));

/* ── 정상 흐름: 키 등록 → 목표 선택 → 홈 반영 ── */
const full = await browser.newPage();
full.on('pageerror', (e) => console.log('  [pageerror]', e.message));
let validateCalls = 0;
await full.route('**/app/api/groq/validate', (r) => {
  validateCalls++;
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) });
});
await full.addInitScript(() => {
  if (!sessionStorage.getItem('__onb_cleared')) {
    localStorage.removeItem('va_onboarded');
    sessionStorage.setItem('__onb_cleared', '1');
  }
});
await full.goto(`${BASE}/app`);
await full.waitForSelector('.onb-card', { timeout: 15000 });
await full.click('.onb-next'); // 시작하기 → AI 연결
await full.waitForSelector('.onb-keyrow', { timeout: 5000 });

// 형식이 틀린 키는 네트워크를 쓰지 않고 즉시 거절
await full.fill('.onb-keyrow .text-input', 'not-a-key');
await full.click('.onb-keysave');
await full.waitForSelector('.onb-err', { timeout: 5000 });
check('형식 틀린 키 즉시 거절', (await full.evaluate(() => document.querySelector('.onb-err')?.textContent || '')).includes('gsk_'));
check('형식 오류는 서버를 부르지 않음', validateCalls === 0, String(validateCalls));

await full.fill('.onb-keyrow .text-input', 'gsk_onboarding_key');
await full.click('.onb-keysave');
await full.waitForSelector('.onb-goals', { timeout: 8000 });
check('유효한 키는 검증 후 저장', (await full.evaluate(() => JSON.parse(localStorage.getItem('va_groq_key') || '""'))) === 'gsk_onboarding_key');
check('키 검증 서버 호출', validateCalls === 1, String(validateCalls));
check('연결 완료 안내', await full.evaluate(() => !!document.querySelector('.onb-ok')));

// 목표를 40으로 바꾸고 진단 없이 시작
await full.click('.onb-goal:has-text("집중")');
await full.click('.onb-skip'); // 진단 없이 바로 시작
await full.waitForSelector('.stat-hero', { timeout: 10000 });
check('선택한 목표가 저장됨', (await full.evaluate(() => JSON.parse(localStorage.getItem('va_daily_goal') || '0'))) === 40);
check('홈 지표에 목표 반영', (await full.evaluate(() => document.querySelector('.stat-hero-num span')?.textContent || '')).includes('40'));

/* ── 레벨 진단으로 이어가기 ── */
const place = await browser.newPage();
place.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await place.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await place.addInitScript(() => {
  if (!sessionStorage.getItem('__onb_cleared')) {
    localStorage.removeItem('va_onboarded');
    sessionStorage.setItem('__onb_cleared', '1');
  }
});
await place.goto(`${BASE}/app`);
await place.waitForSelector('.onb-card', { timeout: 15000 });
await place.click('.onb-next');
await place.waitForSelector('.onb-keyrow', { timeout: 5000 });
await place.click('.onb-skip'); // 키는 나중에
await place.waitForSelector('.onb-goals', { timeout: 5000 });
await place.click('.onb-next'); // 레벨 진단하고 시작하기
await place.waitForTimeout(600);
check('진단 선택 시 배치고사로 이동', (await place.evaluate(() => document.querySelector('.app-header h1')?.textContent)) === 'CEFR 배치고사');

await browser.close();
finish('22-onboarding');
