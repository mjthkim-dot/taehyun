/**
 * 미팅 스크립트 — 상황별 대본이 실제로 열리고, 핵심 계약인
 * "이 상황으로 AI와 연습하기"가 회화 탭까지 이어지는지 검증한다.
 * 읽고 끝나는 콘텐츠와 롤플레이로 이어지는 콘텐츠의 차이가 이 핸드오프에 있다.
 */
import { BASE, check, finish, launch, mockGroq, seedKey } from './helpers.mjs';

const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.route('**/app/api/groq/validate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));

let systemPrompt = '';
await mockGroq(page, { onSystem: (s) => { systemPrompt = s; } });
await seedKey(page);

await page.goto(`${BASE}/app`);
await page.waitForSelector('.mission-card', { timeout: 15000 });
await page.click('.mode-tab:has-text("더보기")');
await page.waitForSelector('.more-sheet .feat-card', { timeout: 8000 });
await page.click('.more-sheet .feat-card:has-text("기능")');
await page.waitForSelector('.feat-card', { timeout: 8000 });
check('기능 탭에 미팅 스크립트 카드', await page.evaluate(() => Array.from(document.querySelectorAll('.feat-card')).some((c) => c.textContent.includes('미팅 스크립트'))));

await page.click('.feat-card:has-text("미팅 스크립트")');
await page.waitForSelector('.script-card', { timeout: 8000 });
check('시나리오 6종 렌더', (await page.evaluate(() => document.querySelectorAll('.script-card').length)) === 6);
const listBody = await page.evaluate(() => document.body.textContent || '');
check('IT 영업 상황 구성', /오프닝/.test(listBody) && /가격 반론/.test(listBody) && /임원 보고|QBR/.test(listBody));

// 가격 반론 대응 — 실전에서 가장 어려운 상황을 상세로 연다
await page.click('.script-card:has-text("가격 반론")');
await page.waitForSelector('.script-goal', { timeout: 8000 });
check('목표 문장 표시', (await page.evaluate(() => document.querySelector('.script-goal')?.textContent || '')).includes('총비용'));
check('단계별 카드 렌더', (await page.evaluate(() => document.querySelectorAll('.script-step-no').length)) >= 3);
check('단계마다 목적 설명', (await page.evaluate(() => document.querySelectorAll('.script-purpose').length)) >= 3);
check('표현 + 한국어 렌더', (await page.evaluate(() => document.querySelectorAll('.script-line .script-en').length)) >= 8);
check('표현 선택 이유(note) 렌더', (await page.evaluate(() => document.querySelectorAll('.script-note').length)) >= 3);
check('흔한 실수 목록', (await page.evaluate(() => document.querySelectorAll('.script-pitfalls li').length)) >= 3);
check('본문에 리터럴 ** 없음', !(await page.evaluate(() => document.body.textContent || '')).includes('**'));

// 모범 대화는 먼저 말해보게 하려고 접혀 있어야 한다
check('모범 대화는 기본 접힘', (await page.evaluate(() => document.querySelectorAll('.script-turn').length)) === 0);
await page.click('.btn.ghost:has-text("모범 대화 펼치기")');
await page.waitForSelector('.script-turn', { timeout: 5000 });
check('모범 대화 8줄 펼침', (await page.evaluate(() => document.querySelectorAll('.script-turn').length)) === 8);

// 표현 저장 → 표현장/드릴로 이어진다
await page.locator('.script-save').first().click();
await page.waitForTimeout(250);
const phrases = await page.evaluate(() => JSON.parse(localStorage.getItem('va_phrases') || '[]'));
check('표현이 표현장에 저장됨', phrases.length === 1 && String(phrases[0].lesson).startsWith('script:'), JSON.stringify(phrases[0] || {}));

// 핵심 계약: 같은 상황으로 AI 롤플레이까지 이어진다
await page.locator('.script-practice').first().click();
await page.waitForSelector('.talk-screen', { timeout: 10000 });
check('회화 화면으로 이동', (await page.evaluate(() => document.querySelector('.app-header h1')?.textContent)) === '회화');
const intro = await page.evaluate(() => document.querySelector('.talk-intro')?.textContent || '');
check('회화 인트로가 해당 상황', intro.includes('가격 반론'), intro.slice(0, 40));

await page.fill('.controls .text-input', 'Your price is too high.');
await page.click('.round-btn.send');
await page.waitForTimeout(900);
check('AI에 상대 역할 지시 전달', /구매 담당자|경쟁사 견적/.test(systemPrompt), systemPrompt.slice(0, 60));
check('시스템 프롬프트에 상황 제목 포함', systemPrompt.includes('가격 반론'));

await browser.close();
finish('16-scripts');
