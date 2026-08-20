/**
 * 면접 실전 모드(핸즈프리) — "마이크 누르고 제출 누르는 게 무슨 면접이냐"의 답:
 *   ① 마이크 가능하면 실전 모드가 기본 — 시작하면 질문 낭독 후 자동 청취
 *   ② 말이 끝나면(침묵) 버튼 없이 자동 제출 → 반응+다음 질문 자동 낭독 → 자동 청취
 *   ③ ⏹ 답변 끝내기로 즉시 종료 가능, 흐름은 계속 자동
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FA { constructor() { this.fftSize = 1024; this.t0 = Date.now(); } getFloatTimeDomainData(b) { const l = Date.now() - this.t0 < 500; for (let i = 0; i < b.length; i++) b[i] = l ? 0.5 : 0; } }
  class FC { constructor() { this.state = 'running'; } createAnalyser() { return new FA(); } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  window.AudioContext = FC;
  class FR { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; } start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); } stop() { setTimeout(() => this.onstop?.(), 20); } }
  window.MediaRecorder = FR;
};
const TTS_STUB = () => {
  window.__spoken = [];
  const synth = {
    speaking: false, paused: false, pending: false,
    getVoices: () => [],
    cancel: () => {}, pause: () => {}, resume: () => {},
    speak: (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 30); },
    addEventListener: () => {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' })); // Groq TTS 실패 → 브라우저(스텁) 폴백
await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'I manage fifty enterprise accounts and closed a large deal.' }) }));
await page.route('**/app/api/groq', (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const sys = String(body.messages?.[0]?.content || '');
  const content = sys.includes('짧은 자연스러운 반응') ? JSON.stringify({ reaction: 'Great, thank you.', followUp: null }) : '{}';
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
await seedKey(page);
await page.addInitScript(MIC_STUB);
await page.addInitScript(TTS_STUB);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("면접")');
await page.waitForSelector('.iv-role', { timeout: 10000 });

/* ① 실전 모드 기본 + 시작 → 자동 청취 */
check('실전 모드가 기본 선택', await page.evaluate(() => [...document.querySelectorAll('.iv-mode')].find((b) => b.textContent.includes('실전 모드'))?.classList.contains('on')));
await page.click('button:has-text("면접 시작")');
await page.waitForSelector('.iv-live', { timeout: 15000 });
await page.waitForFunction(() => document.body.innerText.includes('듣고 있어요'), null, { timeout: 10000 });
check('질문이 음성으로 낭독된다', await page.evaluate(() => (window.__spoken || []).some((t) => /introduce yourself|background/i.test(t))));
check('낭독 후 자동으로 듣기 시작(버튼 없이)', true);
check('⏹ 답변 끝내기 탈출구가 있다', await page.evaluate(() => document.body.innerText.includes('답변 끝내기')));

/* ② 침묵 → 자동 제출 → 자동으로 다음 질문 + 재청취 (클릭 0회) */
await page.waitForFunction(() => document.body.innerText.includes('질문 2/5'), null, { timeout: 30000 });
check('버튼 없이 자동 제출되고 다음 질문으로 흐른다', true);
check('반응이 다음 질문 앞에 낭독된다', await page.evaluate(() => (window.__spoken || []).some((t) => t.includes('Great, thank you.'))));
await page.waitForFunction(() => document.body.innerText.includes('듣고 있어요'), null, { timeout: 15000 });
check('다음 질문에서도 자동 청취가 이어진다', true);

/* ③ ⏹로 즉시 끝내기 → 그래도 자동으로 흐른다 */
await page.click('button:has-text("답변 끝내기")');
await page.waitForFunction(() => document.body.innerText.includes('질문 3/5'), null, { timeout: 30000 });
check('⏹ 종료 후에도 자동 제출·진행', true);

await browser.close();
finish();
