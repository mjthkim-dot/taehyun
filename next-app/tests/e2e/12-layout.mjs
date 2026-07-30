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

  await page.close();
}

await browser.close();
finish('12-layout');
