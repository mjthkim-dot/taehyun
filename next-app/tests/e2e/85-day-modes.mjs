/**
 * M4 하루 조절기 — 바쁜 날·소리 못 내는 날·쉬고 돌아온 날을 '다른 모드'로 받는다.
 *   ① 홈 DramaCard 길게 누르기 → 시트 [오늘은 5분만] [조용히 모드] → 5분만:
 *      배너 · 목표 ×0.5('발화 0/5') · 플레이어 예산 바 '/ 5:00' · 역할극 3줄만(EP1 태오 대사 4줄 중 3) ·
 *      엔딩 '오늘은 5분 완료'(조금 더 ▾ 없음) · 회상 3개 → 홈 '발화 6/5' 불꽃 lit (리텔 1회는 M5 카드가 붙으면 이 흐름에 들어온다)
 *   ② '⋯' 버튼(키보드 경로) → 조용히 모드: 점 2개(리텔·회화 숨김) · 역할극이 입모양(lip — 듣기 → 한국어 → 영어 공개 →
 *      '입으로만 따라했어요 ✓', STT 호출 0) · 발화 0.5 가중 · 회화 탭 첫 화면에 '조용히 모드' 안내
 *   ③ 날짜 조작(마지막 학습일 5일 전) → 복귀 배너 '돌아온 것만으로 충분해요' · 프리즈 1개 자동 소비로 공백 메움 · 예산 바 '/ 8:00'
 *   ④ 플래그 dayGovernor off → 배너·예산 바 없음(전부 normal), 프리즈는 예전 규칙
 * 마이크·STT 스텁은 83-roleplay·84-recall-speak와 같은 패턴. 음소거(va_drama_mute)로 소리 대신 시간만 흐른다.
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FA { constructor() { this.fftSize = 1024; this.t0 = Date.now(); } getFloatTimeDomainData(b) { const l = Date.now() - this.t0 < 500; for (let i = 0; i < b.length; i++) b[i] = l ? 0.5 : 0; } }
  class FC { constructor() { this.state = 'running'; } createAnalyser() { return new FA(); } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  window.AudioContext = FC;
  class FR { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; } start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); } stop() { setTimeout(() => this.onstop?.(), 20); } }
  window.MediaRecorder = FR;
};

const verboseFor = (text) => {
  const toks = text.split(/\s+/).filter(Boolean);
  const words = toks.map((w, i) => ({ word: w, start: 0.3 + i * 0.32, end: 0.3 + i * 0.32 + 0.25 }));
  return { text, duration: 0.6 + toks.length * 0.32, words, segments: [{ start: 0, end: 0.6 + toks.length * 0.32, text, avg_logprob: -0.2, no_speech_prob: 0.02, compression_ratio: 1.3 }] };
};

/** EP1 역할극 순서(태오 대사): 장면 2·5·10(speak)·14 — 짧은 날은 앞 3줄 */
const T = ["Is it… broken?", "Thanks. I'm really nervous.", "I'm Taeo. Nice to meet you.", 'Sorry! The elevator got stuck.'];
/** 엔딩 회상 카드에 나올 기한 된 드라마 카드 3장(box 2 → 말로 떠올리기) */
const CARDS = [
  { en: 'See you tomorrow morning.', kr: '내일 아침에 봐요.' },
  { en: 'I am on my way now.', kr: '지금 가는 중이에요.' },
  { en: 'That makes a lot of sense.', kr: '정말 말이 되네요.' },
];

const browser = await launch();

async function open({ key = true, flags = null, lastStudyAgo = 1, freeze = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(MIC_STUB);
  await page.addInitScript(
    ({ key, flags, lastStudyAgo, freeze, cards }) => {
      if (sessionStorage.getItem('seeded')) return; // 새로고침·이동 때 다시 덮어쓰지 않는다
      sessionStorage.setItem('seeded', '1');
      const k = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const ago = (n) => k(new Date(Date.now() - n * 86400000));
      localStorage.setItem('va_onboarded', 'true');
      localStorage.setItem('va_mode', JSON.stringify('focus'));
      localStorage.setItem('va_drama_mute', 'true');
      localStorage.setItem('va_drama_auto', 'true');
      localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
      // 3화만 본 기록 — 홈 카드가 보이고(가이드 끝) 다음 화는 1화(태오 대사 4줄)
      localStorage.setItem('va_drama', JSON.stringify({ done: { 3: '2026-09-20' }, score: { 3: 80 } }));
      // 마지막 학습일 = lastStudyAgo일 전(그 전 이틀도 학습 — 연속이 있었던 사람)
      localStorage.setItem('va_days', JSON.stringify([ago(lastStudyAgo + 2), ago(lastStudyAgo + 1), ago(lastStudyAgo)]));
      if (freeze) localStorage.setItem('va_freeze', JSON.stringify({ count: freeze, earnedFor: 0 }));
      localStorage.setItem('va_weak', JSON.stringify(cards.map((c, j) => ({ ...c, cat: '드라마', lesson: 'drama:2', box: 2, lapses: 0, due: 1000 + j }))));
      if (key) localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
      if (flags) localStorage.setItem('va_flags', JSON.stringify(flags));
    },
    { key, flags, lastStudyAgo, freeze, cards: CARDS }
  );
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  const stt = { replies: [], calls: 0 };
  await page.route('**/app/api/stt', (r) => {
    stt.calls++;
    const text = stt.replies.length ? stt.replies.shift() : 'Hello.';
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(verboseFor(text)) });
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.dr-card', { timeout: 15000 });
  return { ctx, page, stt };
}

/** 참여 문항(고르기·뜻)은 정답으로 */
async function answerQuizIfAny(page) {
  const choice = page.locator('.dr-act .dr-opt', { hasText: "Yes, it's my first day." });
  if (await choice.count()) {
    await choice.first().click();
    return true;
  }
  const meaning = page.locator('.dr-act .dr-opt', { hasText: '조금만 버텨 봐요' });
  if (await meaning.count()) {
    await meaning.first().click();
    return true;
  }
  return false;
}

/** 엔딩까지 돈다 — 역할극(.rs-root)마다 모드를 모으고 onRole로 처리 */
async function drive(page, onRole, budgetMs = 240000) {
  const modes = [];
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (await page.locator('.dr-end').count()) return modes;
    const role = page.locator('.rs-root');
    if (await role.count()) {
      const mode = await role.first().getAttribute('data-mode');
      modes.push(mode);
      await onRole(page, mode);
      await page.waitForFunction(() => !document.querySelector('.rs-root') || document.querySelector('.dr-end'), null, { timeout: 30000 }).catch(() => null);
      continue;
    }
    if (await answerQuizIfAny(page)) {
      await page.waitForTimeout(150);
      continue;
    }
    if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(250);
  }
  return modes;
}

const gov = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('va_day_gov') || '{}'));

/* ══ ① 길게 누르기 → 오늘은 5분만 ══ */
{
  const { ctx, page, stt } = await open();
  check('카드에 키보드용 ⋯ 버튼(44px)', await page.evaluate(() => {
    const b = document.querySelector('.dr-card .dg-more');
    return !!b && b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().width >= 44;
  }));
  await page.dispatchEvent('.dr-card .dr-card-title', 'pointerdown');
  await page.waitForSelector('.dg-sheet', { timeout: 3000 });
  await page.dispatchEvent('.dr-card .dr-card-title', 'pointerup');
  const opts = await page.locator('.dg-sheet .dg-opt').allTextContents();
  check('길게 누르기 → 시트 [오늘은 5분만] [조용히 모드]', opts.length === 2 && opts[0].includes('오늘은 5분만') && opts[1].includes('조용히 모드'), opts.join(' | '));
  check('시트는 가로로 넘치지 않는다(390px)', await page.evaluate(() => document.documentElement.scrollWidth <= 390));
  await page.click('.dg-opt:has-text("오늘은 5분만")');
  await page.waitForSelector('.dg-sheet', { state: 'detached', timeout: 3000 });
  const g0 = await gov(page);
  check("va_day_gov 오늘 mode 'short'(사용자 선택)", g0.mode === 'short' && g0.chosen === true, JSON.stringify(g0));
  const banner = await page.locator('.dr-card .dg-banner').textContent();
  const fuel = await page.textContent('.rc-fuel');
  check("배너 '오늘은 5분만' + 목표 절반 '발화 0/5'", banner.includes('오늘은 5분만') && /발화 0\/5/.test(fuel), `${banner} / ${fuel}`);

  stt.replies.push(T[0], T[1], T[2]);
  await page.click('.dr-card .dr-go');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  await page.waitForSelector('.dg-bar', { timeout: 10000 });
  check("플레이어 상단 예산 바 '0:0x / 5:00'", /\d+:\d\d \/ 5:00/.test(await page.textContent('.dg-bar')), await page.textContent('.dg-bar'));
  const modes = await drive(page, async (page) => {
    await page.waitForSelector('.rs-result', { timeout: 40000 });
    await page.click('.rs-next');
  });
  check('역할극은 태오 대사 3줄만(4줄 중) — 넷째 줄은 보통 대사로 흐른다', modes.length === 3 && modes.every((m) => m === 'role'), JSON.stringify(modes));
  await page.waitForSelector('.dr-end', { timeout: 15000 });
  check("엔딩 첫 안내 '오늘은 5분 완료'", (await page.locator('.dg-stop[data-kind="short"]').count()) === 1);
  check("짧은 날엔 '조금 더 ▾' 없음 · 회상 카드는 기본", (await page.locator('.ee-more-btn').count()) === 0 && (await page.locator('.ee-card[data-card="recall"]').count()) === 1);
  stt.replies.push(CARDS[0].en, CARDS[1].en, CARDS[2].en);
  await page.click('.rc-card-start');
  for (let n = 0; n < 3; n++) {
    await page.waitForSelector('.rc-result', { timeout: 20000 });
    await page.click('.rc-next');
    await page.waitForTimeout(200);
  }
  await page.waitForSelector('.rc-card-sum', { timeout: 10000 });
  check('회상 3개 완료', (await page.textContent('.rc-card-sum')).includes('3개 중 3개'));
  const g1 = await gov(page);
  check('시간이 쌓였다(재생 중 + 엔딩) · 시도 3/3', g1.elapsedMs > 0 && g1.tries >= 3 && g1.adapt === false, JSON.stringify({ e: g1.elapsedMs, t: g1.tries, p: g1.passed }));
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.dr-card .rc-fuel', { timeout: 15000 });
  const fuel2 = await page.textContent('.rc-fuel');
  check("홈 '발화 6/5' — 짧은 날 목표(×0.5)로 불꽃 lit", /발화 6\/5/.test(fuel2) && (await page.getAttribute('.rc-fuel', 'data-level')) === 'lit', fuel2);
  await ctx.close();
}

/* ══ ② ⋯ 버튼(키보드) → 조용히 모드 ══ */
{
  const { ctx, page, stt } = await open();
  await page.focus('.dr-card .dg-more');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.dg-sheet', { timeout: 5000 });
  check('⋯(Enter) → 시트, 첫 버튼에 포커스', await page.evaluate(() => document.activeElement?.classList.contains('dg-opt')));
  await page.click('.dg-opt:has-text("조용히 모드")');
  await page.waitForSelector('.dg-sheet', { state: 'detached', timeout: 3000 });
  check("배너 '조용히 모드' · 점 2개(리텔·회화 숨김)", (await page.textContent('.dg-banner')).includes('조용히 모드') && (await page.textContent('.rc-dots')).length === 2, await page.textContent('.rc-dots'));
  await page.click('.dr-card .dr-go');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  let revealOk = false;
  const modes = await drive(page, async (page, mode) => {
    if (mode !== 'lip') return;
    await page.waitForSelector('.rs-lip-ok', { timeout: 20000 });
    revealOk = revealOk || (await page.locator('.rs-lip .rs-en').count()) === 1;
    await page.click('.rs-lip-ok');
    await page.waitForSelector('.rs-next', { timeout: 10000 }).catch(() => null);
    if (await page.locator('.rs-next').count()) await page.click('.rs-next');
  });
  check('역할극이 전부 입모양(lip) — 태오 대사 4줄', modes.length === 4 && modes.every((m) => m === 'lip'), JSON.stringify(modes));
  check("듣기 → 영어 공개 → '입으로만 따라했어요 ✓'", revealOk);
  check('마이크·STT 호출 0', stt.calls === 0, String(stt.calls));
  await page.waitForSelector('.dr-end', { timeout: 15000 });
  const spoken = await page.evaluate(() => JSON.parse(localStorage.getItem('va_spoken') || '{}').count);
  check('입모양 발화는 0.5 가중(4줄 → 2)', spoken === 2, String(spoken));
  // 저녁 6시 뒤에 돌리면 낮 세션을 마친 순간 '저녁 보충' 시간이 된다 — 그때는 안내 종류가 evening, 회화도 열린다
  const evening = new Date().getHours() >= 18;
  check("엔딩 '조용히 모드 완료 — 저녁 보충' 안내 · 낮 세션 완료 기록", (await page.locator(`.dg-stop[data-kind="${evening ? 'evening' : 'quiet'}"]`).count()) === 1 && (await gov(page)).quietDone === true);
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.mode-tab', { timeout: 15000 });
  await page.click('.mode-tab:has-text("회화")');
  if (evening) {
    await page.waitForSelector('.dr-screen', { timeout: 15000 });
    check('회화 탭: 저녁 보충 시간엔 조용히 안내 없음', (await page.locator('.dg-quiet-talk').count()) === 0);
  } else {
    await page.waitForSelector('.dg-quiet-talk', { timeout: 15000 });
    check("회화 탭: '조용히 모드 — 오늘 낮엔 쉬어요' 안내(시작은 보조 버튼)", (await page.textContent('.dg-quiet-talk')).includes('조용히 모드'));
  }
  await ctx.close();
}

/* ══ ③ 날짜 조작 — 5일 쉬고 돌아온 날 ══ */
{
  const { ctx, page } = await open({ lastStudyAgo: 5, freeze: 1 });
  await page.waitForSelector('.dr-card .dg-banner', { timeout: 10000 });
  check("복귀 배너 '돌아온 것만으로 충분해요'", (await page.getAttribute('.dg-banner', 'data-banner')) === 'return' && (await page.textContent('.dg-banner')).includes('돌아온 것만으로 충분해요'));
  const st = await page.evaluate(() => ({
    freeze: JSON.parse(localStorage.getItem('va_freeze') || '{}').count,
    frozen: JSON.parse(localStorage.getItem('va_frozen_days') || '[]'),
  }));
  check('프리즈 1개 자동 소비로 공백 4일을 메웠다(연속 유지)', st.freeze === 0 && st.frozen.length === 4, JSON.stringify(st));
  await page.click('.dr-card .dr-go');
  await page.waitForSelector('.dg-bar', { timeout: 15000 });
  check("복귀 첫날 예산 바 '/ 8:00'", /\/ 8:00/.test(await page.textContent('.dg-bar')));
  check("va_day_gov 오늘 mode 'return'(저절로)", (await gov(page)).mode === 'return');
  await ctx.close();
}

/* ══ ④ 플래그 off → 전부 normal ══ */
{
  const { ctx, page } = await open({ lastStudyAgo: 5, freeze: 2, flags: { dayGovernor: false } });
  check('플래그 off: 복귀 배너 없음', (await page.locator('.dg-banner').count()) === 0);
  const freeze = await page.evaluate(() => JSON.parse(localStorage.getItem('va_freeze') || '{}').count);
  check('플래그 off: 프리즈는 예전 규칙(하루 1개씩 — 2개 소비)', freeze === 0, String(freeze));
  await page.click('.dr-card .dr-go');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  await page.waitForTimeout(800);
  check('플래그 off: 예산 바 없음', (await page.locator('.dg-bar').count()) === 0);
  await ctx.close();
}

await browser.close();
finish('85-day-modes');
