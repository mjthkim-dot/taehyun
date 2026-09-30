/**
 * 드라마 레슨 — "한 번에 할 게 너무 많고, 형식이 반복되고, 재미가 없다":
 *   ① 신규(집중 모드): 가이드 2단계(레벨 진단 → 1화 보기)
 *   ② 1화 보기 → 허브를 건너뛰고 바로 재생, 대화가 **자동으로** 한 줄씩 흐른다(내 차례에서만 멈춤)
 *   ③ 이야기 속 참여: 답 고르기(오답이면 이유) · 뜻 알아듣기 · 따라 말하기(건너뛰기 가능)
 *   ④ 엔딩: 오늘의 표현 2개(복습 카드로) + 다음 화 예고
 *   ⑤ 홈: 가이드가 사라지고 '오늘의 에피소드'(EP 2)가 주인공
 *   ⑥ 7화까지는 직접 쓴 원고, 8화부터 AI가 이어 쓴다(모킹) — 검증 통과한 원고만 재생
 *   ⑦ 다음 화 첫머리 '지난 화 기억나요?' 복습, 엔딩은 '오늘은 여기까지'가 기본
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const EP4 = {
  level: 'A2', title: 'Friday Face-off', titleKr: '금요일의 대면', recap: 'Grant가 계약 해지를 검토 중이라는 걸 알게 된 태오.',
  scenes: [
    { type: 'narr', kr: '금요일 아침. 회의실에 Mr. Grant가 먼저 와 있다.' },
    { type: 'line', who: 'grant', en: 'You look nervous, Taco.', kr: '긴장한 것 같네요, 타코.' },
    { type: 'line', who: 'taeo', en: 'Just a little. Thanks for coming.', kr: '조금요. 와 주셔서 감사해요.' },
    { type: 'choice', prompt: '비용이 오른 이유를 찾았다고 말하자.', opts: [
      { en: 'I found the problem.', ok: true, reply: { who: 'grant', en: 'Go on.', kr: '계속해요.' } },
      { en: 'I find the problem yesterday.', ok: false, why: '어제 한 일은 과거형 found.' },
      { en: 'Problem finding me.', ok: false, why: '주어와 동사 순서가 뒤집혔어요.' },
    ] },
    { type: 'line', who: 'taeo', en: 'Some servers were running all night.', kr: '일부 서버가 밤새 돌고 있었어요.' },
    { type: 'meaning', who: 'grant', en: 'That makes sense.', opts: ['이해가 되네요', '말이 안 돼요', '돈이 많이 드네요'], a: 0, why: 'That makes sense = 납득이 된다.' },
    { type: 'line', who: 'maya', en: 'And we can fix it this week.', kr: '그리고 이번 주에 고칠 수 있어요.' },
    { type: 'speak', who: 'taeo', en: 'We will save you money.', kr: '비용을 아껴 드릴게요.' },
    { type: 'line', who: 'grant', en: 'Fine. You have one month.', kr: '좋아요. 한 달 드리죠.' },
    { type: 'narr', kr: 'Grant가 나가자 Jun이 문틈으로 엄지를 든다.' },
    { type: 'line', who: 'jun', en: 'Taco, you did it!', kr: '타코, 해냈네!' },
    { type: 'narr', kr: '그때 태오의 휴대폰이 울린다. 발신자: Diane.' },
  ],
  learn: [{ en: 'That makes sense.', kr: '이해가 돼요.', note: '상대 설명에 납득할 때' }, { en: 'I found the problem.', kr: '문제를 찾았어요.', note: '원인을 알아냈을 때' }],
  cliff: 'CEO Diane이 왜 태오에게 직접 전화를 했을까?',
};

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.addInitScript(() => {
  localStorage.setItem('va_onboarded', 'true');
  localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
  localStorage.setItem('va_drama_mute', 'true');
  if (!localStorage.getItem('va_placed')) localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
});
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
let genCalls = 0;
await page.route('**/app/api/groq', (r) => {
  const sys = String(JSON.parse(r.request().postData() || '{}').messages?.[0]?.content || '');
  const content = sys.includes('웹드라마 작가') ? (genCalls++, JSON.stringify(EP4)) : '{}';
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
await page.goto(`${BASE}/app`);

/* ① 가이드 */
await page.waitForSelector('.fg-card', { timeout: 15000 });
check('가이드 2단계 = 드라마 1화 보기', await page.evaluate(() => document.querySelector('.fg-title')?.textContent.includes('2단계 · 드라마 1화 보기')));
check('가이드는 2단계뿐(할 일 최소화)', (await page.locator('.fg-step').count()) === 2);
check('집중 홈에 12주 레슨 카드가 없다', (await page.locator('.pg-card').count()) === 0);

/* ② 바로 재생 */
await page.click('.fg-cta');
await page.waitForSelector('.dr-log', { timeout: 15000 });
check('허브를 건너뛰고 1화가 바로 시작', await page.evaluate(() => document.querySelector('.dr-ep')?.textContent.includes('EP 1')));
check('첫 장면은 해설', (await page.locator('.dr-narr').count()) === 1);

async function next() {
  await page.click('.dr-next');
  await page.waitForTimeout(120);
}
/* 참여 문항이 나올 때까지 진행 */
async function untilAct() {
  for (let g = 0; g < 20; g++) {
    if (await page.locator('.dr-act').count()) return;
    await next();
  }
}
// 자동 재생 — 다음 버튼 없이 첫 참여 문항까지 저절로 흐른다
check('자동 재생 중엔 다음 버튼 대신 재생 표시', (await page.locator('.dr-next').count()) === 0 && (await page.locator('.dr-playing').count()) === 1);
await page.waitForSelector('.dr-act', { timeout: 25000 });
check('누르지 않아도 첫 참여 문항까지 흘렀다', (await page.locator('.dr-line').count()) >= 3);
check('자막(한국어)이 붙는다', (await page.locator('.dr-kr').count()) >= 1);
check('내 차례에선 멈춘다(재생 표시·다음 버튼 없음)', (await page.locator('.dr-next, .dr-playing').count()) === 0);

/* ③-1 choice: 일부러 오답 */
const wrong = page.locator('.dr-opt', { hasText: 'I am first day' });
await wrong.click();
await page.waitForSelector('.dr-note', { timeout: 3000 });
check('오답이면 이유가 나온다', await page.evaluate(() => document.querySelector('.dr-note')?.textContent.includes('It')));
await page.waitForFunction(() => document.body.innerText.includes('Welcome to Nimbus'), null, { timeout: 5000 });
check('정답 대사와 상대 반응으로 이야기가 이어진다', true);

/* 답한 뒤 저절로 다시 흘러 다음 참여 문항(뜻 알아듣기)까지 */
await page.waitForFunction(() => document.querySelector('.dr-ask')?.textContent.includes('무슨 뜻'), null, { timeout: 30000 });
check('답하고 나면 저절로 이어서 재생', true);

/* ③-2 meaning */
await page.locator('.dr-opt', { hasText: '조금만 버텨 봐요' }).click();
check('정답 해설', await page.evaluate(() => document.querySelector('.dr-note.ok')?.textContent.includes('hang in there')));

/* 일시정지 → 수동 진행 */
await page.click('.dr-auto');
check('일시정지하면 다음 버튼이 나타난다', (await page.locator('.dr-next').count()) === 1);
check('자동 재생 설정이 저장된다', await page.evaluate(() => JSON.parse(localStorage.getItem('va_drama_auto')) === false));
await next();
await untilAct();

/* ③-3 speak — 건너뛰기 가능(부담 없음) */
check('따라 말하기 형식', await page.evaluate(() => document.querySelector('.dr-ask')?.textContent.includes('말해 보세요')));
await page.click('.dr-skip');
for (let g = 0; g < 20 && !(await page.locator('.dr-end').count()); g++) await next();

/* ④ 엔딩 */
await page.waitForSelector('.dr-end', { timeout: 5000 });
check('오늘의 표현 2개', (await page.locator('.dr-learn').count()) === 2);
check('이해도(1개 틀림)', await page.evaluate(() => /이해도 \d+%/.test(document.querySelector('.dr-end-score')?.textContent || '')));
check('다음 화 예고', await page.evaluate(() => document.querySelector('.dr-cliff p')?.textContent.includes('CEO')));
check('표현이 복습 카드로', await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]').some((w) => w.en === "It's my first day.")));

/* ⑤ 홈 */
await page.click('.dr-go:has-text("오늘은 여기까지")');
await page.click('.mode-tab:has-text("홈")');
await page.waitForSelector('.dr-card-title', { timeout: 15000 });
check('가이드가 사라진다', (await page.locator('.fg-card').count()) === 0);
check('홈의 주인공 = 오늘의 에피소드 EP 2(완료 표시)', await page.evaluate(() => /EP 2/.test(document.querySelector('.dr-card-title')?.textContent || '') && document.querySelector('.dr-card')?.textContent.includes('완료')));
check('지난 이야기의 예고가 훅으로', await page.evaluate(() => document.querySelector('.dr-card-hook')?.textContent.includes('CEO')));

/* ⑦ 2화 — 첫머리 복습 */
await page.click('.dr-card .dr-go');
await page.waitForSelector('.dr-log', { timeout: 20000 });
// 앞에서 자동 재생을 꺼 두었으므로(설정 유지) 수동으로 넘긴다
await untilAct();
check('2화는 지난 화 표현 복습부터', await page.evaluate(() => document.querySelector('.dr-ask')?.textContent.includes('지난 화')));
const recallOk = await page.evaluate(() => [...document.querySelectorAll('.dr-opt')].map((b) => b.textContent));
check('복습 보기 3개', recallOk.length === 3);
await page.locator('.dr-opt', { hasText: "It's my first day." }).click();
await page.waitForSelector('.dr-note.ok', { timeout: 5000 });
check('맞히면 기억 칭찬 + 뜻', await page.evaluate(() => document.querySelector('.dr-note.ok')?.textContent.includes('첫 출근')));
check('복습 결과가 간격 반복에 반영(상자 증가)', await page.evaluate(() => (JSON.parse(localStorage.getItem('va_weak') || '[]').find((w) => w.en === "It's my first day.")?.box || 0) >= 1));

/* ⑥ AI 이어쓰기 — 7화까지는 원고, 8화부터 생성 */
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('va_drama'));
  for (let n = 2; n <= 7; n++) p.done[String(n)] = '2026-01-01';
  localStorage.setItem('va_drama', JSON.stringify(p));
});
await page.goto(`${BASE}/app`);
await page.waitForSelector('.dr-card-title', { timeout: 15000 });
check('다음 화 EP 8 · 새 이야기(1~7화는 직접 쓴 원고)', await page.evaluate(() => document.querySelector('.dr-card-title')?.textContent.includes('EP 8')));
await page.click('.dr-card .dr-go');
await page.waitForSelector('.dr-log', { timeout: 20000 });
check('AI가 8화를 써서 바로 재생', genCalls === 1 && (await page.evaluate(() => document.querySelector('.dr-ep')?.textContent.includes('금요일의 대면'))));

await browser.close();
finish();
