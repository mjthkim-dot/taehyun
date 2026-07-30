/**
 * 커리큘럼 커버리지 — 경로의 모든 노드에 실제 레슨 콘텐츠가 있어야 하고,
 * CEFR 핵심 문법 영역이 빠져 있으면 안 된다.
 * 배경: 전치사·관계대명사·구동사·수량 표현 등 필수 영역이 통째로 없었다
 * (노드는 32개였지만 문법 실러버스에 구멍이 있었다).
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.path-node', { timeout: 15000 });

const titles = await page.evaluate(() => Array.from(document.querySelectorAll('.path-node')).map((n) => n.textContent || ''));
const all = titles.join(' | ');

// 반드시 커버돼야 하는 문법 영역(표기가 바뀌어도 견디도록 키워드로 검사)
const REQUIRED = [
  ['전치사(시간·장소)', /전치사/],
  ['관계대명사', /관계대명사/],
  ['구동사', /구동사/],
  ['수량 표현·there is', /there is|수량/i],
  ['의문문', /의문문/],
  ['접속사·절 연결', /접속사/],
  ['시제 심화(완료진행)', /시제 심화|have been/i],
  ['분사구문·명사절', /분사구문|명사절/],
  ['가정법', /가정법/],
  ['수동태', /수동태/],
  ['조동사', /조동사/],
  ['현재 완료', /현재 완료/],
];
for (const [label, re] of REQUIRED) {
  check(`커리큘럼에 ${label} 포함`, re.test(all));
}

check('경로 노드가 41개', titles.length === 41, String(titles.length));

// 모든 노드가 실제 레슨으로 연결되는지 — 콘텐츠 없는 노드를 탭하면 빈 화면이 된다.
// 새로 추가한 유닛 중 하나(전치사)를 실제로 열어 본문·예문이 렌더되는지 확인한다.
const prepIdx = titles.findIndex((t) => /전치사 ①/.test(t));
check('전치사 노드가 경로에 있음', prepIdx >= 0);
await page.locator('.path-node').nth(prepIdx).click();
await page.waitForTimeout(600);
check('탭하면 레슨 화면으로 이동', (await page.evaluate(() => document.querySelector('.app-header h1')?.textContent)) === '레슨');
const body = await page.evaluate(() => document.body.textContent || '');
check('전치사 레슨 본문 렌더', /at 7|시간 전치사|on Monday/.test(body));
check('전치사 레슨에 장소 설명 포함', /장소 전치사|on the table/.test(body));

await browser.close();
finish('14-curriculum');
