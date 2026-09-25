/**
 * 훈련 대시보드(Phase 4) — "늘고 있는가"가 보이는 계약:
 *   ① 시도 로그가 있으면 진도 화면 맨 위에 2주 발화·평균 정확도·오늘 입 트임이 뜬다
 *   ② 정확도 막대(최근 7일)와 입 트임 라인이 그려진다
 *   ③ 약점(발음 축)·실전 사용·틀린 문장 드릴 진입이 한 카드에 모인다
 *   ④ 기록이 없으면 채근 없이 빈 상태 안내만 나온다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const browser = await launch();

/* ── ①②③ 데이터가 있을 때 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await seedKey(page);
  await page.addInitScript(() => {
    const now = Date.now();
    const log = [];
    for (let d = 6; d >= 0; d--) {
      for (let i = 0; i < 3; i++) {
        log.push({ t: now - d * 86400000 + i * 60000, en: `s${d}-${i}`, score: 70 + (6 - d) * 4, latencyMs: 2000 - (6 - d) * 150, durationMs: 4000, src: 'session' });
      }
    }
    localStorage.setItem('va_attempt_log', JSON.stringify(log));
    localStorage.setItem('va_pron', JSON.stringify([{ key: 'r-l', date: new Date(now).toISOString().slice(0, 10), count: 3 }]));
    localStorage.setItem('va_mistakes', JSON.stringify([
      { wrong: 'I go meeting', right: 'I went to the meeting.', note: '과거 시제', t: now - 1000 },
      { wrong: 'discuss about it', right: "Let's discuss it.", note: 'discuss는 전치사 없이', t: now - 2000 },
    ]));
    localStorage.setItem('va_pattern_use', JSON.stringify({ 'id-like': 2 }));
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("진도")');
  await page.waitForSelector('.dash-hero', { timeout: 10000 });

  const hero = await page.evaluate(() => document.querySelector('.dash-hero')?.innerText || '');
  check('요약 히어로: 2주간 발화 수', hero.includes('21') && hero.includes('2주간 발화'), hero.replace(/\n/g, ' '));
  check('요약 히어로: 평균 정확도', hero.includes('평균 정확도'));
  check('요약 히어로: 오늘 입 트임(초)', /\d\.\d\s*초/.test(hero.replace(/\n/g, '')), hero.replace(/\n/g, ' '));

  const charts = await page.evaluate(() => ({
    bars: document.querySelectorAll('svg[aria-label="일별 평균 정확도"] rect').length,
    line: document.querySelectorAll('svg[aria-label="발화 개시 지연 추이"] path').length,
    axis: document.querySelector('.dash-axis')?.textContent || '',
    used: document.querySelector('.dash-used')?.textContent || '',
  }));
  check('정확도 막대가 7일치 그려진다', charts.bars === 7, String(charts.bars));
  check('입 트임 라인이 그려진다', charts.line >= 1, String(charts.line));
  check('발음 약점 축이 보인다', charts.axis.includes('R / L'), charts.axis);
  check('실전 사용 횟수가 보인다', charts.used.includes('2회'), charts.used);

  // 틀린 문장 → 드릴
  await page.click('.dash .mx-practice-btn');
  await page.waitForSelector('.drill-source', { timeout: 10000 });
  check('약점 카드에서 드릴로 바로 간다', (await page.evaluate(() => document.querySelector('.drill-source')?.textContent || '')).includes('자주 틀리는 문장'));
  await page.close();
}

/* ── ④ 빈 상태 ── */
{
  const page = await browser.newPage();
  await page.route('**/app/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await seedKey(page);
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("진도")');
  await page.waitForSelector('.dash', { timeout: 10000 });
  const empty = await page.evaluate(() => document.querySelector('.dash')?.innerText || '');
  check('기록이 없으면 빈 상태 안내가 뜬다', empty.includes('아직 기록이 없어요'), empty.slice(0, 60));
  check('빈 상태에서는 히어로 숫자를 띄우지 않는다', (await page.locator('.dash-hero').count()) === 0);
  await page.close();
}

await browser.close();
finish();
