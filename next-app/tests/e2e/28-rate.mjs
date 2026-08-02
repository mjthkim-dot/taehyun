/**
 * 느리게 듣기 배속 — 0.6배속 고정을 사용자가 고를 수 있게 바꾼 것.
 *
 * 적당한 속도는 사람마다 다르다: 초급에겐 0.6도 빠르고, 귀가 트인 뒤에는 0.6이
 * 오히려 부자연스러워 원어민 리듬(연음·강세)을 못 익힌다. 계약은 네 가지다.
 *   ① 연습 화면에서 배속을 고를 수 있다
 *   ② 고른 값이 기기에 남아 다시 열어도 유지된다
 *   ③ 앱 전체(레슨·드릴·발음 훈련·듣기)가 같은 값을 쓴다 — 화면마다 따로 놀지 않는다
 *   ④ 실제 재생 속도가 그 값으로 바뀐다(라벨만 바뀌는 게 아니다)
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

/** 드릴은 기본이 '뜻 보고 말하기' — 영어와 듣기 버튼을 드러낸다. */
async function revealEnglish(pg) {
  const toggle = pg.locator('button:has-text("뜻 보고 말하기")').first();
  if (await toggle.count()) {
    await toggle.click().catch(() => {});
    await pg.waitForTimeout(300);
  }
}

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));

// 실제로 어떤 배속으로 재생되는지 가로챈다 — 라벨만 바뀌는 것을 진짜 변경으로 착각하지 않기 위해
await page.addInitScript(() => {
  window.__rates = [];
  const OrigUtter = window.SpeechSynthesisUtterance;
  if (OrigUtter) {
    window.SpeechSynthesisUtterance = function (t) {
      const u = new OrigUtter(t);
      Object.defineProperty(u, 'rate', {
        set(v) {
          window.__rates.push(v);
          this._rate = v;
        },
        get() {
          return this._rate;
        },
      });
      return u;
    };
  }
  // 오디오 경로(TTS 프록시)로 나가는 경우도 잡는다
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
  Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
    set(v) {
      window.__rates.push(v);
      desc.set.call(this, v);
    },
    get() {
      return desc.get.call(this);
    },
  });
});
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("드릴")');
await page.waitForSelector('.speaking-practice', { timeout: 10000 });

/* ── ① 고를 수 있다 ──
 * 드릴 기본은 '뜻 보고 말하기'라 영어와 듣기 버튼이 가려진다. 배속 선택은 소리를
 * 내지 않으므로 그 상태에서도 닿을 수 있어야 한다 — 듣기 버튼에 묶으면 이 모드에서는
 * 설정 자체가 사라진다. */
check('정답을 가린 모드에서도 배속 설정에 닿는다', (await page.locator('.rate-open').count()) > 0);
await page.click('.rate-open');
await page.waitForSelector('.rate-picker', { timeout: 5000 });
const opts = await page.evaluate(() => [...document.querySelectorAll('.rate-opt.slow-opt')].map((e) => e.textContent.trim()));
check('배속 선택지가 여러 개', opts.length >= 3, JSON.stringify(opts));
check('선택지에 0.6배속 포함', opts.includes('0.6×'), JSON.stringify(opts));

// 기본은 0.6배속 — 기존 사용자의 경험이 바뀌지 않아야 한다
check('기본값은 0.6배속', (await page.evaluate(() => document.querySelector('.rate-opt.slow-opt.active')?.textContent?.trim() || '')) === '0.6×');

await page.click('.rate-opt.slow-opt:has-text("0.9×")');
const afterPick = await page.evaluate(() => ({
  active: document.querySelector('.rate-opt.slow-opt.active')?.textContent?.trim() || '',
  stored: localStorage.getItem('va_slow_rate'),
}));
check('고른 값이 선택 상태로 표시', afterPick.active === '0.9×', JSON.stringify(afterPick));
check('기기에 저장됨', afterPick.stored === '0.9', String(afterPick.stored));

// 영어를 드러내야 느리게 듣기 버튼이 나온다(그전에는 정답이 보이면 안 되므로 가려져 있다)
await revealEnglish(page);
check(
  '느리게 듣기 버튼 라벨이 고른 값을 따라감',
  (await page.evaluate(() => document.querySelector('.speak-mini-slow')?.textContent?.trim() || '')) === '0.9×'
);

/* ── ④ 실제 재생 속도가 바뀐다 ── */
await page.evaluate(() => (window.__rates = []));
await page.click('.speak-mini-slow');
await page.waitForTimeout(600);
const played = await page.evaluate(() => window.__rates);
check('실제 재생 배속이 0.9를 반영', played.some((r) => Math.abs(r - 0.9) < 0.001 || Math.abs(r - 0.9 * 0.84) < 0.001), JSON.stringify(played));

/* ── ② 다시 열어도 유지 ── */
await page.reload();
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("드릴")');
await page.waitForSelector('.speaking-practice', { timeout: 10000 });
await page.click('.rate-open');
await page.waitForSelector('.rate-picker', { timeout: 5000 });
check('새로고침 뒤에도 유지', (await page.evaluate(() => document.querySelector('.rate-opt.slow-opt.active')?.textContent?.trim() || '')) === '0.9×');

/* ── ③ 다른 화면도 같은 값을 쓴다 ── */
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-grid .feat-card:has-text("음성 진단")', { timeout: 8000 });
await page.click('.feat-grid .feat-card:has-text("음성 진단")');
await page.waitForSelector('.rate-picker', { timeout: 8000 });
check('음성 진단에서도 같은 값', (await page.evaluate(() => document.querySelector('.rate-opt.slow-opt.active')?.textContent?.trim() || '')) === '0.9×');

// 여기서 바꾸면 학습 화면도 따라와야 한다 — 화면마다 따로 놀면 설정이 아니다
await page.click('.rate-opt.slow-opt:has-text("0.5×")');
await page.click('.mode-tab:has-text("드릴")');
await page.waitForSelector('.speaking-practice', { timeout: 10000 });
await page.click('.rate-open');
await page.waitForSelector('.rate-picker', { timeout: 5000 });
check('한 곳에서 바꾸면 앱 전체가 따라감', (await page.evaluate(() => document.querySelector('.rate-opt.slow-opt.active')?.textContent?.trim() || '')) === '0.5×');

await browser.close();
finish('28-rate');
