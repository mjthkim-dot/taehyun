/**
 * 면접 전달력 코치(벤치마크: Yoodli WPM·필러, Google Warmup 재답변 루프):
 *   ① 답변 직후 체크포인트 — 단어 수·필러·핵심 포인트(숫자/내 역할/결과) 미터
 *   ② "다시 답하기"로 같은 질문을 재도전(이전 답 폐기)
 *   ③ 리포트에 전달력 종합(평균·필러 총·포인트)과 규칙 기반 팁
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const REPORT = JSON.stringify({
  score: 80,
  summary: '구성은 좋고 필러만 줄이면 됩니다. 꾸준히 연습하세요.',
  strengths: ['숫자 활용'],
  improvements: [{ wrong: 'I go there', right: 'I went there.', note: '시제', type: 'tense' }],
  modelAnswers: [{ q: 'Q', en: 'I manage fifty enterprise accounts.', kr: '50개 계정을 담당합니다.' }],
});

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
await page.route('**/app/api/groq', (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const sys = String(body.messages?.[0]?.content || '');
  let content = '{}';
  if (sys.includes('짧은 자연스러운 반응')) content = JSON.stringify({ reaction: 'Ok, thanks.', followUp: null });
  else if (sys.includes('시니어 면접관')) content = REPORT;
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

/* ① 미터 */
await page.fill('.iv-answer', 'Um you know I led the migration and closed a deal worth $250,000. Um it resulted in a three-year commitment.');
await page.click('button:has-text("답변 제출")');
await page.waitForSelector('.iv-meter-row', { timeout: 15000 });
const meters = await page.evaluate(() => document.body.innerText);
check('필러가 감지된다', /필러 [2-9]회/.test(meters), (meters.match(/필러 \d+회/) || [])[0]);
check('핵심 포인트 3종이 켜진다', meters.includes('숫자 ✓') && meters.includes('내 역할 ✓') && meters.includes('결과 ✓'));
check('단어 수가 보인다', /단어 \d+/.test(meters));

/* ② 다시 답하기 */
await page.click('button:has-text("다시 답하기")');
await page.waitForSelector('.iv-answer', { timeout: 8000 });
check('같은 질문으로 돌아온다', await page.evaluate(() => document.body.innerText.includes('질문 1/5')));
await page.fill('.iv-answer', 'I closed a three-year deal worth two hundred fifty thousand dollars and delivered strong results.');
await page.click('button:has-text("답변 제출")');
await page.waitForSelector('.iv-meter-row', { timeout: 15000 });
check('재답변은 필러 0', await page.evaluate(() => document.body.innerText.includes('필러 0회')));
await page.click('button:has-text("다음 질문")');
await page.waitForFunction(() => document.body.innerText.includes('질문 2/5'), null, { timeout: 15000 });

/* 나머지 4문항 완주 → ③ 리포트 전달력 종합 */
for (let i = 2; i <= 5; i++) {
  await page.fill('.iv-answer', `I drove the project number ${i} and it delivered 20 percent growth.`);
  await page.click('button:has-text("답변 제출")');
  await page.waitForSelector('button:has-text("다음 질문")', { timeout: 15000 });
  await page.click('button:has-text("다음 질문")');
  if (i < 5) await page.waitForFunction((n) => document.body.innerText.includes(`질문 ${n}/5`), i + 1, { timeout: 15000 });
}
await page.waitForSelector('.iv-score', { timeout: 20000 });
const rep = await page.evaluate(() => document.body.innerText);
check('리포트에 전달력 종합이 있다', rep.includes('전달력 종합') && /평균 \d+단어/.test(rep) && /필러 총 \d+회/.test(rep));
check('포인트 집계가 있다', /포인트 \d+\/15/.test(rep));

await browser.close();
finish();
