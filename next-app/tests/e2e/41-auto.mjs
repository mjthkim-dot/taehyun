/**
 * 자동화 훈련(Phase 2) — "입이 얼마나 빨리 떨어지는가"의 계약:
 *   ① 발화 개시 지연(voiceOnset)이 측정돼 점수 옆 배지로 보이고 로그에 남는다
 *   ② 지연은 절대 기준 없이 본인 추이용 — 측정 불가 환경에서는 조용히 생략된다
 *   ③ 세션 원어민 단계는 80점 2연속이어야 다음으로 — 실패하면 연속이 끊긴다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

/** 목소리가 늦게 나오는 마이크 스텁 — 시작 후 600~1100ms 구간만 유성 */
const DELAYED_MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FakeAnalyser {
    constructor() { this.fftSize = 1024; this.t0 = Date.now(); }
    getFloatTimeDomainData(buf) {
      const el = Date.now() - this.t0;
      const loud = el > 600 && el < 1100;
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

/** 즉시 말하는 표준 스텁(2연속 시나리오용) */
const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FakeAnalyser {
    constructor() { this.fftSize = 1024; this.t0 = Date.now(); }
    getFloatTimeDomainData(buf) {
      const loud = Date.now() - this.t0 < 500;
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

const TARGET = 'Could you send the report?';
const NATIVE_EN = "I'd like to schedule a quick call this week.";

const browser = await launch();

/* ── ①② 발화 개시 지연 측정·표시·기록 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: TARGET }) }));
  await seedKey(page);
  await page.addInitScript(DELAYED_MIC_STUB);
  await page.addInitScript((en) => {
    localStorage.setItem('va_drill_queue', JSON.stringify({ label: '자동화 점검', items: [{ en, kr: '보고서를 보내주시겠어요?' }] }));
  }, TARGET);
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("드릴")');
  await page.waitForSelector('.mic', { timeout: 10000 });
  await page.click('.mic');
  await page.waitForSelector('.speaking-practice .score', { timeout: 20000 });

  const badge = await page.evaluate(() => document.querySelector('.lat-badge')?.textContent || '');
  check('개시 지연 배지가 점수 옆에 보인다', /⚡ \d+\.\d초/.test(badge), badge);
  const logged = await page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem('va_attempt_log') || '[]');
    return log[log.length - 1];
  });
  check('지연이 로그에 기록된다(늦게 말한 만큼)', typeof logged.latencyMs === 'number' && logged.latencyMs >= 400 && logged.latencyMs <= 1500, String(logged.latencyMs));
  check('출처가 드릴로 남는다', logged.src === 'drill', logged.src);
  await page.close();
}

/* ── ③ 세션 원어민 단계 2연속 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  let sttReply = 'I want to schedule a call.';
  await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: sttReply }) }));
  await seedKey(page);
  await page.addInitScript(MIC_STUB);
  // 오늘의 패턴은 날짜 로테이션 — id-like만 미정착으로 남겨 결정성 확보
  await page.addInitScript(() => {
    localStorage.setItem('va_maturity_patterns', JSON.stringify(['could-you', 'get-back', 'didnt-catch', 'just-to-confirm', 'that-works', 'im-afraid', 'thanks-time']));
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.session-cta', { timeout: 15000 });
  await page.click('.session-cta');
  await page.waitForSelector('.ss-story', { timeout: 10000 });
  await page.click('.ss-nav .start-drill-btn'); // 스토리 → 말하기 ①(기본)
  await page.waitForSelector('.speaking-practice', { timeout: 8000 });
  await page.click('.ss-screen .mic');
  await page.waitForSelector('.speaking-practice .score', { timeout: 20000 });
  await page.click('.ss-nav .start-drill-btn'); // → 말하기 ②(원어민)
  await page.waitForSelector('.ss-reps', { timeout: 8000 });

  check('원어민 단계에 2연속 표시가 있다', (await page.locator('.ss-reps i').count()) === 2);
  sttReply = NATIVE_EN;
  await page.click('.ss-screen .mic');
  await page.waitForFunction(() => document.querySelectorAll('.ss-reps i.on').length === 1, null, { timeout: 20000 });
  check('1회 통과 후에도 다음은 잠겨 있다', await page.evaluate(() => document.querySelector('.ss-nav .start-drill-btn')?.disabled === true));
  await page.click('.ss-screen .mic'); // 다시 말하기(2연속째)
  await page.waitForFunction(() => document.querySelectorAll('.ss-reps i.on').length === 2, null, { timeout: 20000 });
  check('2연속이면 다음이 열린다', await page.evaluate(() => document.querySelector('.ss-nav .start-drill-btn')?.disabled === false));
  const label = await page.evaluate(() => document.querySelector('.ss-reps-label')?.textContent || '');
  check('2연속 통과가 표시된다', label.includes('2연속 통과'), label);
  await page.close();
}

await browser.close();
finish();
