/**
 * Preply 수업 노트 파이프라인(글로벌 미션 P0-A) — 계약:
 *   ① 토큰 미설정이어도 시드 스냅숏(7회차)이 뜨고, 동기화 시 설정 안내가 나온다
 *   ② 노트 문장이 SRS(cat '수업')·표현장에 자동 등록되고 노트 단위로 멱등이다
 *   ③ 동기화: 5xx 2회 후 성공 → 재시도로 회복, AI 구조화 결과가 캐시되어
 *      두 번째 동기화는 AI 재호출이 없다
 *   ④ 회차 문장 → 드릴 핸드오프가 동작한다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const RAW_NOTE = {
  id: 'note-8',
  title: '8회차',
  raw: '8회차 수업 2026-08-12. 현재완료 도입. It\'s been a while. How have you been? 연습. 숙제: 현재완료 문장 10개.',
};
const EXTRACTED = JSON.stringify({
  title: '현재완료 도입',
  date: '2026-08-12',
  grammar: ['현재완료: have + p.p.'],
  sentences: [{ en: "It's been a while. How have you been?", kr: '오랜만이에요. 어떻게 지내셨어요?' }],
  pron: [],
  homework: ['현재완료 문장 10개'],
  weakPoints: ['현재완료 즉각 발화'],
});

const browser = await launch();

/* ── ① 미설정 + 시드 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/notion/preply', (r) => r.fulfill({ status: 501, contentType: 'application/json', body: '{"configured":false}' }));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  await seedKey(page);
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("수업 노트")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("수업 노트")');
  await page.waitForSelector('.pp-note', { timeout: 10000 });

  check('시드 스냅숏 7개 회차가 뜬다', (await page.locator('.pp-note').count()) === 7);
  check('시드 상태 라벨이 정직하다', (await page.evaluate(() => document.querySelector('.pp-src')?.textContent || '')).includes('시드 스냅숏'));

  /* ② SRS 자동 등록 + 멱등 */
  const srs1 = await page.evaluate(() => ({
    weak: JSON.parse(localStorage.getItem('va_weak') || '[]').filter((w) => w.cat === '수업').length,
    imported: JSON.parse(localStorage.getItem('va_preply_imported') || '[]').length,
  }));
  check('노트 문장이 SRS에 자동 등록된다', srs1.weak >= 20 && srs1.imported === 7, JSON.stringify(srs1));
  // 리로드는 홈으로 돌아간다(모드 상태 리셋) — 재진입 경로로 멱등성을 검증한다
  await page.reload();
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("수업 노트")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("수업 노트")');
  await page.waitForSelector('.pp-note', { timeout: 10000 });
  const srs2 = await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]').filter((w) => w.cat === '수업').length);
  check('재방문해도 중복 등록되지 않는다(멱등)', srs2 === srs1.weak, `${srs1.weak}→${srs2}`);

  /* 미설정 안내 */
  await page.click('button:has-text("동기화")');
  await page.waitForSelector('.pp-setup', { timeout: 8000 });
  check('미설정이면 설정 안내가 뜬다(실패로 취급하지 않음)', (await page.evaluate(() => document.querySelector('.pp-setup')?.textContent || '')).includes('NOTION_API_KEY'));

  /* ④ 드릴 핸드오프 */
  await page.click('.pp-note-head >> nth=0');
  await page.waitForSelector('.pp-body', { timeout: 8000 });
  await page.click('button:has-text("이 회차 문장으로 드릴")');
  await page.waitForSelector('.drill-source', { timeout: 10000 });
  check('회차 문장이 드릴 큐로 넘어간다', (await page.evaluate(() => document.querySelector('.drill-source')?.textContent || '')).includes('회차 수업'));
  await page.close();
}

/* ── ③ 동기화: 재시도 회복 + AI 구조화 캐시 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  let notionCalls = 0;
  await page.route('**/app/api/notion/preply', (r) => {
    notionCalls++;
    if (notionCalls <= 2) return r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"tmp"}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, notes: [RAW_NOTE] }) });
  });
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  let extractCalls = 0;
  await page.route('**/app/api/groq', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const isExtract = (body.messages || []).some((m) => String(m.content || '').includes('학습 카드로 구조화'));
    if (isExtract) extractCalls++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: isExtract ? EXTRACTED : '{}' } }] }) });
  });
  await seedKey(page);
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("수업 노트")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("수업 노트")');
  await page.waitForSelector('.pp-note', { timeout: 10000 });

  await page.click('button:has-text("동기화")');
  await page.waitForFunction(() => document.body.textContent.includes('동기화 완료'), null, { timeout: 20000 });
  check('5xx 2회 후 성공 — 재시도로 회복한다', notionCalls === 3, `호출 ${notionCalls}회`);
  check('AI 구조화가 1회 수행된다', extractCalls === 1, String(extractCalls));
  check('동기화 라벨로 바뀐다', (await page.evaluate(() => document.querySelector('.pp-src')?.textContent || '')).includes('Notion 동기화'));
  const note8 = await page.evaluate(() => document.body.innerText.includes('현재완료 도입'));
  check('동기화된 노트가 화면에 뜬다', note8);

  // 두 번째 동기화 — 해시 캐시로 AI 재호출 없음
  await page.click('button:has-text("동기화")');
  await page.waitForFunction(() => document.body.textContent.includes('동기화 완료'), null, { timeout: 20000 });
  check('같은 원문은 AI를 다시 부르지 않는다(해시 캐시)', extractCalls === 1, String(extractCalls));
  await page.close();
}

await browser.close();
finish();
