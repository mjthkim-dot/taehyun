/**
 * 접근성 가드 — 손가락과 눈으로 실제 쓸 수 있는지 자동 검사.
 *
 * 배경: 자동 감사에서 아이콘 버튼들이 19~31px로 나왔다(iOS 권장 44px).
 * 보이는 크기는 그대로 두고 누를 수 있는 영역만 넓혔는데, 이 기준이 다시
 * 무너지지 않도록 고정한다. 대비 검사는 **반투명 배경을 합성**해서 계산한다 —
 * 합성을 빠뜨리면 어두운 배경 위 밝은 글자를 오탐한다.
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

const AUDIT = () => {
  const parse = (c) => {
    const m = (c || '').match(/[\d.]+/g);
    if (!m) return { r: 0, g: 0, b: 0, a: 0 };
    return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 };
  };
  /** 위쪽(부모) 배경부터 아래로 알파 합성해 실제 보이는 배경색을 구한다.
   *  그라디언트(background-image)는 backgroundColor가 투명이라 잡히지 않으므로,
   *  첫 색 정지점을 대표색으로 삼는다 — 안 그러면 민트 CTA 위 잉크 글자를 오탐한다. */
  const resolveBg = (el) => {
    const stack = [];
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      const img = cs.backgroundImage || '';
      const grad = img.includes('gradient') ? (img.match(/rgba?\([^)]+\)/) || [])[0] : null;
      stack.push(grad ? parse(grad) : parse(cs.backgroundColor));
      n = n.parentElement;
    }
    let out = { r: 10, g: 12, b: 14 }; // 캔버스 기본값
    for (let i = stack.length - 1; i >= 0; i--) {
      const c = stack[i];
      if (!c.a) continue;
      out = { r: c.r * c.a + out.r * (1 - c.a), g: c.g * c.a + out.g * (1 - c.a), b: c.b * c.a + out.b * (1 - c.a) };
    }
    return out;
  };
  const lum = ({ r, g, b }) =>
    [r, g, b]
      .map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      })
      .reduce((acc, v, i) => acc + [0.2126, 0.7152, 0.0722][i] * v, 0);

  const small = [];
  const unnamed = [];
  const lowContrast = [];

  document.querySelectorAll('button, a[href], input').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.height < 36) small.push(`${(el.className || el.tagName).toString().split(' ')[0]}(${Math.round(r.height)}px)`);
    if (el.tagName === 'BUTTON') {
      const name = (el.textContent || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || '';
      if (!name) unnamed.push((el.className || '').toString().split(' ')[0] || 'button');
    }
  });

  const seen = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    if (el.children.length || !(el.textContent || '').trim()) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') return;
    // 비활성 컨트롤의 흐림은 '지금 누를 수 없다'는 의도된 표현이라 대비 기준에서 제외한다
    if (el.closest('button:disabled, input:disabled, [aria-disabled="true"]')) return;
    const size = parseFloat(cs.fontSize);
    const fg = parse(cs.color);
    // 글자에 opacity가 걸려 있으면 그만큼 배경과 섞인다
    const bg = resolveBg(el);
    const alpha = fg.a * parseFloat(cs.opacity || '1');
    const blended = { r: fg.r * alpha + bg.r * (1 - alpha), g: fg.g * alpha + bg.g * (1 - alpha), b: fg.b * alpha + bg.b * (1 - alpha) };
    const a = lum(blended);
    const b = lum(bg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < need) {
      const key = `${cs.color}|${Math.round(size)}`;
      if (!seen.has(key)) {
        seen.add(key);
        lowContrast.push(`${ratio.toFixed(2)}:1 ${Math.round(size)}px "${(el.textContent || '').trim().slice(0, 16)}"`);
      }
    }
  });

  return { small: [...new Set(small)], unnamed: [...new Set(unnamed)], lowContrast };
};

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });

const screens = [
  ['홈', null],
  ['회화', '회화'],
  ['레슨', '레슨'],
  ['드릴', '드릴'],
];
for (const [name, tab] of screens) {
  if (tab) {
    await page.click(`.mode-tab:has-text("${tab}")`);
    await page.waitForTimeout(500);
  }
  const { small, unnamed, lowContrast } = await page.evaluate(AUDIT);
  check(`${name}: 터치 타깃 36px 이상`, small.length === 0, small.slice(0, 4).join(', '));
  check(`${name}: 모든 버튼에 접근 가능한 이름`, unnamed.length === 0, unnamed.slice(0, 4).join(', '));
  check(`${name}: 텍스트 대비 WCAG AA`, lowContrast.length === 0, lowContrast.slice(0, 3).join(' | '));
}

// 키보드 포커스가 보이는지 — 마우스 없이도 조작 가능해야 한다
await page.click('.mode-tab:has-text("홈")');
await page.waitForTimeout(300);
await page.keyboard.press('Tab');
const focusRing = await page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  return { tag: el.tagName, outline: cs.outlineWidth, shadow: cs.boxShadow !== 'none' };
});
check('Tab 이동 시 포커스 표시', !!focusRing && (parseFloat(focusRing.outline) > 0 || focusRing.shadow), JSON.stringify(focusRing));

await browser.close();
finish('24-a11y');
