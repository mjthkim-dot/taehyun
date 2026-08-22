/**
 * 무료 티어 15분 연속 대화 시뮬레이션 — RPM 절약 설계의 핵심 검증.
 *
 * 조건: 분당 발화 8개(7.5초 간격) × 15분 = 120발화를 실제 시간으로 주입.
 *       모의 Gemini가 무료 티어 한도(Flash-Lite 15 RPM · Flash 10 RPM)를
 *       실제로 강제하며, 90초마다 퀵 리액션 클릭 + 자동 요약이 함께 돈다.
 * 합격: ① 429 응답 0건  ② 상대 발화 전부 번역 표시  ③ 배칭으로
 *       번역 호출 수 < 문장 수  ④ JS 오류 0
 *
 * 실행: GEMINI 모의(tests 참조) + 서버 기동 후
 *       node tests/rpm-sim.mjs            (15분)
 *       SIM_MIN=3 node tests/rpm-sim.mjs  (짧은 검증)
 */
import { chromium } from 'playwright';

const MIN = +(process.env.SIM_MIN || 15);
const GAP_MS = 7500;                         // 분당 8발화
const N = Math.round(MIN * 60000 / GAP_MS);
const APP = process.env.MC_BASE || 'http://127.0.0.1:3799';

const TOPICS = [
  "the migration timeline for the core workloads",
  "your quote compared to the other vendor we evaluated",
  "the egress cost line item in the estimate",
  "vendor lock-in and how portable the data layer is",
  "the security compliance requirements for our industry",
  "the pilot scope and what success looks like",
  "the total cost of ownership over three years",
  "who owns the migration on your side after signing",
];
// 문장을 전부 고유하게 — 번역 캐시가 부하를 흡수하면 한도 검증이 무의미해진다
const utt = i => i % 3 === 2
  ? ["나", `Let me address point ${i + 1} about ${TOPICS[i % TOPICS.length]}.`]
  : ["상대", `Regarding item ${i + 1}, can we talk about ${TOPICS[i % TOPICS.length]} now?`];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
let calls429 = 0, trCalls = 0, sgCalls = 0;
p.on('response', r => { if (r.status() === 429) calls429++; });
await p.route('**/api/translate', r => { trCalls++; r.continue(); });
await p.route('**/api/suggest', r => { sgCalls++; r.continue(); });

await p.goto(APP + '/app.html'); await p.waitForTimeout(1200);
console.log(`■ ${MIN}분 시뮬 시작 — 발화 ${N}개, 7.5초 간격, 무료 한도 강제(mock)`);

const t0 = Date.now();
let themCount = 0;
const dispLat = [];
for (let i = 0; i < N; i++) {
  const [who, text] = utt(i);
  const tick = Date.now();
  if (who === '상대') {
    themCount++;
    const nBefore = await p.evaluate(() =>
      [...document.querySelectorAll('#feed .row .kr')].filter(e => e.textContent.trim() && !e.querySelector('.tr-wait')).length);
    await p.evaluate(([t, w]) => addUtterance(t, w), [text, who]);
    // 이 발화의 번역이 붙을 때까지 (배칭이면 최대 4초 대기 + 응답)
    p.waitForFunction(n =>
      [...document.querySelectorAll('#feed .row .kr')].filter(e => e.textContent.trim() && !e.querySelector('.tr-wait')).length > n,
      nBefore, { timeout: 20000 })
      .then(() => dispLat.push(Date.now() - tick)).catch(() => {});
  } else {
    await p.evaluate(([t, w]) => addUtterance(t, w), [text, who]);
  }
  if (i > 0 && i % 12 === 0) {                       // 90초마다 퀵 리액션
    await p.click('.actions [data-intent="' + ['agree', 'pushback', 'ask', 'propose'][(i / 12) % 4 | 0] + '"]');
  }
  if (i === Math.floor(N / 2)) {                     // 중간에 퀵 번역 1회
    await p.fill('#say-in', '보안 요건을 다음 주에 다시 논의하자고 말하고 싶어요');
    await p.click('#say-go');
  }
  const wait = GAP_MS - (Date.now() - tick);
  if (wait > 0) await sleep(wait);
}
await sleep(9000);                                   // 마지막 배치 플러시 대기

const translated = await p.evaluate(() =>
  [...document.querySelectorAll('#feed .row .kr')].filter(e => e.textContent.trim().length > 3 && !e.textContent.includes('실패') && !e.querySelector('.tr-wait')).length);
const failed = await p.evaluate(() =>
  [...document.querySelectorAll('#feed .row .kr')].filter(e => e.textContent.includes('실패') || e.textContent.includes('누락')).length);
const chip = await p.evaluate(() => $('#quota-chip').textContent);
const banner = await p.evaluate(() => $('#status-txt').textContent);
dispLat.sort((a, b2) => a - b2);
const q = f => dispLat.length ? dispLat[Math.min(dispLat.length - 1, Math.floor(dispLat.length * f))] : 0;

const dur = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`\n■ 결과 (${dur}분 실측)`);
console.log(`  429 응답:            ${calls429}건  ${calls429 === 0 ? '✅' : '❌'}`);
console.log(`  상대 발화 번역 표시:  ${translated}/${themCount}  실패/누락 ${failed}건  ${translated >= themCount && !failed ? '✅' : '❌'}`);
console.log(`  번역 호출/문장:       ${trCalls}회 / ${themCount + 1}문장 (배칭 절약 ${themCount + 1 - trCalls}회)`);
console.log(`  제안 호출:            ${sgCalls}회 (클릭+자동+퀵번역)`);
console.log(`  번역 표시 지연:       p50 ${q(.5)}ms · p95 ${q(.95)}ms · max ${dispLat[dispLat.length - 1] || 0}ms (기준: 배치 후 3초 → 대기 포함 7초)`);
console.log(`  사용량 칩:            "${chip}"`);
console.log(`  배너:                "${banner.slice(0, 40)}"`);
console.log(`  JS 오류:             ${errs.length}건 ${errs.slice(0, 2)}`);
const pass = calls429 === 0 && translated >= themCount && !failed && errs.length === 0 && q(.95) <= 7000;
console.log(pass ? '\n✅ 완주 — 무료 한도 안에서 429 없이 통과' : '\n❌ 실패');
await b.close();
process.exit(pass ? 0 : 1);
