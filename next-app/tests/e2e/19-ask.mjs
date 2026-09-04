/**
 * 본문 문맥 질문 — 레슨을 읽다가 그 자리에서 자유 질문을 던진다.
 *
 * 기존 '꾹 눌러 물어보기'는 영어 표현을 선택해야만 열려, 한국어 설명을 읽다
 * 생긴 의문은 물어볼 길이 없었다. 이 경로의 계약을 검증한다:
 * ① 단락마다 버튼이 있다 ② 프롬프트에 그 단락 본문이 실린다
 * ③ 답변·예문이 렌더된다 ④ 이어 묻기에 직전 문답이 실린다 ⑤ 질문 기록에 남는다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));

const prompts = [];
await page.route('**/app/api/groq', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (body.stream) {
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n' });
  }
  const msgs = body.messages || [];
  const isAsk = (msgs[0]?.content || '').includes('교재 본문');
  if (isAsk) {
    prompts.push(msgs);
    const n = prompts.length;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                answer_ko: n === 1 ? '관사는 처음 언급하면 a, 서로 아는 것이면 the를 씁니다.' : '이어지는 답변입니다 — 직업 앞에는 반드시 a가 붙습니다.',
                examples: [{ en: 'I am a designer.', ko: '저는 디자이너입니다.' }],
              }),
            },
          },
        ],
      }),
    });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
});
await seedKey(page);

await page.goto(`${BASE}/app`);
await page.waitForSelector('.path-node', { timeout: 15000 });
const idx = await page.evaluate(() => Array.from(document.querySelectorAll('.path-node')).findIndex((n) => /관사 & 명사/.test(n.textContent)));
await page.locator('.path-node').nth(idx).click();
await page.waitForSelector('.ctx-ask-open', { timeout: 10000 });

const askButtons = await page.evaluate(() => document.querySelectorAll('.ctx-ask-open').length);
check('단락마다 물어보기 버튼', askButtons >= 2, String(askButtons));

await page.locator('.ctx-ask-open').first().click();
await page.waitForSelector('.ctx-ask-input', { timeout: 5000 });
check('추천 질문 칩 노출', (await page.evaluate(() => document.querySelectorAll('.ctx-ask-chip').length)) >= 3);

// 자유 질문
await page.fill('.ctx-ask .text-input', '왜 여기서 the를 쓰나요?');
await page.click('.ctx-ask-send');
await page.waitForSelector('.ctx-ask-a', { timeout: 10000 });

const first = prompts[0] || [];
const userMsg = first.filter((m) => m.role === 'user').pop()?.content || '';
check('프롬프트에 단락 제목 포함', userMsg.includes('관사'), userMsg.slice(0, 40));
check('프롬프트에 본문 원문 포함', /a book|an apple|서로 아는/.test(userMsg));
check('프롬프트에 학습자 질문 포함', userMsg.includes('왜 여기서 the를 쓰나요?'));
check('본문 밖 답변은 밝히도록 지시', (first[0]?.content || '').includes('본문에는 없지만'));

check('답변 렌더', (await page.evaluate(() => document.querySelector('.ctx-ask-a')?.textContent || '')).includes('관사는 처음'));
check('예문 + 한국어 렌더', await page.evaluate(() => !!document.querySelector('.ctx-ask-example-en') && !!document.querySelector('.ctx-ask-example-ko')));
check('질문도 함께 표시', (await page.evaluate(() => document.querySelector('.ctx-ask-q')?.textContent || '')).includes('the를'));
check('답변 후 추천 칩은 감춤', (await page.evaluate(() => document.querySelectorAll('.ctx-ask-chip').length)) === 0);

// 이어 묻기 — 직전 문답이 프롬프트에 실려야 한다
await page.fill('.ctx-ask .text-input', '직업 앞에는요?');
await page.click('.ctx-ask-send');
await page.waitForFunction(() => document.querySelectorAll('.ctx-ask-turn').length === 2, { timeout: 10000 });
const second = prompts[1] || [];
check('이어 묻기: 직전 질문 포함', second.some((m) => m.role === 'user' && m.content.includes('왜 여기서 the를')));
check('이어 묻기: 직전 답변 포함', second.some((m) => m.role === 'assistant' && m.content.includes('관사는 처음')));
check('이어 묻기: 순서가 user→assistant', (() => {
  const i = second.findIndex((m) => m.role === 'user' && m.content.includes('왜 여기서 the를'));
  return i > 0 && second[i + 1]?.role === 'assistant';
})());
check('문답 2개 누적', (await page.evaluate(() => document.querySelectorAll('.ctx-ask-turn').length)) === 2);

// 질문 기록 저장
const history = await page.evaluate(() => JSON.parse(localStorage.getItem('va_ask_history') || '[]'));
check('질문 기록에 2건 저장', history.length === 2, String(history.length));
check('기록에 단락 제목이 함께 남음', (history[0]?.phrase || '').includes('관사'), history[0]?.phrase || '');

// 키가 없으면 안내 — seedKey는 initScript라 reload로는 지워지지 않는다.
// 키를 심지 않은 새 페이지로 '키 없음' 상태를 정확히 재현한다.
const bare = await browser.newPage();
await bare.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await bare.goto(`${BASE}/app`);
await bare.waitForSelector('.path-node', { timeout: 15000 });
await bare.locator('.path-node').nth(idx).click();
await bare.waitForSelector('.ctx-ask-open', { timeout: 10000 });
await bare.locator('.ctx-ask-open').first().click();
await bare.fill('.ctx-ask .text-input', '테스트');
await bare.click('.ctx-ask-send');
await bare.waitForSelector('.ctx-ask-error', { timeout: 5000 });
check('키 없으면 등록 안내', (await bare.evaluate(() => document.querySelector('.ctx-ask-error')?.textContent || '')).includes('AI 키 등록'));

await browser.close();
finish('19-ask');
