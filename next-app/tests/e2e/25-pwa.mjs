/**
 * PWA 오프라인 — 서비스워커가 실제로 등록·활성화되고, 끊긴 상태에서 앱이 뜨는지.
 *
 * 배경: sw.js는 생성·서빙되는데 **아무도 등록하지 않아** 오프라인과 복습 알림이
 * 통째로 죽어 있었다(next-pwa 5.6의 자동 등록은 Pages Router 전제). 등록을 붙인 뒤에도
 * 세 가지가 연달아 막았다:
 *   ① 프리캐시 목록의 404 두 건(app-build-manifest.json, basePath 빠진 /offline)
 *      → 워크박스는 항목 하나만 실패해도 설치 전체를 실패시킨다
 *   ② 스크립트가 /app/sw.js라 최대 스코프가 /app/ 인데 접속 주소는 /app(끝 슬래시 없음)
 *      → 페이지가 스코프 밖이라 영원히 제어되지 않는다
 *   ③ runtimeCaching을 직접 지정해 기본 문서 캐싱 규칙이 사라져 오프라인에서 앱 대신
 *      폴백 페이지만 떴다
 * 셋 다 조용히 실패하는 종류라 테스트로 고정한다.
 */
import { BASE, check, finish, launch } from './helpers.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* ── 프리캐시 목록에 죽은 링크가 없어야 한다(설치 실패의 원인) ── */
const sw = readFileSync(path.join(root, 'public/sw.js'), 'utf8');
const urls = [...sw.matchAll(/\{url:"([^"]+)"/g)].map((m) => m[1]);
check('프리캐시 목록이 비어 있지 않음', urls.length > 5, String(urls.length));
const dead = [];
for (const u of urls) {
  const r = await fetch(`${BASE}${u}`).catch(() => null);
  if (!r || !r.ok) dead.push(`${u}(${r ? r.status : 'ERR'})`);
}
check('프리캐시 항목이 모두 200', dead.length === 0, dead.slice(0, 3).join(', '));

/* ── 스코프 확장 헤더 ── */
const swRes = await fetch(`${BASE}/app/sw.js`);
check('sw.js 서빙', swRes.ok);
check('Service-Worker-Allowed 헤더로 스코프 확장', swRes.headers.get('service-worker-allowed') === '/', String(swRes.headers.get('service-worker-allowed')));

/* ── 실제 등록·활성화·오프라인 동작 ── */
const browser = await launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.addInitScript(() => localStorage.setItem('va_onboarded', 'true'));
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

// waitForFunction은 async 콜백이 돌려주는 Promise를 truthy로 보고 즉시 통과한다 —
// 서비스워커처럼 비동기 상태는 직접 폴링해야 한다.
let active = false;
for (let i = 0; i < 40 && !active; i++) {
  active = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active);
  if (!active) await page.waitForTimeout(500);
}
check('서비스워커 등록·활성화', active);

// 활성화된 뒤 한 번 더 방문해야 SW가 문서를 캐시한다(첫 방문은 SW 제어 밖)
await page.reload();
await page.waitForSelector('.mission-card', { timeout: 15000 });
check('SW가 페이지를 제어함', await page.evaluate(() => !!navigator.serviceWorker.controller));

await ctx.setOffline(true);
await page.reload();
await page.waitForTimeout(1200);
const offline = await page.evaluate(() => ({
  app: !!document.querySelector('.app-shell'),
  mission: !!document.querySelector('.mission-card'),
  title: document.querySelector('.app-header h1')?.textContent || '',
}));
check('오프라인에서도 앱이 뜬다', offline.app, JSON.stringify(offline));
check('오프라인에서 학습 화면 유지', offline.mission && offline.title === '홈', JSON.stringify(offline));

await ctx.setOffline(false);
await browser.close();
finish('25-pwa');
