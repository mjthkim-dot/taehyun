/**
 * 미팅 준비 · 회고 — 공부와 실제 업무를 잇는 고리.
 *
 * 배경: 이 앱의 상황 학습은 전부 '일반적인 상황'이었다. 정작 내일 잡힌 그 미팅을
 * 준비하는 자리가 없어서, 학습이 끝나면 학습으로 끝났다. 계약은 다섯 가지다.
 *   ① 상대·안건·목표 세 줄로 그 미팅용 표현과 예상 질문이 만들어진다
 *   ② 안건 없이는 만들지 않는다 — 빈 입력으로 만든 자료는 일반론이라 쓸모가 없다
 *   ③ 만든 자료가 기기에 남아 다시 열 수 있다
 *   ④ 표현을 드릴로, 상황을 회화 리허설로 넘길 수 있다
 *   ⑤ 회고에 적은 '못 한 말'이 영어가 되어 표현장과 복습 큐에 들어간다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const PREP = {
  headline: 'Today I want to walk you through the migration plan.',
  phrases: [
    { en: 'Thanks for making the time on short notice.', kr: '갑작스러운 요청에도 시간 내주셔서 감사합니다.' },
    { en: 'Let me walk you through the migration plan first.', kr: '먼저 마이그레이션 계획을 안내드리겠습니다.' },
    { en: 'We can start with a two-week proof of concept.', kr: '2주짜리 개념 검증으로 시작할 수 있습니다.' },
    { en: 'That would keep the production workload untouched.', kr: '운영 워크로드는 건드리지 않는 방식입니다.' },
    { en: 'Could we agree on the PoC dates today?', kr: '오늘 PoC 일정을 정할 수 있을까요?' },
  ],
  questions: [
    {
      en: 'What happens to our data during the migration?',
      kr: '마이그레이션 중에 데이터는 어떻게 되나요?',
      answer: { en: 'Nothing moves until you sign off on the dry run.', kr: '리허설을 승인하시기 전까지는 아무것도 옮기지 않습니다.' },
    },
    {
      en: 'This looks more expensive than what we pay now.',
      kr: '지금 내는 비용보다 비싸 보이는데요.',
      answer: { en: 'Let me break down the total cost over three years.', kr: '3년 총비용 기준으로 나눠서 설명드리겠습니다.' },
    },
  ],
  talkPrompt: '클라우드 도입을 검토 중인 제조사 인프라 팀장. 비용과 데이터 안전성을 집요하게 묻는다.',
};

const GAPS = {
  items: [
    { kr: '그건 저희 쪽에서 확인하고 내일 회신드리겠다', en: "Let me check on that and get back to you tomorrow." },
    { kr: '지금 단계에서 가격을 확정하긴 이르다', en: "It's a bit early to lock in pricing at this stage." },
  ],
};

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));

// AI 응답은 두 종류다 — 준비 자료 생성과 회고 번역. 프롬프트로 구분한다.
let prepCalls = 0;
let gapCalls = 0;
let lastPrompt = '';
await page.route('**/app/api/groq', (route) => {
  const body = route.request().postData() || '';
  lastPrompt = body;
  const isGap = body.includes('wished they could say');
  if (isGap) gapCalls++;
  else prepCalls++;
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(isGap ? GAPS : PREP) } }] }),
  });
});
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-grid .feat-card:has-text("미팅 준비")', { timeout: 8000 });
await page.click('.feat-grid .feat-card:has-text("미팅 준비")');
await page.waitForSelector('.mt-empty, .mt-list', { timeout: 8000 });
check('처음에는 준비한 미팅이 없다고 알림', (await page.locator('.mt-empty').count()) === 1);

await page.click('button:has-text("새 미팅 준비하기")');
await page.waitForSelector('.mt-field', { timeout: 8000 });

/* ── ② 안건 없이는 만들지 않는다 ── */
await page.click('button:has-text("준비 자료 만들기")');
await page.waitForTimeout(400);
check('안건이 비면 만들지 않고 이유를 알림', (await page.locator('.warn').count()) > 0 && prepCalls === 0, String(prepCalls));

/* ── ① 세 줄 → 준비 자료 ── */
await page.fill('.mt-field:has-text("상대는") input', '제조사 인프라 팀장');
await page.fill('.mt-field:has-text("무엇을") input', '온프레미스 DB를 클라우드로 옮기는 1차 제안');
await page.fill('.mt-field:has-text("얻고 싶은") input', 'PoC 일정 합의');
await page.click('button:has-text("준비 자료 만들기")');
await page.waitForSelector('.mt-phrase', { timeout: 15000 });

check('AI에 준비 자료를 요청', prepCalls === 1, String(prepCalls));
check('입력한 안건이 프롬프트에 실림', lastPrompt.includes('온프레미스') || lastPrompt.includes('클라우드'), lastPrompt.slice(0, 80));
const detail = await page.evaluate(() => ({
  phrases: document.querySelectorAll('.mt-phrase').length,
  questions: document.querySelectorAll('.mt-q').length,
  headline: document.querySelector('.mt-headline')?.textContent?.trim() || '',
}));
check('이 미팅에서 쓸 표현이 나옴', detail.phrases === 5, JSON.stringify(detail));
check('예상 질문·반론이 나옴', detail.questions === 2, JSON.stringify(detail));
check('미팅 여는 한 문장이 나옴', detail.headline.includes('walk you through'), detail.headline);

/* ── 실제로 쓴 표현 체크 ── */
// :first-of-type은 태그 기준이라 형제 div들 때문에 안 맞는다 — 순번으로 집는다
await page.locator('.mt-phrase .mt-check').first().click();
await page.waitForTimeout(300);
const used = await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('va_meetings') || '[]');
  return all[0]?.used || [];
});
check('실제로 쓴 표현을 체크해 남긴다', used.length === 1, JSON.stringify(used));

/* ── ⑤ 회고: 못 한 말 → 영어 → 표현장 · 복습 큐 ── */
await page.fill('.mt-gap-input', '그건 저희 쪽에서 확인하고 내일 회신드리겠다\n지금 단계에서 가격을 확정하긴 이르다');
await page.click('button:has-text("영어로 바꿔 복습에 넣기")');
await page.waitForSelector('.mt-gap', { timeout: 15000 });
check('회고를 AI에 번역 요청', gapCalls === 1, String(gapCalls));
const saved = await page.evaluate(() => ({
  gaps: document.querySelectorAll('.mt-gap').length,
  phrases: JSON.parse(localStorage.getItem('va_phrases') || '[]').map((p) => p.en),
  weak: JSON.parse(localStorage.getItem('va_weak') || '[]').map((w) => w.en),
}));
check('못 한 말이 영어 문장으로 나옴', saved.gaps === 2, String(saved.gaps));
check('표현장에 저장됨', saved.phrases.some((e) => e.includes('get back to you tomorrow')), JSON.stringify(saved.phrases.slice(0, 2)));
check('복습 큐에도 들어감', saved.weak.some((e) => e.includes('lock in pricing')), JSON.stringify(saved.weak.slice(0, 2)));

/* ── ④ 드릴 · 리허설 핸드오프 ── */
await page.click('button:has-text("못 한 말 드릴하기")');
await page.waitForSelector('.mic', { timeout: 10000 });
check('회고 표현으로 드릴이 시작됨', (await page.evaluate(() => document.body.innerText)).includes('미팅 회고'));

/* ── ③ 기기에 남아 다시 열 수 있다 ── */
await page.reload();
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.click('.feat-grid .feat-card:has-text("미팅 준비")');
await page.waitForSelector('.mt-item', { timeout: 8000 });
const listed = await page.evaluate(() => document.querySelector('.mt-item-title')?.textContent?.trim() || '');
check('새로고침 뒤에도 목록에 남음', listed.includes('온프레미스'), listed);

await page.click('.mt-item-main');
await page.waitForSelector('.mt-phrase', { timeout: 8000 });
await page.click('button:has-text("AI와 리허설")');
await page.waitForTimeout(800);
const talkCtx = await page.evaluate(() => document.body.innerText);
check('리허설로 넘어가면 그 미팅 상황이 실린다', talkCtx.includes('리허설') || talkCtx.includes('인프라 팀장'), talkCtx.slice(0, 100).replace(/\n/g, ' '));

await browser.close();
finish('30-meeting');
