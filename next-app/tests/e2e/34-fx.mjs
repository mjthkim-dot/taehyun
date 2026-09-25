/**
 * 이펙트 키트 — 스픽 벤치마크의 '정답 순간' 연출.
 *
 * 계약:
 *   ① 발화가 80점 이상으로 통과하면 컨페티가 터지고 "+1 문장"이 떠오른다
 *   ② 실패(80점 미만)에는 아무것도 터지지 않는다 — 벌은 조용히
 *   ③ 연속 통과가 콤보로 쌓인다(2연속부터 표시, 실패하면 끊김)
 *   ④ 콤보는 문장이 바뀌어도 이어진다 — 드릴 세션 전체의 연속 통과가 의미다
 *   ⑤ 점수 숫자는 카운트업으로 굴러 올라간다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FakeAnalyser {
    constructor() { this.fftSize = 1024; this.t0 = Date.now(); }
    getFloatTimeDomainData(buf) {
      const loud = Date.now() - this.t0 < 400;
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
    start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); }
    stop() { setTimeout(() => this.onstop?.(), 20); }
  }
  window.MediaRecorder = FakeRecorder;
};

const SENTENCES = [
  { en: 'We can start with a small pilot.', kr: '작은 파일럿부터 시작할 수 있습니다.' },
  { en: 'The migration takes about two weeks.', kr: '마이그레이션은 약 2주 걸립니다.' },
  { en: 'Let me check with the team first.', kr: '먼저 팀과 확인해 보겠습니다.' },
];

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));

// STT 응답을 테스트가 조종한다 — 완벽 발화(통과) 또는 엉뚱한 문장(실패)
let sttReply = SENTENCES[0].en;
await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: sttReply }) }));
await seedKey(page);
await page.addInitScript(MIC_STUB);
await page.addInitScript((items) => {
  localStorage.setItem('va_drill_queue', JSON.stringify({ label: '이펙트 점검', items }));
}, SENTENCES);

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("드릴")');
await page.waitForSelector('.mic', { timeout: 10000 });

/* ── ① 통과: 컨페티 + 플로팅 ── */
await page.click('.mic');
await page.waitForSelector('.score[data-tier="high"]', { timeout: 20000 });
// 컨페티는 1.1초 뒤 사라지므로 등장 직후 바로 확인
const pass1 = await page.evaluate(() => ({
  pieces: document.querySelectorAll('.fx-piece').length,
  float: document.querySelector('.fx-float')?.textContent || '',
  combo: document.querySelector('.fx-combo')?.textContent || '(없음)',
}));
check('통과 시 컨페티가 터진다', pass1.pieces >= 10, String(pass1.pieces));
check('"+1 문장"이 떠오른다', pass1.float.includes('+1'), pass1.float);
check('1회 통과에는 콤보 배지가 없다(2연속부터)', pass1.combo === '(없음)', pass1.combo);

/* ── ⑤ 카운트업이 최종 점수에 도달 ── */
await page.waitForTimeout(800);
const scoreNum = await page.evaluate(() => document.querySelector('.score-num')?.textContent || '');
check('점수가 100에 도달(카운트업 종료)', scoreNum === '100', scoreNum);

/* ── ③④ 다음 문장 통과 → 콤보 2연속 ── */
await page.click('button:has-text("다음")');
// .mic은 이전 문장 것이 계속 보인다 — 새 문장 마운트(이전 점수 사라짐)를 기다려야
// 언마운트 중인 컴포넌트에 녹음이 붙는 경합이 없다
await page.waitForFunction(() => !document.querySelector('.score'), null, { timeout: 10000 });
sttReply = SENTENCES[1].en;
await page.click('.mic');
await page.waitForSelector('.fx-combo', { timeout: 20000 });
const combo2 = await page.evaluate(() => document.querySelector('.fx-combo')?.textContent || '');
check('문장이 바뀌어도 콤보가 이어진다(2연속)', combo2.includes('2연속'), combo2);

/* ── ② 실패: 아무것도 터지지 않고 콤보가 끊긴다 ── */
await page.click('button:has-text("다음")');
await page.waitForFunction(() => !document.querySelector('.score'), null, { timeout: 10000 });
// 목표와 일부만 겹치는 문장 → 저득점(0점이 아니라). 0점이면 점수 UI 자체가
// 렌더되지 않는다(accuracyScore > 0 조건 — 기존 동작).
sttReply = 'Let me buy some coffee now maybe.';
await page.click('.mic');
await page.waitForSelector('.score', { timeout: 20000 });
const fail = await page.evaluate(() => ({
  tier: document.querySelector('.score')?.dataset.tier,
  pieces: document.querySelectorAll('.fx-piece').length,
  float: document.querySelectorAll('.fx-float').length,
  combo: document.querySelectorAll('.fx-combo').length,
}));
check('실패는 low 판정', fail.tier === 'low', fail.tier);
check('실패에는 컨페티가 없다', fail.pieces === 0, String(fail.pieces));
check('실패에는 플로팅이 없다', fail.float === 0);
check('실패로 콤보가 끊긴다', fail.combo === 0);

// 다시 통과해도 콤보는 1부터(배지는 2연속부터라 아직 없음)
await page.evaluate(() => {
  // 같은 문장 재시도
});
sttReply = SENTENCES[2].en;
await page.click('.mic');
await page.waitForSelector('.score[data-tier="high"]', { timeout: 20000 });
const after = await page.evaluate(() => document.querySelectorAll('.fx-combo').length);
check('끊긴 뒤 첫 통과에는 배지가 없다(1부터 다시)', after === 0, String(after));

await browser.close();
finish('34-fx');
