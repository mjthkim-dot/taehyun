/**
 * M3 말로 떠올리기 + 홈 '발화 n/goal' + 불꽃 연료 교체:
 *   ① 키 있음(Whisper verbose_json 목킹): 홈 '표현 복습' → 회상 3개가 한국어만 보고 곧바로 자동 녹음(카운트다운 없음)
 *      - 1번 한 번에 통과(초록 diff) · 2번 두 번 틀림 → 그때만 보기 3개(힌트) → 틀린 보기 → again → 곧바로 '따라 말해요' 1회
 *      - 3번 한 번 틀림 → 정답 없이 한 번 더 → 통과
 *      → 시도 로그 src 'recall'(latencyMs = 개시 지연) · va_recall_speak {asked 3, passed 1} · 발화 +6 →
 *        홈 '🔥 발화 10/10'(점 4개) · 불꽃 lit
 *   ② 키 없음 + Web Speech 없음(iOS PWA): 회상은 고르기 + 녹음 A/B('내 소리 ▶ / 인물 ▶'), STT 호출 0, 자기확인 발화 1.0
 *   ③ 플래그 speakRecall off → 예전 3지선다(RecallStep 없음)
 * 마이크·STT 스텁은 83-roleplay와 같은 패턴. 음소거(va_drama_mute)로 정답 재생은 시간만 흐른다.
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

/** 기한 순서가 정해진 드라마 카드 3장(box 2 → speak 모드) */
const CARDS = [
  { en: 'See you tomorrow morning.', kr: '내일 아침에 봐요.' },
  { en: 'I am on my way now.', kr: '지금 가는 중이에요.' },
  { en: 'That makes a lot of sense.', kr: '정말 말이 되네요.' },
];

const browser = await launch();

async function open({ key = true, webSpeech = true, flags = null, spoken = 0, cards = CARDS } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.addInitScript(MIC_STUB);
  await page.addInitScript(
    ({ key, webSpeech, flags, spoken, cards }) => {
      if (sessionStorage.getItem('seeded')) return; // 새로고침·이동 때 다시 덮어쓰지 않는다
      sessionStorage.setItem('seeded', '1');
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const y = new Date(Date.now() - 86400000);
      const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      localStorage.setItem('va_onboarded', 'true');
      localStorage.setItem('va_mode', JSON.stringify('focus'));
      localStorage.setItem('va_drama_mute', 'true');
      localStorage.setItem('va_drama_auto', 'true');
      localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
      localStorage.setItem('va_drama', JSON.stringify({ done: { 1: '2026-09-20', 2: '2026-09-21' }, score: { 1: 80, 2: 70 } }));
      localStorage.setItem('va_days', JSON.stringify([yesterday]));
      localStorage.setItem('va_weak', JSON.stringify(cards.map((c, k) => ({ ...c, cat: '드라마', lesson: 'drama:2', box: 2, lapses: 0, due: 1000 + k }))));
      if (spoken) localStorage.setItem('va_spoken', JSON.stringify({ date: today, count: spoken }));
      if (key) localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
      if (flags) localStorage.setItem('va_flags', JSON.stringify(flags));
      if (!webSpeech) {
        Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
        Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
      }
    },
    { key, webSpeech, flags, spoken, cards }
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

/** 홈 카드의 '표현 복습' 링크(또는 주 버튼)로 복습 세션을 연다 */
async function openReview(page) {
  const link = page.locator('.dr-card button', { hasText: '복습' });
  await link.first().click();
  await page.waitForSelector('.dr-log', { timeout: 15000 });
}

/** n번째 회상이 열릴 때까지(해설 자동 진행) */
async function waitRecall(page, n) {
  await page.waitForFunction((n) => document.querySelectorAll('.dr-note').length >= n && !!document.querySelector('.rc-root'), n, { timeout: 20000 });
}

/* ══ ① 키 있음 ══ */
{
  const { ctx, page, stt } = await open({ spoken: 4 });
  const line0 = await page.textContent('.rc-fuel');
  check("홈 카드 불꽃 옆 '발화 4/10' + 점 4개", /발화 4\/10/.test(line0) && /[●○]{4}/.test(line0), line0);
  check('반불꽃 안내 — n문장만 더 말하면 켜져요', /6문장만 더 말하면 켜져요/.test(line0), line0);
  stt.replies.push(CARDS[0].en, 'I go', 'I want go', CARDS[1].en, 'That is sense', CARDS[2].en);
  await openReview(page);

  // 1번 — 한국어만 보고 곧바로 녹음, 한 번에 통과
  await waitRecall(page, 0);
  const ask1 = await page.textContent('.rc-ask');
  check('회상은 한국어 한 줄 + 영어는 안 보인다', ask1.includes(CARDS[0].kr) && !(await page.locator('.rc-root').textContent()).includes(CARDS[0].en), ask1);
  check('카운트다운 없이 곧바로 녹음(speak 모드)', (await page.getAttribute('.rc-root', 'data-mode')) === 'speak' && ['rec', 'wait'].includes(await page.getAttribute('.rc-root', 'data-phase')));
  await page.waitForSelector('.rc-result', { timeout: 20000 });
  check('통과 — 초록 단어 diff·인물 목소리 다시 듣기·내 소리 비교', (await page.locator('.rc-result.ok').count()) === 1 && (await page.locator('.rc-result .rs-w.ok').count()) >= 3 && (await page.locator('.rc-replay').count()) === 1 && (await page.locator('.rc-result .vcmp-btn').count()) >= 1);
  check('통과면 따라 말하기 없음', (await page.locator('.rc-follow').count()) === 0);
  await page.click('.rc-next');

  // 2번 — 두 번 틀림 → 힌트 보기 3개 → 틀린 보기 → again → 따라 말하기
  await waitRecall(page, 1);
  await page.waitForSelector('.rc-root[data-phase="again"]', { timeout: 20000 });
  check('첫 실패 — 정답·보기 없이 한 번 더', (await page.locator('.rc-opt').count()) === 0 && !(await page.locator('.rc-root').textContent()).includes(CARDS[1].en));
  await page.waitForSelector('.rc-root[data-phase="hint"]', { timeout: 20000 });
  const hints = await page.locator('.rc-opt').allTextContents();
  check('두 번째 실패 뒤에만 보기 3개(힌트)', hints.length === 3 && hints.includes(CARDS[1].en), hints.join(' | '));
  await page.locator('.rc-opt').filter({ hasNotText: CARDS[1].en }).first().click();
  await page.waitForSelector('.rc-follow', { timeout: 10000 });
  // 틀린 단어엔 스크린리더용 '(틀림)'이 붙는다(리뷰 A13) — 보이는 문장은 정답 그대로
  check('again — 정답 공개 + 곧바로 따라 말해요(틀린 단어는 sr-only (틀림))', (await page.textContent('.rc-result')).replace(/\(틀림\)/g, '').includes(CARDS[1].en) && (await page.locator('.rc-result .rs-w.bad .sr-only').count()) >= 1 && (await page.textContent('.rc-follow-ask')).includes('따라 말해요'));
  await page.waitForSelector('.rc-follow-res', { timeout: 20000 });
  check('따라 말하기 결과 한 줄', (await page.textContent('.rc-follow-res')).includes('점'));
  await page.click('.rc-next');

  // 3번 — 한 번 틀리고 한 번 더 떠올려 통과
  await waitRecall(page, 2);
  await page.waitForSelector('.rc-root[data-phase="again"]', { timeout: 20000 });
  await page.waitForSelector('.rc-result.ok', { timeout: 20000 });
  check('두 번째 시도 통과 — 힌트 없이', (await page.locator('.rc-opt').count()) === 0);
  await page.click('.rc-next');

  await page.waitForSelector('.dr-end', { timeout: 20000 });
  check('복습 결과 — 3개 중 2개 기억', (await page.textContent('.dr-end-title')).includes('3개 중 2개'));
  const st = await page.evaluate(() => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const log = JSON.parse(localStorage.getItem('va_attempt_log') || '[]');
    return {
      recall: log.filter((a) => a.src === 'recall' && a.quality === 'ok'),
      follow: log.filter((a) => a.src === 'recall-follow').length,
      rs: JSON.parse(localStorage.getItem('va_recall_speak') || '{}')[today],
      spoken: JSON.parse(localStorage.getItem('va_spoken') || '{}').count,
      goal: JSON.parse(localStorage.getItem('va_speak_goal') || '{}'),
      weak: JSON.parse(localStorage.getItem('va_weak') || '[]').map((w) => w.box),
    };
  });
  check("시도 로그 src 'recall' 5건(개시 지연 latencyMs 포함) + 따라 말하기 1건", st.recall.length === 5 && st.recall.every((a) => typeof a.latencyMs === 'number') && st.follow === 1, JSON.stringify(st.recall.map((a) => a.latencyMs)));
  check('va_recall_speak — asked 3 · passed 1(1차 통과만) · 지연 중앙값', st.rs && st.rs.asked === 3 && st.rs.passed === 1 && typeof st.rs.latencyMed === 'number', JSON.stringify(st.rs));
  check('발화 4 + 6 = 10 · 채점 발화로 집계', st.spoken === 10 && st.goal.scoredToday === 6 && st.goal.goal === 10, JSON.stringify(st.goal));
  check('간격 반복 — 통과 3상자 · 힌트 오답 0상자 · 두 번째 통과 3상자', JSON.stringify(st.weak) === JSON.stringify([3, 0, 3]), JSON.stringify(st.weak));
  await page.click('.dr-end .dr-go:has-text("홈으로")');
  await page.waitForSelector('.dr-card', { timeout: 15000 });
  const line1 = await page.textContent('.rc-fuel');
  check("홈 '발화 10/10' 갱신 · 불꽃 줄 lit", /발화 10\/10/.test(line1) && (await page.getAttribute('.rc-fuel', 'data-level')) === 'lit', line1);
  check("점 4개 중 '회상' 켜짐", (await page.getAttribute('.rc-dots', 'aria-label')).includes('회상 ✓'));
  await page.waitForSelector('.streak-hero', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('.streak-hero')?.getAttribute('data-level'), null, { timeout: 10000 });
  check('불꽃(StreakFlame) lit — 연료는 발화', (await page.getAttribute('.streak-hero', 'data-level')) === 'lit' && (await page.textContent('.streak-fuel-label')).includes('발화 10/10'));
  await ctx.close();
}

/* ══ ② 키 없음 + Web Speech 없음(iOS PWA) — 고르기 + 녹음 A/B ══ */
{
  const { ctx, page, stt } = await open({ key: false, webSpeech: false, cards: [CARDS[0]] });
  await openReview(page);
  await waitRecall(page, 0);
  check('키 없음: 회상은 고르기(보기 3개)', (await page.getAttribute('.rc-root', 'data-mode')) === 'choice' && (await page.locator('.rc-opt').count()) === 3);
  await page.locator('.rc-opt', { hasText: CARDS[0].en }).click();
  await page.waitForSelector('.rc-ab-rec', { timeout: 10000 });
  check('정답 뒤 녹음 A/B 버튼', (await page.textContent('.rc-ab-rec')).includes('소리 내어 말해 보기'));
  await page.click('.rc-ab-rec');
  await page.waitForSelector('.rc-ab .vcmp-btn', { timeout: 15000 });
  const cmp = await page.locator('.rc-ab .vcmp-btn').allTextContents();
  check("'내 소리 ▶ / 인물 ▶' 번갈아 듣기", cmp.some((t) => t.includes('내 소리')) && cmp.some((t) => t.includes('▶') && !t.includes('내 소리')), cmp.join(' | '));
  check('STT 호출 0 · 자기확인 발화 1.0(키 없는 구간)', stt.calls === 0 && (await page.evaluate(() => JSON.parse(localStorage.getItem('va_spoken') || '{}').count)) === 1);
  check('va_speak_goal selfToday 1 · keyless', await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('va_speak_goal') || '{}');
    return g.selfToday === 1 && g.keyless === true;
  }));
  await ctx.close();
}

/* ══ ③ 플래그 off → 예전 3지선다 ══ */
{
  const { ctx, page } = await open({ flags: { speakRecall: false }, cards: [CARDS[0]] });
  await openReview(page);
  await page.waitForSelector('.dr-act .dr-opt', { timeout: 20000 });
  check('speakRecall off — RecallStep 없이 예전 보기 3개', (await page.locator('.rc-root').count()) === 0 && (await page.locator('.dr-act .dr-opt').count()) === 3);
  await ctx.close();
}

await browser.close();
finish('84-recall-speak');
