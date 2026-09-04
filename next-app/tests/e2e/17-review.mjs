/**
 * 롤플레이 사후 점검 — 미팅 스크립트에서 넘어온 대화를 체크리스트로 채점한다.
 * 계약: ① 스크립트 핸드오프일 때만 '상황 점검' 버튼이 뜬다
 *       ② 프롬프트에 체크 항목과 학습자 발화가 실려 나간다
 *       ③ 결과가 달성/미달성 + 근거 인용 + 다음 팁으로 렌더된다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));

let reviewPrompt = '';
await page.route('**/app/api/groq', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const last = (body.messages || []).slice(-1)[0]?.content || '';
  if (body.stream) {
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"choices":[{"delta":{"content":"Our price reflects the scope."}}]}\n\ndata: [DONE]\n\n',
    });
  }
  // 상황 점검 요청만 골라 고정 결과를 돌려준다(교정·요약 등 다른 호출과 구분)
  if (last.includes('점검 항목') || last.includes('상황의 롤플레이')) {
    reviewPrompt = last;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [
                  { key: 'acknowledge', done: true, evidence: "That's a fair point", tip_ko: '인정 후 바로 질문으로 넘어가면 더 좋습니다.' },
                  { key: 'compare', done: false, evidence: '', tip_ko: 'What are you comparing it to? 로 기준을 물으세요.' },
                  { key: 'reframe', done: true, evidence: 'three-year TCO', tip_ko: '숫자를 함께 제시하면 설득력이 커집니다.' },
                  { key: 'trade', done: false, evidence: '', tip_ko: 'If you can commit for two years, we could revisit the pricing.' },
                  { key: 'respect', done: true, evidence: '', tip_ko: '경쟁사 언급을 사실로만 유지했습니다.' },
                ],
                summary_ko: '반론을 인정하고 TCO로 기준을 옮긴 점이 좋았습니다. 다음에는 비교 기준을 먼저 물어보세요.',
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

// 스크립트 없이 회화에 바로 들어가면 점검 버튼이 없어야 한다
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("회화")');
await page.waitForSelector('.mini-actions', { timeout: 10000 });
check('일반 회화에는 상황 점검 버튼 없음', (await page.evaluate(() => document.body.textContent || '')).includes('상황 점검') === false);

// 미팅 스크립트 → AI 연습으로 진입
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-card', { timeout: 8000 });
await page.click('.feat-card:has-text("미팅 스크립트")');
await page.waitForSelector('.script-card', { timeout: 8000 });
await page.click('.script-card:has-text("가격 반론")');
await page.waitForSelector('.script-practice', { timeout: 8000 });
await page.locator('.script-practice').first().click();
await page.waitForSelector('.talk-screen .mini-actions', { timeout: 10000 });
check('스크립트 핸드오프 시 상황 점검 버튼 노출', await page.evaluate(() => Array.from(document.querySelectorAll('.mini-btn')).some((b) => b.textContent.includes('상황 점검'))));

// 발화가 거의 없으면 점검을 막는다
await page.click('.mini-btn.accent');
await page.waitForTimeout(400);
check('발화 부족 시 안내 후 중단', (await page.evaluate(() => document.body.textContent || '')).includes('먼저 몇 마디 나눈 뒤'));

// 실제로 몇 마디 나눈 뒤 점검
for (const line of [
  "That's a fair point, thanks for being direct.",
  'If we look at the three-year TCO, the gap narrows considerably.',
]) {
  await page.fill('.controls .text-input', line);
  await page.click('.round-btn.send');
  await page.waitForTimeout(700);
}
await page.click('.mini-btn.accent');
await page.waitForSelector('.review-card', { timeout: 10000 });

check('점검 프롬프트에 체크 항목 포함', /반론을 먼저 인정했는가/.test(reviewPrompt));
check('점검 프롬프트에 학습자 발화 포함', reviewPrompt.includes('three-year TCO'));
check('AI 발화는 프롬프트에서 제외', !reviewPrompt.includes('Our price reflects the scope'));

check('점검 항목 5개 렌더', (await page.evaluate(() => document.querySelectorAll('.review-row').length)) === 5);
check('달성 3/5 표시', (await page.evaluate(() => document.querySelector('.review-score')?.textContent || '')).trim() === '3/5');
check('달성 항목 3개', (await page.evaluate(() => document.querySelectorAll('.review-row.done').length)) === 3);
check('근거 인용 렌더', (await page.evaluate(() => document.querySelector('.review-evidence')?.textContent || '')).includes('fair point'));
check('미달성 항목에 다음 팁 제시', (await page.evaluate(() => document.body.textContent || '')).includes('What are you comparing it to?'));
check('총평 렌더', (await page.evaluate(() => document.querySelector('.review-summary')?.textContent || '')).includes('비교 기준'));

await browser.close();
finish('17-review');
