/**
 * 2분 피치 훈련 — 이 앱에 없던 '긴 발화' 층.
 *
 * 배경: 훈련이 전부 문장 단위(드릴)나 한 턴(회화)이었다. 영업에서 실제로 무너지는
 * 지점은 "솔루션을 2분만 설명해 주세요"인데, 그걸 연습할 곳이 없었다. 계약:
 *   ① 주제를 고르면 30초 준비 뒤 말하기로 넘어간다
 *   ② 녹음이 짧은 발화 기준(30초 상한·1.2초 무음 자동종료)에 걸리지 않는다 —
 *      걸리면 2분 발화의 뒷부분이 통째로 잘려 나가는데 잘린 줄도 모른다
 *   ③ 시간·속도·채움말·멈춤을 기기에서 계산한다(AI 키 없이도 지표는 나온다)
 *   ④ 구조 네 칸 충족 여부와 코칭이 나온다
 *   ⑤ 기록이 남아 다음번에 '지난번 대비'를 볼 수 있다
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

/** 오래 말하는 마이크 스텁 — 사용자가 멈출 때까지 계속 소리가 난다. */
const LONG_MIC_STUB = () => {
  window.__recStopped = false;
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  class FakeAnalyser {
    constructor() { this.fftSize = 1024; }
    getFloatTimeDomainData(buf) {
      // 계속 '말하는 중' — 자동 종료가 켜져 있으면 상한까지 녹음된다
      for (let i = 0; i < buf.length; i++) buf[i] = 0.5;
    }
  }
  class FakeCtx {
    constructor() { this.state = 'running'; }
    createAnalyser() { return new FakeAnalyser(); }
    createMediaStreamSource() { return { connect() {} }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  window.AudioContext = FakeCtx;
  class FakeRecorder {
    constructor() { this.mimeType = 'audio/webm'; }
    static isTypeSupported() { return true; }
    start() {
      setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(8192)], { type: 'audio/webm' }) }), 20);
    }
    stop() {
      window.__recStopped = true;
      setTimeout(() => this.onstop?.(), 20);
    }
  }
  window.MediaRecorder = FakeRecorder;
};

// 2분짜리 발화를 흉내 낸 전사 — 채움말과 구조가 섞여 있다
const SPOKEN = [
  'Um, thanks for making the time today.',
  'Right now your team is running everything on-premises, and, you know, the scaling problem shows up every quarter end.',
  'What we do is move the database layer to managed services first, so you keep the application untouched.',
  'A manufacturing customer we worked with cut their quarter-end incidents from eleven to two, and, um, saved about thirty percent on infrastructure.',
  'So what I would suggest is a two-week proof of concept starting next month.',
].join(' ');

const COACH = {
  structure: [
    { key: 's0', label: '고객이 지금 겪는 문제', ok: true, note: '분기말 확장 문제를 짚었습니다.' },
    { key: 's1', label: '우리가 그 문제를 푸는 방식', ok: true, note: '관리형 서비스 전환을 설명했습니다.' },
    { key: 's2', label: '비슷한 고객에서의 결과', ok: true, note: '숫자를 들어 설득했습니다.' },
    { key: 's3', label: '오늘 제안하는 다음 단계', ok: false, note: 'PoC를 언급했지만 날짜를 못 박지 않았습니다.' },
  ],
  strengths: ['"cut their quarter-end incidents from eleven to two"처럼 숫자로 말한 점이 좋습니다.', '문제 → 해법 순서가 분명했습니다.'],
  fixes: ['다음 단계는 날짜와 담당자를 함께 제시하세요.', '채움말 대신 한 박자 쉬는 연습을 하세요.'],
  betterOpening: 'Let me show you how we cut your quarter-end incidents in half within two weeks.',
};

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await page.route('**/app/api/groq', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(COACH) } }] }) })
);
await page.route('**/app/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: SPOKEN }) }));
await seedKey(page);
await page.addInitScript(LONG_MIC_STUB);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-grid .feat-card:has-text("2분 피치")', { timeout: 8000 });
await page.click('.feat-grid .feat-card:has-text("2분 피치")');
await page.waitForSelector('.pt-topic', { timeout: 8000 });

const topics = await page.evaluate(() => document.querySelectorAll('.pt-topic').length);
check('주제 카드가 여러 개', topics >= 5, String(topics));

/* ── ① 주제 → 30초 준비 ── */
await page.click('.pt-topic:has-text("우리 솔루션")');
await page.waitForSelector('.pt-countdown', { timeout: 8000 });
const prep = await page.evaluate(() => ({
  count: document.querySelector('.pt-countdown')?.textContent?.trim() || '',
  outline: document.querySelectorAll('.pt-outline li').length,
}));
check('준비 카운트다운이 뜬다', /^\d+/.test(prep.count), prep.count);
check('구성 뼈대를 보여준다', prep.outline >= 3, String(prep.outline));

/* ── ② 긴 발화: 짧은 발화 기준에 걸리지 않아야 한다 ── */
await page.click('button:has-text("준비됐어요")');
await page.waitForSelector('.pt-timer', { timeout: 8000 });

// 소리가 계속 나는 상태로 5초를 기다린다. 자동 종료(1.2초 무음)나 30초 상한이
// 그대로 걸려 있으면 여기서 이미 결과 화면으로 넘어가 버린다.
await page.waitForTimeout(5000);
const stillSpeaking = await page.evaluate(() => ({
  timer: !!document.querySelector('.pt-timer'),
  stopped: window.__recStopped,
  shown: document.querySelector('.pt-timer')?.textContent?.trim() || '',
}));
check('말하는 동안 자동으로 끊기지 않음', stillSpeaking.timer && !stillSpeaking.stopped, JSON.stringify(stillSpeaking));
check('경과 시간이 흐른다', /0[0-9]:0[3-9]|0[0-9]:1[0-9]/.test(stillSpeaking.shown), stillSpeaking.shown);
check('말하는 동안 자막 칸이 살아 있음', (await page.locator('.transcript.live').count()) === 1);

/* ── ③④ 끝내면 지표와 코칭 ── */
await page.click('button:has-text("말하기 끝내기")');
await page.waitForSelector('.pt-metrics', { timeout: 20000 });
const metrics = await page.evaluate(() =>
  [...document.querySelectorAll('.pt-metric')].map((e) => ({
    v: e.querySelector('b')?.textContent?.trim() || '',
    l: e.querySelector('span')?.textContent?.trim() || '',
  }))
);
check('지표 네 개가 나온다', metrics.length === 4, JSON.stringify(metrics));
check('말한 시간이 기록됨', /^\d+:\d\d$/.test(metrics[0].v), metrics[0].v);
check('분당 단어가 계산됨', Number(metrics[1].v) > 0, metrics[1].v);
check('채움말을 세었다', Number(metrics[2].v) >= 2, metrics[2].v);

await page.waitForSelector('.pt-struct', { timeout: 15000 });
const coach = await page.evaluate(() => ({
  structs: document.querySelectorAll('.pt-struct').length,
  ok: document.querySelectorAll('.pt-struct.ok').length,
  body: document.body.innerText,
}));
check('구조 네 칸을 판정', coach.structs === 4, String(coach.structs));
check('채운 칸과 못 채운 칸을 구분', coach.ok === 3, String(coach.ok));
check('잘한 것과 고칠 것이 함께 나옴', coach.body.includes('잘한 것') && coach.body.includes('다음에 고칠 것'));
check('더 나은 오프닝을 제안', coach.body.includes('cut your quarter-end incidents'));
check('내가 말한 내용을 돌려준다', (await page.evaluate(() => document.querySelector('.pt-transcript')?.textContent || '')).includes('proof of concept'));

/* ── ⑤ 기록이 남는다 ── */
const runs = await page.evaluate(() => JSON.parse(localStorage.getItem('va_pitches') || '[]'));
check('연습 기록이 저장됨', runs.length === 1 && runs[0].topicKey === 'solution', JSON.stringify(runs.map((r) => r.topicKey)));
check('구조 충족 수가 기록됨', runs[0].covered === 3 && runs[0].total === 4, `${runs[0]?.covered}/${runs[0]?.total}`);

await page.click('button:has-text("다른 주제 고르기")');
await page.waitForSelector('.pt-topic', { timeout: 8000 });
await page.click('.pt-topic:has-text("우리 솔루션")');
await page.waitForSelector('.pt-prev', { timeout: 8000 });
check('지난번 결과를 보여준다', (await page.evaluate(() => document.querySelector('.pt-prev')?.textContent || '')).includes('3/4'));

await browser.close();
finish('31-pitch');
