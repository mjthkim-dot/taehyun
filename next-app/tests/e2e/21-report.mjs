/**
 * 주간 리포트 — 이미 쌓이던 데이터를 '읽을 수 있는 형태'로 묶는 화면.
 * 계약: ① 최근 7일 합계와 지난주 대비 증감이 정확하다 ② 요일 막대가 렌더된다
 *       ③ 자주 틀린 표현이 실패 횟수 순으로 나온다 ④ 다음 행동으로 연결된다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await seedKey(page);

// 최근 14일 발화 로그를 심는다: 지난주 총 10, 이번 주 총 25(=15 증가)
await page.addInitScript(() => {
  const key = (i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const log = {};
  // 8~13일 전(지난주 구간): 합계 10
  [8, 9, 10, 11, 12].forEach((i, n) => { log[key(i)] = [2, 2, 2, 2, 2][n]; });
  // 0~6일 전(이번 주): 합계 25
  [0, 1, 2, 3, 4].forEach((i, n) => { log[key(i)] = [5, 5, 5, 5, 5][n]; });
  localStorage.setItem('va_spoken_log', JSON.stringify(log));
  localStorage.setItem('va_daycount', JSON.stringify({ [key(0)]: 3, [key(1)]: 2, [key(2)]: 1 }));
  // 반복 실패 항목 — 실패 횟수 순으로 나와야 한다
  localStorage.setItem('va_weak', JSON.stringify([
    { en: 'I am a designer.', kr: '저는 디자이너입니다.', box: 0, lapses: 2, due: 0 },
    { en: 'It depends on the client.', kr: '고객에 따라 달라요.', box: 0, lapses: 5, due: 0 },
    { en: 'Never used.', kr: '안 틀림', box: 3, lapses: 0, due: Date.now() + 8.64e7 },
  ]));
  // CAF 세션 6개 — 최근 3개 평균이 이전 3개보다 높아야 '▲'
  const caf = (c, a, f) => ({ date: new Date().toISOString(), cefr: 'B1', caf: { complexity: c, accuracy: a, fluency: f } });
  localStorage.setItem('va_sessions', JSON.stringify([caf(4, 4, 4), caf(4, 4, 4), caf(4, 4, 4), caf(7, 7, 7), caf(7, 7, 7), caf(7, 7, 7)]));
});

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("진도")');
await page.waitForSelector('.wr', { timeout: 10000 });

const stats = await page.evaluate(() => Array.from(document.querySelectorAll('.wr-stat')).map((el) => el.textContent || ''));
check('이번 주 말한 문장 합계(25)', stats[0]?.includes('25'), stats[0]);
check('지난주 대비 증가(+15)', stats[0]?.includes('15'), stats[0]);
check('학습일 표시', /\d+/.test(stats[1] || ''), stats[1]);
check('요일 막대 7개', (await page.evaluate(() => document.querySelectorAll('.wr-bar').length)) === 7);
check('오늘 막대 강조', (await page.evaluate(() => document.querySelectorAll('.wr-bar.today').length)) === 1);

const headline = await page.evaluate(() => document.querySelector('.wr-headline')?.textContent || '');
check('총평 한 줄 제공', headline.length > 10, headline.slice(0, 40));

const weak = await page.evaluate(() => Array.from(document.querySelectorAll('.wr-weak-en')).map((e) => e.textContent));
check('자주 틀린 표현 노출', weak.length === 2, JSON.stringify(weak));
check('실패 횟수 많은 순 정렬', (weak[0] || '').includes('depends on the client'), weak[0]);
check('한 번도 안 틀린 항목은 제외', !weak.join(' ').includes('Never used'));

const cafRow = await page.evaluate(() => document.querySelector('.wr-row-value')?.textContent || '');
check('CAF 추세 표시(상승)', cafRow.includes('7') && cafRow.includes('▲'), cafRow);

check('다음에 이어갈 유닛 제시', (await page.evaluate(() => document.querySelectorAll('.wr-next').length)) >= 1);

// 다음 행동으로 이어지는지 — 유닛을 누르면 레슨 화면
await page.locator('.wr-next').first().click();
await page.waitForTimeout(600);
check('유닛 탭 → 레슨 화면', (await page.evaluate(() => document.querySelector('.app-header h1')?.textContent)) === '레슨');

await browser.close();
finish('21-report');
