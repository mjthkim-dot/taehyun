/**
 * 견고성 — AI가 실패해도, 저장값이 망가져도 앱이 멈추지 않는다(감사 v1.30 #48, v1.31 견고성 점검):
 *   ① 문법: 이미 해 본 유닛은 AI 새 변형을 만드는데, AI가 429여도 '만드는 중…'에서 멈추지 않고 원본으로 진행
 *   ② 드라마: 8화 생성이 네트워크 오류여도 무한 로딩 없이 안내 + 허브로
 *   ③ 드라마: 허브를 열면 다음 AI 화를 미리 쓴다(누를 때 기다림 없음)
 *   ④ 손상된 저장값(배열/객체가 뒤바뀜)이어도 홈·드라마·진도·단어가 뜬다
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const EP8 = {
  level: 'A2', title: 'New Boss', titleKr: '새 상사', recap: 'Grant가 계약을 유지하기로 했다.',
  scenes: [
    { type: 'narr', kr: '월요일 아침. 사무실에 낯선 사람이 있다.' },
    { type: 'line', who: 'maya', en: 'Taeo, meet our new boss.', kr: '태오, 새 상사를 소개할게요.' },
    { type: 'line', who: 'taeo', en: 'Nice to meet you.', kr: '만나서 반가워요.' },
    { type: 'choice', prompt: '어디서 일했는지 물어보자.', opts: [
      { en: 'Where did you work before?', ok: true, kr: '전에 어디서 일했어요?', reply: { who: 'maya', en: 'She was at Google.', kr: '구글에 있었대요.' } },
      { en: 'Where you work before?', ok: false, why: '과거 질문은 did가 필요해요.' },
      { en: 'Where do you worked before?', ok: false, why: 'did 뒤에는 동사원형.' },
    ] },
    { type: 'line', who: 'jun', en: 'Wow. That is cool.', kr: '와. 멋지다.' },
    { type: 'line', who: 'maya', en: 'She means business.', kr: '그녀는 진지해요.' },
    { type: 'meaning', who: 'jun', en: "Let's fix it together.", opts: ['같이 고쳐 보자', '우리 따로 하자', '이건 못 고쳐'], a: 0, why: '5화에서 배운 표현 — 함께 해결하자.' },
    { type: 'line', who: 'taeo', en: 'I will do my best.', kr: '최선을 다할게요.' },
    { type: 'speak', who: 'taeo', en: 'I will do my best.', kr: '최선을 다할게요.' },
    { type: 'line', who: 'maya', en: 'Good. Coffee?', kr: '좋아요. 커피?' },
    { type: 'narr', kr: '그때 새 상사가 태오의 이름을 부른다.' },
  ],
  learn: [{ en: 'Where did you work before?', kr: '전에 어디서 일했어요?', note: '경력을 물을 때' }, { en: 'She means business.', kr: '그녀는 진지해요.', note: '진지한 태도를 말할 때' }],
  cliff: '새 상사는 왜 태오를 불렀을까?',
};

const browser = await launch();
const seedBase = () => {
  localStorage.setItem('va_onboarded', 'true');
  localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
  localStorage.setItem('va_drama_mute', 'true');
  localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
};

/* ① 문법 — AI 429 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(seedBase);
  await page.addInitScript(() => localStorage.setItem('va_grammar', JSON.stringify({ 'a2-past': { n: 1, best: 60, last: 60 } })));
  let calls = 0;
  await page.route('**/app/api/groq', (r) => {
    calls++;
    return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Rate limit reached' } }) });
  });
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.click('.more-sheet .feat-card:has-text("문법")');
  await page.waitForSelector('.gm-units', { timeout: 15000 });
  await page.click('.gm-lv:has-text("A2")');
  await page.click('.gm-unit:has-text("과거")');
  await page.waitForSelector('.gm-think', { timeout: 15000 });
  check('AI가 429여도 문법 유닛이 열린다(무한 로딩 없음)', calls >= 1);
  await ctx.close();
}

/* ② 드라마 — 8화 생성이 네트워크 오류 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(seedBase);
  await page.addInitScript(() => {
    const done = {};
    for (let n = 1; n <= 7; n++) done[n] = '2026-01-01';
    if (!localStorage.getItem('va_drama')) localStorage.setItem('va_drama', JSON.stringify({ done, score: {} }));
  });
  await page.route('**/app/api/groq', (r) => r.abort('internetdisconnected'));
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.dr-card .dr-go', { timeout: 15000 });
  await page.click('.dr-card .dr-go');
  await page.waitForFunction(() => document.body.innerText.includes('원고를 완성하지 못했어요'), null, { timeout: 20000 });
  check('생성 실패 → 안내와 함께 허브로(무한 로딩 없음)', (await page.locator('.gm-loading').count()) === 0 && (await page.locator('.dr-hero').count()) === 1);
  await ctx.close();
}

/* ③ 드라마 — 허브에서 다음 AI 화 미리 쓰기 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(seedBase);
  await page.addInitScript(() => {
    const done = {};
    for (let n = 1; n <= 7; n++) done[n] = '2026-01-01';
    if (!localStorage.getItem('va_drama')) localStorage.setItem('va_drama', JSON.stringify({ done, score: {} }));
    if (!localStorage.getItem('va_weak')) localStorage.setItem('va_weak', JSON.stringify([{ en: "Let's fix it together.", kr: '같이 고쳐 보자.', cat: '드라마', lesson: 'drama:5', box: 1, lapses: 0, due: 0 }]));
  });
  let gen = 0;
  let sysSeen = '';
  await page.route('**/app/api/groq', (r) => {
    const sys = String(JSON.parse(r.request().postData() || '{}').messages?.[0]?.content || '');
    let content = '{}';
    if (sys.includes('웹드라마 작가')) {
      gen++;
      sysSeen = sys;
      content = JSON.stringify(EP8);
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.click('.more-sheet .feat-card:has-text("드라마")');
  await page.waitForSelector('.dr-hero', { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.gm-unit-n')].some((e) => e.textContent === '8'), null, { timeout: 15000 });
  check('허브를 열면 다음 화(EP 8)를 미리 써 둔다', gen === 1);
  check('작가에게 복습할 지난 표현을 새 상황에서 다시 쓰게 한다', sysSeen.includes('복습 표현') && sysSeen.includes("Let's fix it together."));
  check('난이도는 학습자 레벨에 맞춘다', /영어 난이도: A[12]/.test(sysSeen));
  await page.click('.dr-hero .dr-go');
  await page.waitForSelector('.dr-log', { timeout: 5000 });
  check('누르면 기다림 없이 바로 재생(추가 호출 없음)', gen === 1 && (await page.evaluate(() => document.querySelector('.dr-ep')?.textContent.includes('새 상사'))));
  await ctx.close();
}

/* ④ 손상된 저장값 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('va_onboarded', 'true');
    localStorage.setItem('va_drama', JSON.stringify([1, 2, 3]));
    localStorage.setItem('va_drama_eps', JSON.stringify([null, 'x', { no: 9 }]));
    localStorage.setItem('va_weak', JSON.stringify({ en: 'broken' }));
    localStorage.setItem('va_words', JSON.stringify([1, 2]));
    localStorage.setItem('va_words_cfg', JSON.stringify({ daily: 'many', packs: 'all' }));
    localStorage.setItem('va_grammar', '"oops"');
    localStorage.setItem('va_cefr_evidence', JSON.stringify({ bad: true }));
    localStorage.setItem('va_days', '{not json');
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.waitForTimeout(1200);
  check('손상된 값이어도 홈이 뜬다', (await page.locator('.err-screen').count()) === 0 && (await page.locator('.fg-card, .dr-card').count()) >= 1);
  await page.click('.mode-tab:has-text("단어")');
  await page.waitForTimeout(1500);
  check('단어 탭이 뜬다', (await page.locator('.err-screen').count()) === 0);
  await page.click('.mode-tab:has-text("더보기")');
  await page.click('.more-sheet .feat-card:has-text("진도")');
  await page.waitForSelector('.quests', { timeout: 15000 });
  check('진도가 뜬다', true);
  await page.click('.mode-tab:has-text("더보기")');
  await page.click('.more-sheet .feat-card:has-text("드라마")');
  await page.waitForSelector('.dr-hero', { timeout: 15000 });
  check('드라마 허브가 뜬다(EP 1부터)', await page.evaluate(() => document.querySelector('.dr-hero .dr-go')?.textContent.includes('EP 1')));
  check('렌더 오류 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ⑤ 휴대폰 '뒤로'·이어 보기·나가기 */
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('va_onboarded', 'true');
    localStorage.setItem('va_drama_mute', 'true');
    localStorage.setItem('va_drama_auto', 'false');
    localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
  });
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  for (let g = 0; g < 6; g++) {
    if (await page.locator('.dr-act .dr-opt').count()) await page.locator('.dr-act .dr-opt').first().click();
    if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(120);
  }
  const pct = await page.evaluate(() => Number(document.querySelector('.dr-prog')?.getAttribute('aria-valuenow') || 0));
  check('진행 막대가 진행률을 알린다(progressbar)', pct > 0);
  // 마지막 대사가 아래 고정 버튼에 가리지 않는다(부드러운 스크롤이 끝난 뒤)
  await page.waitForTimeout(900);
  const overlap = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.dr-log > .dr-line, .dr-log > .dr-narr, .dr-log > .dr-note')];
    const last = items[items.length - 1]?.getBoundingClientRect();
    const bar = document.querySelector('.dr-next, .dr-playing')?.getBoundingClientRect();
    return last && bar ? Math.max(0, last.bottom - bar.top) : 0;
  });
  check('마지막 대사가 다음 버튼에 가리지 않는다(360px)', overlap === 0, `겹침 ${overlap}px`);
  await page.goBack();
  await page.waitForSelector('.dr-hero', { timeout: 5000 });
  check('뒤로 가기 = 에피소드 목록(앱이 닫히거나 홈으로 튕기지 않음)', (await page.locator('.dr-log').count()) === 0);
  await page.goBack();
  await page.waitForSelector('.fg-card, .dr-card', { timeout: 5000 });
  check('한 번 더 뒤로 = 홈', true);
  await page.click('.fg-cta');
  await page.waitForFunction(() => document.body.innerText.includes('지난번에'), null, { timeout: 10000 });
  check('보다 만 화는 이어 보기를 권한다', true);
  await page.click('button:has-text("이어서 보기")');
  await page.waitForSelector('.dr-log', { timeout: 5000 });
  const pct2 = await page.evaluate(() => Number(document.querySelector('.dr-prog')?.getAttribute('aria-valuenow') || 0));
  check('이어서 보면 멈춘 곳부터(0%가 아님)', pct2 > 0 && Math.abs(pct2 - pct) <= 10, `${pct} → ${pct2}`);
  check('나가기 버튼(✕)이 있다', (await page.locator('.dr-exit').count()) === 1);
  await page.click('.dr-exit');
  await page.waitForSelector('.dr-hero', { timeout: 5000 });
  check('✕ = 목록으로(진행은 저장)', await page.evaluate(() => !!JSON.parse(localStorage.getItem('va_drama_resume') || 'null')));
  check('오류 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
finish();
