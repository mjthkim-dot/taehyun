/**
 * 홈 + 미션 완주 루프: 완료는 잠겨 있고, 표현 3개를 실제로
 * 듣기→말하기(채점 통과)→리콜해야 열린다. 딥카드·저장·링 갱신 포함.
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await seedKey(page);
// 가짜 SpeechRecognition — window.__SR_TEXT를 최종 발화로 돌려줘 채점을 통과시킨다.
await page.addInitScript(() => {
  class FakeSR {
    constructor() { this.continuous = true; this.interimResults = true; this.lang = 'en-US'; this.maxAlternatives = 1; }
    start() {
      this._t = setTimeout(() => {
        const results = [{ 0: { transcript: window.__SR_TEXT || '' }, isFinal: true, length: 1 }];
        results.length = 1;
        this.onresult && this.onresult({ resultIndex: 0, results });
        this.onend && this.onend();
      }, 100);
    }
    stop() { this.onend && this.onend(); }
    abort() { clearTimeout(this._t); }
  }
  window.SpeechRecognition = FakeSR;
  window.webkitSpeechRecognition = FakeSR;
});
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

check('기본 화면이 홈', (await page.evaluate(() => document.querySelector('.app-header h1')?.textContent)) === '홈');
check('핵심 표현 5개', (await page.evaluate(() => document.querySelectorAll('.mission-phrase').length)) === 5);

// 완료 버튼은 시작 시 잠겨 있어야 한다 (완주 루프의 핵심)
const lockedAtStart = await page.evaluate(() => document.querySelector('.mission-complete')?.disabled);
check('완료 버튼이 처음엔 잠김', lockedAtStart === true);

// 표현장 저장(첫 표현)
await page.locator('.mission-phrase').first().locator('.mission-ic').last().click();
await page.waitForTimeout(200);
check('표현장 저장', (await page.evaluate(() => JSON.parse(localStorage.getItem('va_phrases') || '[]').length)) === 1);

const phraseEns = await page.evaluate(() => Array.from(document.querySelectorAll('.mission-phrase-en')).map((e) => e.textContent));

// ── 표현 3개 완주: 듣기 → 딥카드 리콜 → 말하기(채점) ──
for (let i = 0; i < 3; i++) {
  const row = page.locator('.mission-phrase').nth(i);
  // 듣기
  await row.locator('.mission-ic').first().click();
  await page.waitForTimeout(150);
  // 딥카드 열고 리콜 통과
  await row.locator('.mission-phrase-main').click();
  await page.waitForSelector('.deep-recall', { timeout: 5000 });
  if (i === 0) {
    check('딥카드 리콜에 한국어 뜻 표시', !!(await page.evaluate(() => document.querySelector('.deep-recall-kr')?.textContent)));
    check('리콜 중 목록 영어 블러 처리', await page.evaluate(() => !!document.querySelector('.mission-phrase.recalling')));
  }
  await page.locator('.deep-recall-btn').click();
  await page.locator('.deep-recall-yes').click();
  await page.waitForTimeout(150);
  await row.locator('.mission-phrase-main').click(); // 카드 접기
  // 말하기: 연습 대상을 i번째 문장으로 맞춘 뒤 가짜 발화로 통과
  const target = phraseEns[i];
  for (let guard = 0; guard < 6; guard++) {
    const cur = await page.evaluate(() => document.querySelector('.mission-practice .target')?.textContent?.trim());
    if (cur === target) break;
    await page.locator('.mission-mini-next').click();
    await page.waitForTimeout(150);
  }
  await page.evaluate((t) => { window.__SR_TEXT = t; }, target);
  await page.locator('.mission-practice .mic').click();
  await page.waitForTimeout(500);
}

const masteredTxt = await page.evaluate(() => document.querySelector('.mission-progress-txt')?.textContent);
check('완주 3/3 표시', masteredTxt?.includes('3/3') === true, masteredTxt || '');

const unlocked = await page.evaluate(() => document.querySelector('.mission-complete')?.disabled === false);
check('3개 완주 후 완료 버튼 열림', unlocked);

const ringBefore = await page.evaluate(() => document.querySelector('svg text')?.textContent);
await page.click('.mission-complete');
await page.waitForTimeout(300);
check('완료 배너', !!(await page.evaluate(() => document.querySelector('.mission-done-banner'))));
const ringAfter = await page.evaluate(() => document.querySelector('svg text')?.textContent);
check('목표 링 즉시 갱신', ringBefore !== ringAfter, `${ringBefore} → ${ringAfter}`);

// ── 학습 경로(Path): 노드 렌더 + current 강조 + 탭하면 레슨으로 이동 ──
check('경로 노드 32개(전 유닛)', (await page.evaluate(() => document.querySelectorAll('.path-node').length)) === 32);
check('current 노드는 정확히 1개', (await page.evaluate(() => document.querySelectorAll('.path-node.current').length)) === 1);
await page.locator('.path-node.current').click();
await page.waitForTimeout(500);
check('경로 노드 탭 → 레슨 화면', (await page.evaluate(() => document.querySelector('.app-header h1')?.textContent)) === '레슨');

await browser.close();
finish('01-home-mission');
