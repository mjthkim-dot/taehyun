/**
 * M6 회화 탭 교정 → 다시 말하기 게이트 — 집중 모드 '회화'(DramaTalkScreen).
 *   ① 화요일·키 있음: 🎙 길게 누르기 → language 'ko' 녹음 → '이렇게 말해 보세요: hint.en'(턴으로 세지 않음)
 *      → AI fix{wrong,type} → FixGate: 인물 목소리 → 따라 말하기 ≥60 '✓ 다음으로'
 *      → 콩글리시(hand phone) + AI fix → 'L1 간섭' 칩, 따라 말하기 <60 → 통과 + 회상 큐(va_weak)
 *      → 3번째 턴 전 리액션 턴(reaction:true 두 문장): 'Sorry?' → clarify → 인물이 첫 문장을 0.8×로 다시
 *      → 턴마다 ⏱ 반응 지연 칩 → 종료 칩(표현 사용·반응 중앙값·교정 재발화 1/2·리액션 1) → 화요일 사다리 3단 완주
 *      → 기록(va_attempt_log src dtalk·latencyMs, va_dtalk_stats) → 홈 DramaCard '회화' 점 켜짐
 *   ② 수요일·키 있음: 사다리 대신 CAF-lite 1회 → 말하기 증거(va_cefr_evidence src dtalk)
 *   ③ 키 없음(Web Speech도 없음): 대사 + 리액션 따라 말하기를 RoleStep(자기확인)으로, 게이트·리액션 턴 없음
 *   ④ 플래그 fixGate off: 예전 동작(fix 듣기 버튼만, 게이트·⏱·길게 누르기 안내 없음)
 * 마이크·STT는 78-dtalk/83-roleplay와 같은 스텁, 브라우저 TTS는 즉시 onend를 부르는 가짜(속도 기록).
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FA { constructor() { this.fftSize = 1024; this.t0 = Date.now(); } getFloatTimeDomainData(b) { const l = Date.now() - this.t0 < 400; for (let i = 0; i < b.length; i++) b[i] = l ? 0.5 : 0; } }
  class FC { constructor() { this.state = 'running'; } createAnalyser() { return new FA(); } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  window.AudioContext = FC;
  class FR { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; } start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); } stop() { setTimeout(() => this.onstop?.(), 20); } }
  window.MediaRecorder = FR;
  // 브라우저 TTS — 바로 끝난 것으로(무엇을 몇 배속으로 말했는지 기록)
  window.__tts = [];
  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    speak(u) {
      window.__tts.push({ text: u.text, rate: u.rate });
      setTimeout(() => u.onend && u.onend(), 60);
    },
    cancel() {},
    pause() {},
    resume() {},
    getVoices() { return []; },
    addEventListener() {},
    removeEventListener() {},
    onvoiceschanged: null,
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
};

/** 요일 고정 — 시간은 흐르게 두고 날짜만 옮긴다(녹음 무음 감지가 Date.now를 쓴다) */
const shiftDate = (target) => {
  const D = Date;
  const off = target - D.now();
  class FD extends D {
    constructor(...a) {
      if (a.length) super(...a);
      else super(D.now() + off);
    }
    static now() { return D.now() + off; }
  }
  window.Date = FD;
};

const verboseFor = (text) => {
  const toks = text.split(/\s+/).filter(Boolean);
  return { text, duration: 0.6 + toks.length * 0.32, segments: [{ start: 0, end: 0.6 + toks.length * 0.32, text, avg_logprob: -0.2, no_speech_prob: 0.02, compression_ratio: 1.3 }] };
};

const TUE = new Date(2026, 8, 29, 10, 0, 0).getTime(); // 화
const WED = new Date(2026, 8, 30, 10, 0, 0).getTime(); // 수
const RUNGS = [
  { level: '기본', en: 'It is my first day, so I am nervous.', kr: '첫날이라 긴장돼요.', note: '정확한 기본 문장' },
  { level: '자연스럽게', en: "It's my first day, so I'm nervous.", kr: '첫날이라 긴장돼요.', note: '축약형을 살렸어요' },
  { level: '원어민', en: "First day here, so I'm a bit on edge.", kr: '여기 첫날이라 좀 떨려요.', note: 'on edge = 긴장한' },
];

const browser = await launch();

async function open({ key = true, flags = null, day = TUE, webSpeech = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(shiftDate, day);
  await page.addInitScript(MIC_STUB);
  await page.addInitScript(
    ({ key, flags, webSpeech }) => {
      localStorage.setItem('va_onboarded', 'true');
      localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
      if (key) localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
      if (flags) localStorage.setItem('va_flags', JSON.stringify(flags));
      if (!localStorage.getItem('va_drama')) localStorage.setItem('va_drama', JSON.stringify({ done: { 1: '2026-09-28' }, score: { 1: 80 } }));
      if (!webSpeech) {
        Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
        Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
      }
    },
    { key, flags, webSpeech }
  );
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  const stt = { replies: [], bodies: [] };
  await page.route('**/app/api/stt', (r) => {
    stt.bodies.push(r.request().postData() || '');
    const text = stt.replies.length ? stt.replies.shift() : 'Okay.';
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(verboseFor(text)) });
  });
  const ai = { talk: 0, ladder: 0, caf: 0 };
  await page.route('**/app/api/groq', (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    const sys = String(body.messages?.[0]?.content || '');
    let content = '{}';
    if (sys.includes('등장인물') && sys.includes('Taeo')) {
      ai.talk++;
      const lastUser = [...body.messages].reverse().find((m) => m.role === 'user')?.content || '';
      let o = { reply: 'Great. Tell me more.', kr: '좋아요. 더 말해 줘요.', fix: null, hint: { en: "It's my first day.", kr: '오늘이 첫 출근이에요.' } };
      if (ai.talk === 1) o = { ...o, reply: 'Hi Taeo! How was your first day?', kr: '안녕 태오! 첫날 어땠어요?' };
      else if (/[가-힣]/.test(lastUser)) o = { ...o, reply: 'Oh, you look tired.', kr: '아, 피곤해 보여요.', hint: { en: "I'm so tired today.", kr: '오늘 너무 피곤해요.' } };
      else if (lastUser.includes('I am work')) o = { ...o, reply: 'Cool. Do you like it?', kr: '멋지네요. 좋아요?', fix: { wrong: 'I am work', better: 'I work in cloud sales.', kr: '저는 클라우드 영업을 해요.', why: 'be동사와 일반동사를 함께 쓰지 않아요.', type: 'tense' } };
      else if (lastUser.includes('hand phone'))
        o = { ...o, reply: 'I had a really long day. My laptop crashed twice.', kr: '정말 긴 하루였어요. 노트북이 두 번 멈췄어요.', reaction: true, fix: { wrong: 'hand phone', better: 'I lost my cell phone.', kr: '휴대폰을 잃어버렸어요.', why: 'hand phone은 콩글리시예요.', type: 'word-choice' } };
      content = JSON.stringify(o);
    } else if (sys.includes('비즈니스 영어 코치')) {
      ai.ladder++;
      content = JSON.stringify({ rungs: RUNGS });
    } else if (sys.includes('말하기 코치')) {
      ai.caf++;
      content = JSON.stringify({ fix: null, level: 'A2' });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("회화")');
  return { ctx, page, stt, ai };
}

const meCount = (page) => page.evaluate(() => document.querySelectorAll('.dr-line.me').length);
const partnerCount = (page) => page.evaluate(() => document.querySelectorAll('.dr-line:not(.me)').length);

/** 🎙 한 번 눌러 영어로 한 턴(내 줄 n개, 인물 줄 n+1개가 될 때까지) */
async function speakTurn(page, { waitPartner = true } = {}) {
  const me = await meCount(page);
  const pn = await partnerCount(page);
  await page.waitForSelector('.dr-mic:not([disabled])', { timeout: 15000 });
  await page.click('.dr-mic');
  await page.waitForFunction((n) => document.querySelectorAll('.dr-line.me').length > n, me, { timeout: 15000 });
  if (waitPartner) await page.waitForFunction((n) => document.querySelectorAll('.dr-line:not(.me)').length > n, pn, { timeout: 15000 });
}

/* ① 화요일 — 길게 누르기·게이트 통과/실패·리액션 턴·사다리·홈 점 */
{
  const { ctx, page, stt, ai } = await open({ day: TUE });
  await page.waitForSelector('.dr-hero-title', { timeout: 15000 });
  check('시작 안내에 길게 누르기(한국어)', await page.evaluate(() => document.querySelector('.dr-tip')?.textContent.includes('길게 누르기')));
  await page.click('button:has-text("대화 시작")');
  await page.waitForFunction(() => document.body.innerText.includes('How was your first day'), null, { timeout: 10000 });
  check('마이크 아래 길게 누르기 안내', (await page.locator('.fgate-tip').count()) === 1);

  // 한국어 — 길게 누르기
  stt.replies.push('오늘 너무 피곤해요');
  await page.waitForSelector('.dr-mic:not([disabled])', { timeout: 10000 });
  const box = await page.locator('.dr-mic').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  const koRec = await page.evaluate(() => document.body.innerText.includes('한국어로 말하는 중'));
  await page.mouse.up();
  check('길게 누르면 🇰🇷 한국어로 말하는 중', koRec);
  await page.waitForSelector('.fgate-ko', { timeout: 15000 });
  check('한국어 녹음은 language ko', /name="language"\r?\n\r?\nko/.test(stt.bodies[0] || ''));
  check("인물이 받아 주고 '이렇게 말해 보세요: hint.en'", await page.evaluate(() => document.querySelector('.fgate-ko')?.textContent.includes("I'm so tired today.")));
  check('한국어 턴은 대답 수에 세지 않는다(0/5)', await page.evaluate(() => document.querySelector('.dr-ep')?.textContent.includes('0/5')));

  // 턴 1 — AI fix → 게이트 통과
  stt.replies.push('I am work in cloud sales.', 'I work in cloud sales.');
  const pBefore = await partnerCount(page);
  await speakTurn(page, { waitPartner: false });
  await page.waitForSelector('.fgate', { timeout: 15000 });
  check('fix가 오면 게이트: 고친 문장 + 따라 말하기', await page.evaluate(() => document.querySelector('.fgate')?.textContent.includes('I work in cloud sales.') && !!document.querySelector('.fgate-mic')));
  check('게이트 동안 인물의 다음 말은 기다린다', (await partnerCount(page)) === pBefore);
  check('게이트 동안 마이크(다음 턴) 없음', (await page.locator('.dr-mic').count()) === 0);
  check('고친 문장을 인물 목소리로 들려준다', await page.evaluate(() => window.__tts.some((t) => t.text === 'I work in cloud sales.')));
  await page.click('.fgate-mic');
  await page.waitForSelector('.fgate-next', { timeout: 15000 });
  check('≥60 → “100점 ✓ 다음으로”', await page.evaluate(() => /\d+점 ✓ 다음으로/.test(document.querySelector('.fgate-next')?.textContent || '')));
  check('게이트 따라 말하기는 language en(echo 게이트 없음)', /name="language"\r?\n\r?\nen/.test(stt.bodies[2] || ''));
  await page.click('.fgate-next');
  await page.waitForFunction((n) => document.querySelectorAll('.dr-line:not(.me)').length > n, pBefore, { timeout: 10000 });
  check('통과 후 인물이 이어 말하고 fix 카드에 점수', await page.evaluate(() => document.querySelector('.fgate-done')?.textContent.includes('점 ✓')));
  check('턴마다 ⏱ 반응 지연 칩', await page.evaluate(() => /⏱ \d+\.\d초/.test(document.querySelector('.fgate-lat')?.textContent || '')));

  // 턴 2 — 콩글리시 + AI fix → L1 간섭 칩, 게이트 실패 → 통과 + 회상 큐
  stt.replies.push('I lost my hand phone.', 'Hello there.');
  await speakTurn(page, { waitPartner: false });
  await page.waitForSelector('.fgate', { timeout: 15000 });
  check("콩글리시면 게이트에 'L1 간섭' 칩", await page.evaluate(() => document.querySelector('.fgate .fgate-l1')?.textContent.includes('hand phone')));
  await page.click('.fgate-mic');
  await page.waitForSelector('.fgate-next', { timeout: 15000 });
  check('<60 → “다음에 다시 — 회상에 넣었어요”', await page.evaluate(() => document.querySelector('.fgate-next')?.textContent.includes('회상에 넣었어요')));
  check('실패한 교정은 회상 큐(cat 드라마, 내일)', await page.evaluate(() => JSON.parse(localStorage.getItem('va_weak') || '[]').some((w) => w.en === 'I lost my cell phone.' && w.cat === '드라마' && w.due > Date.now() + 3600000)));

  // 리액션 턴 — 게이트 뒤 인물 근황 두 문장, 사이 2초 창에 'Sorry?' → clarify
  stt.replies.push('Sorry?');
  // 리뷰 B8 — 리액션 턴 문구의 인물 이름은 한국어 + 받침에 맞는 조사('Diane가' ✗ → '다이앤이')
  await page.evaluate(() => {
    window.__seenTxt = [];
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('.fgate-rt-status, .fgate-rt-verdict')) {
        const t = el.textContent || '';
        if (!window.__seenTxt.includes(t)) window.__seenTxt.push(t);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.click('.fgate-next');
  await page.waitForSelector('.fgate-rt', { timeout: 10000 });
  check('3번째 턴 전 리액션 턴(힌트 칩 3개)', await page.waitForSelector('.fgate-rt-hint', { timeout: 10000 }).then(async () => (await page.locator('.fgate-rt-hint').count()) === 3).catch(() => false));
  // 판정 문구는 인물이 둘째 문장을 마칠 때까지만 보인다(가짜 TTS는 60ms) — 대화에 남는 리액션 칩으로 본다
  await page.waitForSelector('.fgate-rt', { state: 'detached', timeout: 20000 });
  check('Sorry? = clarify ✓ — 인물이 천천히 다시', await page.evaluate(() => document.querySelector('.fgate-react')?.textContent.includes('천천히')));
  const rtTxt = await page.evaluate(() => window.__seenTxt.join(' | '));
  check("리액션 턴 조사 '다이앤이 근황을…'·'다이앤이 천천히…'(영어 이름+'가' 없음)", /다이앤이 근황을/.test(rtTxt) && /다이앤이 천천히/.test(rtTxt) && !/[A-Za-z]가 /.test(rtTxt), rtTxt);
  const firstSaid = await page.evaluate(() => window.__tts.filter((t) => t.text === 'I had a really long day.').map((t) => t.rate));
  check('clarify면 첫 문장을 0.8×로 한 번 더', firstSaid.length === 2 && Math.abs(firstSaid[1] / firstSaid[0] - 0.8) < 0.01, JSON.stringify(firstSaid));
  check('둘째 문장까지 말한다', await page.evaluate(() => window.__tts.some((t) => t.text === 'My laptop crashed twice.')));
  check('리액션 칩이 대화에 남는다', await page.evaluate(() => document.querySelector('.fgate-react')?.textContent.includes('Sorry?')));
  check('리액션 녹음은 echo 게이트(직전 TTS) 경로 — language en', /name="language"\r?\n\r?\nen/.test(stt.bodies[5] || ''));

  // 턴 3~5
  stt.replies.push('Yes, I will hang in there.', "It's my first day, so I am nervous.", 'See you tomorrow, Diane.');
  for (let t = 3; t <= 5; t++) await speakTurn(page);
  check('대답 5/5', await page.evaluate(() => document.querySelector('.dr-ep')?.textContent.includes('5/5')));
  check('리액션 턴은 한 번만', ai.talk === 7 && (await page.locator('.fgate-rt').count()) === 0, `talk=${ai.talk}`);
  await page.click('button:has-text("대화 마치기")');
  await page.waitForSelector('.fgate-stats', { timeout: 5000 });
  const stats = await page.evaluate(() => document.querySelector('.fgate-stats')?.textContent || '');
  check('종료 칩: 표현 사용·반응 중앙값·교정 재발화 1/2·리액션 1', stats.includes('표현 사용') && stats.includes('반응 중앙값') && stats.includes('교정 재발화 1/2') && stats.includes('리액션 1'), stats);

  // 화요일 — 내 최장 문장 사다리 3단
  await page.waitForSelector('.fgate-ladder .ld-rung.active', { timeout: 10000 });
  check('화요일엔 사다리(내 최장 문장)', await page.evaluate(() => document.querySelector('.fgate-ladder-seed')?.textContent.includes("It's my first day, so I am nervous.")));
  check('그 외 증거(CAF)는 부르지 않는다', ai.caf === 0);
  for (let i = 0; i < 3; i++) {
    stt.replies.push(RUNGS[i].en);
    await page.click('.fgate-ladder .ld-rung.active .fgate-mic');
    await page.waitForSelector('.fgate-ladder .fgate-next', { timeout: 15000 });
    await page.click('.fgate-ladder .fgate-next');
  }
  await page.waitForFunction(() => document.querySelector('.fgate-ladder-seed')?.textContent.includes('완주'), null, { timeout: 5000 });
  check('3단 완주 → 사다리 기록 + 원어민 단 회상 큐', await page.evaluate(() => JSON.parse(localStorage.getItem('va_ladder_done') || '[]').length === 1 && JSON.parse(localStorage.getItem('va_weak') || '[]').some((w) => w.en === "First day here, so I'm a bit on edge.")));

  const rec = await page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem('va_attempt_log') || '[]').filter((a) => a.src === 'dtalk');
    const st = JSON.parse(localStorage.getItem('va_dtalk_stats') || '{}');
    const day = Object.values(st)[0] || {};
    return { n: log.length, lat: log.filter((a) => typeof a.latencyMs === 'number').length, day, mistakes: JSON.parse(localStorage.getItem('va_mistakes') || '[]').length };
  });
  check('시도 로그 src dtalk(턴 5 + 게이트 2) · 반응 지연 포함', rec.n >= 7 && rec.lat >= 5, JSON.stringify(rec));
  check('va_dtalk_stats(턴·교정 재발화·리액션·한국어 턴)', rec.day.turns === 5 && rec.day.fixPass === 1 && rec.day.fixTotal === 2 && rec.day.reactions === 1 && rec.day.clarify === 1 && rec.day.koTurns === 1, JSON.stringify(rec.day));
  check('교정·콩글리시는 교정 축적(recordMistake)에', rec.mistakes >= 2, String(rec.mistakes));

  await page.click('.mode-tab:has-text("홈")');
  await page.waitForSelector('.rc-dots', { timeout: 15000 });
  check("홈 DramaCard '회화' 점이 켜진다", await page.evaluate(() => (document.querySelector('.rc-dots')?.getAttribute('aria-label') || '').includes('회화 ✓')));
  check('390px 가로 넘침 없음', await page.evaluate(() => document.documentElement.scrollWidth <= 390));
  await ctx.close();
}

/* ② 수요일 — 사다리 대신 CAF-lite 증거 */
{
  const { ctx, page, stt, ai } = await open({ day: WED });
  await page.waitForSelector('.dr-hero-title', { timeout: 15000 });
  await page.click('button:has-text("대화 시작")');
  await page.waitForFunction(() => document.body.innerText.includes('How was your first day'), null, { timeout: 10000 });
  stt.replies.push("It's my first day.", 'I like my team a lot.', 'Thank you so much.', 'Yes, I will hang in there.', 'See you tomorrow.');
  for (let t = 1; t <= 5; t++) await speakTurn(page);
  await page.click('button:has-text("대화 마치기")');
  await page.waitForFunction(() => document.querySelector('.fgate-caf')?.textContent.includes('A2'), null, { timeout: 10000 });
  check('수요일엔 사다리 없음', (await page.locator('.fgate-ladder').count()) === 0 && ai.ladder === 0);
  check('CAF-lite 1회 → 말하기 증거 src dtalk', ai.caf === 1 && (await page.evaluate(() => JSON.parse(localStorage.getItem('va_cefr_evidence') || '[]').some((e) => e.src === 'dtalk' && e.skill === 'speaking'))));
  check('교정 없으면 교정 재발화 0/0', await page.evaluate(() => document.querySelector('.fgate-stats')?.textContent.includes('교정 재발화 0/0')));
  await ctx.close();
}

/* ③ 키 없음 — RoleStep 따라 말하기(리액션 턴·게이트·사다리·CAF 없음) */
{
  const { ctx, page, ai } = await open({ key: false, webSpeech: false });
  await page.waitForSelector('.dr-end-title', { timeout: 15000 });
  check('AI 연결 안내 + 대사 따라 말하기(역할극)', await page.evaluate(() => document.body.innerText.includes('AI 연결') && document.body.innerText.includes('EP 1 대사 따라 말하기 · 1/11')));
  await page.waitForSelector('.rs-self-ok', { timeout: 20000 });
  await page.click('.rs-self-ok');
  await page.waitForFunction(() => document.body.innerText.includes('대사 따라 말하기 · 2/'), null, { timeout: 10000 });
  check('자기확인 후 다음 줄로', true);
  check('키 없으면 게이트·리액션 턴·AI 호출 없음', (await page.locator('.fgate, .fgate-rt').count()) === 0 && ai.talk === 0);
  check('발화로 집계(자기확인)', await page.evaluate(() => (JSON.parse(localStorage.getItem('va_spoken') || '{}').count || 0) >= 1));
  await ctx.close();
}

/* ④ 플래그 fixGate off — 예전 동작 */
{
  const { ctx, page, stt } = await open({ flags: { fixGate: false } });
  await page.waitForSelector('.dr-hero-title', { timeout: 15000 });
  await page.click('button:has-text("대화 시작")');
  await page.waitForFunction(() => document.body.innerText.includes('How was your first day'), null, { timeout: 10000 });
  check('플래그 off: 길게 누르기 안내 없음', (await page.locator('.fgate-tip').count()) === 0);
  stt.replies.push('I am work in cloud sales.');
  await speakTurn(page);
  check('플래그 off: 게이트 없이 fix 듣기 버튼만', (await page.locator('.fgate').count()) === 0 && (await page.evaluate(() => document.querySelector('.dt-fix')?.textContent.includes('I work in cloud sales.'))));
  check('플래그 off: ⏱ 칩 없음', (await page.locator('.fgate-lat').count()) === 0);
  check('플래그 off여도 홈 회화 점용 시도 로그(src dtalk)', await page.evaluate(() => JSON.parse(localStorage.getItem('va_attempt_log') || '[]').some((a) => a.src === 'dtalk')));
  await ctx.close();
}

await browser.close();
finish('89-dtalk-gate');
