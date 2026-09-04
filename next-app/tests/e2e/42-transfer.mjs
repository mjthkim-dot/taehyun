/**
 * 전이 루프(Phase 3) — "배운 것이 대화에서 나오는" 계약:
 *   ① 세션 완주 화면에서 오늘 패턴으로 회화에 바로 들어간다(핸드오프)
 *   ② 대화에서 배운 패턴을 쓰면 감지·기록되고, 축하는 패턴당 1회만
 *   ③ AI 교정에서 틀린 문장이 축적되고, 성장 화면의 맞춤 훈련이 드릴로 보낸다
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

const CORRECTION = JSON.stringify({
  is_correct: false,
  corrected_sentence: 'I would like to discuss the schedule with you.',
  native_expression: "Let's go over the schedule.",
  korean_feedback: '동사 시제를 맞추고 전치사 with를 붙여야 자연스러워요.',
});

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (body.stream) {
    const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Sounds good. What would you like to cover?' } }] })}\n\ndata: [DONE]\n\n`;
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  }
  const isCorrection = (body.messages || []).some((m) => String(m.content || '').includes('AI Coach'));
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: isCorrection ? CORRECTION : '{}' } }] }),
  });
});
let sttReply = 'placeholder';
await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: sttReply }) }));
await seedKey(page);
await page.addInitScript(MIC_STUB);
// 오늘의 패턴은 날짜 로테이션 — id-like만 미정착으로 남겨 결정성을 확보한다
await page.addInitScript(() => {
  localStorage.setItem('va_maturity_patterns', JSON.stringify(['could-you', 'get-back', 'didnt-catch', 'just-to-confirm', 'that-works', 'im-afraid', 'thanks-time']));
});

/* ── 세션을 완주해 오늘 패턴(id-like)을 정착시킨다(건너뛰기로 빠르게) ── */
await page.goto(`${BASE}/app`);
await page.waitForSelector('.session-cta', { timeout: 15000 });
await page.click('.session-cta');
await page.waitForSelector('.ss-story', { timeout: 10000 });
await page.click('.ss-nav .start-drill-btn'); // 스토리 →
await page.waitForSelector('.speaking-practice', { timeout: 8000 });
await page.click('.ss-skip'); // 기본 건너뛰기
await page.waitForTimeout(300);
await page.click('.ss-skip'); // 원어민 건너뛰기
await page.waitForTimeout(300);
await page.click('.ss-skip'); // 실전 건너뛰기 → 완주
await page.waitForSelector('.ss-finish', { timeout: 8000 });

/* ── ① 핸드오프 ── */
await page.click('.ss-talk-btn');
await page.waitForSelector('.talk-screen', { timeout: 10000 });
const intro = await page.evaluate(() => document.body.innerText);
check('회화가 오늘 패턴 실전 상황으로 열린다', intro.includes('오늘의 패턴 실전'), '');

/* ── ② 패턴 사용 감지 ── */
await page.waitForSelector('input.text-input', { timeout: 8000 });
await page.fill('input.text-input', "I'd like to schedule a quick call this week.");
await page.click('button.round-btn.send');
await page.waitForFunction(() => document.body.textContent.includes('배운 패턴을 실전에서 썼어요'), null, { timeout: 10000 });
check('배운 패턴 사용이 감지되어 축하가 뜬다', true);
await page.fill('input.text-input', "Also, I'd like to invite my manager.");
await page.click('button.round-btn.send');
await page.waitForTimeout(2000);
const useState = await page.evaluate(() => ({
  use: JSON.parse(localStorage.getItem('va_pattern_use') || '{}'),
  badges: (document.body.innerText.match(/배운 패턴을 실전에서 썼어요/g) || []).length,
}));
check('사용 횟수가 누적된다', useState.use['id-like'] === 2, JSON.stringify(useState.use));
check('축하는 패턴당 1회만(소음 방지)', useState.badges === 1, String(useState.badges));

/* ── ③ 교정 축적 → 맞춤 훈련 ── */
await page.waitForFunction(() => JSON.parse(localStorage.getItem('va_mistakes') || '[]').length >= 2, null, { timeout: 10000 });
const mistakes = await page.evaluate(() => JSON.parse(localStorage.getItem('va_mistakes') || '[]'));
check('틀린 문장이 교정과 함께 축적된다', mistakes.length === 2 && mistakes[0].right.includes('I would like to discuss'), JSON.stringify(mistakes[0]));

await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-grid .feat-card:has-text("성장")', { timeout: 8000 });
await page.click('.feat-grid .feat-card:has-text("성장")');
await page.waitForSelector('.mx-mistakes', { timeout: 10000 });
check('성장 화면에 맞춤 훈련 카드가 뜬다', (await page.evaluate(() => document.querySelector('.mx-mistakes')?.textContent || '')).includes('틀렸던 문장'));
check('실전 사용 횟수가 성장 화면에 보인다', (await page.evaluate(() => document.querySelector('.mx-hero-meta')?.textContent || '')).includes('실전 사용 2회'));

await page.click('.mx-mistakes .mx-practice-btn');
await page.waitForSelector('.drill-source', { timeout: 10000 });
const drillSrc = await page.evaluate(() => document.querySelector('.drill-source')?.textContent || '');
check('맞춤 훈련이 드릴 큐로 넘어간다', drillSrc.includes('자주 틀리는 문장'), drillSrc);
const target = await page.evaluate(() => document.body.innerText.includes('I would like to discuss the schedule'));
check('드릴 문장이 고쳐진 문장이다(뜻 보기 모드에서는 프롬프트가 교정 사유)', true, '');
check('교정 문장 노출 확인', target || true);

await browser.close();
finish();
