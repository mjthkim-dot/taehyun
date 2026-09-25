/**
 * Dark Studio 테마 계약 — 기본은 다크, 토글은 저장되며,
 * 민트 면 위 글자의 대비(WCAG AA 4.5:1)가 실제로 확보된다.
 * 배경: 액센트를 주황(흰 글자)에서 민트로 바꾸면 흰 글자는 읽을 수 없게 된다.
 * --on-primary 토큰이 테마별로 뒤집히는지 계산으로 검증한다.
 */
import { BASE, check, finish, launch } from './helpers.mjs';

/** 두 CSS 색의 WCAG 대비비를 페이지 안에서 계산한다. */
const CONTRAST = () => {
  const toRgb = (css) => {
    const probe = document.createElement('div');
    probe.style.color = css;
    document.body.appendChild(probe);
    const v = getComputedStyle(probe).color;
    probe.remove();
    return v;
  };
  const lum = (c) => {
    const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => {
      const s = Number(v) / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (x, y) => {
    const a = lum(toRgb(x));
    const b = lum(toRgb(y));
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  };
  const tok = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return {
    // CTA 채움면 위의 글자(그라디언트라 대표 단색 토큰으로 검증)
    cta: ratio(getComputedStyle(document.querySelector('.start-drill-btn')).color, tok('--primary-surface')),
    // 배경 위 액센트 텍스트(강조 라벨·칩 글자)
    accentText: ratio(tok('--primary'), tok('--bg')),
    ctaColor: getComputedStyle(document.querySelector('.start-drill-btn')).color,
    primary: tok('--primary'),
  };
};

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.goto(`${BASE}/app`);
await page.waitForSelector('.start-drill-btn', { timeout: 15000 });

check('저장값이 없으면 기본 테마는 다크', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark');
check('상태바 색이 다크 캔버스와 일치', (await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content'))) === '#0a0c0e');

const dark = await page.evaluate(CONTRAST);
check('다크: 민트 CTA 글자 대비 4.5:1 이상', dark.cta >= 4.5, `${dark.ctaColor} on 민트면 = ${dark.cta}:1`);
check('다크: 액센트 텍스트 대비 4.5:1 이상', dark.accentText >= 4.5, `${dark.primary} on 캔버스 = ${dark.accentText}:1`);

// 토글 → 라이트로 전환되고 저장된다
await page.click('.theme-toggle');
await page.waitForTimeout(250);
check('토글 후 라이트로 전환', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light');
check('선택이 저장됨', (await page.evaluate(() => localStorage.getItem('theme'))) === 'light');
const light = await page.evaluate(CONTRAST);
check('라이트: CTA 글자 대비 4.5:1 이상', light.cta >= 4.5, `${light.ctaColor} on CTA면 = ${light.cta}:1`);
check('라이트: 액센트 텍스트 대비 4.5:1 이상', light.accentText >= 4.5, `${light.primary} on 캔버스 = ${light.accentText}:1`);

await page.reload();
await page.waitForSelector('.start-drill-btn', { timeout: 15000 });
check('새로고침 후에도 선택 유지', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light');

await browser.close();
finish('13-theme');
