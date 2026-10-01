/**
 * M8 단어 '예문 말하기' 문항 — 상자 2·4 복습이 고르기 대신 말하기로 나온다:
 *   ① (키 있음·Whisper 목킹) 상자 2 단어 → 카드에 한국어 뜻·예문 번역만(영어 없음) → 자동 녹음 →
 *      통과 → '오늘 말한 단어 1/4' · 상자 +1 · 시도 로그 src 'words' · 발화 카운터 +1 → 원어민 재생 뒤 저절로 다음
 *   ② 상자 4 단어 → 1차 실패 → 영어 예문 공개 + 내 소리/원어민 비교 + '한 번 더' → 2차 통과 → 상자 +1
 *   ③ 상자 2 단어 → 2차도 실패 → '다음' 버튼, 오답 채점(상자 1) · 3문제 뒤 재출제 큐에 들어간다
 *   ④ (키 없음) 브라우저 인식이 권한 거부로 실패 → '🗣 소리 내어 말했어요 ✓' 자기확인 → 카운터·상자 +1
 * 기존 4종(73-words)은 그대로 — 신규 단어(상자 0)·재출제(상자 1)는 여전히 고르기.
 */
import { BASE, check, finish, launch } from './helpers.mjs';

/** 78-dtalk와 같은 마이크·녹음 스텁 — 0.4초 소리 뒤 무음이라 1.5초 침묵 감지로 저절로 끝난다 */
const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FA { constructor() { this.fftSize = 1024; this.t0 = Date.now(); } getFloatTimeDomainData(b) { const l = Date.now() - this.t0 < 400; for (let i = 0; i < b.length; i++) b[i] = l ? 0.5 : 0; } }
  class FC { constructor() { this.state = 'running'; } createAnalyser() { return new FA(); } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  window.AudioContext = FC;
  class FR { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; } start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); } stop() { setTimeout(() => this.onstop?.(), 20); } }
  window.MediaRecorder = FR;
};

/** 브라우저 음성 합성 스텁 — onend가 와야 '원어민 재생 뒤 다음'이 돈다(81-offline-replay 패턴) */
const SYNTH_STUB = () => {
  window.__said = [];
  const synth = {
    speaking: false, paused: false, pending: false,
    getVoices: () => [],
    cancel() {}, pause() {}, resume() {},
    speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 300); },
    addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};

/** 복습 큐: today(상자 2) → tomorrow(상자 4) → yesterday(상자 2) 순(기한 순) */
const SEED = () => {
  localStorage.setItem('va_onboarded', 'true');
  localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
  localStorage.setItem('va_words_cfg', JSON.stringify({ daily: 10, packs: [] }));
  // 오늘 신규 할당을 이미 다 쓴 상태 — 큐가 복습 3개뿐이라 진행 표시(1/3 …)를 그대로 확인할 수 있다
  const d = new Date();
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  localStorage.setItem('va_words_log', JSON.stringify({ [key]: { new: 10, rev: 0, ok: 10 } }));
  localStorage.setItem('va_words', JSON.stringify({
    'basics:today': { b: 2, d: 1, n: 2, l: 0, t: '2026-09-01' },
    'basics:tomorrow': { b: 4, d: 2, n: 4, l: 0, t: '2026-09-01' },
    'basics:yesterday': { b: 2, d: 3, n: 2, l: 0, t: '2026-09-01' },
  }));
};

const browser = await launch();

/* ①~③ 키 있음 — Whisper 경로(목킹) */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(MIC_STUB);
  await page.addInitScript(SYNTH_STUB);
  await page.addInitScript(SEED);
  await page.addInitScript(() => localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key')));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  // 받아쓰기 응답 순서: ① today 통과 / ② tomorrow 1차 실패 → 2차 통과 / ③ yesterday 1차·2차 실패
  const SAID = ['Are you free today?', 'good morning everyone', "I'll call you tomorrow.", 'nothing like that at all', 'still nothing like that'];
  let sttN = 0;
  const sttBodies = [];
  await page.route('**/app/api/stt', (r) => {
    sttBodies.push(r.request().postData() || '');
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: SAID[Math.min(sttN++, SAID.length - 1)] }) });
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("단어")');
  await page.waitForSelector('.wd-hero', { timeout: 15000 });
  check('복습 3개가 큐에 있다', await page.evaluate(() => document.querySelector('.wd-hero-title')?.textContent.includes('3개 복습')));
  await page.click('.wd-cta');

  /* ① 통과 */
  await page.waitForSelector('.wq-speak', { timeout: 10000 });
  check("상자 2 복습은 '말해 보기' 문항", await page.evaluate(() => document.querySelector('.wd-tag')?.textContent.includes('말해 보기') && document.querySelectorAll('.wd-opt').length === 0));
  check('카드에 한국어 뜻·예문 번역만, 영어 예문은 없다', await page.evaluate(() => {
    const kr = document.querySelector('.wq-speak-kr')?.textContent || '';
    const exkr = document.querySelector('.wq-speak-exkr')?.textContent || '';
    return kr.includes('오늘') && exkr.includes('오늘 시간 있어요') && !document.querySelector('.wq-speak-ex');
  }));
  check("상단 '오늘 말한 단어 0/4'", await page.evaluate(() => document.querySelector('.wq-speak-goal')?.textContent.includes('0/4')));
  check('텍스트 입력칸이 없다', (await page.locator('.wd-screen input, .wd-screen textarea').count()) === 0);
  await page.waitForSelector('.wq-speak[data-phase="pass"]', { timeout: 15000 });
  check('통과 — 점수·초록 표시', await page.evaluate(() => document.querySelector('.wq-speak-said')?.textContent.includes('점') && !!document.querySelector('.wq-speak-ex.pass')));
  check("카운터 '오늘 말한 단어 1/4'", await page.evaluate(() => document.querySelector('.wq-speak-goal')?.textContent.includes('1/4')));
  check('채점: 상자 2 → 3', await page.evaluate(() => JSON.parse(localStorage.getItem('va_words'))['basics:today'].b === 3));
  check("시도 로그 src 'words'·예문·점수", await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('va_attempt_log') || '[]'); return l.length === 1 && l[0].src === 'words' && l[0].en === 'Are you free today?' && l[0].score >= 60; }));
  check('발화 카운터 +1(va_spoken)·오늘 말한 단어 저장(va_words_spoken)', await page.evaluate(() => JSON.parse(localStorage.getItem('va_spoken')).count === 1 && JSON.parse(localStorage.getItem('va_words_spoken')).count === 1));
  check('STT 힌트는 고유명사만(예문 없음)·temperature 0', /Nimbus/.test(sttBodies[0]) && !/Are you free today/.test(sttBodies[0]) && /name="temperature"\r?\n\r?\n0/.test(sttBodies[0]));
  // 원어민 재생 뒤 저절로 다음 문항
  await page.waitForFunction(() => /2\/3/.test(document.querySelector('.wd-count')?.textContent || ''), null, { timeout: 10000 });
  check('원어민 예문을 들려준 뒤 저절로 다음(1/3 → 2/3)', (await page.evaluate(() => window.__said)).includes('Are you free today?'));

  /* ② 1차 실패 → 영어 공개 → 한 번 더 → 통과 */
  await page.waitForSelector('.wq-speak[data-phase="fail"]', { timeout: 15000 });
  check("상자 4도 '말해 보기'", await page.evaluate(() => document.querySelector('.wd-tag')?.textContent.includes('상자 4')));
  check('실패하면 영어 예문이 펼쳐진다', await page.evaluate(() => (document.querySelector('.wq-speak-ex')?.textContent || '').replace(/\s+/g, ' ').includes("I'll call you tomorrow")));
  check("'한 번 더'·'듣기'·내 소리/원어민 비교", (await page.locator('.wq-speak-again').count()) === 1 && (await page.locator('.wq-speak-hear').count()) === 1 && (await page.locator('.vcmp').count()) === 1);
  check('1차 실패는 아직 채점하지 않는다(상자 4 유지)', await page.evaluate(() => JSON.parse(localStorage.getItem('va_words'))['basics:tomorrow'].b === 4));
  await page.click('.wq-speak-again');
  await page.waitForSelector('.wq-speak[data-phase="pass"]', { timeout: 15000 });
  check('2차 통과 — 상자 4 → 5, 시도 2/2', await page.evaluate(() => JSON.parse(localStorage.getItem('va_words'))['basics:tomorrow'].b === 5 && document.querySelector('.wq-speak-tries')?.textContent.includes('2/2')));
  check("카운터 '2/4'(문항당 한 번만 센다)", await page.evaluate(() => document.querySelector('.wq-speak-goal')?.textContent.includes('2/4') && JSON.parse(localStorage.getItem('va_spoken')).count === 2));
  await page.waitForFunction(() => /3\/3/.test(document.querySelector('.wd-count')?.textContent || ''), null, { timeout: 10000 });

  /* ③ 2차도 실패 → '다음' → 오답 채점 */
  await page.waitForSelector('.wq-speak[data-phase="fail"]', { timeout: 15000 });
  await page.click('.wq-speak-again');
  await page.waitForSelector('.wq-speak[data-phase="done"]', { timeout: 15000 });
  check("2차도 실패하면 '다음' 버튼(저절로 넘어가지 않음)", (await page.locator('.wq-speak-next').count()) === 1 && (await page.locator('.wq-speak-again').count()) === 0);
  check('오답 채점 — 상자 2 → 1', await page.evaluate(() => JSON.parse(localStorage.getItem('va_words'))['basics:yesterday'].b === 1));
  check('스크린리더 상태 알림', await page.evaluate(() => (document.querySelector('.wq-speak [role=status]')?.textContent || '').startsWith('오답')));
  await page.waitForTimeout(1500);
  check('다음을 누르기 전엔 머문다', (await page.locator('.wq-speak[data-phase="done"]').count()) === 1);
  await page.click('.wq-speak-next');
  await page.waitForFunction(() => /4\/4/.test(document.querySelector('.wd-count')?.textContent || ''), null, { timeout: 10000 });
  check('오답 단어가 큐 뒤에 한 번 더(3 → 4) — 재출제는 고르기(상자 1)', (await page.locator('.wd-opt').count()) === 4 && (await page.locator('.wq-speak').count()) === 0);
  check('시도 로그 5건(①통과 1 · ②실패+통과 2 · ③실패 2) — 채점된 시도는 전부 남는다', await page.evaluate(() => JSON.parse(localStorage.getItem('va_attempt_log') || '[]').filter((a) => a.src === 'words').length === 5));
  await ctx.close();
}

/* ④ 키 없음 — 브라우저 인식이 권한 거부 → 자기확인 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(SYNTH_STUB);
  await page.addInitScript(SEED);
  await page.addInitScript(() => {
    // 받아쓰기는 '있지만' 권한이 거부되는 기기 — listenOnce가 실패해도 자기확인으로 넘어가야 한다
    class DeniedSR {
      constructor() { this.lang = 'en-US'; }
      start() { setTimeout(() => { this.onerror && this.onerror({ error: 'not-allowed' }); this.onend && this.onend(); }, 50); }
      stop() {}
      abort() {}
    }
    window.SpeechRecognition = DeniedSR;
    window.webkitSpeechRecognition = DeniedSR;
  });
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("단어")');
  await page.waitForSelector('.wd-hero', { timeout: 15000 });
  await page.click('.wd-cta');
  await page.waitForSelector('.wq-speak', { timeout: 10000 });
  check('키 없이도 말하기 문항이 나온다(브라우저 인식)', true);
  await page.waitForSelector('.wq-speak-self', { timeout: 10000 });
  check("받아쓰기 실패 → '🗣 소리 내어 말했어요 ✓' 자기확인 + 안내", await page.evaluate(() => (document.querySelector('.wq-speak-msg')?.textContent || '').includes('마이크 권한')));
  check('STT 호출 없이도 막히지 않는다(영어는 아직 비공개)', (await page.locator('.wq-speak-ex').count()) === 0);
  await page.click('.wq-speak-self');
  await page.waitForSelector('.wq-speak[data-phase="pass"]', { timeout: 5000 });
  check("자기확인 → 카운터 '1/4'·상자 2 → 3·발화 +1", await page.evaluate(() => document.querySelector('.wq-speak-goal')?.textContent.includes('1/4') && JSON.parse(localStorage.getItem('va_words'))['basics:today'].b === 3 && JSON.parse(localStorage.getItem('va_spoken')).count === 1));
  check('자기확인은 시도 로그에 점수를 남기지 않는다', await page.evaluate(() => JSON.parse(localStorage.getItem('va_attempt_log') || '[]').length === 0));
  await page.waitForFunction(() => /2\/3/.test(document.querySelector('.wd-count')?.textContent || ''), null, { timeout: 10000 });
  check('원어민 예문을 들려준 뒤 다음으로', (await page.evaluate(() => window.__said)).includes('Are you free today?'));
  await ctx.close();
}

await browser.close();
finish('87-words-speak');
