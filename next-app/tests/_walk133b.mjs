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


{
  const { ctx, page, errs } = await open();
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  const t0 = Date.now();
  while (Date.now() - t0 < 240000 && !(await page.locator('.dr-end').count())) {
    if (await page.locator('.dr-act .rs-next').count()) await page.click('.dr-act .rs-next');
    else if (await page.locator('.dr-act .rs-self-ok').count()) await page.click('.dr-act .rs-self-ok');
    else if (await page.locator('.dr-act .dr-opt').count()) await page.locator('.dr-act .dr-opt').first().click();
    else if (await page.locator('.dr-act button:has-text("다음")').count()) await page.locator('.dr-act button:has-text("다음")').first().click();
    else if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1200);
  const endLine = await page.evaluate(() => document.querySelector('.dr-end')?.innerText.split('\n').slice(0, 6).join(' / '));
  console.log('ENDING:', endLine);
  console.log('va_spoken:', await page.evaluate(() => localStorage.getItem('va_spoken')), 'va_speak_goal:', await page.evaluate(() => localStorage.getItem('va_speak_goal')));
  // 리텔: 시작 → 3초 말하고 ■ 끝
  await page.locator('.rt-card button:has-text("시작"), button:has-text("🎙 시작 ·")').first().click();
  await page.waitForTimeout(3000);
  await page.locator('button:has-text("끝")').first().click();
  await page.waitForTimeout(3500);
  await page.evaluate(() => [...document.querySelectorAll('*')].find((e) => e.textContent?.trim().startsWith('🗣 이야기 다시 말하기'))?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(400);
  await shot(page, '07b-retell-result');
  const rt = await page.evaluate(() => document.body.innerText);
  console.log('RETELL result has 말 속도:', /말 속도 분당 \d+단어/.test(rt), '| 점수:', (rt.match(/\d+점/) || [''])[0]);
  // 홈 카드 불꽃 상태
  await page.click('.mode-tab:has-text("홈")');
  await page.waitForSelector('.dr-card', { timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('HOME card:', (await page.textContent('.dr-card')).replace(/\s+/g, ' ').slice(0, 220));
  console.log('HEADER flame:', await page.evaluate(() => document.querySelector('.app-header [class*="streak"], .app-header [class*="flame"], .streak-pill')?.outerHTML?.slice(0, 200)));
  await shot(page, '16-home-after');
  console.log('errors:', errs.join(' | ') || 'none');
  await ctx.close();
}
await b.close();
