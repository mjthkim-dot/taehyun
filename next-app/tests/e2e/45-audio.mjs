/**
 * 오디오 모드(이터레이션 2) — 듣기 입력 루프의 계약:
 *   ① 재생목록이 로컬 재료(오늘 패턴 대화 + due SRS + 정착 패턴)로 만들어진다
 *   ② 재생하면 영어→한국어 뜻 순서로 읽고 다음 문장으로 스스로 전진한다
 *   ③ 멈추기/반복/뜻 읽기 토글이 동작하고, 재생 중 목록 탭으로 건너뛸 수 있다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

// speechSynthesis 스텁 — 발화 즉시 onend를 불러 체인이 빠르게 전진하게 한다.
// 어떤 텍스트를 읽었는지 window.__spoken에 쌓아 검증한다.
const TTS_STUB = () => {
  window.__spoken = [];
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
      setTimeout(() => u.onend && u.onend(), 30);
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
};

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
// Groq TTS는 404 → 브라우저 음성(스텁)으로 폴백
await page.route('**/app/api/tts', (r) => r.fulfill({ status: 404, body: '' }));
await seedKey(page);
await page.addInitScript(TTS_STUB);
await page.addInitScript(() => {
  localStorage.setItem('va_weak', JSON.stringify([
    { en: 'Could you send the file?', kr: '파일을 보내주시겠어요?', box: 1, lapses: 0, due: 0 },
  ]));
  // 오늘의 패턴은 날짜 로테이션 — id-like만 미정착으로 남겨 결정성 확보
  localStorage.setItem('va_maturity_patterns', JSON.stringify(['could-you', 'get-back', 'didnt-catch', 'just-to-confirm', 'that-works', 'im-afraid', 'thanks-time']));
});

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-grid .feat-card:has-text("오디오 모드")', { timeout: 8000 });
await page.click('.feat-grid .feat-card:has-text("오디오 모드")');
await page.waitForSelector('.al-card', { timeout: 10000 });

/* ── ① 재생목록 구성 ── */
const list = await page.evaluate(() => [...document.querySelectorAll('.al-item-en')].map((e) => e.textContent));
check('오늘 패턴 대화가 목록에 있다', list.some((t) => t.includes('this is Taehyun')), String(list.length));
check('due SRS 문장이 목록에 있다', list.some((t) => t.includes('Could you send the file?')));
check('중복 문장은 하나로 합쳐진다', new Set(list.map((t) => t.toLowerCase())).size === list.length);

/* ── ② 재생 전진 (영어→한국어) ── */
await page.click('.al-play');
await page.waitForFunction(() => (window.__spoken || []).length >= 4, null, { timeout: 15000 });
const spoken = await page.evaluate(() => window.__spoken);
check('영어 다음에 한국어 뜻을 읽는다', spoken[0].includes('Hello') && /[가-힣]/.test(spoken[1]), JSON.stringify(spoken.slice(0, 2)));
const posMoved = await page.evaluate(() => document.querySelector('.al-pos')?.textContent || '');
check('다음 문장으로 스스로 전진한다', !posMoved.startsWith('1 /'), posMoved);

/* ── ③ 멈추기·뜻 읽기 토글 ── */
await page.click('.al-play'); // ⏸
await page.waitForTimeout(300);
const before = await page.evaluate(() => (window.__spoken || []).length);
await page.waitForTimeout(800);
const after = await page.evaluate(() => (window.__spoken || []).length);
check('멈추면 더 읽지 않는다', after === before, `${before}→${after}`);

await page.click('.mini-btn:has-text("뜻 읽기")'); // OFF
await page.evaluate(() => { window.__spoken = []; });
await page.click('.al-play');
await page.waitForFunction(() => (window.__spoken || []).length >= 3, null, { timeout: 15000 });
const noKr = await page.evaluate(() => window.__spoken);
check('뜻 읽기 OFF면 영어만 읽는다', noKr.every((t) => !/[가-힣]/.test(t)), JSON.stringify(noKr.slice(0, 3)));

await browser.close();
finish();
