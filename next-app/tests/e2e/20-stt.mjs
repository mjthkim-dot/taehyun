/**
 * 음성 인식(Whisper) 경로 — 브라우저 내장 인식 대신 녹음→서버 변환을 쓴다.
 *
 * 계약: ① 마이크가 되면 Whisper로 인식해 채점까지 이어진다
 *       ② 인식 힌트로 연습 문장이 함께 전송된다
 *       ③ 마이크가 거부되면 조용히 브라우저 내장 인식으로 물러난다(학습이 멈추지 않음)
 * 실제 마이크는 헤드리스에 없으므로 MediaRecorder/getUserMedia를 스텁으로 대체한다.
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

/** 말소리가 있는 것처럼 보이게 하는 마이크 스텁 — 무음 감지가 즉시 끝나도록 짧게 잡는다. */
const MIC_STUB = () => {
  // getUserMedia: 트랙 하나짜리 가짜 스트림
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({
    getTracks: () => [{ stop() {} }],
  });
  // AudioContext: 처음 0.5초만 '소리 있음' → 그 뒤 무음.
  // 계속 소리가 나면 무음 감지가 끝나지 않아 30초 상한까지 녹음된다(실제 발화와 동일하게 재현).
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
  // MediaRecorder: start 직후 데이터를 흘리고, stop되면 onstop을 부른다
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

const browser = await launch();

/* ── ① Whisper 경로: 인식 → 채점 ── */
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));

let sttCalls = 0;
let sentPrompt = '';
// 인식 결과는 '지금 화면에 표시된 연습 구간'을 그대로 돌려준다 —
// 그래야 채점까지 이어지는지(점수 렌더)를 검증할 수 있다.
let sttReply = '';
await page.route('**/app/api/stt', async (route) => {
  sttCalls++;
  sentPrompt = route.request().postData() || '';
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: sttReply }) });
});
await seedKey(page);
await page.addInitScript(MIC_STUB);

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
// 미션의 빌드업 말하기 — SpeakingPractice가 쓰이는 대표 지점
await page.waitForSelector('.mission-practice .mic', { timeout: 10000 });
const target = await page.evaluate(() => document.querySelector('.mission-practice .target')?.textContent?.trim() || '');
sttReply = target;
await page.click('.mission-practice .mic');
await page.waitForFunction((t) => (document.querySelector('.transcript p')?.textContent || '').includes(t.slice(0, 10)), target, { timeout: 15000 });

check('Whisper 경로로 인식 호출', sttCalls === 1, String(sttCalls));
check('인식 결과가 발화로 반영', (await page.evaluate(() => document.querySelector('.transcript p')?.textContent || '')).includes(target.slice(0, 12)));
check('인식 힌트로 연습 문장 전송', sentPrompt.includes(target.slice(0, 12)), target.slice(0, 24));
check('오디오가 실제로 전송됨', sentPrompt.includes('speech.webm'));
await page.waitForSelector('.score', { timeout: 10000 });
check('인식 결과로 채점까지 이어짐', /정확도 \d+점/.test(await page.evaluate(() => document.querySelector('.score')?.textContent || '')));

/* ── 말하는 동안 화면이 비어 있지 않아야 한다 ──
 * Whisper는 녹음이 끝나야 텍스트를 준다. 그 사이 자막 칸이 비어 있으면 사용자에게는
 * 인식이 죽은 것으로 보인다(실제로 "작동을 안 한다"는 신고의 원인). 브라우저 내장
 * 인식을 미리보기로 나란히 돌려 말하는 중에도 글자가 흐르게 했다. */
const preview = await browser.newPage();
preview.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await preview.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await preview.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
// 변환은 일부러 늦춘다 — 녹음 중 화면 상태를 관찰할 시간을 만든다
await preview.route('**/app/api/stt', async (route) => {
  await new Promise((r) => setTimeout(r, 2500));
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Final whisper text.' }) });
});
await seedKey(preview);
await preview.addInitScript(MIC_STUB);
await preview.addInitScript(() => {
  // 내장 인식 미리보기 스텁 — 중간 결과를 흘려보낸다
  class PreviewSR {
    start() {
      setTimeout(() => {
        const mk = (t, fin) => ({ 0: { transcript: t }, isFinal: fin, length: 1 });
        this.onresult?.({ resultIndex: 0, results: Object.assign([mk('I work with', false)], { length: 1 }) });
      }, 120);
    }
    abort() {}
    stop() {}
  }
  window.SpeechRecognition = PreviewSR;
  window.webkitSpeechRecognition = PreviewSR;
});
await preview.goto(`${BASE}/app`);
await preview.waitForSelector('.mission-practice .mic', { timeout: 15000 });
await preview.click('.mission-practice .mic');

// 녹음이 시작되자마자 자막 칸이 살아 있어야 한다
await preview.waitForSelector('.transcript.live', { timeout: 8000 });
const during = await preview.evaluate(() => ({
  label: document.querySelector('.transcript.live .label')?.textContent?.trim() || '',
  text: document.querySelector('.transcript.live p')?.textContent?.trim() || '',
}));
check('말하는 중 자막 칸이 살아 있음', !!during.label, JSON.stringify(during));
check('말하는 중 안내나 실시간 글자가 보임', during.text.length > 0, JSON.stringify(during));

// 미리보기 자막이 실제로 흐르는지
let previewShown = true;
try {
  await preview.waitForFunction(() => (document.querySelector('.transcript p')?.textContent || '').includes('I work with'), null, { timeout: 8000 });
} catch {
  previewShown = false;
}
check(
  '내장 인식 미리보기가 실시간으로 표시됨',
  previewShown,
  await preview.evaluate(() => document.querySelector('.transcript p')?.textContent || '')
);

// 변환 대기 중에도 빈 화면이 아니어야 한다
await preview.waitForFunction(() => (document.querySelector('.transcript .label')?.textContent || '').includes('인식 중'), null, { timeout: 15000 });
check('변환 대기 중 상태가 드러남', true);

// 최종 판정은 Whisper 결과 — 미리보기가 채점을 오염시키면 안 된다
await preview.waitForFunction(() => (document.querySelector('.transcript p')?.textContent || '').includes('Final whisper text'), null, { timeout: 15000 });
check('최종 텍스트는 Whisper 결과', true);
await preview.close();

/* ── ② 마이크 거부 시 브라우저 내장 인식으로 폴백 ── */
const fb = await browser.newPage();
fb.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await fb.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await fb.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
let fbSttCalls = 0;
await fb.route('**/app/api/stt', (r) => {
  fbSttCalls++;
  return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
});
await seedKey(fb);
await fb.addInitScript(() => {
  // 마이크 권한 거부 재현
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => {
    throw new DOMException('Permission denied', 'NotAllowedError');
  };
  window.MediaRecorder = class {
    static isTypeSupported() { return true; }
  };
  // 브라우저 내장 인식 스텁 — 폴백이 실제로 작동하는지 본다
  class FakeSR {
    start() {
      setTimeout(() => {
        const results = [{ 0: { transcript: 'Fallback recognition works.' }, isFinal: true, length: 1 }];
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
await fb.waitForFunction(() => (document.querySelector('.transcript p')?.textContent || '').includes('Fallback'), { timeout: 15000 });
check('마이크 거부 시 서버를 부르지 않음', fbSttCalls === 0, String(fbSttCalls));
check('브라우저 내장 인식으로 폴백', (await fb.evaluate(() => document.querySelector('.transcript p')?.textContent || '')).includes('Fallback recognition'));
check('폴백 후에도 마이크 버튼 사용 가능', await fb.evaluate(() => document.querySelector('.mission-practice .mic')?.disabled === false));

/* ── ③ 회화 연속 대화(보이스 모드)도 Whisper로 한 턴을 돈다 ── */
const talk = await browser.newPage();
talk.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await talk.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await talk.route('**/app/api/groq', (r) => {
  const b = JSON.parse(r.request().postData() || '{}');
  if (b.stream) {
    return r.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"choices":[{"delta":{"content":"Good to hear that."}}]}\n\ndata: [DONE]\n\n' });
  }
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
});
await talk.route('**/app/api/tts', (r) => r.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.alloc(2048) }));
let talkStt = 0;
await talk.route('**/app/api/stt', (r) => {
  talkStt++;
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'I had a busy week at work.' }) });
});
await seedKey(talk);
await talk.addInitScript(MIC_STUB);
// 브라우저 내장 인식은 없는 기기를 가정 — Whisper만으로 동작해야 한다
await talk.addInitScript(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});

await talk.goto(`${BASE}/app`);
await talk.waitForSelector('.mission-card', { timeout: 15000 });
await talk.click('.mode-tab:has-text("회화")');
await talk.waitForSelector('.controls .round-btn:not(.send)', { timeout: 10000 });
check('내장 인식이 없어도 마이크 사용 가능', await talk.evaluate(() => document.querySelector('.controls .round-btn:not(.send)')?.disabled === false));

await talk.click('.controls .round-btn:not(.send)'); // 보이스 오버레이 진입
await talk.waitForSelector('.vo-orb', { timeout: 10000 });
await talk.waitForFunction(() => document.querySelectorAll('.msg.user').length > 0, { timeout: 20000 });
check('Whisper 인식으로 자동 전송', talkStt >= 1, String(talkStt));
check('말한 내용이 대화에 반영', (await talk.evaluate(() => document.querySelector('.msg.user .bubble')?.textContent || '')).includes('busy week'));
await talk.waitForFunction(() => (document.body.textContent || '').includes('Good to hear'), { timeout: 20000 });
check('AI 응답까지 이어짐', (await talk.evaluate(() => document.body.textContent || '')).includes('Good to hear'));

/* ── ④ 회귀 방지: suspended AudioContext + iOS(mp4) 녹음 ──
   실기기에서 '눌러도 아무 일도 안 일어나던' 결함의 원인 두 가지를 고정한다.
   ① AudioContext가 suspended면 레벨이 전부 0이라 무음으로 오판했다
   ② 파일명을 항상 speech.webm으로 보내 iOS(mp4) 녹음의 포맷을 속였다 */
const ios = await browser.newPage();
ios.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await ios.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await ios.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
let iosCalls = 0;
let iosBody = '';
let resumed = false;
await ios.route('**/app/api/stt', (r) => {
  iosCalls++;
  iosBody = r.request().postData() || '';
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Recognized on iOS.' }) });
});
await seedKey(ios);
await ios.addInitScript(() => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  window.__resumed = false;
  class Analyser {
    constructor(ctx) { this.fftSize = 1024; this.ctx = ctx; }
    // suspended면 무음, resume 이후에만 실제 소리가 잡힌다(실기기 동작 재현)
    getFloatTimeDomainData(buf) {
      const loud = this.ctx.state === 'running' && Date.now() - this.ctx.t0 < 600;
      for (let i = 0; i < buf.length; i++) buf[i] = loud ? 0.4 : 0;
    }
  }
  class SuspendedCtx {
    constructor() { this.state = 'suspended'; this.t0 = Date.now(); }
    createAnalyser() { return new Analyser(this); }
    createMediaStreamSource() { return { connect() {} }; }
    resume() { this.state = 'running'; this.t0 = Date.now(); window.__resumed = true; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  window.AudioContext = SuspendedCtx;
  class Rec {
    constructor() { this.mimeType = 'audio/mp4'; } // iOS Safari
    static isTypeSupported(t) { return t === 'audio/mp4'; }
    start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(8192)], { type: 'audio/mp4' }) }), 20); }
    stop() { setTimeout(() => this.onstop?.(), 20); }
  }
  window.MediaRecorder = Rec;
});

await ios.goto(`${BASE}/app`);
await ios.waitForSelector('.mission-practice .mic', { timeout: 15000 });
await ios.click('.mission-practice .mic');
await ios.waitForFunction(() => (document.querySelector('.transcript p')?.textContent || '').includes('Recognized'), { timeout: 20000 });
resumed = await ios.evaluate(() => window.__resumed === true);
check('suspended 컨텍스트를 깨운다(resume 호출)', resumed);
check('suspended 상태여도 서버로 전송된다', iosCalls === 1, String(iosCalls));
check('iOS 녹음은 mp4 확장자로 전송', iosBody.includes('speech.mp4'), iosBody.slice(0, 0) || 'filename 확인');
check('webm으로 속이지 않음', !iosBody.includes('speech.webm'));

/* ── ⑤ 인식 결과가 비면 포기하지 않고 브라우저 인식으로 한 번 더 시도한다 ── */
const empty = await browser.newPage();
empty.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await empty.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await empty.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await empty.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: '' }) }));
await seedKey(empty);
await empty.addInitScript(MIC_STUB);
await empty.addInitScript(() => {
  class FakeSR {
    start() {
      setTimeout(() => {
        const results = [{ 0: { transcript: 'Second attempt worked.' }, isFinal: true, length: 1 }];
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
await empty.goto(`${BASE}/app`);
await empty.waitForSelector('.mission-practice .mic', { timeout: 15000 });
await empty.click('.mission-practice .mic');
await empty.waitForFunction(() => (document.querySelector('.transcript p')?.textContent || '').includes('Second attempt'), { timeout: 20000 });
check('빈 결과면 브라우저 인식으로 재시도', (await empty.evaluate(() => document.querySelector('.transcript p')?.textContent || '')).includes('Second attempt'));

/* ── ⑥ 마이크에 소리가 전혀 없으면 원인을 안내한다(조용히 실패하지 않음) ── */
const quiet = await browser.newPage();
quiet.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await quiet.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await quiet.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
let quietCalls = 0;
await quiet.route('**/app/api/stt', (r) => {
  quietCalls++;
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: '' }) });
});
await seedKey(quiet);
await quiet.addInitScript(() => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class Analyser {
    constructor() { this.fftSize = 1024; }
    getFloatTimeDomainData(buf) { buf.fill(0); } // 완전 무음(마이크 음소거 등)
  }
  class Ctx {
    constructor() { this.state = 'running'; }
    createAnalyser() { return new Analyser(); }
    createMediaStreamSource() { return { connect() {} }; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  window.AudioContext = Ctx;
  class Rec {
    constructor() { this.mimeType = 'audio/webm'; }
    static isTypeSupported() { return true; }
    start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); }
    stop() { setTimeout(() => this.onstop?.(), 20); }
  }
  window.MediaRecorder = Rec;
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});
await quiet.goto(`${BASE}/app`);
await quiet.waitForSelector('.mission-practice .mic', { timeout: 15000 });
await quiet.click('.mission-practice .mic');
await quiet.waitForFunction(() => (document.body.textContent || '').includes('소리가'), { timeout: 20000 });
check('무음이면 원인을 화면에 안내', (await quiet.evaluate(() => document.body.textContent || '')).includes('소리가'));

await browser.close();
finish('20-stt');
