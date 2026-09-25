/**
 * 문법 시뮬레이션 — 레벨별 문법 사고를 실전 상황으로:
 *   ① 오늘의 레슨 2단계가 '문법' → 누르면 그 유닛이 바로 열린다(핸드오프)
 *   ② 사고: 한국어식 vs 영어식 사고 + 규칙 + 예문
 *   ③ 판단 3문항(틀리면 이유) → ④ 조립 2문항(오답 조각 포함) → ⑤ 실전 4턴(상대 역할)
 *   ⑥ 자유 작문 AI 채점(모킹) → 결과 점수·틀린 이유 → 진행 저장, 레슨 2단계 자동 완료
 *   ⑦ 허브: 레벨 탭·유닛 목록·점수
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

// 마이크 스텁 — 500ms 동안 소리가 있다가 조용해진다(침묵 감지로 자동 종료)
const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FA { constructor() { this.fftSize = 1024; this.t0 = Date.now(); } getFloatTimeDomainData(b) { const l = Date.now() - this.t0 < 500; for (let i = 0; i < b.length; i++) b[i] = l ? 0.5 : 0; } }
  class FC { constructor() { this.state = 'running'; } createAnalyser() { return new FA(); } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  window.AudioContext = FC;
  class FR { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; } start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); } stop() { setTimeout(() => this.onstop?.(), 20); } }
  window.MediaRecorder = FR;
};

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
const VARIANT = {
  scene: '출장 중 호텔 체크인 문제를 프런트에 설명한다.',
  ex: [['I booked a room last week.', '지난주에 방을 예약했어요.'], ['The system lost my booking.', '시스템이 예약을 잃어버렸어요.']],
  checks: [
    { q: 'I ___ the room on Monday.', opts: ['booked', 'book', 'booking'], a: 0, why: '월요일 = 끝난 일 → 과거형.' },
    { q: 'They ___ my card yesterday.', opts: ['charge', 'charged', 'charging'], a: 1, why: '어제 → 과거형 charged.' },
    { q: 'I ___ an email last night.', opts: ['get', 'getting', 'got'], a: 2, why: 'get의 과거 got.' },
  ],
  builds: [
    { kr: '저는 월요일에 예약했어요.', a: 'I booked it on Monday', extra: ['book'] },
    { kr: '확인 메일을 받았어요.', a: 'I got a confirmation email', extra: ['get'] },
  ],
  sim: {
    who: '호텔 프런트 직원',
    turns: [
      { them: 'When did you make the booking?', kr: '언제 예약하셨어요?', task: 'choose', opts: ['I made it last Monday.', 'I make it last Monday.', 'I making it last Monday.'], a: 0, why: 'make의 과거 made.' },
      { them: 'Did you receive a confirmation?', kr: '확인 메일 받으셨어요?', task: 'build', a: 'Yes I got it last night', extra: ['get'], why: 'get의 과거 got.' },
      { them: 'Did you pay already?', kr: '결제하셨어요?', task: 'choose', opts: ['Yes, I paid online.', 'Yes, I pay online.', 'Yes, I paying online.'], a: 0, why: 'pay의 과거 paid.' },
      { them: 'So what happened?', kr: '그래서 무슨 일이죠?', task: 'free', prompt: '무슨 일이 있었는지 과거 시제로 두 문장 말해 보세요.', model: 'I booked a room, but the system lost my booking.', focus: 'past simple' },
    ],
  },
};
let genCalls = 0;
await page.route('**/app/api/groq', (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const sys = String(body.messages?.[0]?.content || '');
  let content;
  if (sys.includes('문법 교재 작가')) {
    genCalls++;
    content = JSON.stringify(VARIANT);
  } else content = JSON.stringify({ ok: true, corrected: 'The database went down at 3 p.m., and we restarted it at 5.', why: '과거 시제를 정확히 썼어요. went는 go의 불규칙 과거형입니다.' });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
await seedKey(page);
await page.addInitScript(MIC_STUB);
await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'We added more monitoring and we tested the backup.' }) }));
await page.addInitScript(() => {
  if (!localStorage.getItem('va_placed')) localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
  if (!localStorage.getItem('va_program')) localStorage.setItem('va_program', JSON.stringify({ startedAt: new Date().toISOString().slice(0, 10), why: 't', minutes: 25, days: [], manual: {} }));
});
await page.goto(`${BASE}/app`);

/* ① 레슨 2단계 */
await page.waitForSelector('.pg-steps', { timeout: 15000 });
check('레슨 2단계 이름이 문법', await page.evaluate(() => [...document.querySelectorAll('.pg-step-name')].map((e) => e.textContent)[1] === '문법'));
await page.click('.pg-toggle');
await page.click('.pg-block-main:has-text("문법")');
await page.waitForSelector('.gm-think', { timeout: 15000 });
check('A2 학습자의 오늘 문법 = 과거 시제(현재 레벨 첫 유닛)', await page.evaluate(() => document.querySelector('.gm-unit-title')?.textContent.includes('과거 시제')));

/* ② 사고 */
const th = await page.evaluate(() => document.querySelector('.gm-think')?.innerText || '');
check('한국어식 vs 영어식 사고가 나란히', th.includes('한국어식 사고') && th.includes('영어식 사고'));
check('규칙과 예문 2개', (await page.locator('.gm-rule').count()) === 1 && (await page.locator('.gm-ex').count()) === 2);
check('상황이 먼저 제시된다', await page.evaluate(() => document.querySelector('.gm-scene')?.textContent.includes('장애')));
await page.click('button:has-text("판단 연습")');

/* ③ 판단 — 첫 문제는 일부러 틀린다 */
await page.waitForSelector('.gm-opt', { timeout: 5000 });
const opts = await page.$$eval('.gm-opt', (b) => b.map((x) => x.textContent));
const wrongIdx = opts.findIndex((o) => o !== 'restarted');
await page.locator('.gm-opt').nth(wrongIdx).click();
check('틀리면 이유가 나온다', await page.evaluate(() => document.querySelector('.gm-why')?.textContent.includes('과거형')));
await page.click('.gm-go');
async function pickRight() {
  // 정답은 클릭 후 .right로 드러난다 — 다음 문제부턴 첫 보기를 누르고 결과대로 진행
  await page.locator('.gm-opt').first().click();
  await page.click('.gm-go');
}
await pickRight();
await pickRight();

/* ④ 조립 — 정답 단어를 순서대로 */
async function buildAnswer(answer) {
  await page.waitForSelector('.gm-pool', { timeout: 5000 });
  for (const w of answer.split(' ')) {
    await page.locator('.gm-pool .gm-tok:not([disabled])', { hasText: new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click();
  }
  await page.click('.gm-go:has-text("확인")');
}
await buildAnswer('We fixed the service at five');
check('조립 정답이면 초록 슬롯', (await page.locator('.gm-slot.ok').count()) === 1);
await page.click('.gm-go:has-text("다음")');
await buildAnswer("The customer data didn't change");
await page.click('.gm-go:has-text("다음")');

/* ⑤ 실전 */
await page.waitForSelector('.gm-bubble', { timeout: 5000 });
check('상대 역할의 말풍선 + 번역', await page.evaluate(() => document.querySelector('.gm-bubble-en')?.textContent.includes('last Friday') && !!document.querySelector('.gm-bubble-kr')));
check('상대가 명시된다', await page.evaluate(() => document.querySelector('.gm-count')?.textContent.includes('운영 매니저')));
await pickRight();
await buildAnswer('We found it two hours later');
await page.click('.gm-go:has-text("다음")');
await pickRight();

/* ⑥ 말하기(타이핑 없음) */
await page.waitForSelector('.gm-mic', { timeout: 5000 });
check('텍스트 입력칸이 없다', (await page.locator('.gm-free textarea, .gm-free input').count()) === 0);
check('모범 답안 듣기 힌트가 있다', (await page.locator('.gm-hint').count()) === 1);
await page.click('.gm-mic');
await page.waitForSelector('.gm-heard', { timeout: 15000 });
check('말한 문장이 받아쓰기로 보인다', await page.evaluate(() => document.querySelector('.gm-heard')?.textContent.includes('We added more monitoring')));
await page.waitForSelector('.gm-why.ok', { timeout: 10000 });
check('AI가 목표 문법 관점으로 채점', await page.evaluate(() => document.querySelector('.gm-why')?.textContent.includes('과거 시제')));
check('다시 말하기 선택지', (await page.locator('.gm-self button:has-text("다시 말하기")').count()) === 1);
check('말한 문장이 오늘 발화 수로 집계', await page.evaluate(() => (JSON.parse(localStorage.getItem('va_spoken') || '{}').count || 0) >= 1));
await page.click('.gm-self button:has-text("결과 보기")');
await page.waitForSelector('.gm-result', { timeout: 5000 });
const score = await page.evaluate(() => Number(document.querySelector('.gm-score')?.textContent));
check('결과 점수 표시(1문제 일부러 틀림 → 100 미만)', score > 0 && score < 100, String(score));
check('틀린 이유 목록', (await page.locator('.gm-miss li').count()) >= 1);
check('진행 저장', await page.evaluate(() => !!JSON.parse(localStorage.getItem('va_grammar') || '{}')['a2-past']));

/* ⑦ 같은 문법, 새 상황 — 두 번째부터는 AI가 새로 만든다 */
check('첫 회차는 다듬어진 원본(생성 호출 0)', genCalls === 0);
await page.click('.gm-go:has-text("새 상황으로 한 번 더")');
await page.waitForSelector('.gm-think', { timeout: 15000 });
check('두 번째 회차는 새 상황이 생성된다', genCalls === 1 && (await page.evaluate(() => document.querySelector('.gm-scene')?.textContent.includes('호텔'))));
check('새 상황 배지', (await page.locator('.gm-fresh').count()) === 1);
check('문법 설명(규칙)은 그대로', await page.evaluate(() => document.querySelector('.gm-rule')?.textContent.includes('stopped')));
await page.click('button:has-text("판단 연습")');
await page.waitForSelector('.gm-prompt', { timeout: 5000 });
check('판단 문제가 새 문항', await page.evaluate(() => document.querySelector('.gm-prompt')?.textContent.includes('on Monday')));
await page.click('.gm-top .mini-btn');

/* ⑧ 허브 */
await page.waitForSelector('.gm-units', { timeout: 5000 }).catch(async () => {
  await page.click('.gm-go:has-text("문법 목록으로")');
});
await page.waitForSelector('.gm-units', { timeout: 5000 });
check('레벨 탭 5개(A1~C1)', (await page.locator('.gm-lv').count()) === 5);
check('기본 탭 = 현재 레벨 A2', await page.evaluate(() => document.querySelector('.gm-lv.on')?.textContent.startsWith('A2')));
check('과거 시제에 점수 표시', await page.evaluate(() => /\d+점/.test(document.querySelector('.gm-unit')?.textContent || '')));

/* 레슨 2단계 자동 완료 */
await page.click('.mode-tab:has-text("홈")');
await page.waitForSelector('.pg-steps', { timeout: 15000 });
check('레슨 문법 단계가 자동 완료', await page.evaluate(() => document.querySelectorAll('.pg-step')[1]?.classList.contains('done')));

await browser.close();
finish();
