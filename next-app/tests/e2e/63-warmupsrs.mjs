/**
 * 워밍업 SRS 채점 + 날짜 회전 — "복습 문장이 매일 똑같다" 재발 방지 계약:
 *   ① 워밍업에서 말하고 넘어가면 그 문장의 SRS box가 오르고 due가 미래로
 *      밀린다 → 내일 워밍업에 같은 문장이 다시 오지 않는다
 *   ② 밀린 문장이 여러 개면 날짜 시드 회전으로 고른다 — 항상 같은 첫
 *      2개가 아니다(기대 조합을 같은 공식으로 계산해 비교)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

// 39-session.mjs와 동일한 마이크 스텁(헤드리스에서 녹음 경로를 살린다)
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

const TARGET = 'Could you send the file today?';

const browser = await launch();

/* ── ① 채점 → 간격 전진 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: TARGET }) }));
  await seedKey(page);
  await page.addInitScript(MIC_STUB);
  await page.addInitScript((en) => {
    localStorage.setItem('va_weak', JSON.stringify([{ en, kr: '오늘 파일 보내주시겠어요?', box: 1, lapses: 0, due: 0 }]));
  }, TARGET);
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.session-cta', { timeout: 15000 });
  await page.click('.session-cta');
  await page.waitForSelector('.speaking-practice', { timeout: 10000 });
  check('워밍업에 due 문장이 뜬다', await page.evaluate((en) => document.body.innerText.includes(en), TARGET));
  check('뜻(한국어)이 함께 보인다 — 뜻 모르고 따라 읽기 금지', await page.evaluate(() => document.body.innerText.includes('오늘 파일 보내주시겠어요?')));
  await page.click('.ss-screen .mic');
  await page.waitForSelector('.speaking-practice .score', { timeout: 20000 });
  await page.click('.ss-nav .start-drill-btn'); // 다음 → 이 순간 채점
  const w = await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]')[0]);
  check('말하고 넘어가면 box가 오른다(1→2)', w.box === 2, String(w.box));
  check('due가 미래로 밀린다 — 내일 같은 문장 재등장 없음', w.due > Date.now(), String(w.due));
  await page.close();
}

/* ── ② due 다수 → 날짜 회전 선택 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  await seedKey(page);
  const SENTS = ['Alpha sentence one.', 'Bravo sentence two.', 'Charlie sentence three.', 'Delta sentence four.'];
  await page.addInitScript((sents) => {
    localStorage.setItem('va_weak', JSON.stringify(sents.map((en) => ({ en, kr: '뜻', box: 1, lapses: 0, due: 0 }))));
  }, SENTS);
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.session-cta', { timeout: 15000 });
  await page.click('.session-cta');
  await page.waitForSelector('.speaking-practice', { timeout: 10000 });
  // dueReviews와 같은 공식으로 오늘의 기대 선택을 계산한다(box 동률 → 원래 순서 유지)
  const d = new Date();
  const daySeed = Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`);
  const start = daySeed % SENTS.length;
  const expectedFirst = SENTS[start];
  check('워밍업 1번이 날짜 회전 선택과 일치', await page.evaluate((en) => document.body.innerText.includes(en), expectedFirst), `기대: ${expectedFirst}`);
  await page.close();
}

await browser.close();
finish();
