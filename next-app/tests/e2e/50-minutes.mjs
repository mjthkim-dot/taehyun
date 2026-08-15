/**
 * 회의록 영어 루프 — "노션에 회의록이 생기면 영어 대화문이 된다"의 계약:
 *   ① 미설정(501)이어도 시드 대화(서북 면담)가 뜨고, 설정 안내가 자동으로 나온다
 *   ② 시드 대화를 열면 DialoguePractice(듣기·역할·암기)가 그 자리에서 열린다
 *   ③ 대화 문장 → 드릴 핸드오프가 동작한다
 *   ④ Notion 목록 → "영어 대화 만들기" 1탭으로 AI 대화가 생성·저장되고,
 *      원문이 그대로면 두 번째 탭은 AI를 다시 부르지 않는다(해시 캐시)
 *   ⑤ 아직 대화가 없는 회의록엔 "새" 배지가 붙는다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const REMOTE_PAGE = { id: 'm-0813', title: '8/13 고객사 정기 미팅 회의록', editedAt: new Date().toISOString() };
const NOTE_RAW = '8/13 고객사 정기 미팅. 안건: 9월 워크로드 이전 일정 확정, 비용 절감안 검토. 결정: 10월 1일까지 스테이징 이전 완료. 고객 요청: 주간 진행 리포트.';
const GENERATED = JSON.stringify({
  title: '워크로드 이전 일정 조율',
  situation: '9월 이전 일정과 비용 절감안을 논의하는 정기 미팅',
  lines: [
    { sp: 'A', en: 'Thanks for joining today. Shall we start with the migration schedule?', kr: '와주셔서 감사합니다. 이전 일정부터 시작할까요?' },
    { sp: 'B', en: 'Sure. Can we finish the staging migration by October first?', kr: '네. 스테이징 이전을 10월 1일까지 끝낼 수 있을까요?' },
    { sp: 'A', en: 'Yes, that timeline works if we lock the scope this week.', kr: '네, 이번 주에 범위를 확정하면 그 일정이 가능합니다.' },
    { sp: 'B', en: 'Good. We also want to review the cost-saving plan.', kr: '좋아요. 비용 절감안도 검토하고 싶습니다.' },
    { sp: 'A', en: 'I prepared two options. I will walk you through them now.', kr: '두 가지 안을 준비했습니다. 지금 설명드릴게요.' },
    { sp: 'B', en: 'One more thing — could we get a weekly progress report?', kr: '한 가지 더 — 주간 진행 리포트를 받을 수 있을까요?' },
    { sp: 'A', en: 'Absolutely. I will send the first one this Friday.', kr: '물론입니다. 이번 금요일에 첫 리포트를 보내드리겠습니다.' },
    { sp: 'B', en: 'Perfect. Let us reconvene next week then.', kr: '완벽해요. 그럼 다음 주에 다시 모이죠.' },
  ],
});

async function gotoMinutes(page) {
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("회의록 영어")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("회의록 영어")');
  await page.waitForSelector('.mn-item', { timeout: 10000 });
}

const browser = await launch();

/* ── ①②③ 미설정 + 시드 + DialoguePractice + 드릴 핸드오프 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/notion/minutes*', (r) => r.fulfill({ status: 501, contentType: 'application/json', body: '{"configured":false}' }));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  await seedKey(page);
  await gotoMinutes(page);

  check('시드 대화(서북 면담)가 뜬다', await page.evaluate(() => document.body.innerText.includes('떠나는 고객과의 마지막 면담')));
  check('시드에는 내장 예시 표기가 붙는다', await page.evaluate(() => document.querySelector('.mn-item-note')?.textContent.includes('내장 예시')));
  await page.waitForSelector('.pp-setup', { timeout: 8000 });
  check('미설정이면 설정 안내가 자동으로 뜬다', (await page.evaluate(() => document.querySelector('.pp-setup')?.textContent || '')).includes('NOTION_API_KEY'));

  /* ② 대화 열기 → DialoguePractice */
  await page.click('.mn-item-head');
  await page.waitForSelector('.mn-item-body', { timeout: 8000 });
  check('듣기·역할·암기 연습이 그 자리에서 열린다', await page.evaluate(() =>
    ['듣기·따라하기', '역할 연습', '암기 체크'].every((t) => document.body.innerText.includes(t))
  ));
  check('대화 줄이 렌더된다', await page.evaluate(() => document.body.innerText.includes("Thank you for making time today")));

  /* ③ 드릴 핸드오프 */
  await page.click('button:has-text("이 대화 문장으로 드릴")');
  await page.waitForSelector('.drill-source', { timeout: 10000 });
  check('대화 문장이 드릴 큐로 넘어간다', (await page.evaluate(() => document.querySelector('.drill-source')?.textContent || '')).includes('회의록 영어'));
  await page.close();
}

/* ── ④⑤ 목록 → 생성 → 해시 캐시 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/notion/minutes*', (r) => {
    const url = new URL(r.request().url());
    if (url.searchParams.get('id')) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, note: { id: REMOTE_PAGE.id, title: REMOTE_PAGE.title, raw: NOTE_RAW } }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, pages: [REMOTE_PAGE] }) });
  });
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  let genCalls = 0;
  await page.route('**/app/api/groq', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const isGen = (body.messages || []).some((m) => String(m.content || '').includes('롤플레이 대화문'));
    if (isGen) genCalls++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: isGen ? GENERATED : '{}' } }] }) });
  });
  await seedKey(page);
  await gotoMinutes(page);

  /* ⑤ 새 배지 */
  await page.waitForSelector('.mn-page', { timeout: 10000 });
  check('Notion 최근 회의록 목록이 자동으로 뜬다', await page.evaluate(() => document.body.innerText.includes('8/13 고객사 정기 미팅')));
  check('대화가 없는 회의록엔 "새" 배지', (await page.locator('.mn-badge-new').count()) === 1);

  /* ④ 생성 */
  await page.click('button:has-text("영어 대화 만들기")');
  await page.waitForFunction(() => document.body.innerText.includes('대화 생성 완료'), null, { timeout: 20000 });
  check('AI 생성이 1회 수행된다', genCalls === 1, String(genCalls));
  check('생성된 대화가 목록에 추가되고 열린다', await page.evaluate(() =>
    document.body.innerText.includes('워크로드 이전 일정 조율') && document.body.innerText.includes('Shall we start with the migration schedule?')
  ));
  check('배지가 사라지고 "대화 열기"로 바뀐다', (await page.locator('.mn-badge-new').count()) === 0 && (await page.locator('button:has-text("대화 열기")').count()) === 1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('va_minutes') || '{}'));
  check('생성 대화가 저장된다(va_minutes)', !!stored['m-0813'] && stored['m-0813'].dialogue.lines.length === 8, String(stored['m-0813']?.dialogue?.lines?.length));

  /* 같은 원문 → AI 재호출 없음 */
  await page.click('.mn-item-head >> nth=0'); // 열린 대화 접기
  await page.click('button:has-text("대화 열기")');
  await page.waitForFunction(() => document.body.innerText.includes('만들어 둔 대화를 다시 열었어요'), null, { timeout: 15000 });
  check('원문이 그대로면 AI를 다시 부르지 않는다(해시 캐시)', genCalls === 1, String(genCalls));
  await page.close();
}

await browser.close();
finish();
