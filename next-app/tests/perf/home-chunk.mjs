/**
 * 홈 첫 청크 예산 가드 — 빌드 산출물(.next)에서 홈 페이지 청크를 읽어
 *   ① 크기가 예산 안인지, ② 홈이 쓰지 않는 무거운 원고·데이터가 끌려 들어오지 않았는지 확인한다.
 * 감사(v1.30 → v1.31): isMissionDoneToday 한 줄 때문에 업무 미션 원고 47KB가, 전체 모드 전용
 * 세션·주간 시험 카드 때문에 성장 단계 데이터가 홈 청크에 들어와 있었다.
 *
 * 사용: npm run build && node tests/perf/home-chunk.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(root, '.next/static/chunks/app');
const page = fs.readdirSync(dir).find((f) => /^page-[0-9a-f]+\.js$/.test(f));
if (!page) {
  console.error('홈 청크를 찾지 못했어요 — 먼저 npm run build');
  process.exit(1);
}
const src = fs.readFileSync(path.join(dir, page), 'utf8');
const BUDGET = 95_000;
const FORBIDDEN = [
  ['아이스브레이킹', '업무 미션 원고(dailyMission)'],
  ['va_weekly_tests', '주간 시험(weeklyTest)'],
  ['va_session_last', '패턴 세션(session)'],
  ['Hang in there, buddy', '드라마 원고 본문(dramaSeed)'],
  // M3: 발화 목표 계산(lib/speakGoal)·말로 떠올리기(RecallStep)는 드라마 화면 청크에만 — 홈은 저장값만 읽는다
  ['freezeWeek', '발화 목표 계산(speakGoal)'],
  ['recall-follow', '말로 떠올리기(RecallStep)'],
];
let fail = 0;
const ok = (name, cond, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!cond) fail++;
};
ok(`홈 청크 ${src.length.toLocaleString()}B ≤ 예산 ${BUDGET.toLocaleString()}B`, src.length <= BUDGET);
for (const [needle, what] of FORBIDDEN) ok(`홈 청크에 ${what} 없음`, !src.includes(needle));
// 렌더 차단 CSS(레이아웃에 걸리는 전역 스타일)도 예산 안인지
const cssDir = path.join(root, '.next/static/css');
const html = fs.existsSync(path.join(root, '.next/server/app/index.html')) ? fs.readFileSync(path.join(root, '.next/server/app/index.html'), 'utf8') : '';
const blocking = [...html.matchAll(/static\/css\/([0-9a-f]+\.css)/g)].map((m) => m[1]);
const cssBytes = [...new Set(blocking)].reduce((a, f) => a + (fs.existsSync(path.join(cssDir, f)) ? fs.statSync(path.join(cssDir, f)).size : 0), 0);
if (blocking.length) ok(`홈 렌더 차단 CSS ${cssBytes.toLocaleString()}B ≤ 160,000B`, cssBytes <= 160_000);
// 서비스 워커 — 시작 주소 전용 규칙(제한 시간 없음) 없음, 글꼴·Pages Router 런타임 프리캐시 없음, 해시 파일 리비전 고정
const swPath = path.join(root, 'public/sw.js');
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8');
  ok('sw.js에 start-url 규칙 없음(약한 신호에서 흰 화면 방지)', !sw.includes('start-url'));
  ok('프리캐시에 글꼴 서브셋 없음', !/url:"[^"]*\.woff2"/.test(sw));
  ok('프리캐시에 Pages Router 런타임 없음', !/url:"[^"]*chunks\/(framework|main|polyfills)-[0-9a-f]+\.js"/.test(sw) && !/url:"[^"]*chunks\/pages\//.test(sw));
  ok('해시 파일은 리비전 고정(배포마다 다시 받지 않음)', sw.includes('"immutable"'));
}
console.log(fail ? `home-chunk: ${fail}개 실패` : 'home-chunk: 모두 통과');
process.exit(fail ? 1 : 0);
