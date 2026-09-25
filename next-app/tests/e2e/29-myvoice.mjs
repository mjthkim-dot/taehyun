/**
 * 내 발음 다시 듣기 — 녹음을 버리지 않고 원어민 음성과 번갈아 듣게 한다.
 *
 * 배경: Whisper 인식을 위해 이미 녹음하고 있었는데 텍스트만 뽑고 blob은 그대로
 * 버렸다. 발음 교정에서 가장 확실한 것은 자기 소리를 듣는 것이라, 그 소리를 살렸다.
 * 계약:
 *   ① 인식이 끝나면 '내 발음' 재생이 생긴다
 *   ② 실제로 녹음된 소리가 재생된다(blob: URL) — 원어민 음성 재생과 구분된다
 *   ③ 녹음이 없으면(마이크 거부·내장 인식 폴백) 비교 줄 자체를 그리지 않는다 —
 *      눌리지 않는 버튼은 고장으로 보인다
 *   ④ 다음 문장으로 넘어가면 이전 녹음의 객체 URL을 해제한다(반복 연습에서의 누수)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

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
    resume() { this.state = 'running'; return Promise.resolve(); }
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

/** 객체 URL 생성·해제를 세어 누수를 잡는다 */
const URL_SPY = () => {
  window.__made = [];
  window.__freed = [];
  const mk = URL.createObjectURL.bind(URL);
  const rm = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (b) => {
    const u = mk(b);
    window.__made.push(u);
    return u;
  };
  URL.revokeObjectURL = (u) => {
    window.__freed.push(u);
    return rm(u);
  };
  // 어떤 소리가 재생됐는지 기록 — 원어민(음성합성/프록시)과 내 녹음(blob:)을 구분한다
  window.__played = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__played.push(this.src || '');
    return Promise.resolve();
  };
};

const browser = await launch();

/* ── ①②④ 녹음이 있을 때 ── */
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'I work with three vendors.' }) }));
await seedKey(page);
await page.addInitScript(MIC_STUB);
await page.addInitScript(URL_SPY);
await page.addInitScript(() => {
  localStorage.setItem(
    'va_drill_queue',
    JSON.stringify({
      label: '녹음 비교 점검',
      items: [
        { en: 'I work with three vendors.', kr: '저는 세 곳의 벤더와 일합니다.' },
        { en: 'We ship updates every two weeks.', kr: '저희는 2주마다 업데이트를 내보냅니다.' },
      ],
    })
  );
});
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("드릴")');
await page.waitForSelector('.mic', { timeout: 10000 });

// 말하기 전에는 비교할 소리가 없다
check('녹음 전에는 비교 줄이 없음', (await page.locator('.vcmp').count()) === 0);

await page.click('.mic');
await page.waitForSelector('.vcmp', { timeout: 20000 });
const btns = await page.evaluate(() => [...document.querySelectorAll('.vcmp-btn')].map((e) => e.textContent.trim()));
check('인식 후 비교 줄이 생김', btns.length === 2, JSON.stringify(btns));
check('원어민 · 내 발음 두 갈래', btns.some((t) => t.includes('원어민')) && btns.some((t) => t.includes('내 발음')), JSON.stringify(btns));

const made = await page.evaluate(() => window.__made.length);
check('녹음이 재생 가능한 형태로 살아 있음', made >= 1, String(made));

// 실제로 내 녹음이 재생되는지 — blob: URL이어야 원어민 음성과 구분된다
await page.evaluate(() => (window.__played = []));
await page.click('.vcmp-btn:has-text("내 발음")');
await page.waitForTimeout(500);
const played = await page.evaluate(() => window.__played);
check('내 발음 버튼이 녹음된 소리를 재생', played.some((s) => s.startsWith('blob:')), JSON.stringify(played));

/* ── ④ 다음 문장으로 넘어가면 이전 URL을 해제한다 ── */
const before = await page.evaluate(() => window.__freed.length);
await page.click('button:has-text("다음")');
await page.waitForTimeout(600);
const after = await page.evaluate(() => ({ freed: window.__freed.length, vcmp: document.querySelectorAll('.vcmp').length }));
check('문장이 바뀌면 이전 녹음 URL 해제', after.freed > before, `${before} → ${after.freed}`);
check('새 문장에서는 비교 줄이 사라짐', after.vcmp === 0, String(after.vcmp));
await page.close();

/* ── ③ 녹음이 없으면 비교 줄을 그리지 않는다 ── */
const fb = await browser.newPage();
fb.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await fb.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await fb.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await seedKey(fb);
await fb.addInitScript(() => {
  // 마이크 거부 → Whisper 경로가 아예 열리지 않는다
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => {
    throw new DOMException('Permission denied', 'NotAllowedError');
  };
  window.MediaRecorder = class {
    static isTypeSupported() { return true; }
  };
  class FakeSR {
    start() {
      setTimeout(() => {
        const results = [{ 0: { transcript: 'I work with three vendors.' }, isFinal: true, length: 1 }];
        results.length = 1;
        this.onresult?.({ resultIndex: 0, results });
        this.onend?.();
      }, 80);
    }
    stop() { this.onend?.(); }
    abort() {}
  }
  window.SpeechRecognition = FakeSR;
  window.webkitSpeechRecognition = FakeSR;
});
await fb.goto(`${BASE}/app`);
await fb.waitForSelector('.mission-practice .mic', { timeout: 15000 });
await fb.click('.mission-practice .mic');
// 내장 인식은 오디오 blob을 주지 않는다 — 인식·채점은 그대로 되어야 하고,
// 비교할 소리가 없으니 비교 줄은 나오면 안 된다.
await fb.waitForFunction(() => (document.querySelector('.transcript p')?.textContent || '').includes('I work with'), null, { timeout: 20000 });
check('내장 인식 폴백에서도 인식은 된다', true);
check('녹음이 없으면 비교 줄을 그리지 않음', (await fb.locator('.vcmp').count()) === 0);

await browser.close();
finish('29-myvoice');
