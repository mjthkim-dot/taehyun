/**
 * 게이트웨이 내성 시뮬레이션 — 유료 티어 장애 재현 3종 (전부 mock).
 *
 *  A. 버스트 급류: 10발화가 5초 안에 몰림 + 버튼 연타 + 퀵 번역
 *     → 게이트웨이 평활화로 429 0건, 번역 전부 표시 (드레인 90초 이내)
 *  B. 429 폭탄: B1) p=1.0 주입 → 연속 429 3회 → 서킷 브레이커 발동(배너)
 *              B2) p=0.3 주입 → 클릭 제안 생존율 측정, 전체 중단 없음
 *  C. 503 간헐: p=0.5 주입 → 항목별 스킵(1회 재시도 후), JS 오류 0, 해제 후 정상
 *
 * 실행: python3 tests/mock_gemini.py (MOCK_RPM_LITE=1000 MOCK_RPM_FLASH=1000) +
 *       GEMINI_API_KEY=test GEMINI_URL=http://127.0.0.1:3898 서버 기동 후
 *       node tests/resilience-sim.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.MC_BASE || 'http://127.0.0.1:3799';
const MOCK = process.env.MOCK_BASE || 'http://127.0.0.1:3898';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const err = async (mode, p = 0, retry_after = undefined) =>
  fetch(MOCK + '/__err', { method: 'POST', body: JSON.stringify({ mode, p, retry_after }) });
const usage = async () => (await fetch(APP + '/api/usage')).json();

const checks = [];
const check = (name, ok, note = '') => {
  checks.push(ok);
  console.log(`  ${ok ? '✅' : '❌'} ${name}${note ? ' — ' + note : ''}`);
};

const b = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const jsErrs = []; p.on('pageerror', e => jsErrs.push(e.message));
let client429 = 0; p.on('response', r => { if (r.status() === 429) client429++; });
await p.goto(APP + '/app.html'); await p.waitForTimeout(1200);

const translatedN = () => p.evaluate(() =>
  [...document.querySelectorAll('#feed .row .kr')]
    .filter(e => e.textContent.trim().length > 3 && !e.textContent.includes('실패') && !e.querySelector('.tr-wait')).length);

// ═══ A. 버스트 급류 ═══
console.log('\n■ A. 버스트 — 10발화/5초 + 버튼 연타 + 퀵 번역');
const u0 = (await usage()).gateway;
for (let i = 0; i < 10; i++) {
  await p.evaluate(([t, w]) => addUtterance(t, w),
    [`Burst item ${i + 1}, can we talk about the cost line now?`, i % 3 === 2 ? '나' : '상대']);
  await sleep(500);
}
await p.click('.actions [data-intent="agree"]');
await sleep(250);
await p.click('.actions [data-intent="ask"]');       // 연타 — 클라 병합 + 게이트웨이 큐
await p.fill('#say-in', '보안 요건을 다시 논의하자고 말하고 싶어요');
await p.click('#say-go');
// 드레인 대기 — 평활화(GW_RPM)로 최대 90초
const themA = 7;
let okA = false;
for (let w = 0; w < 90 && !okA; w++) { okA = (await translatedN()) >= themA; await sleep(1000); }
const uA = (await usage()).gateway;
check('버스트 중 429 0건', uA.err_429 - u0.err_429 === 0 && client429 === 0,
  `게이트웨이 발사 ${uA.dispatched - u0.dispatched}회 · 60초 발사율 ${uA.rpm60}`);
check('상대 발화 번역 전부 표시', okA, `${await translatedN()}/${themA}`);

// ═══ B1. 429 전면 주입 → 서킷 브레이커 ═══
console.log('\n■ B1. 429 폭탄 (p=1.0) — 연속 429 → 브레이커 발동');
await err('429', 1.0, 1);
await p.click('.actions [data-intent="propose"]');    // 3시도 전부 429 → 브레이커
let tripped = false, bannerTxt = '';
for (let w = 0; w < 30 && !tripped; w++) {
  const g = (await usage()).gateway;
  tripped = g.breaker_trips >= 1 && g.breaker_until > 0;
  await sleep(1000);
}
await err('off');
if (tripped) {
  // 클라이언트는 /api/usage를 15초 주기로 폴링한다 — 배너 표시까지 최대 한 주기
  for (let w = 0; w < 20 && !bannerTxt.includes('대기'); w++) {
    bannerTxt = await p.evaluate(() => document.querySelector('#status-txt').textContent);
    await sleep(1000);
  }
}
check('서킷 브레이커 발동', tripped, `trips=${(await usage()).gateway.breaker_trips}`);
check('대기 배너 표시', bannerTxt.includes('대기'), `"${bannerTxt.slice(0, 30)}"`);
// 브레이커 해제 대기 → 회복 확인
for (let w = 0; w < 40; w++) { if (!(await usage()).gateway.breaker_until) break; await sleep(1000); }
await p.click('.actions [data-intent="agree"]');
let recovered = false;
for (let w = 0; w < 20 && !recovered; w++) {
  recovered = await p.evaluate(() => !!document.querySelector('#c-answers .en')?.textContent.match(/[A-Za-z]{3,}/));
  await sleep(1000);
}
check('브레이커 해제 후 첫 클릭 회복', recovered);

// ═══ B2. 429 무작위 30% — 클릭 제안 생존율 ═══
console.log('\n■ B2. 429 무작위 30% — 클릭 제안 생존율 (재시도 규율)');
await err('429', 0.3, 1);
let survived = 0;
const CLICKS = 8;
for (let i = 0; i < CLICKS; i++) {
  await p.evaluate(([t, w]) => addUtterance(t, w),
    [`Random-fail round ${i + 1}, what about the timeline?`, '상대']);
  await p.click('.actions [data-intent="' + ['agree', 'ask', 'propose', 'pushback'][i % 4] + '"]');
  // 브레이커(30초 차단)가 우연히 발동해도 큐는 유지된다 — 회복까지 40초 허용
  let got = false;
  for (let w = 0; w < 40 && !got; w++) {
    got = await p.evaluate(() => {
      const t = document.querySelector('#c-answers .en')?.textContent || '';
      return /[A-Za-z]{3,}/.test(t) && !t.includes('생성 중');
    });
    await sleep(1000);
  }
  survived += got ? 1 : 0;
  await p.waitForTimeout(1500);
}
await err('off');
const uB = (await usage()).gateway;
check(`클릭 제안 생존율 ${survived}/${CLICKS}`, survived >= 6,
  `재시도 ${uB.retries}회 · 429 ${uB.err_429}건 흡수`);
check('전체 중단 없음 (주입 해제 후 번역 재개)', await (async () => {
  const n = await translatedN();
  await p.evaluate(([t, w]) => addUtterance(t, w), ['After the storm, shall we continue?', '상대']);
  for (let w = 0; w < 20; w++) { if ((await translatedN()) > n) return true; await sleep(1000); }
  return false;
})());

// ═══ C. 503 간헐 주입 — 항목별 스킵 ═══
console.log('\n■ C. 503 간헐 (p=0.5) — 항목별 스킵, 전역 오류 없음');
const jsBefore = jsErrs.length;
await err('503', 0.5);
for (let i = 0; i < 6; i++) {
  await p.evaluate(([t, w]) => addUtterance(t, w),
    [`Flaky backend round ${i + 1}, is the SLA still valid?`, '상대']);
  await sleep(4000);
}
await sleep(8000);
await err('off');
const uC = (await usage()).gateway;
check('503을 별도 집계 (429와 구분)', uC.err_5xx > 0, `5xx ${uC.err_5xx}건 · 429 ${uC.err_429}건`);
check('503 구간 JS 오류 0', jsErrs.length === jsBefore, jsErrs.slice(jsBefore, jsBefore + 1).join(''));
// 해제 후 정상 복귀
const nC = await translatedN();
await p.evaluate(([t, w]) => addUtterance(t, w), ['Back to normal now, right?', '상대']);
let okC = false;   // 평활화 설계상 폭주 직후엔 큐 드레인이 남아 있다 — 30초 허용
for (let w = 0; w < 30 && !okC; w++) { okC = (await translatedN()) > nC; await sleep(1000); }
check('해제 후 번역 정상 복귀', okC);

console.log(`\n■ 종합: JS 오류 ${jsErrs.length}건 · 클라이언트로 새어나간 429 ${client429}건`);
const g = (await usage()).gateway;
console.log(`  게이트웨이 누계: 발사 ${g.dispatched} · 재시도 ${g.retries} · 드롭 ${g.dropped}` +
  ` · 브레이커 ${g.breaker_trips}회 · 429 ${g.err_429} · 5xx ${g.err_5xx}`);
const pass = checks.every(Boolean) && jsErrs.length === 0;
console.log(pass ? '\n✅ 내성 시나리오 전부 통과' : '\n❌ 실패');
await b.close();
process.exit(pass ? 0 : 1);
