/**
 * 보이스 모드: 마이크 탭 한 번 → 오버레이 → 말하면 '전송 버튼 없이' 자동 전송 →
 * AI 응답 → 오버레이 종료. "STT만 되고 보내는 건 수동"이던 문제의 회귀 방지.
 */
import { BASE, check, finish, launch, mockGroq, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await mockGroq(page);
// TTS는 오프라인 404로 → 브라우저 합성 폴백 경로(테스트 속도·외부 의존 제거)
await page.route('**/app/api/tts', (route) => route.fulfill({ status: 404, body: '' }));
await seedKey(page);
// 가짜 SR: __SR_TEXT를 한 번만 최종 발화로 돌려주고 비운다(자동 재청취 루프에서 재전송 방지)
await page.addInitScript(() => {
  class FakeSR {
    constructor() { this.continuous = false; this.interimResults = true; this.lang = 'en-US'; }
    start() {
      this._t = setTimeout(() => {
        const t = window.__SR_TEXT || '';
        if (t) {
          window.__SR_TEXT = '';
          const results = [{ 0: { transcript: t }, isFinal: true, length: 1 }];
          results.length = 1;
          this.onresult && this.onresult({ resultIndex: 0, results });
        }
        this.onend && this.onend();
      }, 150);
    }
    stop() { this.onend && this.onend(); }
    abort() { clearTimeout(this._t); }
  }
  window.SpeechRecognition = FakeSR;
  window.webkitSpeechRecognition = FakeSR;
});
await page.goto(`${BASE}/app`);
await page.waitForTimeout(1200);
await page.click('.mode-tab:has-text("회화")');
await page.waitForSelector('.round-btn', { timeout: 8000 });

// 발화 예약 후 마이크 탭 → 보이스 모드
await page.evaluate(() => { window.__SR_TEXT = 'Hello, nice to meet you today'; });
await page.locator('.controls .round-btn').first().click();
await page.waitForSelector('.voice-overlay', { timeout: 5000 });
check('보이스 오버레이 열림', true);
check('오브 렌더', !!(await page.evaluate(() => document.querySelector('.vo-orb'))));

// 핵심: 전송 버튼을 누르지 않아도 발화가 자동 전송된다
await page.waitForTimeout(1500);
const userSent = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.msg.user .bubble')).some((b) => b.textContent.includes('Hello, nice to meet you'))
);
check('말하면 자동 전송(버튼 불필요)', userSent);
const aiReplied = await page.evaluate(() => document.querySelectorAll('.msg.ai .bubble').length > 0);
check('AI 응답 도착', aiReplied);

// 종료 → 오버레이 닫히고 마이크 off
await page.click('.vo-close');
await page.waitForTimeout(300);
check('종료 시 오버레이 닫힘', !(await page.evaluate(() => document.querySelector('.voice-overlay'))));
check('종료 시 마이크 off', !(await page.evaluate(() => document.querySelector('.round-btn.listening'))));

await browser.close();
finish('07-voice');
