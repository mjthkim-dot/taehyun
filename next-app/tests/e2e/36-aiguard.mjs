/**
 * AI 응답 방어(lib/aiGuard) — 드릴 코칭에서 났던 "한국어 지시를 무시한 영어 응답"
 * 사고가 다른 화면에서 재발하지 않게 고정하는 계약:
 *   ① 한국어 기대 필드가 영어로 오면 그대로 보여주지 않고 한 번 다시 묻는다
 *   ② 재요청까지 실패하면 영어 덩어리 대신 한국어 실패 안내를 띄운다
 *   ③ 미팅 회고: 번역 결과가 비면 입력을 지우지도, 완료 처리하지도 않는다
 *      (예전에는 결과 0건에도 done:true + 입력 삭제로 사용자가 쓴 말이 사라졌다)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const EN_GRADE = JSON.stringify({
  cefr: 'B1', score: 72,
  summary: 'Your writing shows good basic structure but needs work on articles.',
  strengths: ['Good use of connectors'],
  issues: [{ wrong: 'I go to meeting', fix: 'I went to the meeting', why: 'Past tense is required.' }],
  corrected: 'I went to the meeting yesterday.',
  modelAnswer: 'Yesterday I attended the review meeting.',
});
const KO_GRADE = JSON.stringify({
  cefr: 'B1', score: 72,
  summary: '기본 구조는 좋지만 관사 사용을 더 다듬어야 해요.',
  strengths: ['연결어를 잘 썼어요'],
  issues: [{ wrong: 'I go to meeting', fix: 'I went to the meeting', why: '과거 시제와 관사가 필요해요.' }],
  corrected: 'I went to the meeting yesterday.',
  modelAnswer: 'Yesterday I attended the review meeting.',
});

const browser = await launch();

async function openWriting(page) {
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("쓰기")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("쓰기")');
  await page.waitForSelector('textarea', { timeout: 8000 });
  await page.fill('textarea', 'I go to meeting yesterday. It was good meeting and we talk about many things together.');
}

/* ── ① 영어 첨삭 → 재요청 → 한국어로 표시 ── */
{
  const page = await browser.newPage();
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  let calls = 0;
  await page.route('**/app/api/groq', (route) => {
    calls++;
    const content = calls === 1 ? EN_GRADE : KO_GRADE;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });
  await seedKey(page);
  await openWriting(page);
  await page.click('button:has-text("AI 첨삭 받기")');
  await page.waitForFunction(() => document.body.textContent.includes('관사'), null, { timeout: 15000 });
  check('영어 첨삭이 오면 한 번 다시 묻는다', calls === 2, `호출 ${calls}회`);
  const body = await page.evaluate(() => document.body.innerText);
  check('재요청 뒤 한국어 총평이 표시된다', body.includes('기본 구조는 좋지만'));
  check('영어 총평은 화면에 남지 않는다', !body.includes('needs work on articles'));
  await page.close();
}

/* ── ② 끝까지 영어 → 실패 안내 (영어 덩어리 노출 금지) ── */
{
  const page = await browser.newPage();
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  let calls = 0;
  await page.route('**/app/api/groq', (route) => {
    calls++;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: EN_GRADE } }] }) });
  });
  await seedKey(page);
  await openWriting(page);
  await page.click('button:has-text("AI 첨삭 받기")');
  await page.waitForFunction(() => document.body.textContent.includes('AI 응답을 만들지 못했어요'), null, { timeout: 15000 });
  check('두 번 다 영어면 한국어 실패 안내를 띄운다', calls === 2, `호출 ${calls}회`);
  const body2 = await page.evaluate(() => document.body.innerText);
  check('영어 첨삭 덩어리를 그대로 보여주지 않는다', !body2.includes('needs work on articles'));
  await page.close();
}

/* ── ③ 미팅 회고: 빈 번역 결과 → 입력 보존 + 완료 처리 안 함 ── */
{
  const PREP = {
    headline: 'Today I want to walk you through the plan.',
    phrases: [
      { en: 'Thanks for making the time.', kr: '시간 내주셔서 감사합니다.' },
      { en: 'Let me walk you through the plan.', kr: '계획을 안내드리겠습니다.' },
      { en: 'We can start with a small PoC.', kr: '작은 PoC로 시작할 수 있습니다.' },
      { en: 'Could we agree on dates today?', kr: '오늘 일정을 정할 수 있을까요?' },
    ],
    questions: [
      { en: 'What about our data?', kr: '데이터는 어떻게 되나요?', answer: { en: 'Nothing moves until sign-off.', kr: '승인 전까지 옮기지 않습니다.' } },
      { en: 'Is this expensive?', kr: '비싼가요?', answer: { en: 'Let me break down the cost.', kr: '비용을 나눠 설명드리겠습니다.' } },
    ],
    talkPrompt: '클라우드 도입을 검토하는 팀장. 비용을 집요하게 묻는다.',
  };
  const page = await browser.newPage();
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  let gapCalls = 0;
  await page.route('**/app/api/groq', (route) => {
    const body = route.request().postData() || '';
    const isGap = body.includes('wished they could say');
    if (isGap) gapCalls++;
    // 번역은 빈 결과(줄 수 불일치) — 방어가 없으면 done 처리 + 입력 삭제가 일어난다
    const content = isGap ? JSON.stringify({ items: [] }) : JSON.stringify(PREP);
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });
  await seedKey(page);
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("미팅 준비")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("미팅 준비")');
  await page.click('button:has-text("새 미팅 준비하기")');
  await page.waitForSelector('.mt-field', { timeout: 8000 });
  await page.fill('.mt-field:has-text("상대는") input', '팀장');
  await page.fill('.mt-field:has-text("무엇을") input', '클라우드 이전 제안');
  await page.fill('.mt-field:has-text("얻고 싶은") input', '일정 합의');
  await page.click('button:has-text("준비 자료 만들기")');
  await page.waitForSelector('.mt-phrase', { timeout: 15000 });

  const GAP_TEXT = '그건 저희 쪽에서 확인하고 회신드리겠다';
  await page.fill('.mt-gap-input', GAP_TEXT);
  await page.click('button:has-text("영어로 바꿔 복습에 넣기")');
  await page.waitForFunction(() => document.body.textContent.includes('입력은 그대로 두었으니'), null, { timeout: 15000 });
  check('빈 결과에는 재요청까지 시도한다', gapCalls === 2, `호출 ${gapCalls}회`);
  const state = await page.evaluate(() => ({
    input: document.querySelector('.mt-gap-input')?.value || '',
    meeting: JSON.parse(localStorage.getItem('va_meetings') || '[]')[0] || {},
    weak: JSON.parse(localStorage.getItem('va_weak') || '[]').length,
  }));
  check('실패 시 사용자가 쓴 입력을 지우지 않는다', state.input === GAP_TEXT, state.input);
  check('실패 시 회고를 완료 처리하지 않는다', state.meeting.done !== true, String(state.meeting.done));
  check('빈 항목이 복습 큐에 들어가지 않는다', state.weak === 0, String(state.weak));
  await page.close();
}

await browser.close();
finish();
