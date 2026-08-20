/**
 * Workato EAE 면접 프리셋 — 실제 지원 포지션 맞춤 준비의 계약:
 *   ① 프리셋이 최상단에 "내 지원 포지션" 배지로 뜬다
 *   ② 핵심 답변 카드 9장(GitLab 스크립트의 Workato 번역판)이 펼쳐지고
 *      드릴 핸드오프가 동작한다
 *   ③ 면접 시작 시 AI 질문 생성 없이 JD 큐레이션 세트가 즉시 뜬다
 *      (첫 세트 = 풀의 1~5번, 로테이션 인덱스 저장)
 *   ④ JD 컨텍스트가 면접관 반응 프롬프트에 주입된다(후속 질문이 JD 기준)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
let genCalls = 0;
let reactSys = '';
await page.route('**/app/api/groq', (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const sys = String(body.messages?.[0]?.content || '');
  let content = '{}';
  if (sys.includes('면접 질문 5개')) genCalls++;
  else if (sys.includes('짧은 자연스러운 반응')) {
    reactSys = sys;
    content = JSON.stringify({ reaction: 'Thanks for sharing.', followUp: null });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-grid .feat-card:has-text("면접 시뮬레이션")', { timeout: 8000 });
await page.click('.feat-grid .feat-card:has-text("면접 시뮬레이션")');
await page.waitForSelector('.iv-role', { timeout: 10000 });

/* ① 프리셋 — 최상단은 임박한 HR 라운드, 심층은 그 다음 */
const first = await page.evaluate(() => document.querySelector('.iv-role')?.textContent || '');
check('HR 스크리닝 프리셋이 최상단 + 배지', first.includes('HR 스크리닝') && first.includes('월요일 미팅'));
check('기본 선택이 HR 라운드다', await page.evaluate(() => document.querySelector('.iv-role.on')?.textContent.includes('HR')));
// 이 테스트는 심층 프리셋을 검증한다 — 명시적으로 선택
await page.click('.iv-role:has-text("내 지원 포지션")');

/* ② 핵심 답변 카드 */
await page.click('.iv-answers-toggle');
await page.waitForSelector('.pp-sent', { timeout: 8000 });
check('답변 카드 9장이 펼쳐진다', (await page.locator('.study-card .pp-sent').count()) === 9);
check('검증된 서사가 Workato 버전으로 실려 있다', await page.evaluate(() =>
  document.body.innerText.includes('repeatable new-logo engine') && document.body.innerText.includes('quarter-million-dollar commitment')
));
await page.click('button:has-text("핵심 답변으로 드릴")');
await page.waitForSelector('.drill-source', { timeout: 10000 });
check('답변 카드 드릴 핸드오프', (await page.evaluate(() => document.querySelector('.drill-source')?.textContent || '')).includes('Workato EAE'));

/* ③ 큐레이션 질문 세트 */
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-grid .feat-card:has-text("면접 시뮬레이션")', { timeout: 8000 });
await page.click('.feat-grid .feat-card:has-text("면접 시뮬레이션")');
await page.waitForSelector('.iv-role', { timeout: 10000 });
await page.click('.iv-role:has-text("내 지원 포지션")'); // 심층 프리셋(기본은 HR 라운드)
await page.click('button:has-text("면접 시작")');
await page.waitForSelector('.iv-q', { timeout: 10000 });
check('AI 질문 생성 없이 즉시 시작(큐레이션)', genCalls === 0);
check('첫 질문이 JD 세트 1번', await page.evaluate(() => document.querySelector('.iv-q')?.textContent.includes('walk me through your background')));
check('한국어 힌트가 붙는다', await page.evaluate(() => document.body.innerText.includes('이 역할에 맞는 이유')));
check('로테이션 인덱스가 저장된다', await page.evaluate(() => JSON.parse(localStorage.getItem('va_workato_q') || '0') === 5));

/* ④ JD 컨텍스트 주입 */
await page.fill('.iv-answer', 'I have been selling cloud solutions for over four years and closed six-figure deals.');
await page.click('button:has-text("답변 제출")');
await page.waitForSelector('button:has-text("다음 질문")', { timeout: 15000 }); // 전달력 체크포인트(v1.17)
await page.click('button:has-text("다음 질문")');
await page.waitForFunction(() => document.body.innerText.includes('질문 2/5'), null, { timeout: 15000 });
check('JD 요약이 반응 프롬프트에 주입된다', reactSys.includes('Workato Enterprise Account Executive') && reactSys.includes('$100K'), reactSys.slice(0, 80));

await browser.close();
finish();
