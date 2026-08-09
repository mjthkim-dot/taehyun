/**
 * 커리큘럼 데이터 무결성 검증 — CI에서 tsc 이후, 빌드 이전에 돌린다.
 *
 * TypeScript 타입이 못 잡는 "내용" 규칙을 검사한다:
 *  - id 유일성/형식(sXXeXX-…), 장면·표현 id가 에피소드 id로 시작하는가
 *  - 필수 텍스트 필드 비어 있지 않은가, 대화 라인 수(4~10)
 *  - dialogue의 expressionId가 실제 그 장면의 표현을 가리키는가
 *  - 장면의 모든 표현이 대화에서 최소 1회 연습되는가
 *  - Guest 라인에 speakerLabel이 있는가
 *
 * TS 모듈을 그대로 읽기 위해 tsx 없이 정규식 파싱 대신 next 빌드 산출물을 쓰는
 * 방법도 있지만, 여기서는 단순하게 TypeScript 소스를 트랜스파일 없이 평가할 수
 * 있도록 데이터 파일이 "순수 리터럴"이라는 규칙을 이용해 ts를 동적 import 한다.
 * (Node 22+는 --experimental-strip-types를 지원하지만 CI 안정성을 위해
 *  간단한 strip 후 data URL import 방식을 쓴다.)
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const epDir = path.join(root, 'data/episodes');

/** 데이터 파일은 import type + 순수 객체 리터럴이라는 규칙 하에 TS→JS 변환. */
function stripTs(source) {
  return source
    .replace(/import type[^;]+;/g, '')
    .replace(/const episode: Episode =/, 'const episode =')
    .replace(/export default episode;/, 'export default episode;');
}

async function loadEpisode(file) {
  const src = stripTs(readFileSync(path.join(epDir, file), 'utf8'));
  const mod = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
  return mod.default;
}

const errors = [];
const err = (msg) => errors.push(msg);

const files = readdirSync(epDir).filter((f) => f.endsWith('.ts')).sort();
if (files.length === 0) err('에피소드 파일이 없습니다.');

const episodes = [];
for (const f of files) {
  try {
    episodes.push({ file: f, ep: await loadEpisode(f) });
  } catch (e) {
    err(`${f}: 파싱 실패 — ${e.message}`);
  }
}

const seenIds = new Set();
const nonEmpty = (obj, fields, where) => {
  for (const field of fields) {
    const v = obj[field];
    if (typeof v !== 'string' || v.trim().length === 0) err(`${where}: ${field}가 비어 있음`);
  }
};

for (const { file, ep } of episodes) {
  const where = `${file} (${ep?.id})`;
  if (!/^s\d{2}e\d{2}$/.test(ep.id)) err(`${where}: 에피소드 id 형식 오류`);
  if (seenIds.has(ep.id)) err(`${where}: 중복 에피소드 id`);
  seenIds.add(ep.id);
  if (ep.code !== ep.id.toUpperCase()) err(`${where}: code(${ep.code})와 id 불일치`);
  if (ep.season !== Number(ep.id.slice(1, 3))) err(`${where}: season(${ep.season})과 id 불일치`);
  nonEmpty(ep, ['titleEn', 'titleKr', 'synopsisKr', 'theme'], where);
  if (!Array.isArray(ep.scenes) || ep.scenes.length < 1) err(`${where}: 장면이 없음`);

  for (const scene of ep.scenes ?? []) {
    const sw = `${where} > ${scene.id}`;
    if (!scene.id.startsWith(`${ep.id}-`)) err(`${sw}: 장면 id가 에피소드 id로 시작하지 않음`);
    if (seenIds.has(scene.id)) err(`${sw}: 중복 장면 id`);
    seenIds.add(scene.id);
    nonEmpty(scene, ['titleKr', 'location', 'contextKr'], sw);

    if (!Array.isArray(scene.expressions) || scene.expressions.length < 3)
      err(`${sw}: 표현이 3개 미만`);
    const exprIds = new Set();
    for (const ex of scene.expressions ?? []) {
      const xw = `${sw} > ${ex.id}`;
      if (!ex.id.startsWith(`${scene.id}-`)) err(`${xw}: 표현 id가 장면 id로 시작하지 않음`);
      if (seenIds.has(ex.id)) err(`${xw}: 중복 표현 id`);
      seenIds.add(ex.id);
      exprIds.add(ex.id);
      nonEmpty(ex, ['phrase', 'meaningKr', 'nuanceKr', 'exampleEn', 'exampleKr'], xw);
      if (![1, 2, 3].includes(ex.level)) err(`${xw}: level은 1~3이어야 함`);
    }

    if (!Array.isArray(scene.dialogue) || scene.dialogue.length < 4 || scene.dialogue.length > 10)
      err(`${sw}: 대화는 4~10라인이어야 함 (현재 ${scene.dialogue?.length ?? 0})`);
    const practiced = new Set();
    for (const [i, line] of (scene.dialogue ?? []).entries()) {
      const lw = `${sw} 대화 ${i + 1}행`;
      nonEmpty(line, ['en', 'kr'], lw);
      if (line.speaker === 'Guest' && !line.speakerLabel) err(`${lw}: Guest에 speakerLabel 없음`);
      if (line.expressionId) {
        if (!exprIds.has(line.expressionId))
          err(`${lw}: expressionId(${line.expressionId})가 이 장면의 표현이 아님`);
        practiced.add(line.expressionId);
      }
    }
    for (const id of exprIds) {
      if (!practiced.has(id)) err(`${sw}: 표현 ${id}가 대화에서 한 번도 연습되지 않음`);
    }
  }
}

if (errors.length > 0) {
  console.error(`✗ 데이터 검증 실패 — ${errors.length}건:\n`);
  for (const e of errors) console.error(`  · ${e}`);
  process.exit(1);
}

const totalScenes = episodes.reduce((n, { ep }) => n + ep.scenes.length, 0);
const totalExpr = episodes.reduce(
  (n, { ep }) => n + ep.scenes.reduce((m, s) => m + s.expressions.length, 0),
  0,
);
console.log(
  `✓ 데이터 검증 통과 — 에피소드 ${episodes.length}편, 장면 ${totalScenes}개, 표현 ${totalExpr}개`,
);
