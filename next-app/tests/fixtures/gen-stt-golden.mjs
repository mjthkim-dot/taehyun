/**
 * 골든 전사 변형 생성기 — 사람이 쓴 기본 20문장(stt-golden.json)마다 세 가지 변형을 규칙으로 만든다.
 *
 *  rl     : R/L 치환(한국인 혼동축) — 목표 문장의 한 단어를 r↔l로 바꾼 전사. 게이트는 ok,
 *           점수는 100 미만이어야 한다(바뀐 단어가 diff에서 틀림으로 잡혀야 발음 진단으로 이어진다).
 *  silent : 무음 환각 — 말을 안 했는데 Whisper가 지어낸 상투구("Thank you." 류).
 *           세그먼트 no_speech_prob가 높다 → 게이트 silent, 채점 전에 걸러져야 한다.
 *  echo   : 스피커 누출 — 직전 상대 대사(TTS)가 그대로 전사됨. lastTtsText와 ≥80% 일치 → 게이트 echo.
 *
 * 20 × 3 = 60개. 단위 테스트(tests/unit/sttGolden.test.ts)가 기본 20 + 변형 60 = 80케이스를 돌린다.
 * 실행: node tests/fixtures/gen-stt-golden.mjs  → 변형 목록을 JSON으로 출력(검토용).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** R/L 혼동 사전 — 목표 문장에 이 단어가 있으면 그대로 바꾼다(가장 흔한 축을 먼저) */
export const RL_MAP = [
  ['reason', 'leason'],
  ['right', 'light'],
  ['really', 'leally'],
  ['room', 'loom'],
  ['running', 'lunning'],
  ['run', 'lun'],
  ['servers', 'selvers'],
  ['strange', 'stlange'],
  ['free', 'flee'],
  ['from', 'flom'],
  ['forward', 'folward'],
  ['floor', 'froor'],
  ['line', 'rine'],
  ['let', 'ret'],
  ['look', 'rook'],
  ['last', 'rast'],
  ['call', 'carl'],
  ['bill', 'birr'],
  ['all', 'arr'],
  ['wrong', 'wlong'],
  ['grant', 'glant'],
  ['angry', 'angly'],
  ['nervous', 'nelvous'],
  ['customer', 'customel'],
];

/** 무음 환각 상투구 — Whisper가 무음·숨소리에 흔히 붙이는 것들 */
export const HALLUCINATIONS = ['Thank you.', 'Thanks for watching.', 'Bye.', 'Thank you for watching!', 'Subtitles by the community.'];

/** 정상 발화의 세그먼트(게이트 ok) */
export const CLEAR_SEGMENT = { start: 0, end: 2.4, avg_logprob: -0.25, no_speech_prob: 0.02, compression_ratio: 1.3 };
/** 무음 환각의 세그먼트(게이트 silent) */
export const SILENT_SEGMENT = { start: 0, end: 1.1, avg_logprob: -0.9, no_speech_prob: 0.92, compression_ratio: 1.1 };

const stripWord = (w) => w.toLowerCase().replace(/[^a-z']/g, '');

/** 목표 문장에서 R/L 치환할 단어와 결과 — 사전에 없으면 첫 r→l(없으면 l→r) 규칙 */
export function rlSwap(target) {
  const toks = target.split(/\s+/);
  for (const [from, to] of RL_MAP) {
    const i = toks.findIndex((t) => stripWord(t) === from);
    if (i >= 0) return { from, to, said: toks.map((t, k) => (k === i ? t.replace(new RegExp(from, 'i'), to) : t)).join(' ') };
  }
  let i = toks.findIndex((t) => /r/i.test(stripWord(t)) && stripWord(t) !== 'mr');
  if (i >= 0) {
    const to = stripWord(toks[i]).replace(/r/i, 'l');
    return { from: stripWord(toks[i]), to, said: toks.map((t, k) => (k === i ? t.replace(/r/i, 'l') : t)).join(' ') };
  }
  i = toks.findIndex((t) => /l/i.test(stripWord(t)));
  const to = stripWord(toks[i]).replace(/l/i, 'r');
  return { from: stripWord(toks[i]), to, said: toks.map((t, k) => (k === i ? t.replace(/l/i, 'r') : t)).join(' ') };
}

/** 기본 케이스 배열 → 변형 60개 */
export function generateVariants(bases) {
  const out = [];
  bases.forEach((b, idx) => {
    const swap = rlSwap(b.target);
    out.push({
      id: `${b.id}-rl`,
      kind: 'rl',
      baseId: b.id,
      target: b.target,
      said: swap.said,
      swapped: { from: swap.from, to: swap.to },
      segments: [CLEAR_SEGMENT],
      expectScoreMin: 60,
      expectScoreMax: 95,
      expectGate: 'ok',
    });
    out.push({
      id: `${b.id}-silent`,
      kind: 'silent',
      baseId: b.id,
      target: b.target,
      said: HALLUCINATIONS[idx % HALLUCINATIONS.length],
      segments: [SILENT_SEGMENT],
      expectScoreMin: 0,
      expectScoreMax: 30,
      expectGate: 'silent',
    });
    out.push({
      id: `${b.id}-echo`,
      kind: 'echo',
      baseId: b.id,
      target: b.target,
      said: b.partner,
      lastTtsText: b.partner,
      segments: [CLEAR_SEGMENT],
      expectScoreMin: 0,
      expectScoreMax: 60,
      expectGate: 'echo',
    });
  });
  return out;
}

/** 기본 20문장 읽기 — 테스트와 CLI가 같은 파일을 쓴다 */
export function loadBases() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return JSON.parse(fs.readFileSync(path.join(here, 'stt-golden.json'), 'utf8')).cases;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(JSON.stringify(generateVariants(loadBases()), null, 2));
}
