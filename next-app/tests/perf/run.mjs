/**
 * 성능 측정 — 폰에서 실제로 느껴지는 값을 잰다.
 *
 * 데스크톱 헤드리스에서 재면 뭐든 빠르게 나와 의미가 없다. 이 앱은 출퇴근길에
 * 폰으로 여는 앱이라 CPU 4배 스로틀(중급 안드로이드 근사)과 390×844 뷰포트를 건다.
 *
 * 네트워크 에뮬레이션(CDP Network.emulateNetworkConditions)은 **일부러 쓰지 않는다.**
 * 이 환경에서 켜 보니 리소스가 전부 854ms에 도착했는데도 첫 카드가 5.3초 뒤에 떴다.
 * 단일 파일 전송은 164ms로 정상이었고, 서비스워커를 꺼도 API 스텁을 빼도 똑같았다 —
 * 즉 대역폭이 아니라 CDP Network 도메인 계측 자체가 스로틀된 메인 스레드에서 ~4초를
 * 더하고 있었다. 그런 숫자를 두고 최적화하면 없는 문제를 쫓게 된다.
 *
 * 대신 네트워크 쪽은 **첫 방문에 실제로 내려받는 바이트**로 잰다. 이건 기기·회선과
 * 무관하게 정확하고, 줄이면 반드시 빨라지는 값이다.
 *
 * 그리고 **두 가지 상태**를 모두 잰다. 새 사용자(빈 저장소)만 재면 데이터가 쌓인 뒤
 * 느려지는 것을 놓친다 — 이 앱은 표현·오답·대화 로그가 계속 쌓이는 구조라 그쪽이
 * 오히려 실사용에 가깝다.
 *
 * 통과/실패를 가르는 가드가 아니라 **숫자를 보여주는 진단**이다. 다만 눈에 띄게
 * 나쁜 값에는 경고를 붙여, 다음에 무엇을 손봐야 할지 바로 알 수 있게 한다.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;

/* ── 서버 ── */
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/app`);
      if (r.ok) return;
    } catch {
      /* 아직 안 뜸 */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('서버가 뜨지 않았습니다');
}

const rows = [];
function row(label, value, unit, warn) {
  rows.push({ label, value, unit, warn: warn ?? null });
}

/* ── 번들 크기: 첫 방문에 내려받는 양 ── */
function bundleReport() {
  const dir = path.join(ROOT, '.next/static/chunks');
  let total = 0;
  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (f.endsWith('.js')) {
        total += st.size;
        files.push({ f, kb: st.size / 1024 });
      }
    }
  };
  walk(dir);
  files.sort((a, b) => b.kb - a.kb);
  return { totalKb: total / 1024, top: files.slice(0, 5) };
}

/** 저장소에 실사용 수준의 데이터를 채운다(1년쯤 쓴 사용자 근사). */
const SEED_HEAVY = () => {
  const day = (i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const phrases = Array.from({ length: 500 }, (_, i) => ({
    en: `This is saved expression number ${i} that I want to remember for customer meetings.`,
    kr: `고객 미팅에서 쓰려고 저장해 둔 ${i}번째 표현입니다.`,
    lesson: i % 50,
  }));
  const weak = Array.from({ length: 200 }, (_, i) => ({
    en: `I keep getting this sentence wrong number ${i}.`,
    kr: `자꾸 틀리는 ${i}번째 문장입니다.`,
    lesson: i % 50,
    cat: '드릴',
    box: i % 6,
    lapses: i % 5,
    due: Date.now() - 86400000,
  }));
  const log = {};
  for (let i = 0; i < 60; i++) log[day(i)] = (i * 7) % 25;
  const days = Array.from({ length: 60 }, (_, i) => day(i));
  const counts = {};
  for (const d of days) counts[d] = 3;
  const chatLogs = Array.from({ length: 30 }, (_, i) => ({
    id: `c${i}`,
    date: new Date().toISOString(),
    lessonId: i % 50,
    lessonTitle: `레슨 ${i}`,
    transcript: Array.from({ length: 20 }, (_, j) => ({
      role: j % 2 ? 'assistant' : 'user',
      content: `This is turn ${j} of a fairly long practice conversation about cloud migration and pricing.`,
    })),
  }));
  const sessions = Array.from({ length: 40 }, () => ({
    date: new Date().toISOString(),
    cefr: 'B1',
    caf: { complexity: 6, accuracy: 6, fluency: 6 },
  }));
  const pron = Array.from({ length: 60 }, (_, i) => ({ key: ['r-l', 'th', 'f-p', 'v-b'][i % 4], date: day(i % 30), count: (i % 4) + 1 }));
  localStorage.setItem('va_phrases', JSON.stringify(phrases));
  localStorage.setItem('va_weak', JSON.stringify(weak));
  localStorage.setItem('va_spoken_log', JSON.stringify(log));
  localStorage.setItem('va_days', JSON.stringify(days));
  localStorage.setItem('va_daycount', JSON.stringify(counts));
  localStorage.setItem('va_chat_logs', JSON.stringify(chatLogs));
  localStorage.setItem('va_sessions', JSON.stringify(sessions));
  localStorage.setItem('va_pron', JSON.stringify(pron));
  localStorage.setItem('va_onboarded', 'true');
  localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
};

/** 페이지 로드 지표 — 사용자가 '떴다'고 느끼는 시점들. */
async function loadMetrics(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const paints = {};
    for (const p of performance.getEntriesByType('paint')) paints[p.name] = p.startTime;
    const lcp = window.__lcp || 0;
    const longTasks = window.__longTasks || [];
    return {
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      loadEvent: Math.round(nav.loadEventEnd || 0),
      fcp: Math.round(paints['first-contentful-paint'] || 0),
      lcp: Math.round(lcp),
      longTaskCount: longTasks.length,
      longTaskTotal: Math.round(longTasks.reduce((a, b) => a + b, 0)),
      heapMb: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    };
  });
}

const OBSERVE = () => {
  window.__lcp = 0;
  window.__longTasks = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    /* 미지원 */
  }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* 미지원 */
  }
};

async function newMobilePage(browser, { seed } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  // 중급 안드로이드 근사 — 데스크톱 그대로 재면 무엇이 느린지 드러나지 않는다
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(OBSERVE);
  await page.addInitScript(() => localStorage.setItem('va_onboarded', 'true'));
  if (seed) await page.addInitScript(seed);
  await page.route('**/app/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  return { ctx, page };
}

/* ── 실행 ── */
await waitReady();
// 이 환경에는 번들된 헤드리스 셸이 없다 — e2e 헬퍼와 같은 폴백을 쓴다
const LAUNCH = { args: ['--no-sandbox', '--js-flags=--expose-gc'] };
const browser = await chromium
  .launch(LAUNCH)
  .catch(() => chromium.launch({ ...LAUNCH, executablePath: '/opt/pw-browsers/chromium' }));

console.log('\n성능 측정 — 모바일 390×844 · CPU 4배 스로틀\n');

/* 1) 첫 방문(빈 저장소) */
{
  const { ctx, page } = await newMobilePage(browser);
  const t0 = Date.now();
  await page.goto(`${BASE}/app`, { waitUntil: 'load' });
  await page.waitForSelector('.mission-card', { timeout: 30000 });
  const interactive = Date.now() - t0;
  const m = await loadMetrics(page);
  row('첫 방문 · 첫 화면 표시(FCP)', m.fcp, 'ms', m.fcp > 2500 ? '느림' : null);
  row('첫 방문 · 주요 콘텐츠(LCP)', m.lcp, 'ms', m.lcp > 4000 ? '느림' : null);
  row('첫 방문 · 홈 카드까지', interactive, 'ms', interactive > 5000 ? '느림' : null);
  row('첫 방문 · 메인 스레드 블로킹', m.longTaskTotal, `ms(${m.longTaskCount}건)`, m.longTaskTotal > 2000 ? '무거움' : null);
  row('첫 방문 · JS 힙', m.heapMb, 'MB', null);
  // 회선과 무관하게 정확한 네트워크 지표 — 줄이면 반드시 빨라진다
  const transfer = await page.evaluate(() => {
    const r = performance.getEntriesByType('resource');
    const kb = (t) => Math.round(r.filter((x) => x.name.endsWith(t)).reduce((a, x) => a + (x.transferSize || 0), 0) / 1024);
    return { js: kb('.js'), css: kb('.css'), files: r.filter((x) => x.name.endsWith('.js')).length };
  });
  row('첫 방문 · 내려받은 JS', transfer.js, `KB(${transfer.files}개)`, transfer.js > 250 ? '큼' : null);
  row('첫 방문 · 내려받은 CSS', transfer.css, 'KB', null);
  await ctx.close();
}

/* 2) 데이터가 쌓인 사용자 */
let heavyPage = null;
let heavyCtx = null;
{
  const { ctx, page } = await newMobilePage(browser, { seed: SEED_HEAVY });
  const t0 = Date.now();
  await page.goto(`${BASE}/app`, { waitUntil: 'load' });
  await page.waitForSelector('.mission-card', { timeout: 30000 });
  const interactive = Date.now() - t0;
  const m = await loadMetrics(page);
  const bytes = await page.evaluate(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      n += (k + (localStorage.getItem(k) || '')).length;
    }
    return n;
  });
  row('데이터 쌓인 뒤 · 저장소 크기', Math.round(bytes / 1024), 'KB', bytes / 1024 > 4000 ? '한도 근접' : null);
  row('데이터 쌓인 뒤 · 첫 화면 표시(FCP)', m.fcp, 'ms', m.fcp > 2500 ? '느림' : null);
  row('데이터 쌓인 뒤 · 홈 카드까지', interactive, 'ms', interactive > 5000 ? '느림' : null);
  row('데이터 쌓인 뒤 · 메인 스레드 블로킹', m.longTaskTotal, `ms(${m.longTaskCount}건)`, m.longTaskTotal > 2000 ? '무거움' : null);
  row('데이터 쌓인 뒤 · JS 힙', m.heapMb, 'MB', null);
  heavyPage = page;
  heavyCtx = ctx;
}

/* 3) 화면 전환 반응 속도 — 매일 수십 번 하는 동작 */
{
  const page = heavyPage;
  const tabs = [
    ['레슨', '.study-screen, .curriculum'],
    ['드릴', '.speaking-practice, .mic'],
    ['회화', '.talk-screen, .mini-btn'],
    ['홈', '.mission-card'],
  ];
  for (const [name, sel] of tabs) {
    const t0 = Date.now();
    await page.click(`.mode-tab:has-text("${name}")`);
    await page.waitForSelector(sel, { timeout: 20000 });
    const ms = Date.now() - t0;
    row(`탭 전환 · ${name}`, ms, 'ms', ms > 600 ? '체감 지연' : null);
  }
}

/* 4) 반복 전환 후 메모리 — 화면을 오가며 누수가 쌓이는지 */
{
  const page = heavyPage;
  const before = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0));
  for (let i = 0; i < 12; i++) {
    await page.click('.mode-tab:has-text("레슨")');
    await page.waitForTimeout(120);
    await page.click('.mode-tab:has-text("홈")');
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.gc?.());
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0));
  const growth = +(after - before).toFixed(1);
  row('12회 왕복 후 힙 증가', growth, 'MB', growth > 15 ? '누수 의심' : null);
}

/* 5) 무거운 화면 진입 — 데이터가 많을 때 가장 오래 걸리는 곳들 */
{
  const page = heavyPage;
  const screens = [
    // '.wr'(주간 리포트 전체 커밋)이 아니라 화면이 보이는 시점 — 복습(.study-card)과
    // 같은 정의다. 리포트는 한 프레임 뒤에 채워진다(ProgressScreen 주석 참고).
    ['진도 · 리포트', '.more-sheet .feat-card:has-text("진도")', '.stat-grid'],
    ['복습', '.more-sheet .feat-card:has-text("복습")', '.study-card'],
  ];
  for (const [name, cardSel, waitSel] of screens) {
    await page.click('.mode-tab:has-text("더보기")');
    await page.waitForSelector('.more-sheet .feat-card', { timeout: 10000 });
    const t0 = Date.now();
    await page.click(cardSel);
    await page.waitForSelector(waitSel, { timeout: 20000 });
    const ms = Date.now() - t0;
    row(`화면 진입 · ${name}`, ms, 'ms', ms > 1000 ? '체감 지연' : null);
  }
}

await heavyCtx.close();
await browser.close();
server.kill();

/* ── 서비스워커가 첫 방문에 미리 받는 양 ── */
try {
  const sw = readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  const n = [...sw.matchAll(/\{url:"([^"]+)"/g)].length;
  row('서비스워커 프리캐시 항목', n, '개', n > 30 ? '많음' : null);
} catch {
  /* 빌드 전이면 없음 */
}

/* ── 번들 ── */
const b = bundleReport();
row('내려받는 JS 총량(.next/static)', Math.round(b.totalKb), 'KB', b.totalKb > 1500 ? '큼' : null);

/* ── 출력 ── */
const pad = (s, n) => String(s).padEnd(n, ' ');
console.log(pad('항목', 34) + pad('값', 16) + '비고');
console.log('─'.repeat(64));
for (const r of rows) {
  console.log(pad(r.label, 34) + pad(`${r.value ?? '—'} ${r.unit}`, 16) + (r.warn ? `⚠ ${r.warn}` : ''));
}
console.log('\n가장 큰 청크 5개');
for (const f of b.top) console.log(`  ${Math.round(f.kb)} KB  ${f.f}`);

const warns = rows.filter((r) => r.warn);
console.log(`\n${warns.length ? `주의 ${warns.length}건` : '눈에 띄는 문제 없음'}`);
