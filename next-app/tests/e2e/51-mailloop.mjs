/**
 * Gmail 실전 소스 + 피드백 루프 — "고객 메일이 학습 소스가 되고, 쓸수록
 * 나에게 맞게 학습되는" 계약:
 *   ① Gmail 스레드 목록이 자동으로 뜨고, 1탭으로 대화가 생성된다(source=gmail)
 *   ② 피드백 루프 ①: 내 교정 기록(va_mistakes)이 생성 프롬프트에 주입되고,
 *      반영된 약점이 focus 칩으로 보인다
 *   ③ 피드백 루프 ②: 소스에서 수확한 표현이 SRS(cat '실전')에 자동 등록되고
 *      시드 표현 포함 문서 단위로 멱등이다
 *   ④ 두 소스가 모두 미설정이면 각각의 설정 안내가 뜬다(Gmail은 GMAIL_* 안내)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const THREAD = { id: 't-cplabs', title: 'EDP 미소진 금액 리뷰 · Jeffrey Song', editedAt: new Date().toISOString() };
const THREAD_RAW = [
  '[나]\n재산출 시뮬레이션 결과를 공유드립니다. 기준일자 8월 11일, CP8 계정 제외.',
  '[상대(Jeffrey Song)]\n산출 기준에 이견 없습니다. 8/31 만료 전에 미소진 잔액 전액을 RI/SP 구매로 전환하고자 합니다. 8/25까지 최선 추정치 회신 부탁드립니다.',
].join('\n\n');
const GENERATED = JSON.stringify({
  title: '미소진 잔액 발주 확정 통화',
  situation: 'EDP 만료 전 잔액 전환 발주를 확정하는 통화',
  focus: ['시제'],
  expressions: [
    { en: 'lock in the order', kr: '발주를 확정하다' },
    { en: 'a ballpark figure', kr: '대략적인 수치' },
    { en: 'circle back', kr: '다시 논의하다' },
  ],
  lines: [
    { sp: 'A', en: 'I sent you the updated simulation yesterday. Did it reach you safely?', kr: '어제 업데이트된 시뮬레이션을 보내드렸는데, 잘 받으셨나요?' },
    { sp: 'B', en: 'Yes, we went through it this morning. The basis looks right.', kr: '네, 오늘 아침에 검토했습니다. 기준은 맞아 보입니다.' },
    { sp: 'B', en: 'We want to convert the full unspent balance before the end of the month.', kr: '월말 전에 미소진 잔액 전액을 전환하고 싶습니다.' },
    { sp: 'A', en: 'Understood. I asked our billing team for the final number this morning.', kr: '알겠습니다. 오늘 아침에 정산팀에 최종 수치를 요청해 두었습니다.' },
    { sp: 'B', en: 'Can we get at least a ballpark figure by Monday?', kr: '월요일까지 대략적인 수치라도 받을 수 있을까요?' },
    { sp: 'A', en: 'Yes. I will send the estimate as soon as it lands, and we can lock in the order.', kr: '네. 수치가 오는 대로 추정치를 보내드리고, 발주를 확정하면 됩니다.' },
    { sp: 'B', en: 'Perfect. Let us circle back on Thursday then.', kr: '좋습니다. 그럼 목요일에 다시 논의하죠.' },
    { sp: 'A', en: 'Sounds good. I will set up the call.', kr: '좋습니다. 통화 일정을 잡아 두겠습니다.' },
  ],
});

async function gotoMinutes(page) {
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("실전 영어")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("실전 영어")');
  await page.waitForSelector('.mn-item', { timeout: 10000 });
}

const browser = await launch();

/* ── ①②③ Gmail 소스 + 약점 주입 + 표현 수확 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/notion/minutes*', (r) => r.fulfill({ status: 501, contentType: 'application/json', body: '{"configured":false}' }));
  await page.route('**/app/api/gmail/threads*', (r) => {
    const url = new URL(r.request().url());
    if (url.searchParams.get('id')) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, note: { id: THREAD.id, title: THREAD.title, raw: THREAD_RAW } }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, pages: [THREAD] }) });
  });
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  let genSys = '';
  let genCalls = 0;
  await page.route('**/app/api/groq', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const isGen = (body.messages || []).some((m) => String(m.content || '').includes('롤플레이 대화문'));
    if (isGen) {
      genCalls++;
      genSys = String(body.messages?.[0]?.content || '');
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: isGen ? GENERATED : '{}' } }] }) });
  });
  await seedKey(page);
  // 피드백 루프의 입력: 회화·드릴에서 축적된 실제 교정 기록
  await page.addInitScript(() => {
    localStorage.setItem('va_mistakes', JSON.stringify([
      { wrong: 'I go there yesterday', right: 'I went there yesterday.', note: '시제', t: 1, type: 'tense' },
      { wrong: 'He receive the file last week', right: 'He received the file last week.', note: '시제', t: 2, type: 'tense' },
    ]));
  });
  await gotoMinutes(page);

  /* ③ 시드 표현이 SRS로 (씨피랩스 4개 + 서북 3개) */
  await page.waitForFunction(() => document.body.innerText.includes('실전 표현'), null, { timeout: 8000 });
  const seedExpr = await page.evaluate(() => ({
    weak: JSON.parse(localStorage.getItem('va_weak') || '[]').filter((w) => w.cat === '실전').length,
    done: JSON.parse(localStorage.getItem('va_minutes_expr') || '[]').length,
  }));
  check('시드 수확 표현이 SRS(cat 실전)에 등록된다', seedExpr.weak === 7 && seedExpr.done === 2, JSON.stringify(seedExpr));
  check('메일 시드(씨피랩스)가 뜬다', await page.evaluate(() => document.body.innerText.includes('미소진 잔액 전환 협상')));

  /* ① Gmail 목록 → 생성 */
  await page.waitForSelector('.mn-page', { timeout: 10000 });
  check('Gmail 스레드 목록이 자동으로 뜬다', await page.evaluate(() => document.body.innerText.includes('EDP 미소진 금액 리뷰')));
  await page.click('button:has-text("영어 대화 만들기")');
  await page.waitForFunction(() => document.body.innerText.includes('대화 생성 완료'), null, { timeout: 20000 });
  check('AI 생성 1회 + gmail 소스로 저장된다', genCalls === 1 && (await page.evaluate(() => JSON.parse(localStorage.getItem('va_minutes') || '{}')['t-cplabs']?.source === 'gmail')));

  /* ② 약점 주입 */
  check('교정 기록이 생성 프롬프트에 주입된다', genSys.includes('자주 틀리는 유형') && genSys.includes('시제(2회)') && genSys.includes('I went there yesterday'), genSys.slice(-120));
  check('반영된 약점이 focus 칩으로 보인다', await page.evaluate(() => document.body.innerText.includes('내 약점 반영: 시제')));

  /* ③ 생성 표현 수확 + 메시지 */
  check('수확 표현이 추가 등록된다(7→10)', await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]').filter((w) => w.cat === '실전').length === 10));
  check('생성 완료 메시지에 표현 등록이 표시된다', await page.evaluate(() => document.body.innerText.includes('표현 3개 복습 큐 등록')));
  check('열린 대화에 수확 표현 카드가 보인다', await page.evaluate(() => document.body.innerText.includes('lock in the order')));

  /* ③ 멱등: 재진입해도 표현이 다시 쌓이지 않는다 */
  await page.reload();
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("실전 영어")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("실전 영어")');
  await page.waitForSelector('.mn-item', { timeout: 10000 });
  check('재방문해도 표현이 중복 등록되지 않는다(멱등)', await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]').filter((w) => w.cat === '실전').length === 10));
  await page.close();
}

/* ── ④ 두 소스 모두 미설정 → 각자의 안내 ── */
{
  const page = await browser.newPage();
  await page.route('**/app/api/notion/minutes*', (r) => r.fulfill({ status: 501, contentType: 'application/json', body: '{"configured":false}' }));
  await page.route('**/app/api/gmail/threads*', (r) => r.fulfill({ status: 501, contentType: 'application/json', body: '{"configured":false}' }));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  await seedKey(page);
  await gotoMinutes(page);
  await page.waitForFunction(() => document.querySelectorAll('.pp-setup').length >= 2, null, { timeout: 10000 });
  const setups = await page.evaluate(() => Array.from(document.querySelectorAll('.pp-setup')).map((s) => s.textContent));
  check('Notion 설정 안내가 뜬다', setups.some((s) => s.includes('NOTION_API_KEY')));
  check('Gmail 설정 안내가 뜬다(GMAIL_* 3종)', setups.some((s) => s.includes('GMAIL_CLIENT_ID') && s.includes('GMAIL_REFRESH_TOKEN')));
  await page.close();
}

await browser.close();
finish();
