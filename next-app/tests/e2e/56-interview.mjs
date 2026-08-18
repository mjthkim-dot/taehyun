/**
 * 면접 시뮬레이션 — 풀 사이클 계약:
 *   ① 역할 선택 → 질문 5개 생성 → 첫 질문이 뜬다(영어 + 진행 표시)
 *   ② 얕은 답변 → 면접관 반응 + 즉석 후속 질문(후속 배지), 충분한 답 → 다음 질문
 *   ③ 5문항 종료 → 평가 리포트(점수·강점·교정·모범 답변)
 *   ④ 피드백 루프: 교정이 va_mistakes(note '면접:')로, 점수가 이력으로 남는다
 *   ⑤ 모범 답변 → 드릴 핸드오프
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const QUESTIONS = JSON.stringify({
  questions: [
    { q: 'Could you tell me about yourself?', qKr: '자기소개 부탁드립니다.' },
    { q: 'Why this role?', qKr: '왜 이 역할인가요?' },
    { q: 'Tell me about a difficult customer.', qKr: '어려운 고객 경험은?' },
    { q: 'Your proudest achievement?', qKr: '가장 자랑스러운 성과는?' },
    { q: 'Any questions for us?', qKr: '질문 있으신가요?' },
  ],
});
const REPORT = JSON.stringify({
  score: 78,
  summary: '내용 구성은 좋았지만 시제 실수가 반복됐어요. 답변 길이를 조금 더 늘리면 좋겠습니다.',
  strengths: ['구체적 숫자를 들어 설명함', '침착한 태도'],
  improvements: [
    { wrong: 'I go there last year', right: 'I went there last year.', note: '과거 경험은 과거 시제로', type: 'tense' },
    { wrong: 'He give me feedback', right: 'He gave me feedback.', note: '3인칭 과거형', type: 'tense' },
  ],
  modelAnswers: [
    { q: 'Could you tell me about yourself?', en: 'I manage a portfolio of enterprise cloud customers in Korea.', kr: '한국에서 기업 클라우드 고객 포트폴리오를 담당하고 있습니다.' },
    { q: 'Why this role?', en: 'I want to work with global customers in English every day.', kr: '매일 영어로 글로벌 고객과 일하고 싶습니다.' },
  ],
});

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
  if (sys.includes('면접 질문 5개')) content = QUESTIONS;
  else if (sys.includes('짧은 자연스러운 반응')) {
    reactCalls++;
    content = JSON.stringify(
      reactCalls === 1
        ? { reaction: 'Thanks. Could you be more specific?', followUp: 'What exactly was your role in that project?' }
        : { reaction: 'I see, thank you.', followUp: null }
    );
  } else if (sys.includes('시니어 면접관')) content = REPORT;
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

/* ① 시작 — AI 질문 생성 경로는 일반 프리셋으로 검증(Workato는 큐레이션 세트라 57에서 따로) */
check('역할 프리셋(Workato+2) + 직접 입력이 있다', (await page.locator('.iv-role').count()) === 4);
await page.click('.iv-role:has-text("Customer Success Manager")');
await page.click('button:has-text("면접 시작")');
await page.waitForSelector('.iv-q', { timeout: 15000 });
check('첫 질문이 영어로 뜬다', await page.evaluate(() => document.querySelector('.iv-q')?.textContent.includes('tell me about yourself')));
check('진행 표시 1/5', await page.evaluate(() => document.body.innerText.includes('질문 1/5')));

/* ② 얕은 답 → 후속 질문 */
await page.fill('.iv-answer', 'I did a project.');
await page.click('button:has-text("답변 제출")');
await page.waitForFunction(() => document.body.innerText.includes('What exactly was your role'), null, { timeout: 15000 });
check('즉석 후속 질문 + 후속 배지', await page.evaluate(() => document.body.innerText.includes('후속')));
await page.fill('.iv-answer', 'I led the migration and negotiated the contract with the vendor.');
await page.click('button:has-text("답변 제출")');
await page.waitForFunction(() => document.body.innerText.includes('질문 2/5'), null, { timeout: 15000 });
check('후속 답변 후 다음 질문으로', true);

/* 나머지 4문항 — 반응은 null이라 바로 넘어간다 */
for (let i = 2; i <= 5; i++) {
  await page.fill('.iv-answer', `My answer for question number ${i} with enough detail and numbers.`);
  await page.click('button:has-text("답변 제출")');
  if (i < 5) await page.waitForFunction((n) => document.body.innerText.includes(`질문 ${n}/5`), i + 1, { timeout: 15000 });
}

/* ③ 리포트 */
await page.waitForSelector('.iv-score', { timeout: 20000 });
check('점수와 총평이 뜬다', await page.evaluate(() => document.querySelector('.iv-score')?.textContent === '78' && document.body.innerText.includes('시제 실수가 반복')));
check('교정과 모범 답변이 뜬다', await page.evaluate(() => document.body.innerText.includes('I went there last year') && document.body.innerText.includes('enterprise cloud customers')));

/* ④ 피드백 루프 */
const loop = await page.evaluate(() => ({
  mistakes: JSON.parse(localStorage.getItem('va_mistakes') || '[]').filter((m) => String(m.note || '').startsWith('면접:')).length,
  hist: JSON.parse(localStorage.getItem('va_interview_history') || '[]'),
}));
check('교정이 va_mistakes로 들어간다', loop.mistakes === 2, String(loop.mistakes));
check('점수 이력이 남는다', loop.hist.length === 1 && loop.hist[0].score === 78, JSON.stringify(loop.hist));

/* ⑤ 드릴 핸드오프 */
await page.click('button:has-text("모범 답변으로 드릴")');
await page.waitForSelector('.drill-source', { timeout: 10000 });
check('모범 답변이 드릴 큐로', (await page.evaluate(() => document.querySelector('.drill-source')?.textContent || '')).includes('면접 모범 답변'));

await browser.close();
finish();
