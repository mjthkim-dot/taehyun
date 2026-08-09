/**
 * 원어민 사다리 — "실제 원어민이 쓰는 표현으로 단계별 성숙"의 계약:
 *   ① 한 문장이 [기본 → 자연스럽게 → 원어민] 3단으로 생성된다
 *   ② 위 단의 문장은 통과 전까지 보이지 않는다 (먼저 읽으면 떠올려 말하기가 안 된다)
 *   ③ 현재 단을 말하기 80점 이상으로 통과해야 다음 단이 열린다 (건너뛰기도 가능)
 *   ④ 완주하면 원어민 단 표현이 표현장·복습 큐(SRS)에 저장된다
 *   ⑤ 같은 문장은 캐시에서 재사용된다 (AI 재호출 없음)
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

const RUNG1 = 'I want to check the schedule with you.';
const RUNG2 = "I'd like to go over the schedule with you.";
const RUNG3 = 'Can we do a quick walkthrough of the timeline?';
const LADDER = JSON.stringify({
  rungs: [
    { level: '기본', en: RUNG1, kr: '일정을 확인하고 싶습니다.', note: '정확하지만 교과서식 표현이에요.' },
    { level: '자연스럽게', en: RUNG2, kr: '일정을 함께 살펴보고 싶어요.', note: "I'd like to와 go over로 훨씬 부드러워졌어요." },
    { level: '원어민', en: RUNG3, kr: '타임라인을 빠르게 훑어볼까요?', note: 'walkthrough라는 원어민 관용 표현을 살렸어요.' },
  ],
});

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
let groqCalls = 0;
await page.route('**/app/api/groq', (route) => {
  groqCalls++;
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: LADDER } }] }) });
});
let sttReply = RUNG1;
await page.route('**/app/api/stt', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: sttReply }) })
);
await seedKey(page);
await page.addInitScript(MIC_STUB);

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-grid .feat-card:has-text("원어민 사다리")', { timeout: 8000 });
await page.click('.feat-grid .feat-card:has-text("원어민 사다리")');
await page.waitForSelector('.ld-seed-input', { timeout: 8000 });

/* ── ① 생성 ── */
await page.fill('.ld-seed-input', '일정을 확인하고 싶다');
await page.click('.ld-gen-btn');
await page.waitForSelector('.ld-rung.active', { timeout: 15000 });
const rungs = await page.evaluate(() => ({
  total: document.querySelectorAll('.ld-rung').length,
  active: document.querySelectorAll('.ld-rung.active').length,
  locked: document.querySelectorAll('.ld-rung.locked').length,
}));
check('3단 사다리가 생성된다', rungs.total === 3, JSON.stringify(rungs));
check('첫 단만 열려 있다', rungs.active === 1 && rungs.locked === 2, JSON.stringify(rungs));

/* ── ② 위 단 문장은 가려져 있다 ── */
const bodyText = await page.evaluate(() => document.body.innerText);
check('기본 단 문장이 보인다', bodyText.includes(RUNG1));
check('원어민 단 문장은 통과 전까지 가려진다', !bodyText.includes(RUNG3));

/* ── ③ 80점 통과 → 다음 단 ── */
check('통과 전에는 다음 단 버튼이 없다', (await page.locator('.ld-next').count()) === 0);
await page.click('.ld-rung.active .mic');
await page.waitForSelector('.ld-next', { timeout: 20000 });
check('80점 이상이면 다음 단 버튼이 열린다', true);
await page.click('.ld-next');
await page.waitForFunction((t) => document.body.innerText.includes(t), RUNG2, { timeout: 8000 });
check('2단(자연스럽게)이 열린다', true);

/* 건너뛰기 → 3단 */
await page.click('.ld-skip');
await page.waitForFunction((t) => document.body.innerText.includes(t), RUNG3, { timeout: 8000 });
check('건너뛰기로도 다음 단에 갈 수 있다', true);

/* ── ④ 3단 통과 → 완주 → 저장 ── */
sttReply = RUNG3;
await page.click('.ld-rung.active .mic');
await page.waitForSelector('.ld-next', { timeout: 20000 });
await page.click('.ld-next');
await page.waitForSelector('.ld-finish', { timeout: 8000 });
const saved = await page.evaluate(() => ({
  phrases: JSON.parse(localStorage.getItem('va_phrases') || '[]').map((p) => p.en),
  weak: JSON.parse(localStorage.getItem('va_weak') || '[]').map((w) => w.en),
  done: JSON.parse(localStorage.getItem('va_ladder_done') || '[]').length,
  cache: Object.keys(JSON.parse(localStorage.getItem('va_ladder_cache') || '{}')).length,
}));
check('완주한 원어민 표현이 표현장에 저장된다', saved.phrases.includes(RUNG3), JSON.stringify(saved.phrases));
check('복습 큐(SRS)에도 들어간다', saved.weak.includes(RUNG3), JSON.stringify(saved.weak));
check('완주 기록이 남는다', saved.done === 1, String(saved.done));

/* ── ⑤ 같은 문장은 캐시 재사용 ── */
const callsBefore = groqCalls;
await page.click('button:has-text("다른 문장 올리기")');
await page.waitForSelector('.ld-seed-input', { timeout: 8000 });
await page.fill('.ld-seed-input', '일정을 확인하고 싶다');
await page.click('.ld-gen-btn');
await page.waitForSelector('.ld-rung.active', { timeout: 8000 });
check('같은 문장은 AI 재호출 없이 캐시에서 온다', groqCalls === callsBefore, `호출 ${groqCalls - callsBefore}회 추가`);

await browser.close();
finish();
