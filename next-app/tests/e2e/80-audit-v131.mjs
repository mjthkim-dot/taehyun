/**
 * v1.31 감사(모바일·접근성·견고성·성능·미해결 비평) 회귀 테스트 — 검증 에이전트가 요청한 확인들:
 *   ① 집중 모드 첫 화면: 키가 없어도 빨간 경고 없음, 레벨 진단 결과 → 바로 1화
 *   ② 엔딩: 헤더 🔥가 화면 전환 없이 1로, 오늘 불꽃 줄
 *   ③ 키 없이 말하기: 브라우저 받아쓰기 → 따라 말하기 결과·말한 문장 수 / 받아쓰기 없으면 ✓ 한 번만
 *   ④ 더보기 시트: Tab이 시트 안에서만, ✕로 닫힘, 드라마는 '홈' 탭이 켜짐
 *   ⑤ 터치 대상 44px(드라마 조작 줄)
 *   ⑥ 백업: 모드 없는 옛 백업 복원 → 집중 모드, 3화 이상·백업 없음 → 보관 권유(나중에 → 숨김)
 *   ⑦ 주간 리포트: 말한 문장 0이어도 학습일이 있으면 '기록 없음'이라 하지 않음, 목표선 = 내 목표
 *   ⑧ 재방문 홈 레이아웃 이동(CLS) < 0.05
 *   ⑨ 키 없이도 인물마다 다른 목소리(또는 음높이)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BASE, check, finish, launch } from './helpers.mjs';

const browser = await launch();
// 시드는 '없을 때만' 넣는다 — 새로고침 뒤(복원 등)에 앱이 바꾼 값을 덮어쓰지 않게
const base = (extra = {}) => {
  localStorage.setItem('va_onboarded', 'true');
  for (const [k, v] of Object.entries(extra)) if (localStorage.getItem(k) == null) localStorage.setItem(k, JSON.stringify(v));
};
async function ctxPage(extra = {}, vp = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(base, extra);
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  return { ctx, page };
}
const TODAY_PLACED = { cefr: 'A2', gse: 30, ts: 1759200000000 };

/* ① */
{
  const { ctx, page } = await ctxPage({ va_placed: TODAY_PLACED });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-card', { timeout: 15000 });
  check('집중 모드·키 없음: 빨간 경고가 없다', (await page.locator('.notice.danger').count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await ctxPage({});
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta'); // 1단계: 레벨 진단
  await page.waitForSelector('[role=radiogroup]', { timeout: 15000 });
  check('레벨 진단 보기 = 라디오(선택 상태를 읽어 준다)', (await page.locator('[role=radio]').count()) >= 18);
  const groups = await page.locator('[role=radiogroup]').count();
  for (let g = 0; g < groups; g++) await page.locator('[role=radiogroup]').nth(g).locator('[role=radio]').first().click();
  await page.click('.start-drill-btn');
  await page.waitForSelector('.start-drill-btn:has-text("바로 1화")', { timeout: 10000 });
  await page.click('.start-drill-btn:has-text("바로 1화")');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  check('진단 결과에서 바로 1화가 재생된다(홈을 한 번 더 거치지 않음)', await page.evaluate(() => document.querySelector('.dr-ep')?.textContent.includes('EP 1')));
  await ctx.close();
}

/* ② 엔딩 — 헤더 불꽃이 바로 1 */
{
  const { ctx, page } = await ctxPage({ va_placed: TODAY_PLACED, va_drama_mute: true, va_drama_auto: false });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  // M2 역할극: 태오 대사는 영어 2초 플래시(.rs-flash.on — 누를 것이 없다) 뒤 녹음·자기확인(.rs-self-ok)·넘어가기(.rs-skip, 화당 3회)가 뜬다.
  // 플래시를 기다려야 해서 반복 횟수(예전 40회×80ms)가 아니라 시간으로 끝까지 진행한다.
  const t0 = Date.now();
  while (Date.now() - t0 < 90000 && !(await page.locator('.dr-end').count())) {
    if (await page.locator('.dr-act .dr-opt').count()) await page.locator('.dr-act .dr-opt').first().click();
    else if (await page.locator('.dr-act .rs-next').count()) await page.click('.dr-act .rs-next');
    else if (await page.locator('.dr-act .rs-self-ok').count()) await page.click('.dr-act .rs-self-ok');
    // 헤드리스 Chromium은 Web Speech 경로지만 받아쓰기가 열리지 않는다 — 자동 시작 실패(idle) 뒤 🎙를 한 번 더 누르면 자기확인으로 간다
    else if (await page.locator('.dr-act[data-phase=idle] .rs-mic, .dr-act[data-phase=gate] .rs-mic').count()) await page.click('.dr-act .rs-mic');
    else if (await page.locator('.dr-skip:not([disabled])').count()) await page.click('.dr-skip:not([disabled])');
    if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(80);
  }
  await page.waitForSelector('.dr-end', { timeout: 5000 });
  await page.waitForTimeout(300);
  check('엔딩에서 헤더 불꽃이 곧바로 🔥 1', (await page.locator('.streak-chip').textContent())?.includes('1'));
  check('엔딩에 오늘 불꽃 줄', (await page.locator('.dr-flame').count()) === 1);
  check('엔딩 제목에 포커스(키보드·스크린리더)', await page.evaluate(() => document.activeElement?.classList.contains('dr-end-title')));
  await ctx.close();
}

/* ③ 키 없이 말하기 — 브라우저 받아쓰기 스텁 */
const SR_STUB = () => {
  class SR {
    constructor() {
      this.onresult = null;
      this.onend = null;
      this.onerror = null;
    }
    start() {
      setTimeout(() => {
        // M2 역할극: 목표 영어는 녹음 직전 2초 플래시(.rs-flash.on)로만 보인다 — 관찰해 둔 마지막 플래시 문장을 그대로 말한다
        const target = window.__lastFlash || '';
        this.onresult?.({ results: [[{ transcript: target }]] });
        this.onend?.();
      }, 60);
    }
    stop() {}
    abort() {}
  }
  // 최신 Chromium은 접두사 없는 SpeechRecognition도 있다 — 둘 다 바꿔 끼운다
  window.webkitSpeechRecognition = SR;
  window.SpeechRecognition = SR;
  new MutationObserver(() => {
    const f = document.querySelector('.rs-flash.on');
    if (f && f.textContent.trim() && f.textContent.trim() !== '…') window.__lastFlash = f.textContent.trim();
  }).observe(document, { subtree: true, childList: true, characterData: true });
};
{
  const { ctx, page } = await ctxPage({ va_placed: TODAY_PLACED, va_drama_mute: true, va_drama_auto: false });
  await page.addInitScript(SR_STUB);
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  // M2 이후 따라 말하기(SpeakStep)는 역할극(RoleStep)이 됐다 — 키가 없으면 Web Speech 경로로 듣기→플래시 뒤 '자동으로' 녹음한다
  // (예전처럼 🎙를 먼저 누르지 않는다). 섀도잉(마이크 없음 → 자기확인)은 ✓로 넘기고 태오 대사 결과 카드까지 간다.
  const t3 = Date.now();
  while (Date.now() - t3 < 60000 && !(await page.locator('.dr-act[data-mode=role] .rs-result').count())) {
    if (await page.locator('.dr-act .dr-opt').count()) await page.locator('.dr-act .dr-opt').first().click();
    else if (await page.locator('.dr-act[data-mode=shadow] .rs-self-ok').count()) await page.click('.dr-act .rs-self-ok');
    else if (await page.locator('.dr-act[data-mode=shadow] .rs-next').count()) await page.click('.dr-act .rs-next');
    if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(80);
  }
  check('키 없어도 태오 대사는 브라우저 받아쓰기로 채점(경로 webspeech)', (await page.getAttribute('.dr-act[data-mode=role]', 'data-path').catch(() => '')) === 'webspeech');
  await page.waitForSelector('text=내가 한 말', { timeout: 5000 });
  check('받아쓴 말과 일치도 피드백', await page.evaluate(() => {
    const r = document.querySelector('.dr-act[data-mode=role] .rs-result');
    const score = Number(r?.querySelector('.rs-score b')?.textContent.replace(/\D/g, '') || 0);
    return score >= 90 && !r.querySelector('.rs-w.bad') && !!r.querySelector('.rs-msg')?.textContent.trim();
  }));
  // 역할극 결과는 '다음 ▶'으로 대사를 마칠 때 기록된다
  await page.click('.dr-act[data-mode=role] .rs-next');
  await page.waitForTimeout(300);
  check('말한 문장 수에 센다', await page.evaluate(() => (JSON.parse(localStorage.getItem('va_spoken') || '{}').count || 0) >= 1));
  await ctx.close();
}
{
  const { ctx, page } = await ctxPage({ va_placed: TODAY_PLACED, va_drama_mute: true, va_drama_auto: false });
  await page.addInitScript(() => {
    delete window.webkitSpeechRecognition;
    delete window.SpeechRecognition;
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  // 섀도잉(M2)은 상대 대사를 다 들은 뒤에 자기확인 버튼이 뜬다 — 반복 횟수가 아니라 시간으로 기다린다
  for (const t4 = Date.now(); Date.now() - t4 < 30000 && !(await page.locator('button:has-text("소리 내어 말했어요")').count()); ) {
    if (await page.locator('.dr-act .dr-opt').count()) await page.locator('.dr-act .dr-opt').first().click();
    // 마이크 자동 시작이 실패하면(헤드리스) 🎙 한 번 더 → 그래도 안 되면 자기확인(역할극 설계)
    else if (await page.locator('.dr-act[data-phase=idle] .rs-mic').count()) await page.click('.dr-act .rs-mic');
    if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(80);
  }
  check('받아쓰기가 없는 기기: 소리 내어 말했어요 ✓', (await page.locator('button:has-text("소리 내어 말했어요")').count()) === 1);
  await page.click('button:has-text("소리 내어 말했어요")');
  check('✓ 한 번 = 한 문장', await page.evaluate(() => JSON.parse(localStorage.getItem('va_spoken') || '{}').count === 1));
  await ctx.close();
}
{
  // 회화(키 없음) — 대사 따라 말하기 ✓를 두 번 눌러도 한 번만 센다
  const { ctx, page } = await ctxPage({ va_placed: TODAY_PLACED, va_drama: { done: { 1: '2026-09-28' }, score: { 1: 80 } } });
  await page.addInitScript(() => {
    delete window.webkitSpeechRecognition;
    delete window.SpeechRecognition;
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("회화")');
  await page.waitForSelector('.dt-shadow', { timeout: 15000 });
  const first = page.locator('.dt-shadow').first();
  await first.locator('button:has-text("말했어요")').click();
  await first.locator('button:has-text("말했어요")').click();
  check('대사 한 줄 ✓는 한 번만 센다', await page.evaluate(() => JSON.parse(localStorage.getItem('va_spoken') || '{}').count === 1));
  await ctx.close();
}

/* ④ 더보기 시트 */
{
  const { ctx, page } = await ctxPage({ va_placed: TODAY_PLACED });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 5000 });
  for (let k = 0; k < 10; k++) await page.keyboard.press('Tab');
  check('Tab이 시트 안에서만 돈다', await page.evaluate(() => !!document.querySelector('.more-sheet')?.contains(document.activeElement)));
  await page.click('.more-sheet-close');
  check('✕로 닫힌다', (await page.locator('.more-sheet').count()) === 0);
  await page.click('.mode-tab:has-text("더보기")');
  await page.click('.more-sheet .feat-card:has-text("드라마")');
  await page.waitForSelector('.dr-hero', { timeout: 10000 });
  check('드라마는 홈 탭이 켜진다(더보기 아님)', await page.evaluate(() => document.querySelector('.mode-tab.active')?.textContent.includes('홈')));
  await ctx.close();
}

/* ⑤ 터치 대상 44px — 드라마 조작 줄 */
{
  const { ctx, page } = await ctxPage({ va_placed: TODAY_PLACED, va_drama_mute: true, va_drama_auto: false }, { width: 360, height: 740 });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-top', { timeout: 15000 });
  const small = await page.evaluate(() => [...document.querySelectorAll('.dr-top button')].map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
  check('드라마 조작 줄 버튼이 모두 44px 이상', small === 0, `${small}개 작음`);
  await ctx.close();
}

/* ⑥ 백업 */
{
  const { ctx, page } = await ctxPage({ va_mode: 'full' });
  page.on('dialog', (d) => d.accept());
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  const tmp = path.join(os.tmpdir(), `bk-v131-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ app: 'my-english-coach', format: 1, exportedAt: new Date().toISOString(), data: { va_days: JSON.stringify(['2026-09-01']), va_drama: JSON.stringify({ done: { 1: '2026-09-01' }, score: { 1: 90 } }) } }));
  await page.evaluate(() => {
    window.history.pushState({ ...(window.history.state || {}), mode: 'backup' }, '');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
  await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 10000 });
  await page.setInputFiles('input[type=file]', tmp);
  await page.waitForEvent('load', { timeout: 8000 }).catch(() => null);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  const tabs = await page.$$eval('.mode-tab', (bs) => bs.map((b) => b.textContent.trim()));
  check('모드가 없는 옛 백업을 복원하면 집중 모드(탭 4개)', tabs.join(',') === '홈,단어,회화,더보기', tabs.join(','));
  fs.rmSync(tmp, { force: true });
  await ctx.close();
}
{
  const { ctx, page } = await ctxPage({ va_placed: TODAY_PLACED, va_drama: { done: { 1: '2026-09-20', 2: '2026-09-21', 3: '2026-09-22' }, score: {} }, va_days: ['2026-09-22'] });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.dr-card', { timeout: 15000 });
  check('3화 이상·백업 없음 → 파일로 보관 권유', (await page.locator('.dr-card button:has-text("파일로 보관하기")').count()) === 1);
  await page.click('.dr-card button:has-text("나중에")');
  await page.reload();
  await page.waitForSelector('.dr-card', { timeout: 15000 });
  check('나중에 → 다시 열어도 숨김', (await page.locator('.dr-card button:has-text("파일로 보관하기")').count()) === 0);
  await ctx.close();
}

/* ⑦ 주간 리포트(전체 모드) */
{
  const d = (n) => {
    const x = new Date();
    x.setDate(x.getDate() - n);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const counts = Object.fromEntries([0, 1, 2, 3, 4].map((n) => [d(n), 2]));
  const { ctx, page } = await ctxPage({ va_mode: 'full', va_daycount: counts, va_daily_goal: 5 });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.evaluate(() => {
    window.history.pushState({ ...(window.history.state || {}), mode: 'progress' }, '');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
  await page.waitForFunction(() => document.body.innerText.includes('목표선'), null, { timeout: 20000 });
  const txt = await page.evaluate(() => document.body.innerText);
  check('말한 문장 0이어도 학습일이 있으면 기록 없음이라 하지 않는다', !txt.includes('아직 학습 기록이 없어요') && !txt.includes('아직 말하기 기록이 없어요'));
  check('목표선 = 내가 고른 하루 목표', txt.includes('목표선 5/일'));
  await ctx.close();
}

/* ⑧ 재방문 홈 CLS */
{
  const { ctx, page } = await ctxPage({ va_placed: TODAY_PLACED, va_drama: { done: { 1: '2026-09-28' }, score: { 1: 80 } }, va_days: ['2026-09-28'], va_seen_whatsnew: 'old-id' });
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.dr-card', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const cls = await page.evaluate(() => window.__cls);
  check('재방문 홈 레이아웃 이동(CLS) < 0.05', cls < 0.05, cls.toFixed(3));
  await ctx.close();
}

/* ⑨ 키 없이 인물 목소리 구분 */
{
  const { ctx, page } = await ctxPage({ va_placed: TODAY_PLACED, va_drama_auto: true });
  await page.addInitScript(() => {
    window.__utt = [];
    const voices = [
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Karen', lang: 'en-AU' },
      { name: 'Daniel', lang: 'en-GB' },
      { name: 'Alex', lang: 'en-US' },
    ];
    const synth = {
      speaking: false, paused: false, pending: false,
      getVoices: () => voices,
      cancel() {}, pause() {}, resume() {},
      speak(u) {
        window.__utt.push({ text: u.text, voice: u.voice?.name || '', pitch: u.pitch });
        setTimeout(() => u.onend && u.onend(), 20);
      },
      addEventListener() {}, removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForFunction(() => (window.__utt || []).some((u) => u.text.includes('Is it') ) && (window.__utt || []).some((u) => u.text.includes('Oh no')), null, { timeout: 20000 });
  const u = await page.evaluate(() => window.__utt);
  const diane = u.find((x) => x.text.includes('Oh no'));
  const taeo = u.find((x) => x.text.includes('Is it'));
  check('키 없이도 Diane과 태오의 목소리가 다르다', !!diane && !!taeo && (diane.voice !== taeo.voice || diane.pitch !== taeo.pitch), JSON.stringify({ diane, taeo }));
  await ctx.close();
}

await browser.close();
finish('80-audit-v131');
