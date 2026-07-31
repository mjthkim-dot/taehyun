/**
 * 본문 콘텐츠 품질 가드 — 브라우저 없이 데이터만 검사한다.
 *
 * 배경: 레슨마다 설명 두께가 들쭉날쭉해 "본문이 약하다"는 문제가 실제로 있었다.
 * 새 레슨을 추가하거나 기존 레슨을 손볼 때 얇은 설명이 다시 섞이지 않도록,
 * 최소 기준(섹션 도입부·포인트 설명·예문·대화)을 데이터 수준에서 고정한다.
 */
import { check, finish } from './helpers.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lessons = JSON.parse(readFileSync(path.join(root, 'data/lessons.json'), 'utf8'));
const curriculum = JSON.parse(readFileSync(path.join(root, 'data/curriculum.json'), 'utf8'));

const all = [...lessons.LESSONS, ...lessons.MASTER_LESSONS];
const withSections = all.filter((l) => (l.sections || []).length);
check('본문이 있는 레슨 50개 이상', withSections.length >= 50, String(withSections.length));

/* ── 최소 두께 ── */
const MIN_INTRO = 60; // 섹션 도입부(한 섹션당)
const MIN_NOTE = 60; // 포인트 설명 하나당
const MIN_NOTE_AVG = 120; // 레슨 평균

const thinIntro = [];
const thinNote = [];
const thinAvg = [];
for (const l of withSections) {
  const pts = l.sections.flatMap((s) => s.points);
  for (const s of l.sections) {
    if ((s.intro || '').length < MIN_INTRO) thinIntro.push(`${l.id}:${s.title}(${(s.intro || '').length})`);
  }
  for (const p of pts) {
    if ((p.note || '').length < MIN_NOTE) thinNote.push(`${l.id}:${p.en.slice(0, 20)}(${(p.note || '').length})`);
  }
  const avg = pts.reduce((n, p) => n + (p.note || '').length, 0) / Math.max(1, pts.length);
  if (avg < MIN_NOTE_AVG) thinAvg.push(`${l.id}(${Math.round(avg)})`);
}
check(`모든 섹션 도입부 ${MIN_INTRO}자 이상`, thinIntro.length === 0, thinIntro.slice(0, 5).join(', '));
check(`모든 포인트 설명 ${MIN_NOTE}자 이상`, thinNote.length === 0, thinNote.slice(0, 5).join(', '));
check(`레슨별 설명 평균 ${MIN_NOTE_AVG}자 이상`, thinAvg.length === 0, thinAvg.slice(0, 8).join(', '));

/* ── 구성 요소 ── */
const noExample = withSections.filter((l) => (l.examples || []).length < 3).map((l) => l.id);
check('레슨마다 예문 3개 이상', noExample.length === 0, noExample.join(', '));
const noDialogue = withSections.filter((l) => !(l.dialogue?.lines || []).length).map((l) => l.id);
check('레슨마다 대화 포함', noDialogue.length === 0, noDialogue.join(', '));

/* ── 마크다운 무결성(리터럴 ** 노출의 원인) ── */
const brokenBold = [];
for (const l of withSections) {
  for (const s of l.sections) {
    const texts = [s.intro || '', ...s.points.map((p) => p.note || '')];
    for (const t of texts) if ((t.match(/\*\*/g) || []).length % 2 !== 0) brokenBold.push(`${l.id}:${t.slice(0, 24)}`);
  }
}
check('볼드 마커(**) 짝이 모두 맞음', brokenBold.length === 0, brokenBold.slice(0, 5).join(', '));

/* ── 커리큘럼 ↔ 레슨 연결 ── */
const ids = new Set(all.map((l) => l.id).concat(lessons.SCENARIO_LIBRARY.map((l) => l.id)));
const orphan = curriculum.flatMap((lv) => lv.units).filter((u) => !ids.has(u.lessonId)).map((u) => u.lessonId);
check('콘텐츠 없는 경로 노드 0개', orphan.length === 0, orphan.join(', '));

/* ── 한국인 오용 교정이 실제로 담겼는지(이번 보강의 핵심) ── */
const withContrast = withSections.filter((l) =>
  l.sections.some((s) => s.points.some((p) => /❌|✅/.test(p.note || '')))
);
check('오류→교정 대조가 담긴 레슨 30개 이상', withContrast.length >= 30, String(withContrast.length));

finish('18-content');
