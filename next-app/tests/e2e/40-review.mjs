/**
 * 복습 엔진(Phase 1) — "배운 것이 되돌아오는" 계약:
 *   ① 데이터 보존: 구버전 키(va_weak·va_maturity_patterns)는 업데이트 후에도
 *      한 항목도 변하지 않는다. 패턴 SRS는 멱등 시드로 추가만 된다.
 *   ② 패턴 리콜: due가 된 패턴이 세션 워밍업에 실전 리콜로 등장하고,
 *      채점 결과에 따라 SRS 박스가 움직인다.
 *   ③ 시도 로그: 말하기 채점마다 va_attempt_log에 문장·점수·출처가 남고,
 *      상한(1000)을 넘으면 오래된 것부터 절삭된다.
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const MIC_STUB = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FakeAnalyser {
    constructor() { this.fftSize = 1024; this.t0 = Date.now(); }
    getFloatTimeDomainData(buf) {
      const loud = Date.now() - this.t0 < 500;
      for (let i = 0; i < buf.length; i++) buf[i] = loud ? 0.5 : 0;
    }
  }
  class FakeCtx {
    constructor() { this.state = 'running'; }
    createAnalyser() { return new FakeAnalyser(); }
    createMediaStreamSource() { return { connect() {} }; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  window.AudioContext = FakeCtx;
  class FakeRecorder {
    constructor() { this.mimeType = 'audio/webm'; }
    static isTypeSupported() { return true; }
    start() {
      setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) }), 20);
    }
    stop() { setTimeout(() => this.onstop?.(), 20); }
  }
  window.MediaRecorder = FakeRecorder;
};

// id-like의 원어민 리콜 문장 — patternStories와 일치해야 한다
const RECALL_EN = "I'd like to schedule a quick call this week.";
const LEGACY_WEAK = [
  { en: 'Could you send the file?', kr: '파일을 보내주시겠어요?', box: 2, lapses: 1, due: Date.now() + 86400000, cat: 'speaking' },
];

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' }));
await page.route('**/app/api/groq', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) })
);
let sttReply = RECALL_EN;
await page.route('**/app/api/stt', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: sttReply }) })
);
await seedKey(page);
await page.addInitScript(MIC_STUB);
// 구버전 사용자 상태: 문장 SRS 1건(아직 due 아님) + 정착 패턴 2개(패턴 SRS 키는 없음).
// id-like는 due를 과거로 강제해 리콜 등장을 검증하고, could-you는 시드만 확인한다.
await page.addInitScript((weak) => {
  localStorage.setItem('va_weak', JSON.stringify(weak));
  localStorage.setItem('va_maturity_patterns', JSON.stringify(['id-like', 'could-you']));
  localStorage.setItem('va_pattern_srs', JSON.stringify([{ key: 'id-like', box: 1, due: Date.now() - 1000 }]));
}, LEGACY_WEAK);

await page.goto(`${BASE}/app`);
await page.waitForSelector('.session-cta', { timeout: 15000 });
await page.click('.session-cta');
await page.waitForSelector('.ss-phases', { timeout: 10000 });

/* ── ① 데이터 보존 + 멱등 시드 ── */
const stores = await page.evaluate(() => ({
  weak: JSON.parse(localStorage.getItem('va_weak') || '[]'),
  patterns: JSON.parse(localStorage.getItem('va_maturity_patterns') || '[]'),
  psrs: JSON.parse(localStorage.getItem('va_pattern_srs') || '[]'),
}));
check('기존 문장 SRS가 그대로 보존된다', JSON.stringify(stores.weak) === JSON.stringify(LEGACY_WEAK), JSON.stringify(stores.weak));
check('기존 정착 패턴 목록이 그대로 보존된다', JSON.stringify(stores.patterns) === JSON.stringify(['id-like', 'could-you']));
check('시드가 없는 정착 패턴만 SRS에 추가된다(멱등)', stores.psrs.length === 2 && stores.psrs.find((p) => p.key === 'could-you')?.box === 1, JSON.stringify(stores.psrs));
check('기존 SRS 항목은 시드가 덮어쓰지 않는다', stores.psrs.find((p) => p.key === 'id-like')?.due < Date.now(), '');

/* ── ② due 패턴이 세션 워밍업에 리콜로 등장 ── */
// 문장 SRS는 due가 아니므로 첫 스텝이 리콜이어야 한다
await page.waitForFunction(() => document.body.textContent.includes('리콜'), null, { timeout: 8000 });
const recallView = await page.evaluate(() => document.body.innerText);
check('리콜은 지난 패턴을 상황만 보고 떠올리게 한다', recallView.includes('지난 패턴') && !recallView.includes(RECALL_EN), '');

// 정확히 말하면 80점↑ → 박스 상승
await page.click('.ss-screen .mic');
await page.waitForSelector('.speaking-practice .score', { timeout: 20000 });
await page.click('.ss-nav .start-drill-btn');
await page.waitForTimeout(400);
const graded = await page.evaluate(() => JSON.parse(localStorage.getItem('va_pattern_srs') || '[]').find((p) => p.key === 'id-like'));
check('리콜 통과로 패턴 SRS 박스가 오른다', graded.box === 2 && graded.due > Date.now(), JSON.stringify(graded));

/* ── ③ 시도 로그 ── */
const log = await page.evaluate(() => JSON.parse(localStorage.getItem('va_attempt_log') || '[]'));
check('시도 로그가 문장·점수·출처와 함께 남는다', log.length === 1 && log[0].en === RECALL_EN && log[0].score >= 80 && log[0].src === 'recall', JSON.stringify(log));
check('리콜 로그에 패턴 키가 붙는다', log[0].patternKey === 'id-like');
check('녹음 길이가 기록된다', typeof log[0].durationMs === 'number');

// 상한: 1000건을 시드하고 한 번 더 말하면 1000건 유지 + 최신이 마지막
const capped = await page.evaluate(() => {
  const big = Array.from({ length: 1000 }, (_, i) => ({ t: i, en: `old ${i}`, score: 50 }));
  localStorage.setItem('va_attempt_log', JSON.stringify(big));
  return true;
});
check('상한 시드 준비', capped);
// 다음 스텝(스토리)으로 이동한 뒤 말하기 단계에서 한 번 더 발화
await page.waitForSelector('.ss-story', { timeout: 8000 });
await page.click('.ss-nav .start-drill-btn');
await page.waitForSelector('.speaking-practice', { timeout: 8000 });
sttReply = 'I want to schedule a call.';
await page.click('.ss-screen .mic');
await page.waitForSelector('.speaking-practice .score', { timeout: 20000 });
const after = await page.evaluate(() => {
  const log2 = JSON.parse(localStorage.getItem('va_attempt_log') || '[]');
  return { len: log2.length, last: log2[log2.length - 1], first: log2[0] };
});
check('로그 상한(1000)이 지켜진다', after.len === 1000, String(after.len));
// 로그의 en은 발화가 아니라 목표 문장(오늘의 패턴 기본 문장)이다 — 오늘의 패턴은
// 날짜 로테이션이라 특정 문장을 고정하지 않고, "시드가 아닌 실제 목표 문장"만 확인한다.
check('넘치면 오래된 것부터 절삭된다', after.first.en === 'old 1' && !!after.last.en && !String(after.last.en).startsWith('old '), `${after.first.en} … ${after.last.en}`);

await browser.close();
finish();
