/**
 * 오늘의 세션 + 탭-뜻보기 — "막막함·단편성·모르는 단어" 개선의 계약:
 *   ① 홈의 주인공은 "오늘 세션 시작" 버튼 — 오늘의 패턴이 미리 보인다
 *   ② 세션은 복습→배우기(스토리)→말하기 2단→실전 리콜로 자동으로 이어진다
 *   ③ 스토리는 장면·대화·활용 포인트를 갖춘다(단편적 카드가 아니다)
 *   ④ 완주하면 패턴 정착 + 사다리 완주 + 오늘 세션 완료가 기록되고
 *      홈 버튼이 완주 상태로 바뀐다
 *   ⑤ 회화 말풍선의 단어를 탭하면 문맥 속 한국어 뜻이 바로 뜬다(캐시 재사용)
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

const WARMUP_EN = 'Let me check and get back to you.';
// 1단계 첫 미정착 패턴은 id-like — 그 스토리의 기본 문장
const BASIC_EN = 'I want to schedule a call.';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) })
);
let sttReply = WARMUP_EN;
await page.route('**/app/api/stt', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: sttReply }) })
);
await seedKey(page);
await page.addInitScript(MIC_STUB);
await page.addInitScript((en) => {
  localStorage.setItem('va_weak', JSON.stringify([{ en, kr: '확인하고 다시 연락드릴게요.', box: 1, lapses: 0, due: 0 }]));
}, WARMUP_EN);

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

/* ── ① 홈의 주인공 버튼 ── */
await page.waitForSelector('.session-cta', { timeout: 8000 });
const cta = await page.evaluate(() => document.querySelector('.session-cta')?.innerText || '');
check('홈에 오늘 세션 버튼이 있다', cta.includes('오늘 세션 시작'), cta.replace(/\n/g, ' '));
check('오늘의 패턴이 미리 보인다', cta.includes("I'd like to"), cta.replace(/\n/g, ' '));

/* ── ② 세션 흐름: 워밍업 ── */
await page.click('.session-cta');
await page.waitForSelector('.ss-phases', { timeout: 10000 });
check('진행 스트립이 복습 단계를 가리킨다', (await page.evaluate(() => document.querySelector('.ss-phase.now')?.textContent)) === '복습');
check('말하기 전에는 다음 버튼이 잠긴다', await page.evaluate(() => document.querySelector('.ss-nav .start-drill-btn')?.disabled === true));
await page.click('.ss-screen .mic');
await page.waitForSelector('.speaking-practice .score', { timeout: 20000 });
await page.click('.ss-nav .start-drill-btn');

/* ── ③ 스토리: 장면·대화·활용 포인트 ── */
await page.waitForSelector('.ss-story', { timeout: 8000 });
const story = await page.evaluate(() => ({
  pattern: document.querySelector('.ss-pattern-name')?.textContent || '',
  scene: (document.querySelector('.ss-scene')?.textContent || '').length,
  lines: document.querySelectorAll('.ss-line').length,
  marked: document.querySelectorAll('.ss-line.mark').length,
  how: (document.querySelector('.ss-how')?.textContent || '').length,
}));
check('오늘의 패턴이 크게 보인다', story.pattern.includes("I'd like to"), story.pattern);
check('장면 설명이 있다', story.scene > 10);
check('미니 대화 3턴이 있다', story.lines === 3, String(story.lines));
check('패턴이 쓰인 줄이 강조된다', story.marked === 1, String(story.marked));
check('활용 포인트 설명이 있다', story.how > 30);
await page.click('.ss-nav .start-drill-btn');

/* ── 말하기 ①(기본) → 말하기 ②(건너뛰기) → 실전 ── */
await page.waitForSelector('.speaking-practice', { timeout: 8000 });
sttReply = BASIC_EN;
await page.click('.ss-screen .mic');
await page.waitForSelector('.speaking-practice .score', { timeout: 20000 });
await page.click('.ss-nav .start-drill-btn');
await page.waitForFunction(() => document.body.textContent.includes('원어민처럼'), null, { timeout: 8000 });
await page.click('.ss-skip');
await page.waitForFunction(() => document.body.textContent.includes('실전'), null, { timeout: 8000 });
check('실전 리콜은 상황만 보여준다(정답 숨김)', await page.evaluate(() => !document.body.textContent.includes("I'd like to schedule a quick call")), '');
await page.click('.ss-skip');

/* ── ④ 완주 기록 ── */
await page.waitForSelector('.ss-finish', { timeout: 8000 });
const rec = await page.evaluate(() => ({
  session: JSON.parse(localStorage.getItem('va_session_last') || '""'),
  patterns: JSON.parse(localStorage.getItem('va_maturity_patterns') || '[]'),
  ladders: JSON.parse(localStorage.getItem('va_ladder_done') || '[]').length,
}));
check('오늘 세션 완료가 기록된다', /^\d{4}-\d{2}-\d{2}$/.test(rec.session), rec.session);
check('패턴이 정착으로 기록된다', rec.patterns.includes('id-like'), JSON.stringify(rec.patterns));
check('사다리 완주로도 쌓인다', rec.ladders === 1, String(rec.ladders));
await page.click('button:has-text("홈으로")');
await page.waitForSelector('.session-cta.done', { timeout: 8000 });
check('홈 버튼이 완주 상태로 바뀐다', (await page.evaluate(() => document.querySelector('.session-cta')?.innerText || '')).includes('완주'));

/* ── ⑤ 회화 탭-뜻보기 ── */
const page2 = await browser.newPage();
await page2.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
let glossCalls = 0;
await page2.route('**/app/api/groq', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (body.stream) {
    const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: 'We should leverage the pilot results.' } }] })}\n\ndata: [DONE]\n\n`;
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  }
  const isGloss = (body.messages || []).some((m) => String(m.content || '').includes('영어 사전'));
  if (isGloss) {
    glossCalls++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"ko":"활용하다"}' } }] }) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
});
await seedKey(page2);
await page2.goto(`${BASE}/app`);
await page2.waitForTimeout(1000);
await page2.click('.mode-tab:has-text("회화")');
await page2.waitForSelector('input.text-input', { timeout: 8000 });
await page2.fill('input.text-input', 'What should we do next?');
await page2.click('button.round-btn.send');
await page2.waitForSelector('.msg.ai .tap-word', { timeout: 10000 });
await page2.locator('.msg.ai .tap-word', { hasText: 'leverage' }).first().click();
await page2.waitForSelector('.gloss-bar', { timeout: 10000 });
await page2.waitForFunction(() => document.querySelector('.gloss-bar')?.textContent?.includes('활용하다'), null, { timeout: 10000 });
check('단어를 탭하면 문맥 속 뜻이 바로 뜬다', true);
// 캐시 재사용: 닫고 같은 단어를 다시 탭 — AI 재호출이 없어야 한다
await page2.click('.gloss-bar button[aria-label="닫기"]');
const callsBefore = glossCalls;
await page2.locator('.msg.ai .tap-word', { hasText: 'leverage' }).first().click();
await page2.waitForFunction(() => document.querySelector('.gloss-bar')?.textContent?.includes('활용하다'), null, { timeout: 5000 });
check('같은 단어는 캐시에서 즉시 온다', glossCalls === callsBefore, `추가 호출 ${glossCalls - callsBefore}회`);

await browser.close();
finish();
