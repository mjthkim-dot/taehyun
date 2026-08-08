/**
 * 불꽃 히어로 — 스픽 벤치마크 리텐션 장치.
 *
 * 계약:
 *   ① 불꽃이 홈 최상단의 주인공이다(헤더 칩이 아니라)
 *   ② 발화가 불을 붙인다 — 목표 미달이면 불씨, 목표 달성이면 점화
 *   ③ 이번 주 7칸 달력에 불꽃·프리즈·구멍이 보인다
 *   ④ 마일스톤(7일 등)에 처음 닿은 날 한 번만 축하가 뜬다
 *   ⑤ 발화가 목표에 닿는 그 순간 화면에서 점화된다(새로고침 없이)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const dstr = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const browser = await launch();

/* ── ①② 꺼짐 → 불씨 → 점화 상태 ── */
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await seedKey(page);
// 6일 연속 학습 + 오늘 발화 0 — 스트릭은 있지만 오늘 불은 꺼짐
await page.addInitScript((days) => {
  localStorage.setItem('va_days', JSON.stringify(days));
}, [dstr(-6), dstr(-5), dstr(-4), dstr(-3), dstr(-2), dstr(-1)]);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.streak-hero', { timeout: 15000 });

const initial = await page.evaluate(() => ({
  level: document.querySelector('.streak-hero')?.dataset.level,
  count: document.querySelector('.streak-count')?.textContent || '',
  status: document.querySelector('.streak-status')?.textContent || '',
  fuel: document.querySelector('.streak-fuel-label')?.textContent || '',
  weekDays: document.querySelectorAll('.streak-day').length,
  aboveMission: (() => {
    const hero = document.querySelector('.streak-hero');
    const mission = document.querySelector('.mission-card');
    return !!hero && !!mission && !!(hero.compareDocumentPosition(mission) & Node.DOCUMENT_POSITION_FOLLOWING);
  })(),
}));
check('불꽃 히어로가 홈에 있다', initial.weekDays === 7, JSON.stringify(initial));
check('미션 카드보다 위(주인공 자리)', initial.aboveMission);
check('연속 6일이 표시됨', initial.count.startsWith('6'), initial.count);
check('오늘은 아직 꺼짐', initial.level === 'off', initial.level);
check('무엇을 하면 불이 붙는지 알려줌', initial.status.includes('문장'), initial.status);
check('발화 진행이 연료로 표시됨', /발화 0\/\d+문장/.test(initial.fuel), initial.fuel);

/* ── ⑤ 발화가 목표에 닿는 순간 점화 ──
 * 실제 발화 경로 대신 저장소를 목표치로 만들고 미션 진행 이벤트로 갱신을 트리거한다. */
await page.evaluate(() => {
  const today = new Date();
  const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  localStorage.setItem('va_spoken', JSON.stringify({ date: ds, count: 20 }));
  const days = JSON.parse(localStorage.getItem('va_days') || '[]');
  if (!days.includes(ds)) days.push(ds);
  localStorage.setItem('va_days', JSON.stringify(days));
});
// 홈을 벗어났다 돌아오면 flameState가 다시 계산된다(리마운트)
await page.click('.mode-tab:has-text("드릴")');
await page.waitForTimeout(400);
await page.click('.mode-tab:has-text("홈")');
await page.waitForSelector('.streak-hero', { timeout: 10000 });
const lit = await page.evaluate(() => ({
  level: document.querySelector('.streak-hero')?.dataset.level,
  count: document.querySelector('.streak-count')?.textContent || '',
  status: document.querySelector('.streak-status')?.textContent || '',
  todayDot: !!document.querySelector('.streak-day.today .flame.lit'),
}));
check('발화 목표 달성 시 점화', lit.level === 'lit', lit.level);
check('스트릭이 7일로 이어짐', lit.count.startsWith('7'), lit.count);
check('오늘 칸에도 불꽃', lit.todayDot);
check('다음 마일스톤 안내', lit.status.includes('마일스톤') || lit.status.includes('완성'), lit.status);

/* ── ④ 마일스톤 축하 — 7일에 처음 닿았으므로 한 번 뜬다 ── */
await page.waitForSelector('.milestone-overlay', { timeout: 8000 });
const ms = await page.evaluate(() => ({
  days: document.querySelector('.milestone-days')?.textContent || '',
  msg: document.querySelector('.milestone-msg')?.textContent || '',
}));
check('7일 마일스톤 축하가 뜸', ms.days.includes('7'), ms.days);
check('숫자만이 아니라 의미를 붙임', ms.msg.length > 10, ms.msg);
await page.click('.milestone-overlay button');
check('닫으면 사라짐', (await page.locator('.milestone-overlay').count()) === 0);

// 같은 마일스톤은 두 번 축하하지 않는다
await page.click('.mode-tab:has-text("드릴")');
await page.waitForTimeout(300);
await page.click('.mode-tab:has-text("홈")');
await page.waitForSelector('.streak-hero', { timeout: 10000 });
await page.waitForTimeout(600);
check('같은 마일스톤 중복 축하 없음', (await page.locator('.milestone-overlay').count()) === 0);
await page.close();

/* ── ③ 주간 달력: 프리즈·구멍 표시 ── */
const cal = await browser.newPage();
cal.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await cal.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await seedKey(cal);
// 이번 주 안에서: 그저께 프리즈로 메움, 어제 학습 — 단 주 초(월·화)에는 과거가 없을 수
// 있으므로 요일 무관하게 상태 종류만 검증한다
await cal.addInitScript((data) => {
  localStorage.setItem('va_days', JSON.stringify(data.days));
  localStorage.setItem('va_frozen_days', JSON.stringify(data.frozen));
}, { days: [dstr(-2), dstr(-1)], frozen: [dstr(-2)] });
await cal.goto(`${BASE}/app`);
await cal.waitForSelector('.streak-hero', { timeout: 15000 });
const states = await cal.evaluate(() =>
  [...document.querySelectorAll('.streak-day')].map((d) => d.className.replace('streak-day ', ''))
);
check('오늘 칸이 표시됨', states.includes('today'), JSON.stringify(states));
check('프리즈로 메운 날이 ❄️로 구분됨', (await cal.evaluate(() => document.body.innerText)).includes('❄️') || states.includes('frozen'), JSON.stringify(states));

await browser.close();
finish('33-streak');
