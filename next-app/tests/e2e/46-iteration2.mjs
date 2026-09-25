/**
 * 이터레이션 2 나머지 — 리콜 러시 · 입 트임 본인 목표 · 교정 유형 태그:
 *   ① 밀린 리콜 2개↑면 성장 화면에 리콜 러시 카드 → 연달아 리콜 → SRS 갱신
 *   ② 지연 데이터 3주↑면 대시보드에 "지난달 -20%" 본인 목표가 뜬다
 *   ③ AI 교정의 error_type이 정규화돼 저장되고 약점 카드에 유형 칩이 뜬다
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

const browser = await launch();

/* ── ① 리콜 러시 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  let sttReply = "I'd like to schedule a quick call this week.";
  await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: sttReply }) }));
  await seedKey(page);
  await page.addInitScript(MIC_STUB);
  await page.addInitScript(() => {
    localStorage.setItem('va_maturity_patterns', JSON.stringify(['id-like', 'could-you']));
    localStorage.setItem('va_pattern_srs', JSON.stringify([
      { key: 'id-like', box: 2, due: Date.now() - 1000 },
      { key: 'could-you', box: 1, due: Date.now() - 2000 },
    ]));
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("성장")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("성장")');
  await page.waitForSelector('.mx-rush', { timeout: 10000 });
  check('밀린 리콜 카드가 성장 화면에 뜬다', (await page.evaluate(() => document.querySelector('.mx-rush')?.textContent || '')).includes('밀린 리콜 2개'));

  await page.click('.mx-rush .mx-practice-btn');
  await page.waitForSelector('.speaking-practice', { timeout: 10000 });
  check('리콜 러시가 시작된다 (1/2)', (await page.evaluate(() => document.body.innerText)).includes('1/2'));

  // 1번째: could-you가 due가 더 오래됨 — 큐는 due 오래된 순. 발화(오답 → 박스 하락 확인용으로 id-like 문장 말함)
  sttReply = 'Could you send me the latest version?';
  await page.click('.mic');
  await page.waitForSelector('.speaking-practice .score', { timeout: 20000 });
  await page.click('.ss-nav .start-drill-btn');
  await page.waitForFunction(() => document.body.textContent.includes('2/2'), null, { timeout: 8000 });
  sttReply = "I'd like to schedule a quick call this week.";
  await page.click('.mic');
  await page.waitForSelector('.speaking-practice .score', { timeout: 20000 });
  await page.click('.ss-nav .start-drill-btn');
  await page.waitForFunction(() => document.body.textContent.includes('리콜 러시 완료'), null, { timeout: 8000 });

  const psrs = await page.evaluate(() => JSON.parse(localStorage.getItem('va_pattern_srs') || '[]'));
  const cy = psrs.find((p) => p.key === 'could-you');
  const il = psrs.find((p) => p.key === 'id-like');
  check('통과한 리콜은 박스가 오른다', cy.box === 2 && il.box === 3, JSON.stringify(psrs));
  check('둘 다 다음 복습이 미래로 잡힌다', cy.due > Date.now() && il.due > Date.now());
  await page.close();
}

/* ── ② 입 트임 본인 목표 + ③ 교정 유형 칩 ── */
{
  const page = await browser.newPage();
  await page.route('**/app/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await seedKey(page);
  await page.addInitScript(() => {
    const now = Date.now();
    const log = [];
    // 4주 전~1주 전: 지연 2000ms대(기준) · 최근 1주: 1200ms대(개선)
    for (let d = 28; d >= 8; d -= 2) {
      for (let i = 0; i < 2; i++) log.push({ t: now - d * 86400000 + i * 60000, en: `b${d}-${i}`, score: 80, latencyMs: 2000 + (i % 2) * 100, src: 'session' });
    }
    for (let d = 6; d >= 0; d -= 2) {
      for (let i = 0; i < 2; i++) log.push({ t: now - d * 86400000 + i * 60000, en: `r${d}-${i}`, score: 85, latencyMs: 1200, src: 'session' });
    }
    localStorage.setItem('va_attempt_log', JSON.stringify(log));
    localStorage.setItem('va_mistakes', JSON.stringify([
      { wrong: 'I go yesterday', right: 'I went yesterday.', note: '시제', t: now - 1000, type: 'tense' },
      { wrong: 'He go there', right: 'He goes there.', note: '시제', t: now - 2000, type: 'tense' },
      { wrong: 'in Monday', right: 'on Monday', note: '전치사', t: now - 3000, type: 'preposition' },
    ]));
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("진도")');
  await page.waitForSelector('.dash-goal', { timeout: 10000 });

  const goal = await page.evaluate(() => document.querySelector('.dash-goal')?.textContent || '');
  // 기준 22개(2000/2100 교차)의 중앙값은 2100 → 목표 1.7초
  check('본인 기준 목표가 뜬다(지난달 -20%)', goal.includes('-20%') && goal.includes('1.7초'), goal);
  check('이번 주 중앙값과 달성 표시', goal.includes('1.2초') && goal.includes('달성'), goal);

  const chips = await page.evaluate(() => [...document.querySelectorAll('.dash-axis-g')].map((e) => e.textContent));
  check('교정 유형 칩이 많은 순으로 뜬다', chips[0]?.includes('시제 ×2') && chips.some((c) => c.includes('전치사 ×1')), JSON.stringify(chips));
  await page.close();
}

await browser.close();
finish();
