/**
 * 발음 진단 — 틀린 단어를 빨갛게 칠하는 데서 멈추지 않고 "무엇으로 들렸고 왜인지"까지.
 *
 * 배경: Whisper로 옮기면서 인식 결과가 **들린 대로** 오게 됐다(브라우저 내장 인식은
 * 문맥으로 단어를 고쳐서 돌려줬다). 그래서 잘못 들린 단어 자체가 진단 자료가 되는데,
 * 그 정보를 그대로 버리고 있었다. 여기서 고정하는 계약:
 *   ① 잘못 들린 단어를 한국어 화자의 전형적 발음 축(R/L·TH…)으로 이름 붙인다
 *   ② 축마다 교정 방법이 함께 나온다(이름만 붙이면 혼자서는 못 고친다)
 *   ③ 축별 횟수가 누적돼 주간 리포트에서 경향으로 읽힌다
 *   ④ 정확히 말한 발화에는 진단이 뜨지 않는다 — 틀린 진단은 없느니만 못하다
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

const TARGET = 'I work with three vendors.';
/** 한국어 화자에게 가장 흔한 두 축을 동시에 재현한다: R→L, TH→T */
const HEARD = 'I walk with tree vendors.';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));

let sttReply = HEARD;
await page.route('**/app/api/stt', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: sttReply }) })
);
await seedKey(page);
await page.addInitScript(MIC_STUB);
// 드릴 큐 핸드오프로 연습 문장을 고정한다 — 문장을 알아야 진단을 검증할 수 있다
await page.addInitScript((en) => {
  localStorage.setItem('va_drill_queue', JSON.stringify({ label: '발음 진단 점검', items: [{ en, kr: '저는 세 곳의 벤더와 일합니다.' }] }));
}, TARGET);

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("드릴")');
await page.waitForSelector('.mic', { timeout: 10000 });

await page.click('.mic');
await page.waitForSelector('.pron-diag', { timeout: 20000 });

const diag = await page.evaluate(() => ({
  chips: [...document.querySelectorAll('.pron-diag .pron-chip')].map((e) => e.textContent.trim()),
  pairs: [...document.querySelectorAll('.pron-pair')].map((e) => e.textContent.trim()),
  tips: [...document.querySelectorAll('.pron-diag .pron-tip')].map((e) => e.textContent.trim()),
  play: document.querySelectorAll('.pron-play').length,
}));

check('발음 진단이 표시됨', diag.chips.length > 0, JSON.stringify(diag.chips));
check('R / L 축을 짚어냄', diag.chips.some((c) => c.includes('R') && c.includes('L')), JSON.stringify(diag.chips));
check('TH 축을 짚어냄', diag.chips.some((c) => c.includes('TH')), JSON.stringify(diag.chips));
check('무엇으로 들렸는지 함께 보여줌', diag.pairs.some((p) => p.includes('work') && p.includes('walk')), JSON.stringify(diag.pairs));
check('축마다 교정 방법이 붙음', diag.tips.length === diag.chips.length && diag.tips.every((t) => t.length > 20), JSON.stringify(diag.tips.map((t) => t.length)));
check('목표 단어를 느리게 들어볼 수 있음', diag.play === diag.chips.length, String(diag.play));
check('마크다운이 새지 않음', !diag.tips.some((t) => t.includes('**') || t.includes('<b>')), JSON.stringify(diag.tips.slice(0, 1)));

/* ── 누적: 축별 횟수가 쌓여야 주간 리포트가 경향으로 읽는다 ── */
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('va_pron') || '[]'));
check('발음 축이 누적 저장됨', stored.length >= 2 && stored.every((r) => r.count > 0 && r.key && r.date), JSON.stringify(stored));
check('축 이름이 R/L과 TH', stored.some((r) => r.key === 'r-l') && stored.some((r) => r.key === 'th'), JSON.stringify(stored.map((r) => r.key)));

/* ── 오탐 방지: 정확히 말하면 진단이 없어야 한다 ── */
sttReply = TARGET;
await page.click('.mic');
await page.waitForFunction(() => /정확도 100점/.test(document.querySelector('.score')?.textContent || ''), null, { timeout: 20000 });
check('정확한 발화에는 진단이 뜨지 않음', (await page.locator('.pron-diag').count()) === 0);

/* ── 주간 리포트로 이어짐 ── */
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("진도")');
await page.waitForSelector('.wr', { timeout: 10000 });
const wr = await page.evaluate(() => {
  const block = [...document.querySelectorAll('.wr-block')].find((b) => (b.querySelector('.wr-block-title')?.textContent || '').includes('발음'));
  if (!block) return null;
  return {
    chips: [...block.querySelectorAll('.pron-chip')].map((e) => e.textContent.trim()),
    counts: [...block.querySelectorAll('.wr-pron-top b')].map((e) => e.textContent.trim()),
    tips: [...block.querySelectorAll('.pron-tip')].map((e) => e.textContent.trim().length),
  };
});
check('주간 리포트에 반복된 발음 블록', !!wr && wr.chips.length >= 2, JSON.stringify(wr));
check('축마다 횟수가 표시됨', !!wr && wr.counts.every((c) => /\d+회/.test(c)), JSON.stringify(wr?.counts));
check('리포트에도 교정 방법이 실림', !!wr && wr.tips.every((n) => n > 20), JSON.stringify(wr?.tips));

/* ── 진단에서 훈련으로 ── 축 이름만 알려주면 혼자서는 못 고친다. 최소대립쌍을
 *    펼쳐 귀로 구분하고, 그 문장들을 그대로 드릴 큐로 넘길 수 있어야 한다. */
const pd = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.pd-toggle')][0];
  if (!btn) return null;
  btn.click();
  return true;
});
check('발음 훈련 통로가 있음', pd === true);
await page.waitForSelector('.pd-body', { timeout: 8000 });
const drill = await page.evaluate(() => ({
  pairs: document.querySelectorAll('.pd-pair').length,
  words: [...document.querySelectorAll('.pd-word')].map((e) => e.textContent.trim()),
  sentences: [...document.querySelectorAll('.pd-sentence')].map((e) => e.textContent.trim()),
  cta: !!document.querySelector('.pd-cta'),
}));
check('최소대립쌍이 펼쳐짐', drill.pairs >= 3, String(drill.pairs));
check('두 단어를 나란히 비교', drill.words.length === drill.pairs * 2, JSON.stringify(drill.words.slice(0, 4)));
check('짝마다 실전 예문이 붙음', drill.sentences.length === drill.pairs, String(drill.sentences.length));
check('리포트에서 드릴로 넘어갈 수 있음', drill.cta);

// 드릴 큐로 실제로 넘어가는지 — 훈련이 말하기로 이어져야 의미가 있다
await page.click('.pd-cta');
await page.waitForSelector('.mic', { timeout: 10000 });
// 큐 핸드오프가 끊기면 버튼만 있고 아무것도 연습되지 않는다.
// 드릴은 기본이 '뜻 보고 말하기'라 영어가 가려지므로 큐 이름과 문항 수로 확인한다.
const queued = await page.evaluate(() => document.body.innerText);
check('훈련 큐로 드릴이 시작됨', queued.includes('발음 훈련'), queued.slice(0, 80).replace(/\n/g, ' '));
check('훈련 문장이 모두 담김', new RegExp(`1 / ${drill.pairs}`).test(queued), String(drill.pairs));

/* ── 역할연습(숙제)도 같은 진단을 받아야 한다 ──
 * 이 화면은 Whisper 이관에서 빠져 브라우저 내장 인식만 쓰고 있었다. 내장 인식은
 * 문맥으로 단어를 고쳐 돌려주기 때문에 발음이 나빠도 점수가 후하게 나온다 —
 * 발음을 보는 화면에서 그건 사실상 채점이 없는 것과 같다. */
const rp = await browser.newPage();
rp.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await rp.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await rp.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
let rpSttCalls = 0;
let rpReply = '';
await rp.route('**/app/api/stt', (route) => {
  rpSttCalls++;
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: rpReply }) });
});
await seedKey(rp);
await rp.addInitScript(MIC_STUB);
await rp.goto(`${BASE}/app`);
await rp.waitForSelector('.mission-card', { timeout: 15000 });
await rp.click('.mode-tab:has-text("더보기")');
await rp.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await rp.click('.more-sheet .feat-card:has-text("기능")');
await rp.waitForSelector('.feat-grid .feat-card:has-text("숙제 도우미")', { timeout: 10000 });
await rp.click('.feat-grid .feat-card:has-text("숙제 도우미")');
await rp.waitForSelector('button:has-text("역할 연습")', { timeout: 10000 });
await rp.click('button:has-text("역할 연습")');
await rp.click('button:has-text("역할 (")');

// 목표 대사를 드러내 읽은 뒤, 한국어 화자의 전형적 오류로 망가뜨려 인식 결과로 돌려준다
await rp.click('button:has-text("정답")');
const line = await rp.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((d) => /^[A-Z][^가-힣]{10,}$/.test((d.textContent || '').trim()) && !d.children.length);
  return el ? el.textContent.trim() : '';
});
check('역할연습 목표 대사를 읽을 수 있음', line.length > 5, line);
rpReply = line.replace(/\bth/gi, 't').replace(/r/g, 'l');

await rp.click('button:has-text("말하기")');
await rp.waitForSelector('.pron-diag', { timeout: 20000 });
const rpDiag = await rp.evaluate(() => ({
  chips: [...document.querySelectorAll('.pron-diag .pron-chip')].map((e) => e.textContent.trim()),
  tips: [...document.querySelectorAll('.pron-diag .pron-tip')].map((e) => e.textContent.trim().length),
}));
check('역할연습이 Whisper로 인식', rpSttCalls >= 1, String(rpSttCalls));
check('역할연습에도 발음 진단이 붙음', rpDiag.chips.length > 0, JSON.stringify(rpDiag.chips));
check('역할연습 진단에도 교정 방법', rpDiag.tips.every((n) => n > 20), JSON.stringify(rpDiag.tips));

await browser.close();
finish('27-pron');
