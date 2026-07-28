/** API 남용 방어: 형식 검증(400)·크기 상한(413)·무키(401)·rate limit(429). 브라우저 불필요. */
import { BASE, check, finish } from './helpers.mjs';

const post = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }).then((r) => r.status);

// groq — 형식/크기/무키 (rate limit 윈도우를 이 3회가 함께 소비한다)
check('groq 잘못된 본문 → 400', (await post('/app/api/groq', {})) === 400);
check('groq 16k자 초과 → 413', (await post('/app/api/groq', { messages: [{ role: 'user', content: 'x'.repeat(20000) }] })) === 413);
check('groq 정상 형태·무키 → 401', (await post('/app/api/groq', { messages: [{ role: 'user', content: 'hi' }] })) === 401);

// tts — 길이 상한/형식
check('tts 600자 초과 → 413', (await post('/app/api/tts', { text: 'y'.repeat(700) })) === 413);
check('tts text 없음 → 400', (await post('/app/api/tts', {})) === 400);

// rate limit: 분당 30회 — 위 3회 포함 최대 40회 안에 429가 나와야 한다.
let saw429 = false;
for (let i = 0; i < 37; i++) {
  const s = await post('/app/api/groq', { messages: [{ role: 'user', content: 'hi' }] });
  if (s === 429) {
    saw429 = true;
    break;
  }
}
check('groq 분당 30회 초과 → 429', saw429);

finish('04-api-guard');
