/**
 * 사용자 해악 전수 점검 가드 — 반복·뜻 누락 렌즈의 남은 두 표면:
 *   ① 회화 기본 진입은 최신 레슨 시나리오 고정이 아니라 오늘의 비즈니스
 *      미션(날짜 회전) 상황으로 시작한다
 *   ② 홈 세션 CTA는 패턴 영어 스템만이 아니라 뜻(한국어)을 함께 보여준다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await seedKey(page);
// CTA 결정성 — id-like만 미정착으로
await page.addInitScript(() => {
  localStorage.setItem('va_maturity_patterns', JSON.stringify(['could-you', 'get-back', 'didnt-catch', 'just-to-confirm', 'that-works', 'im-afraid', 'thanks-time']));
});
await page.goto(`${BASE}/app`);
await page.waitForSelector('.session-cta', { timeout: 15000 });
await page.waitForFunction(() => (document.querySelector('.session-cta')?.textContent || '').includes('오늘의 패턴'), null, { timeout: 10000 });

/* ② CTA 뜻 표시 */
const cta = await page.evaluate(() => document.querySelector('.session-cta')?.innerText || '');
check('CTA에 패턴 영어가 있다', cta.includes("I'd like to"), cta.replace(/\n/g, ' '));
check('CTA에 뜻(한국어)이 함께 있다', /—\s*[가-힣]/.test(cta), cta.replace(/\n/g, ' '));

/* ① 회화 기본 진입 = 오늘의 미션 */
await page.click('.mode-tab:has-text("회화")');
await page.waitForSelector('.talk-intro', { timeout: 10000 });
const intro = await page.evaluate(() => document.querySelector('.talk-intro')?.innerText || '');
check('기본 진입이 미션 상황(🎯)으로 시작', intro.includes('🎯'), intro.slice(0, 60));
check('레슨 고정 시나리오가 아니다', !intro.includes('레스토랑'), intro.slice(0, 60));
await page.close();

/* ③ 0점도 판정이다 — 전혀 다른 발화에도 점수 피드백이 뜬다(무반응 금지) */
{
  const p2 = await browser.newPage();
  p2.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await p2.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await p2.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  await p2.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'zzz' }) }));
  await seedKey(p2);
  await p2.addInitScript(() => {
    navigator.mediaDevices = navigator.mediaDevices || {};
    navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
    class FA { constructor() { this.fftSize = 1024; this.t0 = Date.now(); } getFloatTimeDomainData(b) { const l = Date.now() - this.t0 < 500; for (let i = 0; i < b.length; i++) b[i] = l ? 0.5 : 0; } }
    class FC { constructor() { this.state = 'running'; } createAnalyser() { return new FA(); } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
    window.AudioContext = FC;
    class FR { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; } start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); } stop() { setTimeout(() => this.onstop?.(), 20); } }
    window.MediaRecorder = FR;
  });
  await p2.goto(`${BASE}/app`);
  await p2.waitForSelector('.session-cta', { timeout: 15000 });
  await p2.click('.session-cta');
  await p2.waitForSelector('.ss-story', { timeout: 10000 });
  await p2.click('.ss-nav .start-drill-btn');
  await p2.waitForSelector('.speaking-practice', { timeout: 8000 });
  await p2.click('.ss-screen .mic');
  await p2.waitForSelector('.speaking-practice .score', { timeout: 20000 });
  check('0점 발화에도 점수 판정이 뜬다', await p2.evaluate(() => document.querySelector('.score')?.getAttribute('data-tier') === 'low'));
  await p2.close();
}

await browser.close();
finish();
