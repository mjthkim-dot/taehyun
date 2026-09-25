/**
 * 이터레이션 3 — 스토리 비동기화 · 오디오 개선 · 시험 추이 · 유형 집중 드릴:
 *   ① 스토리가 비동기 청크가 돼도 홈 CTA·세션·성장·오디오가 그대로 동작한다
 *      (기존 39/38/45가 이미 검증 — 여기서는 홈 CTA의 비동기 채움만 확인)
 *   ② 오디오 모드: 0.85× 토글이 재생 속도에 반영되고, 최근 패턴 대화가 목록에 온다
 *   ③ 주간 시험이 2회 이상이면 진도에 추이 차트가 뜬다
 *   ④ 같은 유형 교정이 5건 이상이면 유형 집중 드릴이 열린다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const TTS_STUB = () => {
  window.__spoken = [];
  window.__rates = [];
  const synth = {
    speaking: false,
    paused: false,
    pending: false,
    getVoices: () => [],
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    speak: (u) => {
      window.__spoken.push(u.text);
      window.__rates.push(u.rate);
      setTimeout(() => u.onend && u.onend(), 30);
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
};

const browser = await launch();

/* ── ①② 홈 CTA(비동기 스토리) + 오디오 속도·최근 대화 ── */
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  await page.route('**/app/api/tts', (r) => r.fulfill({ status: 404, body: '' }));
  await seedKey(page);
  await page.addInitScript(TTS_STUB);
  await page.addInitScript(() => {
    localStorage.setItem('va_maturity_patterns', JSON.stringify(['id-like', 'could-you']));
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.session-cta', { timeout: 15000 });
  // 스토리가 비동기 로드된 뒤 CTA에 오늘 패턴이 채워진다
  await page.waitForFunction(() => (document.querySelector('.session-cta')?.textContent || '').includes('오늘의 패턴'), null, { timeout: 10000 });
  check('홈 CTA가 비동기 스토리 로드 후 패턴을 보여준다', true);

  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("기능")');
  await page.waitForSelector('.feat-grid .feat-card:has-text("오디오 모드")', { timeout: 8000 });
  await page.click('.feat-grid .feat-card:has-text("오디오 모드")');
  await page.waitForSelector('.al-card', { timeout: 10000 });

  const tags = await page.evaluate(() => [...document.querySelectorAll('.al-item-tag')].map((e) => e.textContent));
  check('최근 정착 패턴의 대화가 목록에 포함된다', tags.includes('최근 패턴'), JSON.stringify([...new Set(tags)]));

  // 0.85× 토글 → 재생 속도 반영
  await page.click('.mini-btn:has-text("0.85")');
  await page.click('.al-play');
  await page.waitForFunction(() => (window.__rates || []).length >= 1, null, { timeout: 15000 });
  const rates = await page.evaluate(() => window.__rates);
  check('0.85× 토글이 재생 속도에 반영된다', rates.some((r) => Math.abs(r - 0.85) < 0.11), JSON.stringify(rates.slice(0, 3)));
  await page.close();
}

/* ── ③④ 시험 추이 차트 + 유형 집중 드릴 ── */
{
  const page = await browser.newPage();
  await page.route('**/app/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await seedKey(page);
  await page.addInitScript(() => {
    localStorage.setItem('va_weekly_tests', JSON.stringify([
      { date: '2026-08-01', seconds: 60, words: 62, wpm: 62, used: ['id-like'] },
      { date: '2026-08-08', seconds: 60, words: 78, wpm: 78, used: ['id-like', 'get-back'] },
    ]));
    const now = Date.now();
    localStorage.setItem('va_mistakes', JSON.stringify(
      Array.from({ length: 5 }, (_, i) => ({ wrong: `w${i}`, right: `He went there yesterday, case ${i}.`, note: '과거 시제', t: now - i * 1000, type: 'tense' }))
    ));
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mission-card', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click('.more-sheet .feat-card:has-text("진도")');
  await page.waitForSelector('.wt-trend', { timeout: 10000 });

  const trend = await page.evaluate(() => ({
    cols: document.querySelectorAll('.wt-trend-col').length,
    vals: [...document.querySelectorAll('.wt-trend-val')].map((e) => e.textContent),
  }));
  check('주간 시험 추이 차트가 뜬다(2회)', trend.cols === 2, JSON.stringify(trend));
  check('단어 수가 막대 위에 보인다', trend.vals.includes('62') && trend.vals.includes('78'), JSON.stringify(trend.vals));

  const typeBtn = page.locator('button:has-text("시제 집중 드릴")');
  check('유형 5건 이상이면 집중 드릴 버튼이 뜬다', (await typeBtn.count()) === 1);
  await typeBtn.click();
  await page.waitForSelector('.drill-source', { timeout: 10000 });
  check('집중 드릴 큐가 유형 라벨로 열린다', (await page.evaluate(() => document.querySelector('.drill-source')?.textContent || '')).includes('시제 집중'));
  await page.close();
}

await browser.close();
finish();
