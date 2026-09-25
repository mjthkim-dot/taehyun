/**
 * 서버 키가 있는 배포에서 기기에 남은 만료 키가 오경보를 만들지 않는다 —
 * 클라이언트는 기기 키를 우선하지만 서버 라우트는 서버 키를 우선하므로,
 * '거부된 기기 키 + 살아있는 서버 키'는 실패가 아니라 정리 대상이다.
 */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

function wavBuf() {
  const sr = 16000, samples = 1600;
  const data = Buffer.alloc(samples * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + samples * 2, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(samples * 2, 40);
  return Buffer.concat([h, data]);
}

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

// 기기 키는 Groq에서 거부(만료 시나리오), 서버에는 키가 살아있는 상태
await page.route('**/app/api/groq/validate', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: false, status: 401 }) })
);
await page.route('**/app/api/groq', (route) => {
  if (route.request().method() === 'GET') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasServerKey: true }) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
});
let ttsPostSentKey = null;
await page.route('**/app/api/tts', (route) => {
  if (route.request().method() === 'GET') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, bytes: 20480, model: 'canopylabs/orpheus-v1-english' }) });
  }
  ttsPostSentKey = JSON.parse(route.request().postData() || '{}').key ?? null;
  return route.fulfill({ status: 200, contentType: 'audio/wav', body: wavBuf() });
});
await seedKey(page); // 만료된 기기 키가 남아있는 상태를 재현

await page.goto(`${BASE}/app`);
await page.waitForTimeout(1000);
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-card', { timeout: 8000 });
await page.click('.feat-card:has-text("음성 진단")');
await page.waitForSelector('.study-card h3', { timeout: 8000 });
await page.click('.btn.primary');
await page.waitForFunction(() => document.querySelectorAll('.ac-row').length >= 7, { timeout: 30000 });

const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.ac-row')).map((r) => ({
    name: r.querySelector('.ac-name')?.textContent,
    ok: r.classList.contains('ok'),
    detail: r.querySelector('.ac-detail')?.textContent || '',
  }))
);
const keyRow = rows.find((r) => r.name === 'Groq 키');
check('서버 키가 있으면 거부된 기기 키는 실패로 표시하지 않음', keyRow?.ok === true, keyRow?.detail);
check('정리 사실을 안내', keyRow?.detail.includes('정리했어요') === true, keyRow?.detail);
check('만료된 기기 키가 실제로 삭제됨', (await page.evaluate(() => localStorage.getItem('va_groq_key'))) === JSON.stringify(''));
check('이후 TTS 호출은 기기 키를 보내지 않음(서버 키 경로)', ttsPostSentKey === null, String(ttsPostSentKey));
check('TTS 서버 호출 통과', rows.find((r) => r.name === 'TTS 서버 호출')?.ok === true);
check('신경망 음성 재생 통과', rows.find((r) => r.name === '신경망 음성 재생')?.ok === true);

await browser.close();
finish('10-stale-key');
