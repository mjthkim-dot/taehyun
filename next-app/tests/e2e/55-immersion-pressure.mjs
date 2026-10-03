/**
 * 고수 미션 1차 — "입력의 절대량"과 "예측 불가능성" 격차의 계약:
 *   ① 몰입 스토리: 시드 2화가 뜨고, 해석은 탭해야 열린다(영어 우선 읽기)
 *   ② 퀴즈 제출 → 읽음 처리 + 단어장이 SRS(cat '몰입')로(멱등)
 *   ③ 다음 화 생성 → 시리즈에 붙고 난이도는 성숙도 연동(초기 A2)
 *   ④ 회화 돌발 모드: 토글 ON이면 시스템 프롬프트에 압박 지시가 실리고,
 *      OFF면 없다. 반응 속도 칩이 두 번째 발화부터 나타난다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const EP3 = JSON.stringify({
  title: 'The Dark Terminal',
  titleKr: '어두워진 터미널',
  recap: '불이 꺼진 공항에서 태오는 30번 게이트로 달린다.',
  sentences: [
    { en: 'The airport was completely dark.', kr: '공항은 완전히 어두웠다.' },
    { en: 'People started to shout.', kr: '사람들이 소리치기 시작했다.' },
    { en: 'Taeo held the phone tightly.', kr: '태오는 폰을 꽉 쥐었다.' },
    { en: 'He remembered the voice: Gate 30.', kr: '그는 목소리를 기억했다: 30번 게이트.' },
    { en: 'He started to run.', kr: '그는 달리기 시작했다.' },
    { en: 'Someone was running behind him.', kr: '누군가 그의 뒤에서 달리고 있었다.' },
    { en: 'The footsteps came closer.', kr: '발소리가 가까워졌다.' },
    { en: 'Then a hand grabbed his shoulder.', kr: '그때 손 하나가 그의 어깨를 붙잡았다.' },
  ],
  vocab: [
    { en: 'hold ~ tightly', kr: '~을 꽉 쥐다' },
    { en: 'The footsteps came closer.', kr: '발소리가 가까워졌다.' },
  ],
  quiz: [{ q: '태오가 달려간 곳은?', options: ['43번 게이트', '30번 게이트', '주차장'], answer: 1 }],
});

const browser = await launch();

/* ── ①②③ 몰입 스토리 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  let genCalls = 0;
  await page.route('**/app/api/groq', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const isGen = (body.messages || []).some((m) => String(m.content || '').includes('연재 소설'));
    if (isGen) genCalls++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: isGen ? EP3 : '{}' } }] }) });
  });
  await seedKey(page);
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("몰입 스토리")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("몰입 스토리")');
  await page.waitForSelector('.rc-head', { timeout: 10000 });

  check('시드 2화 + 초기 난이도 A2', await page.evaluate(() => {
    const stats = Array.from(document.querySelectorAll('.rc-stat b')).map((b) => b.textContent);
    return stats[0] === '2' && stats[2] === 'A2';
  }));

  /* ① 해석은 탭해야 */
  await page.click('.mn-item:has-text("바뀐 휴대폰") .mn-item-head');
  await page.waitForSelector('.im-sent', { timeout: 8000 });
  check('해석이 처음엔 숨겨져 있다', (await page.locator('.im-sent-kr').count()) === 0);
  await page.click('.im-sent >> nth=0');
  check('문장을 탭하면 해석이 열린다', (await page.locator('.im-sent-kr').count()) === 1);

  /* ② 퀴즈 → 읽음 + SRS */
  await page.click('.im-quiz >> nth=0 >> .im-quiz-opt >> nth=1');
  await page.click('.im-quiz >> nth=1 >> .im-quiz-opt >> nth=1');
  await page.waitForFunction(() => document.body.innerText.includes('1화 완료'), null, { timeout: 8000 });
  const s1 = await page.evaluate(() => ({
    read: JSON.parse(localStorage.getItem('va_immersion_read') || '[]'),
    weak: JSON.parse(localStorage.getItem('va_weak') || '[]').filter((w) => w.cat === '몰입').length,
  }));
  check('읽음 처리 + 단어장 4개 SRS 등록', s1.read.includes(1) && s1.weak === 4, JSON.stringify(s1));
  check('정답이 초록으로 표시된다', (await page.locator('.im-quiz-opt.correct').count()) === 2);

  /* ③ 다음 화 생성 */
  await page.click('.mn-item:has-text("남은 20분") .mn-item-head');
  await page.waitForSelector('button:has-text("다음 화 만들기")', { timeout: 8000 });
  await page.click('button:has-text("다음 화 만들기")');
  await page.waitForFunction(() => document.body.innerText.includes('어두워진 터미널'), null, { timeout: 20000 });
  check('다음 화가 시리즈에 붙는다(3화)', genCalls === 1 && (await page.evaluate(() => Array.from(document.querySelectorAll('.rc-stat b'))[0]?.textContent === '3')));
  const ep3 = await page.evaluate(() => JSON.parse(localStorage.getItem('va_immersion') || '[]')[0]);
  check('생성 화의 난이도가 성숙도 연동(A2)', ep3?.level === 'A2' && ep3?.no === 3, JSON.stringify({ level: ep3?.level, no: ep3?.no }));
  await page.close();
}

/* ── ④ 회화 돌발 모드 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  const sysLog = [];
  await page.route('**/app/api/groq', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.stream) {
      sysLog.push(String(body.messages?.[0]?.content || ''));
      const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Oh interesting — but what would you do if the client said no?' } }] })}\n\ndata: [DONE]\n\n`;
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
  });
  await seedKey(page);
  await page.goto(`${BASE}/app`);
  await page.waitForTimeout(1200);
  await page.click('.mode-tab:has-text("회화")');
  await page.waitForSelector('input.text-input', { timeout: 8000 });
  await page.waitForSelector('.pressure-toggle', { timeout: 8000 });

  /* OFF 상태 발화 → 지시 없음 */
  await page.fill('input.text-input', 'Good morning!');
  await page.click('button.round-btn.send');
  await page.waitForFunction(() => document.body.textContent.includes('what would you do'), null, { timeout: 10000 });
  check('OFF면 압박 지시가 없다', sysLog.length === 1 && !sysLog[0].includes('돌발 모드'));

  /* ON → 지시 실림 + 반응 칩 */
  await page.click('.pressure-toggle');
  await page.fill('input.text-input', 'I would offer a discount.');
  await page.click('button.round-btn.send');
  await page.waitForFunction(() => document.querySelectorAll('.msg.ai').length >= 2 || document.body.textContent.split('what would you do').length >= 3, null, { timeout: 10000 });
  check('ON이면 압박 지시가 실린다', sysLog.length === 2 && sysLog[1].includes('돌발 모드') && sysLog[1].includes('후속 질문'));
  check('반응 속도 칩이 나타난다', await page.evaluate(() => document.body.innerText.includes('평균 반응')));
  await page.close();
}

await browser.close();
finish();
