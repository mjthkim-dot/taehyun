/**
 * 면접 아이스브레이킹 오프닝 — "보통 아이스브레이킹부터 시작하는데 너무 본론으로
 * 들어간 거 아니야?"의 답. 실제 인터뷰 가정:
 *   ① 시작하면 본론 질문이 아니라 스몰토크 인사부터 (☕ 인사 나누는 중, 채점 없음)
 *   ② 오프닝 카드엔 한국어 뜻 + 💬 예시 답변 힌트, 가이드 토글은 숨김
 *   ③ 2턴 뒤 전환 멘트("let's dive in")와 함께 질문 1/5로 자연스럽게 본론 진입
 *   ④ 리포트 진입 시 실제 면접관처럼 클로징 멘트가 낭독된다
 *   ⑤ "바로 본론으로 →"를 누르면 스몰토크 없이 즉시 질문 1/5
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const REPORT = JSON.stringify({
  score: 78,
  summary: '자연스러운 시작이었습니다. 본론 답변에 숫자를 더 넣어보세요.',
  strengths: ['자연스러운 스몰토크'],
  improvements: [{ wrong: 'I go there', right: 'I went there.', note: '시제', type: 'tense' }],
  modelAnswers: [{ q: 'Q', en: 'I manage fifty enterprise accounts.', kr: '50개 계정을 담당합니다.' }],
});
const TTS_STUB = () => {
  window.__spoken = [];
  const synth = {
    speaking: false, paused: false, pending: false,
    getVoices: () => [],
    cancel: () => {}, pause: () => {}, resume: () => {},
    speak: (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 30); },
    addEventListener: () => {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' })); // Groq TTS 실패 → 브라우저(스텁) 폴백
await page.route('**/app/api/groq', (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const sys = String(body.messages?.[0]?.content || '');
  let content = '{}';
  if (sys.includes('짧은 자연스러운 반응')) content = JSON.stringify({ reaction: 'Ok, thanks.', followUp: null });
  else if (sys.includes('시니어 면접관')) content = REPORT;
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
await seedKey(page);
await page.addInitScript(TTS_STUB);

async function openInterview() {
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("면접")');
  await page.waitForSelector('.iv-role', { timeout: 10000 });
  await page.click('.iv-mode:has-text("연습 모드")'); // 텍스트 플로우 검증용
  await page.click('button:has-text("면접 시작")');
  await page.waitForSelector('.iv-q', { timeout: 15000 });
}

/* ① 본론이 아니라 인사부터 */
await openInterview();
const t1 = await page.evaluate(() => document.body.innerText);
check('시작하면 스몰토크 단계 표시', t1.includes('인사 나누는 중'));
check('첫 마디가 본론 질문이 아니라 인사', await page.evaluate(() => /hear me okay/i.test(document.querySelector('.iv-q')?.textContent || '')));
check('질문 카운터가 아직 안 뜬다', !t1.includes('질문 1/5'));
await page.waitForFunction(() => (window.__spoken || []).some((s) => /hear me okay/i.test(s)), null, { timeout: 10000 }); // TTS는 Groq 폴백 뒤 비동기
check('인사가 음성으로 낭독된다', true);

/* ② 오프닝 카드 구성 — 한국어 뜻 + 예시 힌트, 가이드 토글은 숨김 */
check('한국어 뜻이 붙는다', await page.evaluate(() => !!document.querySelector('.iv-q-card .pp-sent-kr')));
check('💬 예시 답변 힌트가 있다', t1.includes('💬 예') && t1.includes('looking forward'));
check('오프닝 중엔 답변 가이드 토글이 없다', (await page.locator('.iv-guide-toggle').count()) === 0);
check('바로 본론으로 탈출구가 있다', (await page.locator('.iv-skip-open').count()) === 1);

/* ③ 2턴 스몰토크 → 전환 멘트와 함께 본론 (채점 없음) */
await page.fill('.iv-answer', 'Yes, I can hear you clearly. Thanks for having me!');
await page.click('button:has-text("답변 제출")');
await page.waitForFunction(() => /day going/i.test(document.querySelector('.iv-q')?.textContent || ''), null, { timeout: 10000 });
check('두 번째 스몰토크로 넘어간다', true);
check('스몰토크 답변은 채점하지 않는다(미터 없음)', (await page.locator('.iv-meter-row').count()) === 0);
await page.fill('.iv-answer', "It's going great, thank you!");
await page.click('button:has-text("답변 제출")');
await page.waitForFunction(() => document.body.innerText.includes('질문 1/5'), null, { timeout: 10000 });
check('2턴 뒤 본론 질문 1/5 진입', true);
await page.waitForFunction(() => (window.__spoken || []).some((s) => s.includes("let's dive in")), null, { timeout: 10000 });
check('전환 멘트가 낭독된다', true);

/* ④ 5문항 완주 → 클로징 멘트 낭독 */
for (let i = 1; i <= 5; i++) {
  await page.fill('.iv-answer', `I drove the project number ${i} and it delivered 20 percent growth.`);
  await page.click('button:has-text("답변 제출")');
  await page.waitForSelector('button:has-text("다음 질문")', { timeout: 15000 });
  await page.click('button:has-text("다음 질문")');
  if (i < 5) await page.waitForFunction((n) => document.body.innerText.includes(`질문 ${n}/5`), i + 1, { timeout: 15000 });
}
await page.waitForSelector('.iv-score', { timeout: 20000 });
await page.waitForFunction(() => (window.__spoken || []).some((s) => s.includes("we'll be in touch")), null, { timeout: 10000 });
check('리포트가 뜨면서 클로징 멘트가 낭독된다', true);

/* ⑤ 바로 본론으로 → 스몰토크 스킵 */
await openInterview();
await page.click('.iv-skip-open');
await page.waitForFunction(() => document.body.innerText.includes('질문 1/5'), null, { timeout: 10000 });
check('스킵하면 즉시 질문 1/5', true);

await browser.close();
finish();
