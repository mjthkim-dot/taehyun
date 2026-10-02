/**
 * M5 엔딩 리텔 — '이야기 다시 말하기' + 한 줄 교정 + 오늘 질문:
 *   ① 키 있음·첫 14일(Whisper verbose_json 목킹): EP1 끝 → 엔딩 기본 첫 카드가 리텔 '3문장 20초'(청자 Maya·키워드 한국어 4·
 *      담화 표지 2) → 🎙 시작(카운트다운) → ⏹ → 전사 위 멈춤 '|' · WPM·멈춤·필러 칩 · 점수 · 키워드 4/4 적중 →
 *      va_retell(round 'short') · 시도 로그 src 'retell' · 말하기 증거 src 'retell'(cafLite 목킹) · 발화 +1 · 첫 14일엔 2·3회차 카드 없음
 *      · 오늘 질문은 월·수·금에만 '조금 더' 안 → 홈 '리텔' 점 켜짐
 *   ② 키 있음·15일+ A2: 1회차 45초 → 조금 더 ▾: ✏️ 한 줄 교정(AI 목킹) → 따라 말하기 → 2회차 30초 → 3회차 건너뛰기 → WPM 비교·가장 빨랐던 회차 ▶
 *   ③ 키 없음 + Web Speech 없음(iOS PWA): recordOnly — 말한 시간·시작까지 + '내 소리 ▶', STT·AI 호출 0, 자기확인 발화 1
 *   ④ 플래그 retell off → 리텔·오늘 질문 카드 없음
 * 마이크·STT 스텁은 83-roleplay·84-recall-speak와 같은 패턴. 역할극·회상 플래그는 꺼서 EP1을 빨리 돈다(그 흐름은 83·84가 본다).
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FA { constructor() { this.fftSize = 1024; this.t0 = Date.now(); } getFloatTimeDomainData(b) { const l = Date.now() - this.t0 > 300 && Date.now() - this.t0 < 2500; for (let i = 0; i < b.length; i++) b[i] = l ? 0.5 : 0; } }
  class FC { constructor() { this.state = 'running'; } createAnalyser() { return new FA(); } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  window.AudioContext = FC;
  class FR { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; } start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); } stop() { setTimeout(() => this.onstop?.(), 20); } }
  window.MediaRecorder = FR;
};

/** verbose_json — 토큰 '|'는 0.8초 멈춤으로 바꾼다(전사에는 안 들어간다) */
const verboseFor = (raw) => {
  const toks = raw.split(/\s+/).filter(Boolean);
  const words = [];
  let t = 0.3;
  for (const w of toks) {
    if (w === '|') {
      t += 0.8;
      continue;
    }
    words.push({ word: w, start: t, end: t + 0.25 });
    t += 0.32;
  }
  const text = words.map((w) => w.word).join(' ');
  return { text, duration: t + 0.3, words, segments: [{ start: 0, end: t + 0.3, text, avg_logprob: -0.2, no_speech_prob: 0.02, compression_ratio: 1.3 }] };
};

const RETELL_SAID = 'First it was my first day. The elevator got stuck | and I was really nervous. Then I meet Diane, she was the CEO. So actually it was fine, but finally I was late.';
const FIX = { fix: { wrong: 'Then I meet Diane', better: 'Then I met Diane', kr: '지난 일이라 met(과거형)으로' }, level: 'A2' };

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODAY = dayKey(new Date());
const DOW = new Date().getDay();
const DQ_DAY = DOW === 1 || DOW === 3 || DOW === 5;

const browser = await launch();

async function open({ key = true, webSpeech = true, flags = {}, startDaysAgo = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(MIC_STUB);
  await page.addInitScript(
    ({ key, webSpeech, flags, startDaysAgo, today }) => {
      if (!webSpeech) {
        Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
        Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
      }
      if (sessionStorage.getItem('seeded')) return; // 새로고침·이동 때 다시 덮어쓰지 않는다
      sessionStorage.setItem('seeded', '1');
      const s = new Date(Date.now() - startDaysAgo * 86400000);
      const start = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
      localStorage.setItem('va_onboarded', 'true');
      localStorage.setItem('va_drama_mute', 'true');
      localStorage.setItem('va_drama_auto', 'true');
      localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
      // 학습일은 시작일 + 어제 — 시작일만 두면 공백 ≥ RETURN_GAP_DAYS(3)라 하루 조절기(M4)가 '복귀 첫날'로 보고
      // 엔딩 '조금 더 ▾'를 통째로 숨긴다(hideMore). 여기서 보는 건 꾸준히 해 온 학습자의 평범한 날이다.
      const y = new Date(Date.now() - 86400000);
      const yday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      localStorage.setItem('va_days', JSON.stringify([...new Set([start, yday])]));
      // 월 1회 3/3/3이 날짜에 따라 끼어들지 않게 — 이번 달 '정확하게 말하기 날'은 이미 했다
      localStorage.setItem('va_retell', JSON.stringify([{ date: `${today.slice(0, 7)}-01`, epNo: 0, round: '333', wpm: 50, score: 60, durationMs: 30000 }]));
      if (key) localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
      localStorage.setItem('va_flags', JSON.stringify({ rolePlay: false, speakRecall: false, ...flags }));
    },
    { key, webSpeech, flags, startDaysAgo, today: TODAY }
  );
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  const ai = { caf: 0 };
  await page.route('**/app/api/groq', (r) => {
    const sys = String(JSON.parse(r.request().postData() || '{}').messages?.[0]?.content || '');
    const isCaf = sys.includes('말하기 코치');
    if (isCaf) ai.caf++;
    const content = isCaf ? JSON.stringify(FIX) : '{}';
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });
  const stt = { replies: [], calls: 0 };
  await page.route('**/app/api/stt', (r) => {
    stt.calls++;
    const text = stt.replies.length ? stt.replies.shift() : 'Hello.';
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(verboseFor(text)) });
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  return { ctx, page, stt, ai };
}

/** EP1을 끝까지 — 고르기·뜻은 정답, 따라 말하기는 건너뛰기, 수동이면 다음 */
async function toEnding(page, budgetMs = 180000) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (await page.locator('.dr-end').count()) return true;
    const choice = page.locator('.dr-act .dr-opt', { hasText: "Yes, it's my first day." });
    const meaning = page.locator('.dr-act .dr-opt', { hasText: '조금만 버텨 봐요' });
    if (await choice.count()) await choice.first().click();
    else if (await meaning.count()) await meaning.first().click();
    else if (await page.locator('.dr-act .dr-skip').count()) await page.locator('.dr-act .dr-skip').first().click();
    else if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(250);
  }
  return false;
}

/** 리텔 한 회차 녹음 — 시작 → 카운트다운 → ms 뒤 ⏹ → 결과 */
async function speak(page, scope, ms) {
  await page.locator(`${scope} .rt-start`).click();
  await page.waitForSelector(`${scope} .rt-run[data-phase="rec"] .rt-time`, { timeout: 10000 });
  await page.waitForTimeout(ms);
  await page.locator(`${scope} .rt-stop`).click();
  await page.waitForSelector(`${scope} .rt-run[data-phase="done"] .rt-result`, { timeout: 20000 });
}

const readStore = (page) =>
  page.evaluate((today) => {
    const j = (k, d) => JSON.parse(localStorage.getItem(k) || d);
    return {
      retell: j('va_retell', '[]').filter((r) => r.date === today && r.epNo !== 0),
      attempts: j('va_attempt_log', '[]').filter((a) => a.src === 'retell'),
      evidence: j('va_cefr_evidence', '[]').filter((e) => e.src === 'retell'),
      spoken: j('va_spoken', '{}').count || 0,
      goal: j('va_speak_goal', '{}'),
    };
  }, TODAY);

/* ══ ① 키 있음 · 첫 14일 — '3문장 20초' ══ */
{
  const { ctx, page, stt, ai } = await open();
  check('EP1 끝까지', await toEnding(page));
  const first = await page.locator('.ee-root .ee-card').first().getAttribute('data-card');
  check('엔딩 기본 첫 카드 = 리텔', first === 'retell', first);
  const card = '.ee-card[data-card="retell"]';
  const round = await page.textContent(`${card} .rt-round`);
  check("첫 14일: '3문장 20초' 1회", round.includes('3문장 20초') && (await page.getAttribute(`${card} .rt-card`, 'data-phase')) === 'first14', round);
  check('청자 Maya + 3문장 안내', (await page.textContent(`${card} .rt-listener`)).includes('Maya에게') && (await page.textContent(`${card} .rt-guide`)).includes('3문장'));
  const kws = await page.locator(`${card} .rt-chip.kw`).allTextContents();
  check('키워드 칩 3개(첫 14일) — 한국어만, 영어 가림', kws.length === 3 && kws[0].includes('첫 출근') && kws.every((k) => !/[a-z]{3}/.test(k)), kws.join(' | '));
  check('담화 표지 칩 2개(영어 노출)', (await page.locator(`${card} .rt-chip.mk`).count()) === 2);
  check('오늘 표현 칩(한국어만)', (await page.locator(`${card} .rt-chip.lr`).count()) === 2 && !(await page.textContent(`${card} .rt-prompts`)).includes('Hang in there'));
  check('엔딩이 뜨자마자 마이크를 열지 않는다(🎙 시작 · 20초)', (await page.textContent(`${card} .rt-start`)).includes('20초') && stt.calls === 0);

  stt.replies.push(RETELL_SAID);
  await page.locator(`${card} .rt-start`).click();
  await page.waitForSelector(`${card} .rt-run[data-phase="rec"] .rt-time`, { timeout: 10000 });
  await page.waitForTimeout(1500);
  const t1 = await page.textContent(`${card} .rt-time`);
  check('녹음 중 카운트다운(경과/20초 · 남은 초)', /\/ 20초/.test(t1) && /남은 \d+초/.test(t1), t1);
  await page.waitForTimeout(4200);
  await page.locator(`${card} .rt-stop`).click();
  await page.waitForSelector(`${card} .rt-run[data-phase="done"] .rt-result`, { timeout: 20000 });
  check('전사 위 멈춤 표시 |', (await page.locator(`${card} .rt-said .rt-pause`).count()) === 1 && (await page.textContent(`${card} .rt-said`)).includes('stuck |'));
  const chips = (await page.locator(`${card} .rt-result .rt-chip.stat`).allTextContents()).join(' · ');
  check('WPM·멈춤·필러 칩', /WPM \d+/.test(chips) && /멈춤 1/.test(chips) && /필러 \d/.test(chips), chips);
  check('키워드 적중 ✓ 3/3', (await page.locator(`${card} .rt-result .rt-chip.kw.hit`).count()) === 3);
  const score = Number((await page.textContent(`${card} .rt-score b`)) || 0);
  check('scoreRetell 점수', score >= 70, String(score));
  check("'내 소리 ▶'", (await page.locator(`${card} .rt-play`).count()) === 1);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('va_cefr_evidence') || '[]').some((e) => e.src === 'retell'), null, { timeout: 10000 }).catch(() => null);
  const st = await readStore(page);
  check("va_retell 오늘 1건(round 'short', WPM·점수·멈춤)", st.retell.length === 1 && st.retell[0].round === 'short' && st.retell[0].epNo === 1 && st.retell[0].wpm > 0 && st.retell[0].score === score && st.retell[0].pauses === 1, JSON.stringify(st.retell));
  check("시도 로그 src 'retell'(wpm·pauseCount·quality ok)", st.attempts.length === 1 && st.attempts[0].wpm > 0 && st.attempts[0].pauseCount === 1 && st.attempts[0].quality === 'ok', JSON.stringify(st.attempts));
  check("말하기 증거 src 'retell' 1건(cafLite 1회)", ai.caf === 1 && st.evidence.length === 1 && st.evidence[0].skill === 'speaking' && st.evidence[0].level === 'A2', JSON.stringify(st.evidence));
  check('발화 +1(채점)', st.spoken === 1 && st.goal.scoredToday === 1, JSON.stringify(st.goal));
  // 첫 14일엔 2·3회차 없음 — 오늘 질문은 월·수·금에만 '조금 더' 안
  if (await page.locator('.ee-more-btn').count()) await page.click('.ee-more-btn');
  check('첫 14일: 2·3회차 카드 없음', (await page.locator('.ee-card[data-card="retell-more"]').count()) === 0);
  check(`오늘 질문 — 월·수·금만(오늘 ${DQ_DAY ? '있음' : '없음'})`, (await page.locator('.ee-more .ee-card[data-card="daily-q"]').count()) === (DQ_DAY ? 1 : 0));
  if (DQ_DAY) {
    const dq = '.ee-card[data-card="daily-q"]';
    check('오늘 질문 20초 — 영어 질문 + 한국어', (await page.textContent(`${dq} .rt-title`)).includes('20초') && (await page.textContent(`${dq} .rt-dq-en`)).length > 5);
    stt.replies.push('I would say sorry to Maya and ask for help.');
    await page.locator(`${dq} .rt-start`).click();
    await page.waitForTimeout(1200);
    await page.locator(`${dq} .rt-stop`).click();
    await page.waitForSelector(`${dq} .rt-result`, { timeout: 20000 });
    const dqLog = await page.evaluate(() => JSON.parse(localStorage.getItem('va_attempt_log') || '[]').filter((a) => a.src === 'daily-q'));
    check("오늘 질문 기록 src 'daily-q'(AI 0)", dqLog.length === 1 && ai.caf === 1 && /단어 \d+/.test(await page.textContent(`${dq} .rt-result`)));
  }
  // 홈 '리텔' 점
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.dr-card', { timeout: 15000 });
  await page.waitForSelector('.rc-dots', { timeout: 10000 });
  check("홈 점 4개 중 '리텔' 켜짐", (await page.getAttribute('.rc-dots', 'aria-label')).includes('리텔 ✓'), await page.getAttribute('.rc-dots', 'aria-label'));
  await ctx.close();
}

/* ══ ② 키 있음 · 15일+ A2 — 45/30/20 + 한 줄 교정 + 3회차 건너뛰기 ══ */
{
  const { ctx, page, stt } = await open({ startDaysAgo: 20 });
  check('EP1 끝까지', await toEnding(page));
  const card = '.ee-card[data-card="retell"]';
  check("A2 15일+: 1회차 45초 · 키워드 4", (await page.textContent(`${card} .rt-round`)).includes('45초') && (await page.locator(`${card} .rt-chip.kw`).count()) === 4);
  stt.replies.push(RETELL_SAID);
  await speak(page, card, 1500);
  check('1회차 뒤 안내 — 조금 더 ▾ 에서 2회차', (await page.textContent(`${card} .rt-note`)).includes('2회차'));
  await page.click('.ee-more-btn');
  const more = '.ee-card[data-card="retell-more"]';
  await page.waitForSelector(`${more} .rt-fix-better`, { timeout: 10000 });
  check('✏️ 한 줄 교정 — 틀린 말(취소선) → 고친 문장 + 한국어', (await page.textContent(`${more} .rt-fix-wrong`)).includes('I meet Diane') && (await page.textContent(`${more} .rt-fix-better`)).includes('I met Diane') && (await page.textContent(`${more} .rt-fix-kr`)).includes('과거형'));
  stt.replies.push('Then I met Diane');
  await page.click(`${more} .rt-fix-follow`);
  await page.waitForTimeout(800);
  if (await page.locator(`${more} .rt-stop`).count()) await page.click(`${more} .rt-stop`);
  await page.waitForSelector(`${more} .rt-fix-res`, { timeout: 15000 });
  check('따라 말하기 1회 — 점수', /따라 말하기 \d+점/.test(await page.textContent(`${more} .rt-fix-res`)));
  await page.click(`${more} .rt-fix-next`);
  await page.waitForSelector(`${more} .rt-run[data-round="2"]`, { timeout: 5000 });
  check('2회차 30초 · 청자 Jun', (await page.textContent(`${more} .rt-round`)).includes('30초') && (await page.textContent(`${more} .rt-listener`)).includes('Jun'));
  stt.replies.push('First my first day. The elevator got stuck and I was nervous. Then I met Diane the CEO. So it was fine.');
  await speak(page, more, 1200);
  await page.click(`${more} .rt-next`);
  await page.waitForSelector(`${more} .rt-run[data-round="3"]`, { timeout: 5000 });
  check('3회차는 건너뛸 수 있다', (await page.locator(`${more} .rt-skip`).count()) === 1);
  await page.click(`${more} .rt-skip`);
  await page.waitForSelector(`${more} .rt-cmp`, { timeout: 5000 });
  check('WPM 비교 2줄 + 가장 빨랐던 회차 ▶', (await page.locator(`${more} .rt-cmp-row`).count()) === 2 && (await page.locator(`${more} .rt-cmp-row.best`).count()) === 1 && (await page.textContent(`${more} .rt-best`)).includes('가장 빨랐던 회차'));
  const st = await readStore(page);
  check('va_retell 1·2회차', JSON.stringify(st.retell.map((r) => r.round)) === '[1,2]', JSON.stringify(st.retell));
  check('발화 = 1회차 + 따라 말하기 + 2회차 = 3', st.spoken === 3, String(st.spoken));
  await ctx.close();
}

/* ══ ③ 키 없음 + Web Speech 없음 — 녹음만 ══ */
{
  const { ctx, page, stt, ai } = await open({ key: false, webSpeech: false });
  check('EP1 끝까지(키 없음)', await toEnding(page));
  const card = '.ee-card[data-card="retell"]';
  check('키 없음: 녹음만 경로', (await page.getAttribute(`${card} .rt-run`, 'data-path')) === 'record');
  await speak(page, card, 2500);
  const txt = await page.textContent(`${card} .rt-result`);
  check('말한 시간·시작까지 + 내 소리 ▶ (점수 없음)', /말한 시간 \d+\.\d초/.test(txt) && /시작까지 \d+\.\d초/.test(txt) && (await page.locator(`${card} .rt-play`).count()) === 1 && (await page.locator(`${card} .rt-score`).count()) === 0, txt);
  const st = await readStore(page);
  check('STT·AI 호출 0', stt.calls === 0 && ai.caf === 0);
  check('va_retell keyless 기록 · 시도 로그·증거 없음', st.retell.length === 1 && st.retell[0].keyless === true && st.attempts.length === 0 && st.evidence.length === 0, JSON.stringify(st.retell));
  check('자기확인 발화 1(키 없는 구간 1.0)', st.spoken === 1 && st.goal.selfToday === 1, JSON.stringify(st.goal));
  await ctx.close();
}

/* ══ ④ 플래그 retell off ══ */
{
  const { ctx, page } = await open({ flags: { retell: false } });
  check('EP1 끝까지(retell off)', await toEnding(page));
  if (await page.locator('.ee-more-btn').count()) await page.click('.ee-more-btn');
  check('리텔·오늘 질문 카드 없음', (await page.locator('.rt-card').count()) === 0 && (await page.locator('[data-card="retell"], [data-card="retell-more"], [data-card="daily-q"]').count()) === 0);
  await ctx.close();
}

await browser.close();
finish('86-retell');
