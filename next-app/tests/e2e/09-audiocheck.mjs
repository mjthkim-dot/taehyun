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
// 키 검증은 실 Groq 호출이므로 목으로 대체(가짜 테스트 키는 당연히 401이 난다 —
// 검증 로직이 작동한다는 뜻. 여기선 '유효한 키' 시나리오를 고정한다)
await page.route('**/app/api/groq/validate', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
await page.route('**/app/api/tts', (route) => {
  if (route.request().method() === 'GET') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, bytes: 20480, model: 'canopylabs/orpheus-v1-english' }) });
  }
  return route.fulfill({ status: 200, contentType: 'audio/wav', body: wavBuf() });
});
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
await page.waitForFunction(() => document.querySelectorAll('.ac-row').length >= 7, { timeout: 30000 });

const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.ac-row')).map((r) => ({
    name: r.querySelector('.ac-name')?.textContent,
    ok: r.classList.contains('ok'),
    detail: r.querySelector('.ac-detail')?.textContent || '',
  }))
);
check('7단계 전부 결과 표시', rows.length >= 7, String(rows.length));
check('장치 출력(비프) 단계 존재', !!rows.find((r) => r.name === '장치 출력(비프)'));
check('서버→Groq 실연결 통과(목)', rows.find((r) => r.name === '서버→Groq 실연결')?.ok === true);
// 메이저 버전에 묶이지 않게 — v1.0.0 승격 때 'v0.' 하드코딩이 깨졌던 자리
check('환경 단계에 버전 포함', /v\d+\./.test(rows.find((r) => r.name === '환경')?.detail || ''));
const keyRow = rows.find((r) => r.name === 'Groq 키');
check('키 단계 통과 + 유효 확인 표기', keyRow?.ok === true && keyRow.detail.includes('유효 확인'), keyRow?.detail);
const tts = rows.find((r) => r.name === 'TTS 서버 호출');
check('TTS 호출 200 + 크기 표시', tts?.ok === true && /KB/.test(tts.detail), tts?.detail);
check('신경망 재생 단계 결과 존재', !!rows.find((r) => r.name === '신경망 음성 재생'));

await browser.close();
finish('09-audiocheck');
