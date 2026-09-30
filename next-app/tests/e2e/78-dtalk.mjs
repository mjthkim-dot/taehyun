/**
 * 집중 모드 '회화' = 드라마 인물과 대화하기 — "회화 탭이 드라마와 무관(장애 보고·식당 문장)"의 답:
 *   ① 아직 본 화가 없으면: 1화 보러 가기(업무 미션·키 입력 폼 없음)
 *   ② 본 화가 있으면: 그 화 인물(1화 = Diane)이 그 화 직후 상황에서 말을 건다, 오늘 표현 2개
 *   ③ 목소리로만 대답(텍스트 입력칸 없음), 힌트는 한국어 → 영어 순서로
 *   ④ 5번 대답하면 마무리: 표현을 직접 썼는지, 고쳐 준 문장은 복습 카드로
 *   ⑤ AI가 없으면 그 화 대사를 인물 목소리로 듣고 따라 말하기
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FA { constructor() { this.fftSize = 1024; this.t0 = Date.now(); } getFloatTimeDomainData(b) { const l = Date.now() - this.t0 < 400; for (let i = 0; i < b.length; i++) b[i] = l ? 0.5 : 0; } }
  class FC { constructor() { this.state = 'running'; } createAnalyser() { return new FA(); } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  window.AudioContext = FC;
  class FR { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; } start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); } stop() { setTimeout(() => this.onstop?.(), 20); } }
  window.MediaRecorder = FR;
};

const browser = await launch();

/* ① 본 화 없음 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(() => {
    localStorage.setItem('va_onboarded', 'true');
    localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("회화")');
  await page.waitForSelector('.dr-end-title', { timeout: 15000 });
  check('본 화가 없으면 1화부터 안내', await page.evaluate(() => document.querySelector('.dr-end-title')?.textContent.includes('1화')));
  check('업무 미션·키 입력 폼이 없다', await page.evaluate(() => !document.body.innerText.includes('장애 상황') && !document.querySelector('input[type=password]')));
  await page.click('button:has-text("1화 보러 가기")');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  check('1화가 바로 재생된다', await page.evaluate(() => document.querySelector('.dr-ep')?.textContent.includes('EP 1')));
  await ctx.close();
}

/* ⑤ AI 없음 — 대사 따라 말하기 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('va_onboarded', 'true');
    localStorage.setItem('va_drama', JSON.stringify({ done: { 1: '2026-09-29' }, score: { 1: 80 } }));
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("회화")');
  await page.waitForSelector('.dr-end-title', { timeout: 15000 });
  check('AI가 없으면 연결 안내 + 1화 대사 따라 말하기', await page.evaluate(() => document.body.innerText.includes('AI 연결') && document.body.innerText.includes('EP 1 대사 따라 말하기')));
  check('대사 목록(인물 이름·영어·뜻)', (await page.locator('.dr-learn').count()) >= 4);
  await ctx.close();
}

/* ②~④ AI 대화 */
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.addInitScript(MIC_STUB);
await page.addInitScript(() => {
  localStorage.setItem('va_onboarded', 'true');
  localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
  localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
  if (!localStorage.getItem('va_drama')) localStorage.setItem('va_drama', JSON.stringify({ done: { 1: '2026-09-29' }, score: { 1: 80 } }));
});
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
const SAID = ["It's my first day, so I am nervous.", 'I am work in cloud sales.', 'Thank you so much.', 'Yes, I will hang in there.', 'See you tomorrow.'];
let sttN = 0;
await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: SAID[sttN++ % SAID.length] }) }));
let sysSeen = '';
let talkCalls = 0;
await page.route('**/app/api/groq', (r) => {
  const body = JSON.parse(r.request().postData() || '{}');
  const sys = String(body.messages?.[0]?.content || '');
  let content = '{}';
  if (sys.includes('등장인물') && sys.includes('Taeo')) {
    sysSeen = sys;
    talkCalls++;
    const lastUser = [...body.messages].reverse().find((m) => m.role === 'user')?.content || '';
    content = JSON.stringify({
      reply: talkCalls === 1 ? 'Taeo! The elevator works again. How do you feel?' : 'Great. Tell me more.',
      kr: talkCalls === 1 ? '태오! 엘리베이터 다시 돼요. 기분 어때요?' : '좋아요. 더 말해 줘요.',
      fix: lastUser.includes('I am work') ? { better: 'I work in cloud sales.', kr: '저는 클라우드 영업을 해요.', why: 'be동사와 일반동사를 함께 쓰지 않아요.' } : null,
      hint: { en: "It's my first day.", kr: '오늘이 첫 출근이에요.' },
    });
  }
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mode-tab', { timeout: 15000 });
await page.click('.mode-tab:has-text("회화")');
await page.waitForSelector('.dr-hero-title', { timeout: 15000 });
check('1화 인물 Diane이 대화 상대', await page.evaluate(() => document.querySelector('.dr-hero-title')?.textContent.includes('Diane')));
check('상황 = 1화의 끝(예고)', await page.evaluate(() => !!document.querySelector('.dt-situation')?.textContent.trim()));
check('오늘 써 볼 표현 2개(1화)', await page.evaluate(() => [...document.querySelectorAll('.dr-learn')].map((b) => b.textContent).join('|').includes("It's my first day.")));
await page.click('button:has-text("대화 시작")');
await page.waitForFunction(() => document.body.innerText.includes('The elevator works again'), null, { timeout: 10000 });
check('인물이 먼저 말을 건다(자막 포함)', await page.evaluate(() => document.querySelector('.dr-kr')?.textContent.includes('엘리베이터')));
check('시스템 프롬프트에 인물·레벨·그 화 표현', sysSeen.includes('Diane') && /A1|A2/.test(sysSeen) && sysSeen.includes('Hang in there.'));
check('텍스트 입력칸이 없다(목소리로만)', (await page.locator('.dr-screen input, .dr-screen textarea').count()) === 0);

/* 힌트: 한국어 먼저, 눌러야 영어 */
await page.click('button:has-text("힌트 보기")');
check('힌트는 한국어 먼저', await page.evaluate(() => document.querySelector('.dt-hint')?.textContent.includes('첫 출근') && !document.querySelector('.dt-hint')?.textContent.includes("It's my first day")));
await page.click('.dt-hint .dr-target');
check('한 번 더 누르면 영어 문장', await page.evaluate(() => document.querySelector('.dt-hint')?.textContent.includes("It's my first day")));

for (let t = 1; t <= 5; t++) {
  await page.waitForSelector('.dr-mic:not([disabled])', { timeout: 10000 });
  await page.click('.dr-mic');
  await page.waitForFunction((n) => document.querySelectorAll('.dr-line.me').length >= n, t, { timeout: 15000 });
  await page.waitForFunction((n) => document.querySelectorAll('.dr-line:not(.me)').length >= n + 1, t, { timeout: 15000 });
  if (t === 2) check('틀린 말은 더 자연스러운 문장으로 고쳐 준다', await page.evaluate(() => document.querySelector('.dt-fix')?.textContent.includes('I work in cloud sales.')));
}
check('대답 5/5', await page.evaluate(() => document.querySelector('.dr-ep')?.textContent.includes('5/5')));
check('5번 대답하면 마이크 대신 마무리 버튼', (await page.locator('.dr-mic').count()) === 0);
await page.click('button:has-text("대화 마치기")');
await page.waitForSelector('.dr-end-title', { timeout: 5000 });
check('영어로 5번 말했다', await page.evaluate(() => document.querySelector('.dr-end-title')?.textContent.includes('5번')));
check('그 화 표현을 직접 썼는지 표시', await page.evaluate(() => [...document.querySelectorAll('.dr-note.ok')].some((n) => n.textContent.includes("It's my first day.")) && [...document.querySelectorAll('.dr-note.ok')].some((n) => n.textContent.includes('Hang in there.'))));
check('고쳐 준 문장은 복습 카드로(뜻 포함) → 다음 화 첫머리에', await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]').some((w) => w.en === 'I work in cloud sales.' && w.cat === '드라마' && w.lesson === 'drama:1')));
check('말한 문장 수가 오늘 발화로 집계', await page.evaluate(() => (JSON.parse(localStorage.getItem('va_spoken') || '{}').count || 0) >= 5));

/* 진도 — 집중 모드 퀘스트가 드라마 기준 */
await page.click('.mode-tab:has-text("더보기")');
await page.click('.more-sheet .feat-card:has-text("진도")');
await page.waitForSelector('.quests', { timeout: 15000 });
const q = await page.evaluate(() => [...document.querySelectorAll('.quest-label')].map((e) => e.textContent).join('|'));
check('집중 모드 퀘스트 = 드라마·떠올리기·말하기', q.includes('드라마 한 편') && q.includes('떠올리기') && q.includes('말하기') && !q.includes('미션'), q);
check('말하기 퀘스트 달성(5문장)', await page.evaluate(() => [...document.querySelectorAll('.quest-row.done .quest-label')].some((e) => e.textContent.includes('말하기'))));
check('숨긴 기능 기록(드릴·코스)은 접혀 있다', await page.evaluate(() => !document.body.innerText.includes('드릴 정확도') && document.body.innerText.includes('전체 학습 기록 보기')));
await page.click('button:has-text("전체 학습 기록 보기")');
check('펼치면 전체 기록(레슨 데이터는 이때 받는다)', await page.waitForFunction(() => document.body.innerText.includes('드릴 정확도'), null, { timeout: 15000 }).then(() => true).catch(() => false));

await browser.close();
finish();
