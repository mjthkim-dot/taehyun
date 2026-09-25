/**
 * 좁은 화면 가독성 회귀 방지 — 320px(iPhone SE)·360px에서
 * ① 가로 스크롤이 생기지 않는다 ② 컨테이너를 삐져나오는 요소가 없다
 * ③ 홈 히어로 제목이 한 줄로 유지된다(어절 중간 줄바꿈 사고 재발 방지).
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();

/** 의도적으로 가로 스크롤/말줄임을 쓰는 요소는 제외하고 넘침을 찾는다. */
const OVERFLOW_PROBE = () => {
  const bad = [];
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.position === 'fixed') return;
    if (cs.textOverflow === 'ellipsis') return; // 말줄임은 설계된 잘림
    // 말풍선 꼬리처럼 '의도적으로 걸쳐 나오는' 장식용 절대배치 가상요소는 제외한다.
    // 실제 잘림 여부는 아래 꼬리 가시성 검사로 따로 확인한다.
    const after = getComputedStyle(el, '::after');
    if (after && after.position === 'absolute' && after.content && after.content !== 'none') return;
    // 말풍선 컨테이너도 같은 이유(자식 꼬리의 의도된 돌출)로 제외 — 실제 잘림은
    // 아래 '꼬리가 잘리지 않음' 검사가 책임진다.
    if (el.classList.contains('msg')) return;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 30) {
      bad.push(`${el.className || el.tagName}(+${el.scrollWidth - el.clientWidth}px)`);
    }
  });
  return [...new Set(bad)];
};

for (const width of [320, 360]) {
  const page = await browser.newPage({ viewport: { width, height: 860 } });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
  await page.route('**/app/api/groq', (r) =>
    r.request().method() === 'GET'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasServerKey: false }) })
      : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) })
  );
  await seedKey(page);

  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.waitForTimeout(400);

  check(`${width}px 홈: 가로 스크롤 없음`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  const homeBad = await page.evaluate(OVERFLOW_PROBE);
  check(`${width}px 홈: 넘치는 요소 없음`, homeBad.length === 0, homeBad.join(', '));

  // 히어로 제목이 두 줄로 접히면(=어절 중간 줄바꿈 위험) 실패로 잡는다
  const heroLines = await page.evaluate(() => {
    const el = document.querySelector('.home-hero-title');
    const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.4;
    return Math.round(el.getBoundingClientRect().height / lh);
  });
  check(`${width}px 히어로 제목 한 줄 유지`, heroLines <= 1, `${heroLines}줄`);

  // 회화 화면: 입력창 + 마이크 + 전송이 화면 안에 다 들어와야 한다
  await page.click('.mode-tab:has-text("회화")');
  await page.waitForSelector('.talk-screen .controls', { timeout: 10000 });
  await page.waitForTimeout(300);
  check(`${width}px 회화: 가로 스크롤 없음`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  const sendVisible = await page.evaluate(() => {
    const btns = document.querySelectorAll('.controls .round-btn');
    const last = btns[btns.length - 1];
    return last ? last.getBoundingClientRect().right <= window.innerWidth + 1 : false;
  });
  check(`${width}px 회화: 전송 버튼이 화면 안에 있음`, sendVisible);
  const talkBad = await page.evaluate(OVERFLOW_PROBE);
  check(`${width}px 회화: 넘치는 요소 없음`, talkBad.length === 0, talkBad.join(', '));

  // 말풍선이 있는 상태도 검사한다 — 꼬리(::after)가 컨테이너를 넘어 잘리던 결함이 있었다
  await page.fill('.controls .text-input', 'If we look at the three-year TCO, the gap narrows considerably.');
  await page.click('.round-btn.send');
  await page.waitForSelector('.msg.user .bubble', { timeout: 8000 });
  await page.waitForTimeout(300);
  const msgBad = await page.evaluate(OVERFLOW_PROBE);
  check(`${width}px 말풍선: 넘치는 요소 없음`, msgBad.length === 0, msgBad.join(', '));
  const tail = await page.evaluate(() => {
    const b = document.querySelector('.msg.user .bubble').getBoundingClientRect();
    const box = document.querySelector('.chat-box');
    const r = box.getBoundingClientRect();
    return { bubbleRight: Math.round(b.right), boxRight: Math.round(r.right), clientRight: Math.round(r.left + box.clientWidth) };
  });
  check(`${width}px 말풍선 꼬리가 잘리지 않음`, tail.bubbleRight + 5 <= tail.clientRight + 1, JSON.stringify(tail));

  await page.close();
}

await browser.close();
finish('12-layout');
