/** 음성 진단: 체인 단계별 결과가 기기에서 그대로 보인다(키·TTS 호출·재생·폴백). */
import { BASE, check, finish, launch, seedKey } from './helpers.mjs';

// 유효한 무음 WAV(0.1초, 16kHz mono 16bit) — 헤드리스에서도 ended 이벤트가 나온다
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
await page.route('**/app/api/tts', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: wavBuf() }));
await page.route('**/app/api/groq', (route) => {
  if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasServerKey: false }) });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
});
await seedKey(page);
await page.goto(`${BASE}/app`);
await page.waitForTimeout(1200);
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-card', { timeout: 8000 });
check('기능 탭에 음성 진단 카드', await page.evaluate(() => Array.from(document.querySelectorAll('.feat-card')).some((c) => c.textContent.includes('음성 진단'))));
await page.click('.feat-card:has-text("음성 진단")');
await page.waitForSelector('.study-card h3', { timeout: 8000 });

await page.click('.btn.primary');
// 재생·폴백 타임아웃까지 고려해 넉넉히 대기
await page.waitForFunction(() => document.querySelectorAll('.ac-row').length >= 5, { timeout: 30000 });

const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.ac-row')).map((r) => ({
    name: r.querySelector('.ac-name')?.textContent,
    ok: r.classList.contains('ok'),
    detail: r.querySelector('.ac-detail')?.textContent || '',
  }))
);
check('5단계 전부 결과 표시', rows.length >= 5, String(rows.length));
check('환경 단계에 버전 포함', rows[0]?.detail.includes('v0.'));
check('키 단계 통과(시드 키)', rows.find((r) => r.name === 'Groq 키')?.ok === true);
const tts = rows.find((r) => r.name === 'TTS 서버 호출');
check('TTS 호출 200 + 크기 표시', tts?.ok === true && /KB/.test(tts.detail), tts?.detail);
check('신경망 재생 단계 결과 존재', !!rows.find((r) => r.name === '신경망 음성 재생'));

await browser.close();
finish('09-audiocheck');
