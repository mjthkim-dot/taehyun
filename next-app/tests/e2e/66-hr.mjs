/**
 * Workato HR 스크리닝 프리셋 — 월요일 1차 미팅 대비의 계약:
 *   ① HR 프리셋이 기본 선택(임박 라운드 우선), 시작하면 HR 전용 질문 세트
 *   ② 질문에 영어 예시 답변 + 한국어 대역이 내장돼 있다
 *   ③ 라운드 성격(HR 스크리닝·간결)이 면접관 반응 프롬프트에 주입된다
 *   ④ 8문항 로테이션 인덱스가 저장된다(두 번이면 전부 커버)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
let reactSys = '';
await page.route('**/app/api/groq', (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const sys = String(body.messages?.[0]?.content || '');
  let content = '{}';
  if (sys.includes('짧은 자연스러운 반응')) {
    reactSys = sys;
    content = JSON.stringify({ reaction: 'Great, thanks!', followUp: null });
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

/* ① 기본 = HR, HR 질문 세트 */
check('HR 프리셋이 기본 선택', await page.evaluate(() => document.querySelector('.iv-role.on')?.textContent.includes('HR 스크리닝')));
await page.click('.iv-mode:has-text("연습 모드")'); // 텍스트 입력 플로우 검증용(기본은 실전 모드)
await page.click('button:has-text("면접 시작")');
await page.waitForSelector('.iv-skip-open', { timeout: 15000 }); // 아이스브레이킹 오프닝은 70번 테스트에서 검증 — 여기선 바로 본론
await page.click('.iv-skip-open');
await page.waitForFunction(() => document.body.innerText.includes('질문 1/5'), null, { timeout: 10000 });
check('첫 질문이 HR 세트 1번(가벼운 자기소개)', await page.evaluate(() => document.querySelector('.iv-q')?.textContent.includes('briefly introduce yourself')));
check('한국어 힌트', await page.evaluate(() => document.body.innerText.includes('간단히 자기소개')));
check('로테이션 인덱스 저장(8문항 순환)', await page.evaluate(() => JSON.parse(localStorage.getItem('va_workato_hr_q') || '0') === 5));

/* ② 영어 예시 내장 */
await page.click('.iv-guide-toggle');
await page.waitForSelector('.iv-sample-en', { timeout: 8000 });
check('HR용 영어 예시 답변 내장', await page.evaluate(() => document.querySelector('.iv-sample-en')?.textContent.includes('MegazoneCloud')));

/* ③ 라운드 성격 주입 */
await page.fill('.iv-answer', "I'm Taehyun, an account manager at MegazoneCloud managing fifty enterprise accounts.");
await page.click('button:has-text("답변 제출")');
await page.waitForSelector('button:has-text("다음 질문")', { timeout: 15000 }); // 전달력 체크포인트(v1.17)
await page.click('button:has-text("다음 질문")');
await page.waitForFunction(() => document.body.innerText.includes('질문 2/5'), null, { timeout: 15000 });
check('HR 라운드 성격이 반응 프롬프트에 주입', reactSys.includes('HR 스크리닝') && reactSys.includes('Talent Acquisition 파트너'), reactSys.slice(0, 80));

await browser.close();
finish();
