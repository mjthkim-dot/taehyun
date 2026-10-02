/**
 * M10 말하기 기준선·성장 아카이브:
 *   ① 키 있음: 배치고사(A1) → 결과 아래 기준선 '오늘 하루 3문장' 15초 → 녹음(Whisper verbose_json 목킹) →
 *      WPM·3문장 ✓·말하기 레벨 보정(A1→A2, 문법 배치값은 그대로) · va_baseline · 시도 로그 src 'baseline' · 녹음 kind 'baseline'
 *      → 진도 '말하기' 섹션: 아카이브 1건 · 지표 3축 · 시간 예산 한 줄 · 주간 목표 버튼
 *      → 이달의 1분(지난 기록 40일 전 시드 → 때가 됨): 1분 녹음 → 재전사(프롬프트 없음·temperature 0) → 이해가능성 · src 'monthly'
 *        → 지난번 vs 이번 달 비교 칩 · 튜터 점수 버튼(1~9) → va_anchor
 *      → CEFR 리포트 '누적 말하기 …' 한 줄(홈 CefrHero가 아니라 레벨 화면)
 *   ② 키 없음: 기준선은 녹음만(STT 0) + pendingRetranscribe → AI 키 등록 저장 성공 시 1회 재전사 → 보정·안내
 *   ③ D+7(시작 7일 전 시드 + D+1 녹음 IndexedDB 시드): EP1 엔딩 '조금 더 ▾'에 D+7 카드 → 녹음 → 'D+1 나 ▶ / D+7 나 ▶ / 태오 ▶'
 *   ④ 플래그 growth off → 월간 카드·D+7 카드 없음(기준선·아카이브는 그대로)
 * 마이크·STT 스텁은 86-retell과 같은 패턴.
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

const verboseFor = (raw) => {
  const toks = raw.split(/\s+/).filter(Boolean);
  const words = [];
  let t = 0.3;
  for (const w of toks) {
    words.push({ word: w, start: t, end: t + 0.25 });
    t += 0.32;
  }
  const text = words.map((w) => w.word).join(' ');
  return { text, duration: t + 0.3, words, segments: [{ start: 0, end: t + 0.3, text, avg_logprob: -0.2, no_speech_prob: 0.02, compression_ratio: 1.3 }] };
};

const DAY_SAID = 'I woke up early today. I met a customer in the morning. It was a busy but good day.';
const MONTH_SAID = 'I work in cloud sales. My team helps customers move to the cloud. I visit customers every week.';
const MONTH_PLAIN = 'I work in cloud sales. My team helps customer move to the cloud. I visit customers every weekend.';
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const browser = await launch();

async function open({ key = true, seed = {}, flags = {}, full = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(MIC_STUB);
  await page.addInitScript(
    ({ key, seed, flags, full }) => {
      if (sessionStorage.getItem('seeded')) return;
      // ①② '모든 기능' 모드(홈 CEFR 카드 → 배치고사, 더보기 → 기능 → AI 키). ③은 집중 모드(홈 드라마 카드 → EP1)
      if (full) localStorage.setItem('va_mode', JSON.stringify('full'));
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('va_onboarded', 'true');
      localStorage.setItem('va_drama_mute', 'true');
      localStorage.setItem('va_drama_auto', 'true');
      if (key) localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
      localStorage.setItem('va_flags', JSON.stringify(flags));
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
    },
    { key, seed, flags, full }
  );
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/app/api/groq', (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"hasServerKey":false}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
  });
  const stt = { replies: [], calls: 0, forms: [] };
  await page.route('**/app/api/stt', (r) => {
    stt.calls++;
    const body = r.request().postDataBuffer()?.toString('latin1') || '';
    stt.forms.push({ prompt: /name="prompt"/.test(body), temp0: /name="temperature"\r\n\r\n0\r\n/.test(body), words: /name="detail"\r\n\r\nwords/.test(body) });
    const text = stt.replies.length ? stt.replies.shift() : 'Hello.';
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(verboseFor(text)) });
  });
  await page.goto(`${BASE}/app`);
  return { ctx, page, stt };
}

/** 배치고사 — A1 3문항만 맞히고 채점 */
async function place(page) {
  await page.waitForSelector('.cf-cta', { timeout: 15000 });
  await page.click('.cf-cta');
  await page.waitForSelector('[role=radiogroup]', { timeout: 15000 });
  for (const [i, j] of [[0, 0], [1, 1], [2, 2]]) await page.locator('[role=radiogroup]').nth(i).locator('[role=radio]').nth(j).click();
  await page.click('button:has-text("채점하고 내 레벨 보기")');
  await page.waitForSelector('.ga-baseline', { timeout: 15000 });
}

async function recordBaseline(page, ms = 1500) {
  await page.click('.ga-baseline .ga-start');
  await page.waitForSelector('.ga-baseline .ga-rec', { timeout: 10000 });
  await page.waitForTimeout(ms);
  await page.click('.ga-baseline .ga-stop');
  await page.waitForSelector('.ga-baseline[data-phase="done"] .ga-result', { timeout: 20000 });
}

async function goMore(page, label) {
  await page.click('.mode-tab:has-text("더보기")');
  await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
  await page.click(`.more-sheet .feat-card:has-text("${label}")`);
}

const j = (page, k, d = 'null') => page.evaluate(([k, d]) => JSON.parse(localStorage.getItem(k) || d), [k, d]);

/* ══ ① 키 있음 ══ */
{
  const past = dayKey(new Date(Date.now() - 40 * 86400000));
  const { ctx, page, stt } = await open({ full: true, seed: { va_growth: { monthly: [{ date: past, qid: 'intro', durationMs: 60000, wpm: 40, longPauses: 9, intelligibility: 60 }] } } });
  await place(page);
  check('배치 결과 아래 기준선 단계(A1: 오늘 하루 3문장 15초·건너뛰기)', (await page.textContent('.ga-baseline')).includes('3문장') && (await page.textContent('.ga-baseline .ga-start')).includes('15초') && (await page.locator('.ga-baseline .ga-skip').count()) === 1);
  check('키 있음 → 전사 경로', (await page.getAttribute('.ga-baseline', 'data-path')) === 'whisper');
  stt.replies.push(DAY_SAID);
  await recordBaseline(page);
  const res = await page.textContent('.ga-baseline .ga-result');
  check('기준선 저장 안내 + WPM + 3문장 ✓', res.includes('기준선 저장') && /WPM \d+/.test(res) && res.includes('3문장 ✓'), res);
  check('말하기 레벨 보정 A1 → A2', res.includes('A1 → A2'), res);
  const b = await j(page, 'va_baseline');
  check('va_baseline(adj +1, pending 없음, 녹음 id)', b && b.adj === 1 && b.pendingRetranscribe === false && b.wpm > 0 && typeof b.recordingId === 'string', JSON.stringify(b));
  const placed = await j(page, 'va_placed');
  check('문법 배치는 A1 그대로, 말하기 사전값만 A2', placed.cefr === 'A1' && placed.skills?.speaking === 'A2', JSON.stringify(placed));
  check("시도 로그 src 'baseline'", (await j(page, 'va_attempt_log', '[]')).filter((a) => a.src === 'baseline').length === 1);
  check('채점 STT는 words·temperature 0', stt.forms[0]?.words && stt.forms[0]?.temp0);

  // 진도 '말하기' 섹션
  await goMore(page, '진도');
  await page.waitForSelector('.ga-sec', { timeout: 15000 });
  await page.waitForSelector('.ga-item', { timeout: 10000 });
  check('아카이브 1건(기준선)', (await page.locator('.ga-item').count()) === 1 && (await page.locator('.ga-item[data-kind="baseline"]').count()) === 1);
  check('지표 3축(회수율·유창성·청크 사용률)', (await page.locator('.ga-axis').count()) === 3);
  check('시간 예산 한 줄', /누적 말하기 .+ · B1까지 약 \d+h/.test(await page.textContent('.ga-eta')), await page.textContent('.ga-eta'));
  await page.click('.ga-goal-btn:has-text("주 14h")');
  check('주간 목표 버튼 → va_growth.weeklyGoalH', (await j(page, 'va_growth')).weeklyGoalH === 14);

  // 이달의 1분 — 맨 위
  check('이달의 1분 카드가 섹션 맨 위', await page.evaluate(() => document.querySelector('.ga-sec > .study-card')?.classList.contains('ga-monthly')));
  stt.replies.push(MONTH_SAID, MONTH_PLAIN);
  const before = stt.calls;
  await page.click('.ga-monthly .ga-start');
  await page.waitForSelector('.ga-monthly .ga-rec', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.click('.ga-monthly .ga-stop');
  await page.waitForSelector('.ga-monthly .ga-result', { timeout: 20000 });
  check('STT 2회(채점 + 프롬프트 없는 재전사·temperature 0)', stt.calls - before === 2 && stt.forms[before].prompt && !stt.forms[before + 1].prompt && stt.forms[before + 1].temp0, JSON.stringify(stt.forms.slice(before)));
  const g = await j(page, 'va_growth');
  const cur = g.monthly[g.monthly.length - 1];
  check('va_growth.monthly 2건 · 이해가능성 숫자(0~100)', g.monthly.length === 2 && typeof cur.intelligibility === 'number' && cur.intelligibility > 50 && cur.intelligibility < 100 && cur.wpm > 0, JSON.stringify(cur));
  check('time 필드 보존(시간 예산)', !!g.time && Object.keys(g.time).length >= 1);
  check("시도 로그 src 'monthly'", (await j(page, 'va_attempt_log', '[]')).filter((a) => a.src === 'monthly').length === 1);
  const cmp = await page.textContent('.ga-monthly .ga-cmp');
  check('지난번 vs 이번 달 숫자 비교', /WPM 40 → \d+/.test(cmp) && /이해가능성 60% → \d+%/.test(cmp), cmp);
  check("A/B — '이번 달 나 ▶'", (await page.locator('.ga-monthly .ga-clip:has-text("이번 달 나")').count()) === 1);
  await page.locator('.ga-monthly .ga-anchor-row').first().locator('.ga-score:has-text("6")').click();
  const anc = await j(page, 'va_anchor');
  check('튜터 점수 버튼 → va_anchor', Object.values(anc || {})[0]?.intelligibility === 6, JSON.stringify(anc));
  check('텍스트 입력칸 없음', (await page.locator('.ga-sec input, .ga-sec textarea').count()) === 0);
  await page.waitForFunction(() => document.querySelectorAll('.ga-item').length >= 1, null, { timeout: 5000 }).catch(() => null);

  // CEFR 리포트 한 줄
  await goMore(page, 'CEFR 리포트');
  await page.waitForSelector('.cf-hero', { timeout: 15000 });
  check("레벨 리포트 '누적 말하기 …' 한 줄", /누적 말하기 .+ · B1까지 약 \d+h/.test((await page.textContent('.ga-eta-cf')) || ''));
  await ctx.close();
}

/* ══ ② 키 없음 → 키 등록 시 재전사 ══ */
{
  const { ctx, page, stt } = await open({ key: false, full: true });
  await place(page);
  check('키 없음 → 녹음만 경로 + 안내', (await page.getAttribute('.ga-baseline', 'data-path')) === 'record' && (await page.textContent('.ga-baseline')).includes('키를 등록하면'));
  await recordBaseline(page);
  const b0 = await j(page, 'va_baseline');
  check('키 없음: STT 0 · pendingRetranscribe · adj 없음', stt.calls === 0 && b0?.pendingRetranscribe === true && b0.adj === undefined && typeof b0.recordingId === 'string', JSON.stringify(b0));
  check('키 없음: 말하기 사전값 그대로', !(await j(page, 'va_placed')).skills);

  await goMore(page, '기능');
  await page.waitForSelector('.feat-card:has-text("AI 키 등록")', { timeout: 8000 });
  await page.click('.feat-card:has-text("AI 키 등록")');
  await page.waitForSelector('.key-status', { timeout: 8000 });
  check('키 등록 화면에 기준선 재전사 안내', (await page.locator('.ga-key-note').count()) === 1);
  stt.replies.push(DAY_SAID);
  await page.fill('.text-input', 'gsk_test_key');
  await page.click('.key-save');
  await page.waitForFunction(() => document.querySelector('.key-msg.ok')?.textContent.includes('첫 녹음을 다시 들었어요'), null, { timeout: 15000 }).catch(() => null);
  check('저장 성공 → 1회 재전사 안내', ((await page.textContent('.key-msg.ok')) || '').includes('첫 녹음을 다시 들었어요'), await page.textContent('.key-msg.ok'));
  const b1 = await j(page, 'va_baseline');
  check('사후 보정: STT 1회 · pending 해제 · WPM · 말하기 사전값', stt.calls === 1 && b1.pendingRetranscribe === false && b1.wpm > 0 && (await j(page, 'va_placed')).skills?.speaking === 'A2', JSON.stringify(b1));
  await ctx.close();
}

/* ══ ③ D+7 카드 · ④ growth off ══ */
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

async function d7Run({ growth }) {
  const start = dayKey(new Date(Date.now() - 7 * 86400000));
  const yday = dayKey(new Date(Date.now() - 86400000));
  const today = dayKey(new Date());
  const { ctx, page } = await open({
    seed: {
      va_placed: { cefr: 'A2', gse: 30, ts: Date.now() },
      va_days: [start, yday],
      va_growth: { d7Pair: { en: 'Sorry! The elevator got stuck.', d1Id: 'd7-seed-1' } },
      va_retell: [{ date: `${today.slice(0, 7)}-01`, epNo: 0, round: '333', wpm: 50, score: 60, durationMs: 30000 }],
    },
    flags: { rolePlay: false, speakRecall: false, retell: false, ...(growth ? {} : { growth: false }) },
  });
  // D+1 녹음 시드(앱과 같은 스키마로 IndexedDB v2)
  await page.evaluate(
    (start1) =>
      new Promise((res) => {
        const req = indexedDB.open('preply-english-coach', 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('lessons')) db.createObjectStore('lessons', { keyPath: 'id' }).createIndex('by-date', 'date');
          if (!db.objectStoreNames.contains('tts')) db.createObjectStore('tts', { keyPath: 'key' }).createIndex('by-at', 'at');
          if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings', { keyPath: 'id' }).createIndex('by-kind', 'kind');
        };
        req.onsuccess = () => {
          const tx = req.result.transaction('recordings', 'readwrite');
          tx.objectStore('recordings').put({ id: 'd7-seed-1', kind: 'd7', date: start1, at: Date.now() - 6 * 86400000, en: 'Sorry! The elevator got stuck.', blob: new Blob([new Uint8Array(3000)], { type: 'audio/webm' }), mime: 'audio/webm', durationMs: 2000 });
          tx.oncomplete = () => res(true);
          tx.onerror = () => res(false);
        };
        req.onerror = () => res(false);
      }),
    dayKey(new Date(Date.now() - 6 * 86400000))
  );
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  const ended = await toEnding(page);
  if (await page.locator('.ee-more-btn').count()) await page.click('.ee-more-btn');
  return { ctx, page, ended };
}

{
  const { ctx, page, ended } = await d7Run({ growth: true });
  check('EP1 끝까지(D+7)', ended);
  const card = '.ee-card[data-card="d7"]';
  check("D+7: '조금 더' 안에 D+7 카드(order 70)", (await page.locator(`.ee-more ${card}`).count()) === 1 && (await page.getAttribute(`${card} .ga-d7`, 'data-stage')) === '7');
  check('고정 문장 = EP1 태오 대사', (await page.textContent(`${card} .ga-q`)).includes('Sorry! The elevator got stuck.'));
  await page.click(`${card} .ga-start`);
  await page.waitForSelector(`${card} .ga-result`, { timeout: 20000 });
  const labels = (await page.locator(`${card} .ga-clip`).allTextContents()).join(' | ');
  check("A/B 3클립 'D+1 나 ▶ / D+7 나 ▶ / 태오 ▶'", labels.includes('D+1 나') && labels.includes('D+7 나') && labels.includes('태오'), labels);
  const pair = (await j(page, 'va_growth')).d7Pair;
  check('va_growth.d7Pair에 D+7 녹음 id', pair?.d1Id === 'd7-seed-1' && typeof pair?.d7Id === 'string', JSON.stringify(pair));
  await ctx.close();
}
{
  const { ctx, page, ended } = await d7Run({ growth: false });
  check('플래그 growth off → D+7 카드 없음', ended && (await page.locator('.ee-card[data-card="d7"]').count()) === 0);
  await goMore(page, '진도');
  await page.waitForSelector('.ga-sec', { timeout: 15000 });
  check('플래그 growth off → 월간 카드 없음(말하기 섹션은 그대로)', (await page.locator('.ga-monthly').count()) === 0 && (await page.locator('.ga-axis').count()) === 3);
  await ctx.close();
}

await browser.close();
finish('88-baseline-archive');
