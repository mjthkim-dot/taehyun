/**
 * 코스 자동 갱신 루프 — "다음 분기에도 같은 방법으로 스스로 재분석"의 계약:
 *   ① 재분석 버튼 → 서버 분석 → 대표 스레드 → AI 시나리오가 트랙에 🆕로 편입
 *   ② 약점 주입: 교정 기록이 생성 프롬프트에 실린다
 *   ③ 같은 분기 재실행은 해시 캐시로 AI 비용 0 ("새 패턴 없음" 안내)
 *   ④ 생성 시나리오는 재방문에도 유지된다 (va_course_extra)
 *   ⑤ 분석이 60일 넘게 묵으면 "갱신 추천" 배지가 붙는다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const ANALYSIS = JSON.stringify({
  configured: true,
  analysis: {
    totalThreads: 180,
    sampled: 45,
    counterparts: [
      { domain: 'newcorp.kr', threads: 9, repId: 't-new', repTitle: '뉴코프 SP 구매 문의', samples: ['뉴코프 SP 구매 문의'] },
    ],
  },
});
const NOTE = JSON.stringify({
  configured: true,
  note: { id: 't-new', title: '뉴코프 SP 구매 문의', raw: '[상대(박부장)]\nSP 3년 약정 구매를 검토 중입니다. 할인율과 결제 방식 문의드립니다.\n\n[나]\n시뮬레이션 산출해서 회신드리겠습니다.' },
});
const GENERATED = JSON.stringify({
  trackId: 'deal',
  title: '뉴코프 SP 구매 상담',
  situation: '3년 약정 SP 구매를 검토하는 고객과 할인율·결제 방식을 논의',
  expressions: [
    { en: 'a three-year commitment', kr: '3년 약정' },
    { en: 'payment options', kr: '결제 방식 선택지' },
    { en: 'I will get back to you with numbers.', kr: '수치로 회신드리겠습니다.' },
  ],
  lines: [
    { sp: 'B', en: 'We are considering a three-year commitment for Savings Plans.', kr: '저희는 Savings Plans 3년 약정을 검토 중입니다.' },
    { sp: 'A', en: 'Great choice. The three-year term gives you the deepest discount.', kr: '좋은 선택입니다. 3년 약정이 할인 폭이 가장 큽니다.' },
    { sp: 'B', en: 'What payment options do we have?', kr: '결제 방식은 어떤 선택지가 있나요?' },
    { sp: 'A', en: 'No-upfront, partial, or all-upfront — I will simulate all three for you.', kr: '선납 없음, 부분, 전액 — 세 가지 모두 시뮬레이션해 드리겠습니다.' },
    { sp: 'B', en: 'When can we see the numbers?', kr: '수치는 언제 볼 수 있죠?' },
    { sp: 'A', en: 'I sent a similar simulation yesterday, so I can adapt it by tomorrow.', kr: '어제 비슷한 시뮬레이션을 보냈어서, 내일까지 맞춰드릴 수 있습니다.' },
    { sp: 'B', en: 'Perfect. Please include the discount rate for each option.', kr: '좋습니다. 옵션별 할인율도 포함해 주세요.' },
    { sp: 'A', en: 'Will do. I will get back to you with numbers tomorrow morning.', kr: '네. 내일 오전에 수치로 회신드리겠습니다.' },
  ],
});

async function gotoCourse(page) {
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("실전 코스")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("실전 코스")');
  await page.waitForSelector('.rc-head', { timeout: 10000 });
}

const browser = await launch();

/* ── ①②③④ 재분석 → 편입 → 캐시 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/gmail/threads*', (r) => {
    const url = new URL(r.request().url());
    if (url.searchParams.get('mode') === 'analyze') return r.fulfill({ status: 200, contentType: 'application/json', body: ANALYSIS });
    if (url.searchParams.get('id')) return r.fulfill({ status: 200, contentType: 'application/json', body: NOTE });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":true,"pages":[]}' });
  });
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  let genSys = '';
  let genCalls = 0;
  await page.route('**/app/api/groq', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const isGen = (body.messages || []).some((m) => String(m.content || '').includes('훈련 시나리오로 바꾸는'));
    if (isGen) {
      genCalls++;
      genSys = String(body.messages?.[0]?.content || '');
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: isGen ? GENERATED : '{}' } }] }) });
  });
  await seedKey(page);
  await page.addInitScript(() => {
    localStorage.setItem('va_mistakes', JSON.stringify([
      { wrong: 'I send it yesterday', right: 'I sent it yesterday.', note: '시제', t: 1, type: 'tense' },
      { wrong: 'She give me the file', right: 'She gave me the file.', note: '시제', t: 2, type: 'tense' },
    ]));
  });
  await gotoCourse(page);

  await page.click('button:has-text("지금 재분석")');
  await page.waitForFunction(() => document.body.innerText.includes('재분석 완료'), null, { timeout: 20000 });
  check('새 시나리오 1편 추가가 보고된다', await page.evaluate(() => document.body.innerText.includes('새 시나리오 1편')));
  check('총 대화 수가 18→19로 는다', await page.evaluate(() => Array.from(document.querySelectorAll('.rc-stat b')).some((b) => b.textContent === '19')));
  check('약점(시제)이 생성 프롬프트에 실린다', genSys.includes('시제(2회)') && genSys.includes('I sent it yesterday'), genSys.slice(-100));

  /* 트랙 편입 + 🆕 */
  await page.click('.mn-item:has-text("계약 & 견적") .mn-item-head');
  await page.waitForSelector('.rc-sc', { timeout: 8000 });
  check('계약 트랙이 4개 시나리오가 된다', (await page.locator('.rc-sc').count()) === 4);
  check('새 시나리오에 🆕 표시', await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.rc-sc-title')).find((t) => t.textContent.includes('뉴코프 SP 구매 상담'));
    return !!el && el.textContent.includes('🆕');
  }));
  await page.click('.rc-sc:has-text("뉴코프 SP 구매 상담") .rc-sc-head');
  await page.waitForSelector('.rc-sc:has-text("뉴코프 SP 구매 상담") .rc-sc-body', { timeout: 8000 });
  check('자동 갱신 근거가 표시된다', await page.evaluate(() => document.body.innerText.includes('자동 갱신 — newcorp.kr')));
  check('생성 대화가 연습 가능하다', await page.evaluate(() => document.body.innerText.includes('a three-year commitment')));

  /* ③ 같은 분기 재실행 = 비용 0 */
  await page.click('button:has-text("지금 재분석")');
  await page.waitForFunction(() => document.body.innerText.includes('새 패턴이 없어요'), null, { timeout: 20000 });
  check('같은 원문 재실행은 AI를 다시 부르지 않는다', genCalls === 1, String(genCalls));

  /* ④ 재방문 유지 */
  await gotoCourse(page);
  check('재방문에도 19편 유지', await page.evaluate(() => Array.from(document.querySelectorAll('.rc-stat b')).some((b) => b.textContent === '19')));
  await page.close();
}

/* ── ⑤ 갱신 추천 배지 ── */
{
  const page = await browser.newPage();
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  await seedKey(page);
  await page.addInitScript(() => {
    localStorage.setItem('va_course_refreshed_at', JSON.stringify('2026-05-01T00:00:00.000Z'));
  });
  await gotoCourse(page);
  check('60일 넘게 묵으면 갱신 추천 배지', await page.evaluate(() => document.body.innerText.includes('갱신 추천')));
  await page.close();
}

await browser.close();
finish();
