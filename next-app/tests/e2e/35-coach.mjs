/**
 * AI 발음 코칭(드릴 완료 화면) — "무슨 말인지 못 알아먹겠다" 문제의 가드.
 *
 * 배경: 코칭 프롬프트가 영어 시스템 프롬프트 + 영어 지시였고 모델(llama)이 통째로
 * 영어 팁을 돌려줘, 영어 발음이 어려워서 쓰는 학습자가 영어 설명을 읽어야 하는
 * 모순이 있었다. 응답도 긴 문단 덩어리라 어디를 어떻게 고치라는 건지 안 보였다.
 * 여기서 고정하는 계약:
 *   ① 팁에 한국어가 하나도 없으면 그대로 보여주지 않고 한 번 다시 묻는다(재요청)
 *   ② 재요청까지 실패하면 영어 덩어리 대신 실패 안내를 띄운다
 *   ③ 팁은 카드 구조다 — 문제 소리(영어) + 한국어 설명 + 눌러서 듣는 연습 문장
 *   ④ 요청에는 문장별로 인식되지 않은 단어(missed)가 들어간다 — 구체적 코칭의 재료
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

/** 20-stt와 같은 마이크 스텁 — 헤드리스에는 실제 마이크가 없다. */
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

const TARGET = 'A table for two, please.';
const HEARD = 'A table po tu please.'; // for·two가 인식되지 않은 낮은 점수 발화

// 1차 응답은 영어 팁(재요청을 유발해야 한다), 2차 응답은 한국어 팁 카드
const EN_TIPS = JSON.stringify({
  tips: [{ focus: 'for two', tip: 'Pay attention to linking sounds between words.', example: 'A table for two.' }],
});
const KO_TIPS = JSON.stringify({
  tips: [
    { focus: 'for two', tip: "'포 투'처럼 끊지 말고 '포투'처럼 한 덩어리로 붙여 말해보세요.", example: 'A table for two, please.' },
    { focus: 'two', tip: "혀끝을 윗니 뒤에 대고 't' 소리를 또렷하게 터뜨려 주세요.", example: 'Could I get two menus?' },
  ],
});

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));

const groqBodies = [];
await page.route('**/app/api/groq', (route) => {
  groqBodies.push(route.request().postData() || '');
  const content = groqBodies.length === 1 ? EN_TIPS : KO_TIPS;
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
await page.route('**/app/api/stt', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: HEARD }) })
);
await seedKey(page);
await page.addInitScript(MIC_STUB);
await page.addInitScript((en) => {
  localStorage.setItem('va_drill_queue', JSON.stringify({ label: '코칭 점검', items: [{ en, kr: '두 명 자리 부탁합니다.' }] }));
}, TARGET);

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("드릴")');
await page.waitForSelector('.mic', { timeout: 10000 });

// 낮은 점수로 발화 → 완료 → 마무리 화면
await page.click('.mic');
await page.waitForSelector('.speaking-practice .score', { timeout: 20000 });
await page.click('.drill-nav button:last-child');
await page.waitForSelector('.start-drill-btn', { timeout: 10000 });

const coachBtn = page.locator('button', { hasText: 'AI 발음 코칭 받기' });
check('낮은 점수 문장이 있으면 코칭 버튼이 활성화된다', await coachBtn.isEnabled());

await coachBtn.click();
await page.waitForSelector('.coach-tip', { timeout: 15000 });

// ① 영어 1차 응답을 그대로 보여주지 않고 다시 물었다
check('영어 응답이면 한 번 다시 묻는다(재요청)', groqBodies.length === 2, `호출 ${groqBodies.length}회`);

// ④ 요청에 missed 단어가 들어간다
check('요청에 인식 안 된 단어(missed)가 담긴다', (groqBodies[0] || '').includes('missed'));

// ③ 팁 카드 구조 — 문제 소리 + 한국어 설명 + 듣기 버튼 + 연습 문장 버튼
const tips = await page.evaluate(() => ({
  cards: document.querySelectorAll('.coach-tip').length,
  focus: [...document.querySelectorAll('.coach-focus')].map((e) => e.textContent.trim()),
  bodies: [...document.querySelectorAll('.coach-tip-body')].map((e) => e.textContent.trim()),
  examples: document.querySelectorAll('.coach-example').length,
  listens: document.querySelectorAll('.coach-tip .speak-mini').length,
}));
check('팁이 카드로 나뉘어 표시된다', tips.cards === 2, `${tips.cards}장`);
check('문제가 된 소리가 제목으로 보인다', tips.focus.includes('for two'), JSON.stringify(tips.focus));
check('설명이 전부 한국어다', tips.bodies.every((t) => /[가-힣]/.test(t)), JSON.stringify(tips.bodies));
check('연습 문장을 눌러 들을 수 있다', tips.examples === 2, `${tips.examples}개`);
check('문제 소리도 느리게 들을 수 있다', tips.listens === 2, `${tips.listens}개`);

// ② 두 번 다 영어면 실패 안내 — 새로 그린 페이지에서 두 응답 모두 영어로
const page2 = await browser.newPage();
await page2.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await page2.route('**/app/api/groq', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: EN_TIPS } }] }) })
);
await page2.route('**/app/api/stt', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: HEARD }) })
);
await seedKey(page2);
await page2.addInitScript(MIC_STUB);
await page2.addInitScript((en) => {
  localStorage.setItem('va_drill_queue', JSON.stringify({ label: '코칭 점검', items: [{ en, kr: '두 명 자리 부탁합니다.' }] }));
}, TARGET);
await page2.goto(`${BASE}/app`);
await page2.waitForSelector('.mission-card', { timeout: 15000 });
await page2.click('.mode-tab:has-text("드릴")');
await page2.waitForSelector('.mic', { timeout: 10000 });
await page2.click('.mic');
await page2.waitForSelector('.speaking-practice .score', { timeout: 20000 });
await page2.click('.drill-nav button:last-child');
await page2.waitForSelector('.start-drill-btn', { timeout: 10000 });
await page2.locator('button', { hasText: 'AI 발음 코칭 받기' }).click();
await page2.waitForFunction(() => document.body.textContent.includes('코칭을 만들지 못했어요'), null, { timeout: 15000 });
check('끝까지 영어면 영어 덩어리 대신 실패 안내를 띄운다', true);
check('실패 시 팁 카드는 그리지 않는다', (await page2.locator('.coach-tip').count()) === 0);

await browser.close();
finish();
