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
// M0 소리 레일에서 고정값을 바꿨다: 예전엔 '연습 문장이 힌트로 전송'을 검증했지만, 목표 문장을
// Whisper 힌트로 주면 전사가 그쪽으로 끌려가 틀리게 말해도 맞게 받아써진다(프롬프트 편향 —
// tests/unit/sttGolden.test.ts가 유/무 FAR 차이를 고정). 채점 경로는 고유명사만 보낸다.
check('인식 힌트에 연습 문장을 넣지 않음(고유명사만)', !sentPrompt.includes(target.slice(0, 12)) && sentPrompt.includes('Nimbus'), target.slice(0, 24));
check('채점 경로는 temperature 0 · 단어 타임스탬프 요청', /name="temperature"\r?\n\r?\n0/.test(sentPrompt) && /name="detail"\r?\n\r?\nwords/.test(sentPrompt));
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

/* ── 모바일에서는 미리보기 인식을 아예 띄우지 않는다 ──
 * Android Chrome에서 SpeechRecognition은 녹음과 같은 마이크를 두고 경합한다 —
 * 인식 서비스가 마이크를 가로채면 녹음이 무음이 되어 "소리가 잡히지 않았어요"로
 * 끝난다(실제 신고의 원인). 폰에서는 마이크 레벨 막대가 그 역할을 대신한다. */
const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mob = await mobileCtx.newPage();
mob.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await mob.addInitScript(() => { localStorage.setItem('va_onboarded', 'true'); localStorage.setItem('va_mode', JSON.stringify('full')); });
await mob.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await mob.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await mob.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Mobile whisper works.' }) }));
await mob.addInitScript(() => localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key')));
await mob.addInitScript(MIC_STUB);
await mob.addInitScript(() => {
  // 미리보기가 시작되면 기록된다 — 모바일에서는 0이어야 한다
  window.__srStarts = 0;
  class SpySR {
    start() { window.__srStarts++; }
    stop() {}
    abort() {}
  }
  window.SpeechRecognition = SpySR;
  window.webkitSpeechRecognition = SpySR;
  // 모바일 환경의 coarse pointer를 강제한다(헤드리스는 fine으로 잡히는 경우가 있다)
  const origMatch = window.matchMedia.bind(window);
  window.matchMedia = (q) => (q.includes('pointer: coarse') ? { matches: true, addEventListener() {}, removeEventListener() {} } : origMatch(q));
});
await mob.goto(`${BASE}/app`);
await mob.waitForSelector('.mission-practice .mic', { timeout: 15000 });
await mob.click('.mission-practice .mic');
await mob.waitForFunction(() => (document.querySelector('.transcript p')?.textContent || '').includes('Mobile whisper works'), null, { timeout: 20000 });
check('모바일에서도 Whisper 인식은 동작', true);
check('모바일에서는 미리보기 인식을 띄우지 않음(마이크 경합 방지)', (await mob.evaluate(() => window.__srStarts)) === 0, String(await mob.evaluate(() => window.__srStarts)));
await mobileCtx.close();

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

/* ── ⑦ M0 소리 레일: verbose_json(words·segments) 응답도 채점까지 이어진다 ──
   채점 경로는 detail=words로 단어 타임스탬프·세그먼트 확신도를 받는다. 응답 모양이 {text}에서
   {text, duration, words, segments}로 바뀌어도 점수가 그대로 렌더돼야 한다. */
const verboseFor = (text) => {
  const toks = text.split(/\s+/).filter(Boolean);
  const words = toks.map((w, i) => ({ word: w, start: 0.3 + i * 0.32, end: 0.3 + i * 0.32 + 0.25 }));
  return {
    text,
    duration: 0.6 + toks.length * 0.32,
    words,
    segments: [{ start: 0, end: 0.6 + toks.length * 0.32, text, avg_logprob: -0.2, no_speech_prob: 0.02, compression_ratio: 1.3 }],
  };
};
const verbose = await browser.newPage();
verbose.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await verbose.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await verbose.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
let verboseTarget = '';
await verbose.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(verboseFor(verboseTarget)) }));
await seedKey(verbose);
await verbose.addInitScript(MIC_STUB);
await verbose.goto(`${BASE}/app`);
await verbose.waitForSelector('.mission-practice .mic', { timeout: 15000 });
verboseTarget = await verbose.evaluate(() => document.querySelector('.mission-practice .target')?.textContent?.trim() || '');
await verbose.click('.mission-practice .mic');
await verbose.waitForSelector('.score', { timeout: 15000 });
check('verbose_json 응답(words·segments)으로도 채점까지 이어짐', /정확도 \d+점/.test(await verbose.evaluate(() => document.querySelector('.score')?.textContent || '')));
await verbose.close();

/* ── ⑧ 품질 게이트: 무음 환각(no_speech_prob 높음)은 채점하지 않고 안내한다 ── */
const halluc = await browser.newPage();
halluc.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await halluc.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await halluc.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
await halluc.route('**/app/api/stt', (r) =>
  r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      text: 'Thank you.',
      duration: 1.1,
      words: [{ word: 'Thank', start: 0.1, end: 0.4 }, { word: 'you.', start: 0.45, end: 0.7 }],
      segments: [{ start: 0, end: 1.1, text: 'Thank you.', avg_logprob: -0.9, no_speech_prob: 0.92, compression_ratio: 1.1 }],
    }),
  })
);
await seedKey(halluc);
await halluc.addInitScript(MIC_STUB);
await halluc.goto(`${BASE}/app`);
await halluc.waitForSelector('.mission-practice .mic', { timeout: 15000 });
await halluc.click('.mission-practice .mic');
await halluc.waitForFunction(() => (document.body.textContent || '').includes('소리가 잘 안 잡혔어요'), null, { timeout: 20000 });
check('무음 환각은 게이트 안내("소리가 잘 안 잡혔어요")', true);
check('무음 환각은 채점하지 않는다(점수 없음)', (await halluc.locator('.score').count()) === 0);
await halluc.close();

/* ── ⑨ 429 Retry-After: 한 번 기다렸다 재시도해 성공한다 ──
   연속 녹음이 Groq 분당 한도(또는 앱 자체 한도)에 닿으면 서버가 429 + Retry-After를 돌려준다.
   클라이언트는 그만큼(≤8초) 기다렸다 **한 번** 다시 보내고, 성공하면 학습이 끊기지 않는다. */
const busy = await browser.newPage();
busy.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await busy.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await busy.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
let busyCalls = 0;
let busyFirstAt = 0;
let busySecondAt = 0;
let busyTarget = '';
await busy.route('**/app/api/stt', (r) => {
  busyCalls++;
  if (busyCalls === 1) {
    busyFirstAt = Date.now();
    return r.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '1' }, body: JSON.stringify({ error: { message: '요청이 너무 잦아요.' } }) });
  }
  busySecondAt = Date.now();
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: busyTarget }) });
});
await seedKey(busy);
await busy.addInitScript(MIC_STUB);
await busy.goto(`${BASE}/app`);
await busy.waitForSelector('.mission-practice .mic', { timeout: 15000 });
busyTarget = await busy.evaluate(() => document.querySelector('.mission-practice .target')?.textContent?.trim() || '');
await busy.click('.mission-practice .mic');
await busy.waitForSelector('.score', { timeout: 20000 });
check('429면 한 번 재시도한다(호출 2회)', busyCalls === 2, String(busyCalls));
check('Retry-After(1초)만큼 기다렸다 재시도', busySecondAt - busyFirstAt >= 900, `${busySecondAt - busyFirstAt}ms`);
check('재시도가 성공하면 채점까지 이어짐', /정확도 \d+점/.test(await busy.evaluate(() => document.querySelector('.score')?.textContent || '')));
await busy.close();

/* ── ⑩ 429가 두 번이면 포기하고 '서버가 바빠요'를 안내한다(무한 대기 없음) ── */
const busy2 = await browser.newPage();
busy2.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await busy2.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await busy2.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
let busy2Calls = 0;
await busy2.route('**/app/api/stt', (r) => {
  busy2Calls++;
  return r.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '1' }, body: JSON.stringify({ error: { message: '요청이 너무 잦아요.' } }) });
});
await seedKey(busy2);
await busy2.addInitScript(MIC_STUB);
await busy2.goto(`${BASE}/app`);
await busy2.waitForSelector('.mission-practice .mic', { timeout: 15000 });
await busy2.click('.mission-practice .mic');
await busy2.waitForFunction(() => (document.body.textContent || '').includes('서버가 바빠요'), null, { timeout: 20000 });
check('429가 두 번이면 "잠시 후 다시(서버가 바빠요)" 안내', true);
check('재시도는 한 번만(호출 2회)', busy2Calls === 2, String(busy2Calls));
await busy2.close();

await browser.close();
finish('20-stt');
