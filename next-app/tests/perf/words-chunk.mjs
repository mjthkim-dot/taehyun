/**
 * 단어 탭 청크 가드(M8) — 빌드 산출물(.next)에서 WordsScreen 청크를 찾아 드라마 원고(dramaSeed)·
 * 업무 미션 원고가 딸려 들어오지 않았는지 확인한다. 말하기 문항이 채점을 lib/align(순수 함수)로
 * 하는 이유가 이것이다 — lib/drama.ts의 speakMatch를 쓰면 원고 47KB가 단어 탭에 들어온다.
 * (정적 import 그래프는 tests/unit/words.test.ts가 빌드 없이 검사한다. 이 스크립트는 번들러가
 * 실제로 묶은 결과를 본다.)
 *
 * 사용: npm run build && node tests/perf/words-chunk.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(root, '.next/static/chunks');
if (!fs.existsSync(dir)) {
  console.error('빌드가 없어요 — 먼저 npm run build');
  process.exit(1);
}
const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js')) files.push(p);
  }
};
walk(dir);
// 단어 탭 청크 = 허브 문구('상황별 단어')가 들어 있는 청크, 말하기 청크 = SpeakQuiz 문구가 들어 있는 청크
const MARKERS = [
  ['WordsScreen', '상황별 단어'],
  ['SpeakQuiz', '오늘 말한 단어'],
];
const FORBIDDEN = [
  ['Hang in there, buddy', '드라마 원고 본문(dramaSeed)'],
  ['아이스브레이킹', '업무 미션 원고(dailyMission)'],
];
let fail = 0;
const ok = (name, cond, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!cond) fail++;
};
for (const [label, marker] of MARKERS) {
  const hits = files.filter((f) => fs.readFileSync(f, 'utf8').includes(marker));
  ok(`${label} 청크를 찾았다`, hits.length > 0, marker);
  for (const f of hits) {
    const src = fs.readFileSync(f, 'utf8');
    for (const [needle, what] of FORBIDDEN) ok(`${label} 청크(${path.basename(f)}, ${src.length.toLocaleString()}B)에 ${what} 없음`, !src.includes(needle));
  }
}
console.log(fail ? `words-chunk: ${fail}개 실패` : 'words-chunk: 모두 통과');
process.exit(fail ? 1 : 0);
