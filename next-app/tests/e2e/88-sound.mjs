/**
 * M7 소리 디코더 + M9 HVPT — 엔딩 '조금 더 ▾' 평일 소리 카드 1장(lib/soundCardPick) + 말풍선 '원어민 소리' 줄 + 진도 TOP3:
 *   ① 키 있음·진단 축 없음 → 디코더: ▶ 두 번 듣기 → 들린 대로 고르기(오답 → 정답) → 따라 말하기(Whisper 목킹, 축약 표기 전사)
 *      → markDecoderSeen · 시도 로그 src 'sound' 1건(≥70) · HVPT 카드 없음
 *   ② 키 없음(+Web Speech 없음) + 진단 축 시드 → HVPT 숨김 → 디코더 · '흘려 말했어요 ✓' 자기확인 → seen, 시도 로그 0(집계 제외), STT 0
 *   ③ 키 + 진단 축(r-l ×3) → HVPT: 10문항(1개 일부러 오답) → 9/10 · va_sound_track.hvpt['r-l'] 10/9 · 디코더 없음
 *      → 산출 2회(목킹 전사 = 목표 문장) → 합의 ok · src 'pron' 2건 · 문항마다 목소리가 바뀐다(TTS 요청 목소리 ≥3종)
 *      → 진도 화면 '소리 축 TOP3'에 R / L · 구분 90%
 *   ③-2 HVPT 산출 단계에 키 없음 + 마이크 → 녹음 '내 소리 ▶ / 원어민 ▶' A/B + 자기확인(점수 제외) · 기기 음성 안내
 *   ④ 설정 soundLine 켜짐 → 말풍선 아래 '🔊 원어민 소리' 회색 줄 / 기본(꺼짐)이면 없음
 *   ⑤ 플래그 decoder·hvpt off → 소리 카드 없음
 * 요일 규칙(평일만)이 있어 주말에 돌리면 페이지 시계를 직전 금요일로 옮긴다(Date 오프셋 — 타이머는 그대로).
 * '조금 더 ▾'가 보이려면 어제 학습일이 있어야 한다(복귀 첫날이 아니게, 86-retell과 같은 시드).
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FA { constructor() { this.fftSize = 1024; this.t0 = Date.now(); } getFloatTimeDomainData(b) { const l = Date.now() - this.t0 > 300 && Date.now() - this.t0 < 1500; for (let i = 0; i < b.length; i++) b[i] = l ? 0.5 : 0; } }
  class FC { constructor() { this.state = 'running'; } createAnalyser() { return new FA(); } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  window.AudioContext = FC;
  class FR { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; } start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); } stop() { setTimeout(() => this.onstop?.(), 20); } }
  window.MediaRecorder = FR;
};

const verboseFor = (text) => {
  const toks = text.split(/\s+/).filter(Boolean);
  const words = toks.map((w, i) => ({ word: w, start: 0.3 + i * 0.32, end: 0.55 + i * 0.32 }));
  const end = 0.6 + toks.length * 0.32;
  return { text, duration: end, words, segments: [{ start: 0, end, text, avg_logprob: -0.2, no_speech_prob: 0.02, compression_ratio: 1.3 }] };
};

// 주말이면 직전 금요일로(평일 규칙) — 노드 쪽 TODAY도 같은 오프셋
const DOW = new Date().getDay();
const OFFSET = DOW === 6 ? -86400000 : DOW === 0 ? -2 * 86400000 : 0;
const shifted = new Date(Date.now() + OFFSET);
const TODAY = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
if (OFFSET) console.log(`  (주말 — 페이지 시계를 ${TODAY}로 옮겨 돌린다)`);

const browser = await launch();

async function open({ key = true, webSpeech = true, flags = {}, pron = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  if (OFFSET)
    await page.addInitScript((off) => {
      const D = Date;
      class FD extends D {
        constructor(...a) {
          super(...(a.length ? a : [D.now() + off]));
        }
        static now() {
          return D.now() + off;
        }
      }
      window.Date = FD;
    }, OFFSET);
  await page.addInitScript(MIC_STUB);
  await page.addInitScript(
    ({ key, webSpeech, flags, pron, today }) => {
      if (!webSpeech) {
        Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
        Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
      }
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const k = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      localStorage.setItem('va_onboarded', 'true');
      localStorage.setItem('va_drama_mute', 'true');
      localStorage.setItem('va_drama_auto', 'true');
      localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
      // 시작일(어제) + 어제 학습 — '복귀 첫날'이면 하루 조절기가 '조금 더 ▾'를 숨긴다(86-retell 참고)
      localStorage.setItem('va_days', JSON.stringify([k(new Date(Date.now() - 86400000))]));
      // 월 1회 3/3/3 리텔이 끼어들지 않게
      localStorage.setItem('va_retell', JSON.stringify([{ date: `${today.slice(0, 7)}-01`, epNo: 0, round: '333', wpm: 50, score: 60, durationMs: 30000 }]));
      if (key) localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
      if (pron) localStorage.setItem('va_pron', JSON.stringify(pron.map((p) => ({ ...p, date: today }))));
      localStorage.setItem('va_flags', JSON.stringify({ rolePlay: false, speakRecall: false, ...flags }));
    },
    { key, webSpeech, flags, pron, today: TODAY }
  );
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  const tts = { voices: [], at: [] };
  await page.route('**/app/api/tts*', (r) => {
    tts.at.push(Date.now());
    try {
      tts.voices.push(JSON.parse(r.request().postData() || '{}').voice);
    } catch {
      /* 무시 */
    }
    return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
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
  return { ctx, page, stt, tts };
}

async function toEnding(page, budgetMs = 180000, until = '.dr-end') {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (await page.locator(until).count()) return true;
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

/** '조금 더 ▾'를 펼친다(있으면) */
async function openMore(page) {
  const btn = page.locator('.ee-more-btn');
  if (!(await btn.count())) return false;
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
  return true;
}

const readStore = (page) =>
  page.evaluate(() => {
    const j = (k, d) => JSON.parse(localStorage.getItem(k) || d);
    const log = j('va_attempt_log', '[]');
    return {
      track: j('va_sound_track', '{}'),
      sound: log.filter((a) => a.src === 'sound'),
      pron: log.filter((a) => a.src === 'pron'),
    };
  });

const DEC = '.ee-card[data-card="sound-decoder"]';
const HV = '.ee-card[data-card="sound-hvpt"]';

/* ══ ① 키 있음 · 진단 축 없음 → 디코더 ══ */
{
  const { ctx, page, stt } = await open();
  check('① EP1 끝까지', await toEnding(page));
  check('① 조금 더 ▾ 있음', await openMore(page));
  check('① 소리 카드 = 디코더(HVPT 없음)', (await page.locator(DEC).count()) === 1 && (await page.locator(HV).count()) === 0);
  const card = page.locator(`${DEC} .sd-card`);
  const id = await card.getAttribute('data-id');
  const say = await card.getAttribute('data-say');
  check('① 오늘의 소리 제목 · 한글 근사', /오늘의 소리/.test(await page.textContent(`${DEC} .sd-title`)) && /처럼 들려요/.test(await page.textContent(`${DEC} .sd-meta`)), id);
  check('① 듣기 전엔 고르기 없음', (await page.locator(`${DEC} .sd-quiz`).count()) === 0);
  await page.click(`${DEC} .sd-both`);
  await page.waitForSelector(`${DEC} .sd-quiz`, { timeout: 5000 });
  const played = await page.getAttribute(`${DEC} .sd-quiz`, 'data-played');
  const other = played === 'natural' ? 'careful' : 'natural';
  check('① 2지선다(원형 vs 원어민 소리)', (await page.locator(`${DEC} .sd-opt`).count()) === 2);
  await page.click(`${DEC} .sd-opt[data-v="${other}"]`);
  check('① 오답 → 다시 듣기 안내, 아직 말하기 없음', /다시 한 번/.test(await page.textContent(`${DEC} .sd-fb`)) && (await page.locator(`${DEC} .sd-rec`).count()) === 0);
  await page.click(`${DEC} .sd-opt[data-v="${played}"]`);
  check('① 정답 → ✓', (await page.locator(`${DEC} .sd-fb.ok`).count()) === 1);
  await page.waitForSelector(`${DEC} .sd-rec`, { timeout: 5000 });
  stt.replies.push(say);
  await page.click(`${DEC} .sd-rec`);
  await page.waitForSelector(`${DEC} .sd-card[data-phase="done"]`, { timeout: 20000 });
  check('① 통과 문구', /✓/.test(await page.textContent(`${DEC} .sd-pass`)));
  const st = await readStore(page);
  check('① markDecoderSeen', Array.isArray(st.track.decoderSeen) && st.track.decoderSeen.includes(id), JSON.stringify(st.track));
  check("① 시도 로그 src 'sound' 1건(≥70, patternKey=항목)", st.sound.length === 1 && st.sound[0].score >= 70 && st.sound[0].patternKey === id, JSON.stringify(st.sound));
  check('① STT 1회', stt.calls === 1, String(stt.calls));
  await ctx.close();
}

/* ══ ② 키 없음 + 진단 축 → HVPT 숨김 → 디코더 자기확인 ══ */
{
  const { ctx, page, stt } = await open({ key: false, webSpeech: false, pron: [{ key: 'r-l', count: 3 }] });
  check('② EP1 끝까지', await toEnding(page));
  await openMore(page);
  check('② 키 없음 → HVPT 숨김, 디코더', (await page.locator(HV).count()) === 0 && (await page.locator(DEC).count()) === 1);
  const id = await page.getAttribute(`${DEC} .sd-card`, 'data-id');
  await page.click(`${DEC} .sd-both`);
  const played = await page.getAttribute(`${DEC} .sd-quiz`, 'data-played');
  await page.click(`${DEC} .sd-opt[data-v="${played}"]`);
  await page.waitForSelector(`${DEC} .sd-self`, { timeout: 5000 });
  check('② 녹음 버튼 대신 자기확인', (await page.locator(`${DEC} .sd-rec`).count()) === 0);
  await page.click(`${DEC} .sd-self`);
  await page.waitForSelector(`${DEC} .sd-card[data-phase="done"]`, { timeout: 5000 });
  const st = await readStore(page);
  check('② seen 기록', (st.track.decoderSeen || []).includes(id));
  check('② 자기확인은 시도 로그에 안 남김(집계 제외) · STT 0', st.sound.length === 0 && stt.calls === 0);
  await ctx.close();
}

/* ══ ③ 키 + 진단 축 → HVPT 10문항 → 산출 2회 → 진도 TOP3 ══ */
{
  const { ctx, page, stt, tts } = await open({ pron: [{ key: 'r-l', count: 3 }] });
  check('③ EP1 끝까지', await toEnding(page));
  await openMore(page);
  check('③ 소리 카드 = HVPT(디코더 없음)', (await page.locator(HV).count()) === 1 && (await page.locator(DEC).count()) === 0);
  check('③ 축 = 진단 상위 r-l', (await page.getAttribute(`${HV} .hv-card`, 'data-axis')) === 'r-l');
  check('③ 제목에 R / L', /R \/ L/.test(await page.textContent(`${HV} .hv-title`)));
  tts.voices.length = 0;
  tts.at.length = 0;
  await page.click(`${HV} .hv-start`);
  let asked = 0;
  for (let k = 0; k < 10; k++) {
    await page.waitForSelector(`${HV} .hv-q[data-k="${k}"]`, { timeout: 5000 });
    const ans = await page.getAttribute(`${HV} .hv-q`, 'data-ans');
    const side = k === 3 ? (ans === 'a' ? 'b' : 'a') : ans; // 4번째는 일부러 틀린다
    await page.click(`${HV} .hv-opt[data-side="${side}"]`);
    await page.waitForSelector(`${HV} .hv-fb`, { timeout: 3000 });
    if (k === 3) check('③ 오답 즉시 표시', (await page.locator(`${HV} .hv-bad`).count()) === 1);
    asked++;
    await page.click(`${HV} .hv-next`);
  }
  await page.waitForSelector(`${HV} .hv-result`, { timeout: 5000 });
  check('③ 10문항 · 9/10 통과', asked === 10 && /9\/10/.test(await page.textContent(`${HV} .hv-score`)) && /통과/.test(await page.textContent(`${HV} .hv-score`)));
  // 합성은 6초 간격으로 차례로 나간다(리뷰 B3 — Orpheus 10회/분) — 세 목소리가 나올 때까지 기다린다
  const vDeadline = Date.now() + 25000;
  while (new Set(tts.voices.filter(Boolean)).size < 3 && Date.now() < vDeadline) await page.waitForTimeout(500);
  const v = new Set(tts.voices.filter(Boolean));
  check('③ 문항마다 목소리를 바꾼다(요청 목소리 ≥3종)', v.size >= 3, [...v].join(','));
  const gaps = tts.at.slice(1).map((t, i) => t - tts.at[i]);
  check('③ 합성 요청 사이 ≥ 6초(분당 10회 한도 안)', tts.at.length >= 3 && gaps.every((g) => g >= 5800), gaps.join(','));
  let st = await readStore(page);
  const h = st.track.hvpt?.['r-l'];
  check("③ 정답률 기록 va_sound_track.hvpt['r-l'] 10/9", h && h.tries === 10 && h.correct === 9, JSON.stringify(h));
  await page.click(`${HV} .hv-to-say`);
  const sayEn = (await page.textContent(`${HV} .hv-say-en`)).replace('🔊', '').trim();
  for (let t = 0; t < 2; t++) {
    await page.waitForSelector(`${HV} .hv-rec`, { timeout: 5000 });
    stt.replies.push(sayEn);
    await page.click(`${HV} .hv-rec`);
    await page.waitForSelector(t === 0 ? `${HV} .hv-card[data-phase="say"]` : `${HV} .hv-done`, { timeout: 20000 });
  }
  check('③ 2회 합의 ok', (await page.getAttribute(`${HV} .hv-done`, 'data-verdict')) === 'ok', await page.textContent(`${HV} .hv-done`));
  st = await readStore(page);
  check("③ 시도 로그 src 'pron' 2건(patternKey r-l)", st.pron.length === 2 && st.pron.every((a) => a.patternKey === 'r-l' && a.score >= 70), JSON.stringify(st.pron));
  // 진도 화면 '소리 축 TOP3'
  await page.evaluate(() => {
    window.history.pushState({ ...(window.history.state || {}), mode: 'progress' }, '');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
  const top = await page.waitForSelector('.hv-axis', { timeout: 20000 }).then(() => page.textContent('.hv-axis')).catch(() => '');
  check('③ 진도 소리 축 TOP3: R / L · 구분 90% · 이번 주', /R \/ L/.test(top) && /구분 90%/.test(top) && /이번 주/.test(top), top);
  await ctx.close();
}

/* ══ ③-2 HVPT 키 없음 + 마이크 있음 → 녹음 A/B 자기확인(리뷰 B4) ══
 * 카드는 키가 있을 때만 뜬다 — 산출 단계 직전에 키를 지운다(키를 지운 기기 = 받아쓰기 불가 + 마이크 있음).
 * 기기 음성 안내(B3)도 여기서 본다 — TTS가 404라 기기 음성으로 내려간다. */
{
  const { ctx, page, stt } = await open({ pron: [{ key: 'r-l', count: 3 }] });
  check('③-2 EP1 끝까지', await toEnding(page));
  await openMore(page);
  check('③-2 HVPT 카드', (await page.locator(HV).count()) === 1);
  await page.click(`${HV} .hv-start`);
  for (let k = 0; k < 10; k++) {
    await page.waitForSelector(`${HV} .hv-q[data-k="${k}"]`, { timeout: 5000 });
    const ans = await page.getAttribute(`${HV} .hv-q`, 'data-ans');
    await page.click(`${HV} .hv-opt[data-side="${ans}"]`);
    await page.waitForSelector(`${HV} .hv-fb`, { timeout: 3000 });
    if (k === 0) {
      const deg = await page.waitForSelector(`${HV} .hv-degraded`, { timeout: 10000 }).then(() => true).catch(() => false);
      check('③-2 기기 음성이면 "신경망 음성에서 효과가 커요" 안내', deg && /신경망 음성/.test(await page.textContent(`${HV} .hv-degraded`)));
    }
    await page.click(`${HV} .hv-next`);
  }
  await page.waitForSelector(`${HV} .hv-to-say`, { timeout: 5000 });
  await page.evaluate(() => localStorage.removeItem('va_groq_key'));
  await page.click(`${HV} .hv-to-say`);
  await page.waitForSelector(`${HV} .hv-say[data-path="ab"]`, { timeout: 5000 });
  check('③-2 키 없음 + 마이크 → 녹음 A/B 경로(받아쓰기 버튼 없음)', (await page.locator(`${HV} .hv-ab-rec`).count()) === 1 && !/마이크가 있는 기기/.test(await page.textContent(HV)));
  await page.click(`${HV} .hv-ab-rec`);
  await page.waitForSelector(`${HV} .hv-ab-mine`, { timeout: 15000 });
  check("③-2 '내 소리 ▶ / 원어민 ▶' A/B", (await page.locator(`${HV} .hv-ab-native`).count()) === 1);
  const spoken0 = await page.evaluate(() => JSON.parse(localStorage.getItem('va_spoken') || '{}').count || 0);
  await page.click(`${HV} .hv-self`);
  await page.waitForSelector(`${HV} .hv-done[data-verdict="self"]`, { timeout: 5000 });
  const st = await readStore(page);
  check("③-2 자기확인은 점수·시도 로그에 넣지 않는다 · STT 0", st.pron.length === 0 && stt.calls === 0, JSON.stringify(st.pron));
  check('③-2 발화는 센다(va_spoken +1)', (await page.evaluate(() => JSON.parse(localStorage.getItem('va_spoken') || '{}').count || 0)) === spoken0 + 1);
  await ctx.close();
}

/* ══ ④ 설정 soundLine → 말풍선 '원어민 소리' 줄 ══ */
{
  const off = await open();
  // 같은 지점(Welcome to Nimbus. 이후)까지 가서 본다
  await toEnding(off.page, 60000, '.dr-bub:has-text("Nimbus")');
  check('④ 기본(꺼짐): 원어민 소리 줄 없음', (await off.page.locator('.dr-bub:has-text("Nimbus")').count()) > 0 && (await off.page.locator('.bb-sound').count()) === 0);
  await off.ctx.close();
  const { ctx, page } = await open({ flags: { soundLine: true } });
  // 첫 고르기를 지나면 'Welcome to Nimbus.'(약형 to → ta)가 나온다
  await toEnding(page, 60000, '.bb-sound');
  const line = (await page.locator('.bb-sound').first().textContent().catch(() => '')) || '';
  check("④ 켜짐: 말풍선 아래 '🔊 원어민 소리' 줄", /원어민 소리/.test(line) && /\bta\b|gonna|wanna|'n|ya\b/.test(line), line);
  await ctx.close();
}

/* ══ ⑤ 플래그 off → 소리 카드 없음 ══ */
{
  const { ctx, page } = await open({ flags: { decoder: false, hvpt: false } });
  check('⑤ EP1 끝까지', await toEnding(page));
  await openMore(page);
  check('⑤ decoder·hvpt off → 소리 카드 없음', (await page.locator(DEC).count()) === 0 && (await page.locator(HV).count()) === 0);
  await ctx.close();
}

await browser.close();
finish('88-sound');
