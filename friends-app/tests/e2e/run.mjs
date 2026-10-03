/**
 * E2E 스모크 러너 — 정적 export(out/)를 내장 HTTP 서버로 띄우고
 * Playwright(Chromium)로 핵심 사용자 여정을 검증한다.
 *
 * 사용: npm run build && npm run test:e2e
 * 검증 항목:
 *  ① 홈 렌더링(브랜드·오늘의 표현·법적 고지)
 *  ② 에피소드 목록 → 레슨 진입 → 장면 완료 → 진도 반영
 *  ③ 퀴즈 한 문제 풀이(정답 하이라이트·해설)
 *  ④ 복습 큐 생성(장면 완료 후) + 플래시카드 뒤집기
 *  ⑤ a11y 기본(html lang, 문서 제목) + 콘솔 에러 없음
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(appRoot, 'out');
const PORT = Number(process.env.E2E_PORT || 3300);
const BASE = `http://localhost:${PORT}`;

if (!existsSync(path.join(outDir, 'index.html'))) {
  console.error('빌드가 없습니다 — 먼저 `npm run build`를 실행하세요.');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    let file = path.join(outDir, p);
    if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

let failed = 0;
const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    results.push(`  ✗ ${name}\n    ${e.message.split('\n')[0]}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// CI에서는 playwright가 내려받은 브라우저를, 로컬/샌드박스에서는 사전 설치된
// Chromium(PLAYWRIGHT_CHROMIUM_PATH)을 쓴다 — 버전 불일치 재다운로드 방지.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto(BASE, { waitUntil: 'networkidle' });

await test('홈: 브랜드와 히어로가 보인다', async () => {
  assert(await page.getByText('프렌즈 잉글리시').first().isVisible(), '브랜드 미표시');
  assert(await page.getByText('진짜 미국 영어').isVisible(), '히어로 카피 미표시');
});

await test('홈: 오늘의 표현 카드가 있다', async () => {
  assert(await page.getByText('오늘의 표현').isVisible(), '오늘의 표현 섹션 없음');
});

await test('홈: 오늘의 플랜 체크리스트', async () => {
  assert(await page.getByText('오늘의 플랜').isVisible(), '오늘의 플랜 없음');
  assert(await page.getByText('장면 1개 학습').isVisible(), '플랜 항목 없음');
});

await test('홈: 법적 고지가 있다', async () => {
  assert(await page.getByText(/비공식 팬 자료/).isVisible(), '법적 고지 없음');
});

await test('a11y: lang=ko + 문서 제목', async () => {
  assert((await page.getAttribute('html', 'lang')) === 'ko', 'html lang이 ko가 아님');
  assert((await page.title()).includes('프렌즈'), '문서 제목 이상');
});

await test('에피소드: 목록 → S01E01 진입', async () => {
  await page.getByRole('button', { name: '에피소드', exact: true }).click();
  assert(await page.getByText('SEASON 1', { exact: true }).isVisible(), '시즌 그룹 없음');
  await page.getByText('The One Where Monica Gets a Roommate').click();
  assert(await page.getByText('웨딩드레스 차림의 불청객').isVisible(), '장면 브리핑 없음');
  assert(await page.getByText("How you doin'?").first().isVisible(), '표현 카드 없음');
});

await test('레슨: 대화 라인과 배역 선택 UI가 있다', async () => {
  assert(await page.getByText('상황 대화 연습').isVisible(), '대화 섹션 없음');
  const bubbles = await page.locator('.dialogue-line').count();
  assert(bubbles >= 4, `대화 라인이 ${bubbles}개뿐`);
});

await test('레슨: 표현 카드 심화(응용·실수·발음) 펼치기', async () => {
  await page.locator('.depth-toggle').first().click();
  assert(await page.getByText('실전 응용').first().isVisible(), '응용 블록 없음');
  assert(await page.getByText('한국인이 자주 틀리는 포인트').first().isVisible(), '실수 블록 없음');
  assert(await page.getByText('소리 내는 법').first().isVisible(), '발음 블록 없음');
  await page.locator('.depth-toggle').first().click();
});

await test('레슨: 유튜브 원장면 링크', async () => {
  const href = await page.locator('.video-link').first().getAttribute('href');
  assert(href && href.startsWith('https://www.youtube.com/results'), `잘못된 링크: ${href}`);
});

await test('레슨: 스피킹 드릴 — 정답 보기 흐름', async () => {
  await page.getByText('스피킹 드릴 1 /').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '정답 보기' }).click();
  assert(await page.locator('.drill-answer').isVisible(), '모범 답안 없음');
  await page.getByRole('button', { name: /다음 드릴/ }).click();
  assert(await page.getByText('스피킹 드릴 2 /').isVisible(), '드릴 진행 안 됨');
});

await test('레슨: 딕테이션 — 정답 입력 시 100점', async () => {
  await page.getByText(/딕테이션 1 \//).scrollIntoViewIfNeeded();
  // 첫 출제 문장은 대화에서 expressionId가 달린 첫 라인이다.
  const answer = "It's a long story. I just... I couldn't do it.";
  await page.locator('.dictation-input').fill(answer);
  await page.getByRole('button', { name: '채점하기' }).click();
  const score = await page.locator('.score-banner .score-num').last().textContent();
  assert(score === '100', `딕테이션 점수 ${score} (100 기대)`);
});

await test('레슨: 장면 완료 → 진도 반영', async () => {
  await page.getByRole('button', { name: /장면 학습 완료/ }).click();
  assert(await page.getByRole('button', { name: /다음 장면으로/ }).isVisible(), '다음 장면 CTA 없음');
  // 헤더 스트릭이 나타난다(오늘 학습 기록됨)
  assert(await page.getByText(/1일/).first().isVisible(), '스트릭 미표시');
});

await test('퀴즈: 한 문제 풀이 흐름', async () => {
  await page.getByRole('button', { name: '퀴즈', exact: true }).click();
  await page.getByRole('button', { name: '전체 표현 랜덤 퀴즈' }).click();
  await page.locator('.quiz-choice').first().click();
  assert(await page.locator('.quiz-choice.correct').count() === 1, '정답 하이라이트 없음');
  assert(await page.locator('.quiz-explanation').isVisible(), '해설 없음');
});

await test('복습: 완료한 장면의 표현이 큐에 들어온다', async () => {
  // 장면 완료로 SRS(due 내일)가 생겼다 — 저장 표현이 아닌 SRS due는 내일이므로,
  // 여기서는 북마크로 즉시 큐에 들어오는 경로를 검증한다.
  await page.getByRole('button', { name: '에피소드', exact: true }).click();
  await page.getByText('The One Where Monica Gets a Roommate').click();
  await page.locator('[aria-label="표현 저장"]').first().click();
  await page.getByRole('button', { name: '복습', exact: true }).click();
  assert(await page.locator('.flashcard').isVisible(), '플래시카드 없음');
  await page.locator('.flashcard').click();
  assert(await page.getByRole('button', { name: /기억나요/ }).isVisible(), '평가 버튼 없음');
});

await test('진도: 통계 화면', async () => {
  await page.getByRole('button', { name: '진도', exact: true }).click();
  assert(await page.getByText('전체 학습 진행률').isVisible(), '진행률 카드 없음');
  assert(await page.getByText('회차별 진행').isVisible(), '회차별 진행 없음');
});

await test('콘솔 에러 없음', async () => {
  assert(consoleErrors.length === 0, `콘솔 에러 ${consoleErrors.length}건: ${consoleErrors[0] ?? ''}`);
});

await browser.close();
server.close();

console.log(results.join('\n'));
if (failed > 0) {
  console.error(`\n✗ E2E 실패 ${failed}건`);
  process.exit(1);
}
console.log('\n✓ E2E 스모크 전체 통과');
