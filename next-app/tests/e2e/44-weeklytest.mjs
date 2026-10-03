/**
 * 주간 말하기 시험(Phase 5) — 측정 리추얼의 계약:
 *   ① 정착 패턴 3개 이상 + 지난 시험 7일 경과일 때만 홈 배너가 뜬다
 *   ② 1분 자유 발화 → 단어·WPM·패턴 사용 감지가 기록된다
 *   ③ 시험 직후에는 배너가 사라진다(7일 뒤 다시)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FakeAnalyser {
    constructor() { this.fftSize = 1024; this.t0 = Date.now(); }
    getFloatTimeDomainData(buf) {
      const loud = Date.now() - this.t0 < 800;
      for (let i = 0; i < buf.length; i++) buf[i] = loud ? 0.5 : 0;
    }
  }
  class FakeCtx {
    constructor() { this.state = 'running'; }
    createAnalyser() { return new FakeAnalyser(); }
    createMediaStreamSource() { return { connect() {} }; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  window.AudioContext = FakeCtx;
  class FakeRecorder {
    constructor() { this.mimeType = 'audio/webm'; }
    static isTypeSupported() { return true; }
    start() {
      setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20);
    }
    stop() { setTimeout(() => this.onstop?.(), 20); }
  }
  window.MediaRecorder = FakeRecorder;
};

const SPEECH =
  "This week I met a new customer. I'd like to schedule a follow-up call. Let me check the numbers and get back to you tomorrow. Overall the pilot went well.";

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: SPEECH }) }));
await seedKey(page);
await page.addInitScript(MIC_STUB);
await page.addInitScript(() => {
  localStorage.setItem('va_maturity_patterns', JSON.stringify(['id-like', 'could-you', 'get-back']));
});

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

/* ── ① 배너 노출 조건 ── */
await page.waitForSelector('.wt-banner', { timeout: 8000 });
check('정착 패턴 3개 + 첫 시험이면 배너가 뜬다', true);

/* ── ② 시험 진행 ── */
await page.click('.wt-banner');
await page.waitForSelector('.wt-pattern', { timeout: 10000 });
check('이번 주 패턴 3개가 제시된다', (await page.locator('.wt-pattern').count()) === 3);
await page.click('button:has-text("시작 — 1분 말하기")');
// 스텁은 0.8초만 말하고 멈추지 않으므로 끝내기로 종료
await page.waitForSelector('button:has-text("끝내기")', { timeout: 8000 });
await page.waitForTimeout(1500);
await page.click('button:has-text("끝내기")');
await page.waitForSelector('.wt-result', { timeout: 20000 });

const res = await page.evaluate(() => ({
  text: document.querySelector('.wt-result')?.innerText || '',
  stored: JSON.parse(localStorage.getItem('va_weekly_tests') || '[]'),
}));
check('단어 수와 WPM이 기록된다', res.stored.length === 1 && res.stored[0].words > 20 && res.stored[0].wpm > 0, JSON.stringify(res.stored[0]));
check('배운 패턴 사용이 감지된다(2개)', res.stored[0].used.length === 2, JSON.stringify(res.stored[0]?.used));
check('결과 화면에 패턴 사용 수가 보인다', res.text.includes('패턴 사용'));
check('첫 기록 안내가 보인다', res.text.includes('첫 기록'));

/* ── ③ 직후에는 배너가 사라진다 ── */
await page.click('button:has-text("홈으로")');
await page.waitForSelector('.session-cta', { timeout: 8000 });
await page.waitForTimeout(400);
check('시험 직후 배너가 사라진다', (await page.locator('.wt-banner').count()) === 0);

await browser.close();
finish();
