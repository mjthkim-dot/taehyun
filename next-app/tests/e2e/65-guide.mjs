/**
 * 면접 영어 예시 답변 — "영어로 어떻게 말하면 좋은지"의 계약:
 *   ① 기본은 접힘 — 토글로 열면 그대로 읽을 수 있는 영어 답변 + 한국어 대역
 *   ② "답변란에 넣고 고쳐 쓰기"가 실제로 입력란을 채운다
 *   ③ 질문이 바뀌면 접히고, 다음 질문은 다른 예시
 *   ④ 즉석 후속 질문(내장 예시 없음)은 ✨ 버튼으로 내 경력 기반 영어 답변을
 *      AI가 즉석 생성한다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
let reactCalls = 0;
await page.route('**/app/api/groq', (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const sys = String(body.messages?.[0]?.content || '');
  let content = '{}';
  if (sys.includes('짧은 자연스러운 반응')) {
    reactCalls++;
    content = JSON.stringify(
      reactCalls === 1
        ? { reaction: 'Thanks.', followUp: 'What metrics would you track in the first ninety days?' }
        : { reaction: 'Good.', followUp: null }
    );
  } else if (sys.includes('영어 면접 답변 코치')) {
    content = JSON.stringify({
      en: 'I would track first meetings booked, qualified opportunities, and pipeline coverage against quota.',
      kr: '첫 미팅 수, 검증된 기회 수, 쿼터 대비 파이프라인 커버리지를 추적하겠습니다.',
    });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("면접")');
await page.waitForSelector('.iv-role', { timeout: 10000 });
await page.click('.iv-mode:has-text("연습 모드")'); // 텍스트 입력 플로우 검증용(기본은 실전 모드)
await page.click('button:has-text("면접 시작")');
await page.waitForSelector('.iv-q', { timeout: 10000 });

/* ① 접힘 → 영어 예시 */
check('가이드는 기본 접힘', (await page.locator('.iv-guide').count()) === 0);
await page.click('.iv-guide-toggle');
await page.waitForSelector('.iv-sample-en', { timeout: 8000 });
const en1 = await page.evaluate(() => document.querySelector('.iv-sample-en')?.textContent || '');
check('그대로 읽을 수 있는 영어 답변이 있다', /[A-Za-z]{3,}/.test(en1) && !/[가-힣]/.test(en1.replace('🔊', '')), en1.slice(0, 60));
check('한국어 대역이 함께 있다', await page.evaluate(() => /[가-힣]/.test(document.querySelector('.iv-sample-kr')?.textContent || '')));

/* ② 답변란 채우기 */
await page.click('button:has-text("답변란에 넣고 고쳐 쓰기")');
const filled = await page.evaluate(() => document.querySelector('.iv-answer')?.value || '');
check('예시가 답변란에 들어간다', filled.length > 40 && en1.includes(filled.slice(0, 30)), filled.slice(0, 40));

/* ④ 후속 질문 → AI 즉석 답변 */
await page.click('button:has-text("답변 제출")');
await page.waitForFunction(() => document.body.innerText.includes('후속'), null, { timeout: 15000 });
await page.click('.iv-guide-toggle');
await page.waitForSelector('button:has-text("영어 답변 만들어줘")', { timeout: 8000 });
await page.click('button:has-text("영어 답변 만들어줘")');
await page.waitForSelector('.iv-sample-en', { timeout: 15000 });
check('후속 질문에도 AI가 영어 답변을 만든다', await page.evaluate(() => document.querySelector('.iv-sample-en')?.textContent.includes('pipeline coverage')));

/* ③ 다음 질문에서 접힘 + 다른 예시 */
await page.fill('.iv-answer', 'I would track meetings and pipeline coverage.');
await page.click('button:has-text("답변 제출")');
await page.waitForFunction(() => document.body.innerText.includes('질문 2/5'), null, { timeout: 15000 });
check('질문이 바뀌면 가이드는 접힘', (await page.locator('.iv-guide').count()) === 0);
await page.click('.iv-guide-toggle');
await page.waitForSelector('.iv-sample-en', { timeout: 8000 });
const en2 = await page.evaluate(() => document.querySelector('.iv-sample-en')?.textContent || '');
check('다음 질문은 다른 예시', en2 !== en1 && /[A-Za-z]{3,}/.test(en2), en2.slice(0, 50));

await browser.close();
finish();
