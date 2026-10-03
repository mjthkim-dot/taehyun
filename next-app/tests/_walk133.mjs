// v1.33 변경점 실기 점검(임시 스크립트 — 커밋하지 않음). 390px, 마이크·받아쓰기·AI는 목킹.
import fs from 'node:fs';
import { chromium } from 'playwright';
const OUT = process.env.OUT;
const BASE = 'http://localhost:3100';
const seed = JSON.parse(fs.readFileSync('data/dramaSeed.json', 'utf8'));
const bank = JSON.parse(fs.readFileSync('data/wordBank.json', 'utf8'));
// 화면에 보이는 한국어 → 말해야 할 영어
const KR2EN = new Map();
for (const ep of seed.episodes) {
  for (const s of ep.scenes || []) if (s.kr && s.en) KR2EN.set(s.kr.trim(), s.en);
  for (const l of ep.learn || []) KR2EN.set(l.kr.trim(), l.en);
}
for (const p of bank.packs) for (const w of p.words) { if (w[5]) KR2EN.set(w[5].trim(), w[4]); }
const verbose = (text) => {
  const toks = text.split(/\s+/).filter(Boolean);
  const words = toks.map((w, i) => ({ word: w, start: 0.3 + i * 0.32, end: 0.55 + i * 0.32 }));
  return { text, duration: 0.6 + toks.length * 0.32, words, segments: [{ start: 0, end: 0.6 + toks.length * 0.32, text, avg_logprob: -0.2, no_speech_prob: 0.02, compression_ratio: 1.3 }] };
};
const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FA { constructor() { this.fftSize = 1024; this.t0 = Date.now(); } getFloatTimeDomainData(b) { const l = Date.now() - this.t0 < 500; for (let i = 0; i < b.length; i++) b[i] = l ? 0.5 : 0; } }
  class FC { constructor() { this.state = 'running'; } createAnalyser() { return new FA(); } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  window.AudioContext = FC;
  class FR { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; } start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); } stop() { setTimeout(() => this.onstop?.(), 20); } }
  window.MediaRecorder = FR;
};
const today = new Date();
const dk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yday = dk(new Date(Date.now() - 86400000));
const start = dk(new Date(Date.now() - 20 * 86400000));
const b = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
const report = [];
const note = (k, ok, extra = '') => report.push(`${ok ? '✓' : '✗'} ${k}${extra ? ' — ' + extra : ''}`);

async function open({ key = true, extra = {}, flags = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(MIC_STUB);
  await page.addInitScript(
    ({ key, extra, flags, yday, start }) => {
      if (localStorage.getItem('__seeded')) return;
      localStorage.setItem('__seeded', '1');
      localStorage.setItem('va_onboarded', 'true');
      localStorage.setItem('va_drama_mute', 'true');
      localStorage.setItem('va_drama_auto', 'true');
      localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
      localStorage.setItem('va_days', JSON.stringify([start, yday]));
      if (key) localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
      if (flags) localStorage.setItem('va_flags', JSON.stringify(flags));
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, JSON.stringify(v));
    },
    { key, extra, flags, yday, start }
  );
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  const ai = { talk: 0 };
  await page.route('**/app/api/groq', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    const sys = String(body.messages?.[0]?.content || '');
    let content = '{"fix":null,"level":"A2"}';
    if (sys.includes('등장인물')) {
      ai.talk++;
      const o = { reply: 'Great. Tell me more.', kr: '좋아요. 더 말해 줘요.', fix: null, hint: { en: "It's my first day.", kr: '오늘이 첫 출근이에요.' } };
      if (ai.talk === 1) Object.assign(o, { reply: 'Hi Taeo! How was your first day?', kr: '안녕 태오! 첫날 어땠어요?' });
      if (ai.talk === 2) Object.assign(o, { reply: 'Cool. Do you like it?', kr: '멋지네요. 좋아요?', fix: { wrong: 'I am work', better: 'I work in cloud sales.', kr: '저는 클라우드 영업을 해요.', why: 'be동사와 일반동사를 함께 쓰지 않아요.', type: 'tense' } });
      content = JSON.stringify(o);
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });
  const stt = { forced: [] };
  await page.route('**/app/api/stt', async (r) => {
    let text = stt.forced.length ? stt.forced.shift() : '';
    if (!text) {
      const shown = await page.evaluate(() => (document.querySelector('.dr-act, .wq-speak, .fgate, .rt-card, .dt-screen') || document.body).innerText).catch(() => '');
      for (const [kr, en] of KR2EN) if (shown.includes(kr)) { text = en; break; }
    }
    if (!text) text = 'Taeo started his first day. The elevator got stuck. Then he met Diane, and she was the CEO.';
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(verbose(text)) });
  });
  return { ctx, page, errs, stt };
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

/* 1. 홈 — 발화 n/목표 줄 + ⋯ 하루 모드 시트 */
{
  const { ctx, page, errs } = await open({ extra: { va_drama: { done: { 1: yday }, score: { 1: 80 } } } });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.dr-card', { timeout: 15000 });
  const t = await page.textContent('.dr-card');
  note('홈 카드: 발화 n/목표 표시', /발화\s*\d+\s*\/\s*\d+/.test(t), (t.match(/발화\s*\d+\s*\/\s*\d+/) || [''])[0]);
  await shot(page, '01-home');
  const more = page.locator('.dr-card button:has-text("⋯"), .dr-card [aria-label*="모드"]').first();
  if (await more.count()) {
    await more.click();
    await page.waitForTimeout(500);
    const sheet = await page.evaluate(() => document.body.innerText);
    note('⋯ → 하루 모드 시트(5분만·조용히)', sheet.includes('5분') && sheet.includes('조용히'));
    await shot(page, '02-daymode-sheet');
  } else note('⋯ 하루 모드 버튼', false, '찾지 못함');
  note('홈 가로 넘침 없음', !(await overflow(page)));
  note('홈 오류 없음', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 2. 드라마 역할극 → 결과 카드 → 엔딩 카드들 */
{
  const { ctx, page, errs } = await open();
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  let shotRole = false, shotResult = false, roles = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 240000 && !(await page.locator('.dr-end').count())) {
    if (!shotRole && (await page.locator('.dr-act .rs-mic, .dr-act [data-phase="rec"]').count())) { await shot(page, '03-roleplay-turn'); shotRole = true; }
    if (await page.locator('.dr-act .rs-next').count()) {
      if (!shotResult) { await page.waitForTimeout(300); await shot(page, '04-roleplay-result'); shotResult = true; }
      roles++;
      await page.click('.dr-act .rs-next');
    } else if (await page.locator('.dr-act .rs-self-ok').count()) await page.click('.dr-act .rs-self-ok');
    else if (await page.locator('.dr-act .dr-opt').count()) await page.locator('.dr-act .dr-opt').first().click();
    else if (await page.locator('.dr-act .rc-next, .dr-act button:has-text("다음")').count()) await page.locator('.dr-act .rc-next, .dr-act button:has-text("다음")').first().click();
    else if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(200);
  }
  const resultTxt = shotResult ? 'ok' : '';
  note('역할극 차례가 뜬다(한국어 보고 말하기)', shotRole);
  note('역할극 결과 카드(단어별 정오·내 소리/태오 소리)', !!resultTxt, `역할극 ${roles}줄 완료`);
  const ended = await page.locator('.dr-end').count();
  note('에피소드 엔딩 도달', !!ended);
  if (ended) {
    await page.waitForTimeout(1200);
    const endTxt = await page.textContent('.dr-end');
    note('엔딩: 발화 요약 줄', /발화|말한/.test(endTxt));
    note('엔딩: 리텔(줄거리 다시 말하기) 카드', /다시 말하기|리텔|20초|45초/.test(endTxt));
    await shot(page, '05-ending');
    await page.evaluate(() => document.querySelector('.rt-card, [class*="rt-"]')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    await shot(page, '06-ending-retell');
    const rec = page.locator('.rt-card button:has-text("🎙"), .rt-rec, [class*="rt-"] button:has-text("말하기")').first();
    if (await rec.count()) {
      await rec.click();
      await page.waitForTimeout(4000);
      const after = await page.evaluate(() => document.querySelector('.rt-card, [class*="rt-"]')?.closest('section,div')?.innerText || '');
      note('리텔 녹음 → 결과(말 속도·키워드 등)', /말 속도|점|키워드/.test(after));
      await shot(page, '07-retell-result');
    }
    const moreBtn = page.locator('.ee-more-btn');
    if (await moreBtn.count()) {
      await moreBtn.click();
      await page.waitForTimeout(800);
      await shot(page, '08-ending-more');
      note("엔딩 '조금 더 ▾' 펼침", true);
    }
  }
  note('드라마 가로 넘침 없음', !(await overflow(page)));
  note('드라마 오류 없음', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 3. 회화 탭 — 교정 → 다시 말하기 게이트 */
{
  const { ctx, page, errs, stt } = await open({ extra: { va_drama: { done: { 1: yday }, score: { 1: 80 } } } });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("회화")');
  await page.waitForTimeout(1500);
  const startBtn = page.locator('button:has-text("시작"), button:has-text("대화")').first();
  if (await startBtn.count()) await startBtn.click();
  await page.waitForTimeout(2500);
  await shot(page, '09-dtalk-start');
  stt.forced.push("It's my first day today.", 'I am work in cloud sales.', 'I work in cloud sales.');
  for (let k = 0; k < 3; k++) {
    const mic = page.locator('.dt-mic, button[aria-label*="말하기"], button:has-text("🎙")').first();
    if (await page.locator('.fgate').count()) break;
    if (await mic.count()) await mic.click().catch(() => {});
    await page.waitForTimeout(3500);
  }
  const gate = await page.locator('.fgate').count();
  note('회화: AI 교정 → 다시 말하기 게이트', !!gate);
  await shot(page, '10-dtalk-fixgate');
  note('회화 가로 넘침 없음', !(await overflow(page)));
  note('회화 오류 없음', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 4. 단어 탭 — 예문 말하기 */
{
  const { ctx, page, errs } = await open({
    extra: {
      va_words_cfg: { daily: 10, packs: [] },
      va_words_log: { [dk(today)]: { new: 10, rev: 0, ok: 10 } },
      va_words: { 'basics:today': { b: 2, d: 1, n: 2, l: 0, t: '2026-09-01' } },
    },
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("단어")');
  await page.waitForSelector('.wd-cta', { timeout: 15000 });
  await page.click('.wd-cta');
  const ok = await page.waitForSelector('.wq-speak', { timeout: 10000 }).then(() => true).catch(() => false);
  note("단어: 상자 2 = '말해 보기' 문항", ok);
  await page.waitForTimeout(500);
  await shot(page, '11-words-speak');
  const pass = await page.waitForSelector('.wq-speak[data-phase="pass"]', { timeout: 15000 }).then(() => true).catch(() => false);
  note('단어: 예문을 말하면 통과', pass);
  await shot(page, '12-words-pass');
  note('단어 오류 없음', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 5. 키 없음 — 역할극 자기확인 경로 */
{
  const { ctx, page, errs } = await open({ key: false });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  const t0 = Date.now();
  while (Date.now() - t0 < 60000 && !(await page.locator('.dr-act .rs-self-ok').count())) {
    if (await page.locator('.dr-act .dr-opt').count()) await page.locator('.dr-act .dr-opt').first().click();
    else if (await page.locator('[data-phase=idle] .rs-mic').count()) await page.locator('[data-phase=idle] .rs-mic').first().click();
    if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(200);
  }
  const self = await page.locator('.dr-act .rs-self-ok').count();
  note('키 없음·받아쓰기 없음(iOS 상당): 녹음 후 스스로 확인 경로', !!self);
  await shot(page, '13-keyless-selfcheck');
  note('키 없음 오류 없음', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 6. 진도 — 말하기 섹션(활동 후) · 백업 고급 */
{
  const { ctx, page, errs } = await open();
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.click('.more-sheet .feat-card:has-text("진도")');
  await page.waitForTimeout(2500);
  const txt = await page.evaluate(() => document.body.innerText);
  note('진도: 말하기 섹션(쉬운 한국어, 틀린 각주 없음)', txt.includes('말하기') && !txt.includes('문장 힌트를 받아'));
  await shot(page, '14-progress');
  await page.click('.mode-tab:has-text("더보기")');
  await page.click('.more-sheet .feat-card:has-text("백업")');
  await page.waitForSelector('#adv-section', { timeout: 8000 });
  await page.click('#adv-section summary');
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#adv-section')?.scrollIntoView({ block: 'start' }));
  const adv = await page.textContent('#adv-section');
  note("백업 '고급 ▾': 소리 점검 + 실험 기능 되돌리기", adv.includes('소리 점검') && adv.includes('되돌리기'));
  await shot(page, '15-backup-advanced');
  note('진도·백업 오류 없음', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

console.log(report.join('\n'));
await b.close();
