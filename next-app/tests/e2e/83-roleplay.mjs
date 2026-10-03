/**
 * M2 에피소드 역할극(내가 태오) — 태오 대사 전부가 '듣고 → 영어 1.5초 → 한국어만 보고 말하기'로 바뀐다.
 *   ① 키 있음(Whisper, verbose_json 목킹): 대사 통과 → 단어 diff·칩 1개·내 소리 ▶/태오 ▶, 60점 미만이면 영어 공개 +
 *      '한 번 더' + 2차 시도 속도 권유, 결과 카드 길게 누르기 → '이 채점이 틀렸어요' → 통과(자기확인), 엔딩 직전 재소환,
 *      이해도에 역할극이 합산되고(va_attempt_log src drama / recall-inline, va_drama.speak) 넘어간 대사는 복습 카드로
 *   ② 넘어가기 화당 3회 — 4번째는 비활성, 말해야 지나간다
 *   ③ 키 없음(Web Speech도 없음 = iOS PWA 경로): 영어 2초 플래시 → 가리고 말하기 → 자기확인, '내 소리 ▶'만(칩 없음),
 *      지정 상대 대사는 섀도잉 기본 ON, 넘어가기 무제한
 *   ④ 플래그 rolePlay off → 예전 동작(태오 대사 자동 재생, 역할극 없음) — 77-drama가 깊게 본다
 *   ⑤ (리뷰 A1) 넘어가기 3회 소진 + 채점 불가(빈 전사)가 거듭 → '🔊 다시 듣기'·'스스로 확인하고 넘어가기' 출구
 *   ⑥ (리뷰 A2) 키 없음 자기확인 ✓만으로는 이해도·레벨이 오르지 않는다(퀴즈를 틀리면 이해도 0%, 발화 요약엔 '스스로 확인')
 *   ⑦ (리뷰 A3) 키 없는 섀도잉에서 아무 말도 안 하면(마이크 레벨 0) 통과가 아니다 — '소리가 안 들렸어요'
 * 마이크·STT는 20-stt/78-dtalk와 같은 스텁(MIC_STUB + **\/app/api/stt 목킹). 음소거(va_drama_mute)로 소리 대신 시간만 흐른다.
 */
import { BASE, check, finish, launch } from './helpers.mjs';

const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FA { constructor() { this.fftSize = 1024; this.t0 = Date.now(); } getFloatTimeDomainData(b) { const l = !window.__micSilent && Date.now() - this.t0 < 500; for (let i = 0; i < b.length; i++) b[i] = l ? 0.5 : 0; } }
  class FC { constructor() { this.state = 'running'; } createAnalyser() { return new FA(); } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  window.AudioContext = FC;
  class FR { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; } start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20); } stop() { setTimeout(() => this.onstop?.(), 20); } }
  window.MediaRecorder = FR;
};
/** 마이크는 열리지만 아무 소리도 없는 기기(말하지 않음) */
const MIC_SILENT = () => {
  window.__micSilent = true;
};

/** verbose_json 응답(단어 타임스탬프·세그먼트 확신도) — 채점 경로는 detail=words */
const verboseFor = (text) => {
  const toks = text.split(/\s+/).filter(Boolean);
  const words = toks.map((w, i) => ({ word: w, start: 0.3 + i * 0.32, end: 0.3 + i * 0.32 + 0.25 }));
  return { text, duration: 0.6 + toks.length * 0.32, words, segments: [{ start: 0, end: 0.6 + toks.length * 0.32, text, avg_logprob: -0.2, no_speech_prob: 0.02, compression_ratio: 1.3 }] };
};

/** EP1 역할극 순서(태오 대사): 장면 2·5·10·14 */
const T = { 2: 'Is it… broken?', 5: "Thanks. I'm really nervous.", 10: "I'm Taeo. Nice to meet you.", 14: 'Sorry! The elevator got stuck.' };

const browser = await launch();

async function open({ key = true, flags = null, webSpeech = true, silent = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  if (silent) await page.addInitScript(MIC_SILENT);
  await page.addInitScript(MIC_STUB);
  await page.addInitScript(
    ({ key, flags, webSpeech }) => {
      localStorage.setItem('va_onboarded', 'true');
      localStorage.setItem('va_drama_mute', 'true');
      localStorage.setItem('va_drama_auto', 'true');
      localStorage.setItem('va_placed', JSON.stringify({ cefr: 'A2', gse: 30, ts: Date.now() }));
      if (key) localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
      if (flags) localStorage.setItem('va_flags', JSON.stringify(flags));
      if (!webSpeech) {
        // iOS 설치형 PWA처럼 브라우저 받아쓰기가 없는 기기
        try { delete window.SpeechRecognition; } catch { /* noop */ }
        try { delete window.webkitSpeechRecognition; } catch { /* noop */ }
        Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
        Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
      }
    },
    { key, flags, webSpeech }
  );
  await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
  await page.route('**/app/api/tts*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/app/api/groq', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }));
  const stt = { replies: [], calls: 0, lastBody: '' };
  await page.route('**/app/api/stt', (r) => {
    stt.calls++;
    stt.lastBody = r.request().postData() || '';
    const text = stt.replies.length ? stt.replies.shift() : 'Hello.';
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(verboseFor(text)) });
  });
  await page.goto(`${BASE}/app`);
  await page.waitForSelector('.fg-cta', { timeout: 15000 });
  await page.click('.fg-cta');
  await page.waitForSelector('.dr-log', { timeout: 15000 });
  return { ctx, page, stt };
}

/** 참여 문항(고르기·뜻)은 정답으로 답한다 — 이해도 분모·분자가 역할극 때문에만 달라지게 */
async function answerQuizIfAny(page, wrong = false) {
  if (wrong) {
    // 정답이 아닌 보기를 고른다(이해도 0%가 되게)
    const opts = page.locator('.dr-act .dr-opt');
    const n = await opts.count();
    for (let k = 0; k < n; k++) {
      const t = (await opts.nth(k).textContent()) || '';
      if (!t.includes("Yes, it's my first day.") && !t.includes('조금만 버텨 봐요')) {
        await opts.nth(k).click();
        return true;
      }
    }
    return false;
  }
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

/**
 * 플레이어를 끝까지 돈다. 역할극(.rs-root)이 나오면 onRole(page, mode, n)을 부른다 — 그 안에서 결과까지 처리해야 한다.
 */
async function drive(page, onRole, { budgetMs = 240000, wrong = false } = {}) {
  let n = 0;
  // 예산은 반복 횟수가 아니라 시간으로 — 음소거 자동 재생은 1화 한 바퀴에 실제 시간 1분 이상이 걸려서(대사당 lineMs)
  // 예전 120회(≈30초) 상한으로는 두 번째 역할극 뒤에서 루프가 끝나 엔딩(.dr-end)·재소환에 닿지 못했다.
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (await page.locator('.dr-end').count()) return n;
    const role = page.locator('.rs-root');
    if (await role.count()) {
      const mode = await role.first().getAttribute('data-mode');
      await onRole(page, mode, n++);
      await page.waitForFunction(() => !document.querySelector('.rs-root') || document.querySelector('.dr-end'), null, { timeout: 30000 }).catch(() => null);
      continue;
    }
    if (await answerQuizIfAny(page, wrong)) {
      await page.waitForTimeout(150);
      continue;
    }
    if (await page.locator('.dr-next').count()) await page.click('.dr-next');
    await page.waitForTimeout(250);
  }
  return n;
}

/* ══ ① 키 있음 — 통과·실패·이의 제기·재소환·이해도 합산 ══ */
{
  const { ctx, page, stt } = await open();
  // 1번째(장면 2) 통과, 2번째(장면 5) 틀리게 → 이의 제기, 3번째(장면 10) 틀리게 → 그냥 다음, 4번째(장면 14) 통과, 재소환(장면 10) 통과
  stt.replies.push(T[2], 'I am very nervous today', 'Hello hello', T[14], T[10]);
  let firstCard = null;
  let disputeOk = false;
  let recallSeen = false;
  let askedBeforeFirst = 0;
  await drive(page, async (page, mode, n) => {
    if (n === 0) {
      check('첫 역할극은 태오 대사(장면 2) — 자동 흐름이 멈춘다', mode === 'role' && (await page.locator('.dr-playing, .dr-next').count()) === 0 && (await page.locator('.dr-line.me').count()) === 0);
      // 영어 플래시 → 가림(한국어만)
      await page.waitForSelector('.rs-flash.on', { timeout: 15000 });
      check('영어가 잠깐 반짝인다(1.5초)', (await page.textContent('.rs-flash')).includes('broken'));
      await page.waitForFunction(() => document.querySelector('.rs-root')?.getAttribute('data-phase') === 'rec', null, { timeout: 8000 });
      check('가린 뒤 한국어만 보고 자동 녹음', (await page.locator('.rs-flash').count()) === 0 && (await page.locator('.rs-kr.big').count()) === 1);
      await page.waitForSelector('.rs-result', { timeout: 30000 });
      firstCard = {
        ok: (await page.locator('.rs-result.ok').count()) === 1,
        words: await page.locator('.rs-w.ok').count(),
        bad: await page.locator('.rs-w.bad').count(),
        chips: await page.locator('.rs-chip').count(),
        cmp: await page.locator('.rs-result .vcmp-btn').allTextContents(),
        body: stt.lastBody,
      };
      await page.click('.rs-next');
      askedBeforeFirst = 1;
    } else if (n === 1) {
      await page.waitForSelector('.rs-result', { timeout: 40000 });
      check('60점 미만 — 영어 공개(단어 diff) + 한 번 더 + 2차 시도 속도 권유', (await page.locator('.rs-result.ok').count()) === 0 && (await page.locator('.rs-w.bad').count()) >= 1 && (await page.locator('.rs-retry').count()) === 1 && (await page.locator('.rs-slow-hint').count()) === 1);
      // 결과 카드 길게 누르기 → '이 채점이 틀렸어요'
      await page.dispatchEvent('.rs-result', 'pointerdown');
      await page.waitForSelector('.rs-dispute', { timeout: 3000 });
      await page.dispatchEvent('.rs-result', 'pointerup');
      await page.click('.rs-dispute');
      disputeOk = (await page.locator('.rs-result.ok').count()) === 1 && (await page.textContent('.rs-msg')).includes('접수') && (await page.locator('.rs-retry').count()) === 0;
      await page.click('.rs-next');
    } else if (n === 2) {
      await page.waitForSelector('.rs-result', { timeout: 40000 });
      await page.click('.rs-next'); // 틀린 채로 다음(재소환 후보)
    } else if (n === 3) {
      await page.waitForSelector('.rs-result', { timeout: 40000 });
      await page.click('.rs-next');
    } else {
      const ask = await page.textContent('.rs-ask');
      recallSeen = ask.includes('🔁') && (await page.locator('.rs-flash').count()) === 0;
      await page.waitForSelector('.rs-result', { timeout: 40000 });
      await page.click('.rs-next');
    }
  });
  check('통과 카드: 초록, 단어 전부 맞음(3), 칩 1개, 내 소리 ▶ / 태오 ▶', !!firstCard && firstCard.ok && firstCard.words === 3 && firstCard.bad === 0 && firstCard.chips === 1 && firstCard.cmp.some((t) => t.includes('내 소리')) && firstCard.cmp.some((t) => t.includes('태오')), JSON.stringify({ ...firstCard, body: undefined })); // body(멀티파트 수 KB)는 다음 check가 본다 — 진단 출력에선 뺀다
  check('채점 경로 전송: 고유명사 프롬프트만·detail=words·temperature 0', !!firstCard && /Taeo, Maya/.test(firstCard.body) && !/broken/.test(firstCard.body) && /name="detail"\r?\n\r?\nwords/.test(firstCard.body) && /name="temperature"\r?\n\r?\n0/.test(firstCard.body));
  check('길게 누르기 → 이의 제기 → 자기확인 통과(초록·한 번 더 없음)', disputeOk);
  check('엔딩 직전 재소환 — 방금 60점 미만을 한국어만 보고 다시(플래시 없음)', recallSeen);
  await page.waitForSelector('.dr-end', { timeout: 15000 });
  const endText = await page.evaluate(() => document.body.innerText);
  // 리뷰 A2: 역할극(말하기)은 이해도(듣기)와 분리 — 이해도는 고르기 1 + 뜻 1(둘 다 정답)뿐
  check('역할극은 이해도에 합산하지 않는다(고르기 1 + 뜻 1 = 100%)', /이해도 100%/.test(endText), endText.match(/이해도 \d+%/)?.[0]);
  check('엔딩에 발화 요약(재소환 포함 5 · 통과 4)', /발화 5 · 통과 4/.test(endText));
  // 변경점 점검: 엔딩 불꽃 줄은 홈과 같은 규칙 — 발화 5 < 목표(첫 14일 10)면 '켜졌어요'가 아니라 남은 문장 수
  check('엔딩 불꽃 = 홈 규칙(목표 전이면 🕯️ 남은 문장)', !endText.includes('불꽃이 켜졌어요') && /🕯️ 발화 \d+\/\d+ — \d+문장만 더/.test(endText), endText.match(/(🔥|🕯️)[^\n]*/)?.[0]);
  const st = await page.evaluate(() => ({
    log: JSON.parse(localStorage.getItem('va_attempt_log') || '[]'),
    disputes: JSON.parse(localStorage.getItem('va_dispute_log') || '[]'),
    weak: JSON.parse(localStorage.getItem('va_weak') || '[]'),
    prog: JSON.parse(localStorage.getItem('va_drama') || '{}'),
    spoken: JSON.parse(localStorage.getItem('va_spoken') || '{}'),
  }));
  const drama = st.log.filter((a) => a.src === 'drama');
  check('시도 로그: src drama 4건(patternKey drama:1:N, wpm·latency) + recall-inline 1건', drama.length === 4 && drama.every((a) => /^drama:1:\d+$/.test(a.patternKey) && typeof a.wpm === 'number') && st.log.filter((a) => a.src === 'recall-inline').length === 1, JSON.stringify(st.log.map((a) => [a.src, a.patternKey, a.score])));
  check('이의 제기는 va_dispute_log 1건 + 로그 disputed:true', st.disputes.length === 1 && drama.some((a) => a.disputed === true));
  check('60점 미만 대사는 복습 카드(드라마, 내일)', st.weak.some((w) => w.en === T[10] && w.cat === '드라마' && w.due > Date.now() + 3600000));
  check('completeEpisode에 speakStats가 저장된다(va_drama.speak)', st.prog.speak?.['1']?.spoken === 5 && st.prog.speak['1'].passed === 4);
  check('발화 수 5(bumpSpoken)', st.spoken.count === 5);
  await ctx.close();
}

/* ══ ② 넘어가기 화당 3회 — 4번째는 비활성 ══ */
{
  const { ctx, page, stt } = await open();
  stt.replies.push(T[14]);
  const labels = [];
  let fourthDisabled = false;
  await drive(page, async (page, mode, n) => {
    const skip = page.locator('.rs-skip');
    await skip.waitFor({ timeout: 15000 });
    labels.push((await skip.textContent()).trim());
    if (n < 3) {
      await skip.click();
      return;
    }
    fourthDisabled = await skip.isDisabled();
    await page.waitForSelector('.rs-result', { timeout: 40000 });
    await page.click('.rs-next');
  });
  check('넘어가기 (1/3)·(2/3)·(3/3) 표시', labels.slice(0, 3).join('|') === '넘어가기 (1/3)|넘어가기 (2/3)|넘어가기 (3/3)', labels.join('|'));
  check('4번째 대사는 넘어가기 비활성 — 말해야 지나간다', fourthDisabled);
  await page.waitForSelector('.dr-end', { timeout: 15000 });
  const st = await page.evaluate(() => ({ weak: JSON.parse(localStorage.getItem('va_weak') || '[]'), body: document.body.innerText }));
  check('넘어간 대사 3개는 복습 카드(드라마)로', [T[2], T[5], T[10]].every((en) => st.weak.some((w) => w.en === en && w.cat === '드라마')));
  check('엔딩 요약: 발화 1 · 통과 1 · 넘어감 3', /발화 1 · 통과 1 · 넘어감 3/.test(st.body));
  await ctx.close();
}

/* ══ ③ 키 없음(Web Speech도 없음) — 자기확인 + 녹음 A/B, 지정 상대 대사 섀도잉 기본 ON, 넘어가기 무제한 ══ */
{
  const { ctx, page } = await open({ key: false, webSpeech: false });
  let first = null;
  let shadowSeen = false;
  let skips = 0;
  let skipEnabled = true;
  await drive(page, async (page, mode, n) => {
    if (n === 0) {
      check('키 없음: 역할극 경로 self', (await page.getAttribute('.rs-root', 'data-path')) === 'self');
      await page.waitForSelector('.rs-flash.on', { timeout: 15000 });
      const t0 = Date.now();
      await page.waitForFunction(() => !document.querySelector('.rs-flash.on'), null, { timeout: 8000 });
      const flashMs = Date.now() - t0;
      await page.waitForSelector('.rs-self', { timeout: 30000 });
      // 녹음 Blob → 객체 URL은 이펙트에서 만들어진다 — 비교 줄이 붙을 때까지 잠깐
      await page.waitForSelector('.rs-self .vcmp-btn', { timeout: 3000 }).catch(() => null);
      first = {
        flashMs,
        selfOk: await page.locator('.rs-self-ok').count(),
        mine: (await page.locator('.rs-self .vcmp-btn').allTextContents()).some((t) => t.includes('내 소리')),
        chips: await page.locator('.rs-chip').count(),
        skipLabel: (await page.textContent('.rs-skip').catch(() => '')) || '',
      };
      await page.click('.rs-self-ok');
      return;
    }
    if (mode === 'shadow' && !shadowSeen) {
      shadowSeen = true;
      // 리뷰 A3: 키 없음은 받아쓰기가 없어 점수 대신 자기확인(소리가 있었을 때만) — 내 소리 ▶ 비교
      await page.waitForSelector('.rs-self', { timeout: 40000 });
      check('키 없는 섀도잉 — 점수 없이 자기확인(칩·점수 없음, 내 소리 ▶)', (await page.locator('.rs-chip, .rs-score').count()) === 0 && (await page.locator('.rs-self-ok').count()) === 1);
      await page.click('.rs-self-ok');
      return;
    }
    const skip = page.locator('.rs-skip');
    await skip.waitFor({ timeout: 15000 });
    if (await skip.isDisabled()) skipEnabled = false;
    await skip.click();
    skips++;
  });
  check('영어 2초 플래시(≥1.8초) → 자기확인 버튼 + 내 소리 ▶, 칩 없음', !!first && first.flashMs >= 1800 && first.selfOk === 1 && first.mine && first.chips === 0, JSON.stringify(first));
  check('지정 상대 대사(Diane)가 섀도잉으로 기본 ON', shadowSeen);
  check(`넘어가기 무제한(${skips}회 모두 가능)`, skips >= 4 && skipEnabled);
  await page.waitForSelector('.dr-end', { timeout: 15000 });
  const body3 = await page.evaluate(() => document.body.innerText);
  check('키 없이도 엔딩까지 막히지 않는다 — 자기확인은 통과가 아니라 스스로 확인으로', /발화 \d+/.test(body3) && /스스로 확인 \d+/.test(body3), body3.match(/🎙 발화[^\n]*/)?.[0]);
  await ctx.close();
}

/* ══ ④ 플래그 off — 예전 동작(태오 대사 자동 재생, 역할극 없음) ══ */
{
  const { ctx, page } = await open({ flags: { rolePlay: false } });
  await page.waitForSelector('.dr-act', { timeout: 25000 });
  check('rolePlay off: 첫 참여 문항까지 역할극 없이 흐르고 태오 대사는 말풍선으로', (await page.locator('.rs-root').count()) === 0 && (await page.locator('.dr-line.me').count()) >= 1 && (await page.locator('.dr-act .dr-opt').count()) === 3);
  await ctx.close();
}

/* ══ ⑤ 리뷰 A1 — 넘어가기 소진 + 게이트 계속 막힘 → 자기확인 출구·다시 듣기 ══ */
{
  const { ctx, page, stt } = await open();
  stt.replies.push('', '');
  let gate = null;
  await drive(page, async (page, mode, n) => {
    const skip = page.locator('.rs-skip');
    if (n < 3) {
      await skip.waitFor({ timeout: 15000 });
      await skip.click();
      return;
    }
    if (n === 3) {
      // 빈 전사 → 게이트(채점 불가) — 시도·넘어가기 수에 넣지 않는다
      await page.waitForFunction(() => document.querySelector('.rs-root')?.getAttribute('data-phase') === 'gate', null, { timeout: 40000 });
      const first = { replay: await page.locator('.rs-replay').count(), self: await page.locator('.rs-to-self').count(), skipOff: await page.locator('.rs-skip').isDisabled() };
      await page.click('.rs-mic');
      await page.waitForFunction(() => document.querySelector('.rs-root')?.getAttribute('data-phase') === 'gate' && !!document.querySelector('.rs-to-self'), null, { timeout: 40000 });
      gate = { first, replay: await page.locator('.rs-replay').count(), self: await page.locator('.rs-to-self').count(), skipText: (await page.textContent('.rs-skip')) || '' };
      await page.click('.rs-replay'); // 음소거 — 읽을 시간만 흐르고 막히지 않는다
      await page.click('.rs-to-self');
      await page.waitForSelector('.rs-self-ok', { timeout: 5000 });
      await page.click('.rs-self-ok');
      return;
    }
    await page.waitForSelector('.rs-result, .rs-self', { timeout: 40000 });
    if (await page.locator('.rs-next').count()) await page.click('.rs-next');
    else await page.click('.rs-self-ok');
  });
  check('게이트 1회: 🔊 다시 듣기는 있고 자기확인 출구는 아직 없음, 넘어가기는 다 썼다', !!gate && gate.first.replay === 1 && gate.first.self === 0 && gate.first.skipOff, JSON.stringify(gate));
  check('게이트 2회: 넘어가기 소진이어도 \'스스로 확인하고 넘어가기\' + 다시 듣기', !!gate && gate.self === 1 && gate.replay === 1 && gate.skipText.includes('다 썼어요'), JSON.stringify(gate));
  await page.waitForSelector('.dr-end', { timeout: 20000 });
  const st = await page.evaluate(() => ({ body: document.body.innerText, log: JSON.parse(localStorage.getItem('va_attempt_log') || '[]') }));
  check('자기확인으로 지나간 줄은 엔딩에 \'스스로 확인\'(통과 아님) · 시도 로그에 넣지 않음', /스스로 확인 1/.test(st.body) && !st.log.some((a) => a.src === 'drama' && a.en === T[14]), st.body.match(/🎙 발화[^\n]*/)?.[0]);
  await ctx.close();
}

/* ══ ⑥ 리뷰 A2 — 자기확인 ✓만으로는 이해도·레벨이 오르지 않는다 ══ */
{
  const { ctx, page } = await open({ key: false, webSpeech: false });
  await drive(
    page,
    async (page) => {
      await page.waitForSelector('.rs-self-ok', { timeout: 40000 });
      await page.click('.rs-self-ok');
    },
    { wrong: true }
  );
  await page.waitForSelector('.dr-end', { timeout: 20000 });
  const st = await page.evaluate(() => ({ body: document.body.innerText, prog: JSON.parse(localStorage.getItem('va_drama') || '{}'), ev: JSON.parse(localStorage.getItem('va_cefr_evidence') || '[]') }));
  check('퀴즈를 다 틀리고 대사를 전부 ✓ — 이해도 0%(자기확인이 정답으로 섞이지 않음)', /이해도 0%/.test(st.body), st.body.match(/이해도 \d+%/)?.[0]);
  check('저장된 역할극 집계: 통과 0(자기확인은 통과가 아니다)', st.prog.speak?.['1']?.passed === 0 && st.prog.speak['1'].spoken >= 4, JSON.stringify(st.prog.speak));
  check('레벨이 오르지 않았다(adj ≤ 0)', !(st.prog.adj > 0), String(st.prog.adj));
  check('듣기 CEFR 증거에 통과 점수가 없다', !st.ev.some((e) => e.skill === 'listening' && e.score >= 60), JSON.stringify(st.ev.slice(-3)));
  await ctx.close();
}

/* ══ ⑦ 리뷰 A3 — 키 없는 섀도잉 침묵은 통과가 아니다 ══ */
{
  const { ctx, page } = await open({ key: false, webSpeech: false, silent: true });
  let shadow = null;
  await drive(page, async (page, mode) => {
    if (mode === 'shadow' && !shadow) {
      await page.waitForFunction(() => document.querySelector('.rs-root')?.getAttribute('data-phase') === 'gate', null, { timeout: 40000 });
      shadow = { msg: (await page.textContent('.rs-gate')) || '', result: await page.locator('.rs-result, .rs-self').count() };
    }
    const skip = page.locator('.rs-skip');
    await skip.waitFor({ timeout: 15000 });
    await skip.click();
  });
  check('침묵(레벨 0) 섀도잉 → \'소리가 안 들렸어요\' 안내, 결과·자기확인으로 넘어가지 않음', !!shadow && shadow.msg.includes('소리가 안 들렸어요') && shadow.result === 0, JSON.stringify(shadow));
  await ctx.close();
}

await browser.close();
finish('83-roleplay');
