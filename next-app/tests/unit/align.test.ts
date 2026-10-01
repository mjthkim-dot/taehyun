import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { alignedScore, normWords } from '../../lib/align';
import { computeAccuracy } from '../../store/useLessonStore';

/**
 * lib/align.ts — 채점 래퍼. 결과는 예전 computeAccuracy와 같아야 하고(래퍼), 무엇보다
 * 원고(dramaSeed)·drama.ts·words.ts·store를 끌고 오지 않아야 한다(단어 탭 청크 오염 방지).
 */
describe('alignedScore', () => {
  test('완전 일치 100, 빈 발화 0', () => {
    expect(alignedScore('We found it together.', 'we found it together').score).toBe(100);
    expect(alignedScore('We found it together.', '').score).toBe(0);
    expect(alignedScore('', 'anything').score).toBe(0);
  });

  test('빠진·틀린 단어가 목표 순서대로 diff에 표시된다', () => {
    const r = alignedScore('We found the reason and fixed it.', 'We found the leason and fix it.');
    expect(r.diff.map((d) => d.ok)).toEqual([true, true, true, false, true, false, true]);
    expect(r.missed).toEqual(['reason', 'fixed']);
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.score).toBeLessThan(100);
  });

  test('순서를 바꾸면 점수가 깎인다(LCS)', () => {
    expect(alignedScore('I work in cloud sales.', 'in cloud sales I work').score).toBeLessThan(100);
  });

  test('useLessonStore.computeAccuracy는 같은 결과를 내는 래퍼다', () => {
    const t = "She's in another meeting. I'm Taeo, her new teammate.";
    const s = "She is in another meeting. I'm Taeo, her new teammate.";
    expect(computeAccuracy(t, s)).toEqual(alignedScore(t, s));
  });

  test('normWords — 곧은 따옴표·굽은 따옴표를 같게 본다', () => {
    expect(normWords("I’m Taeo")).toEqual(normWords("I'm Taeo"));
  });
});

/* ── 번들 의존 검사 — align·sttQuality·fluency는 원고/드라마/단어장/스토어를 (간접으로도) import하지 않는다 ── */
const ROOT = path.resolve(__dirname, '../..');
const FORBIDDEN = [/dramaSeed\.json$/, /\/lib\/drama\.ts$/, /\/lib\/words\.ts$/, /\/lib\/habits\.ts$/, /\/store\//, /wordBank\.json$/];

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null; // 패키지 import는 추적하지 않는다
  const base = path.resolve(path.dirname(from), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return base;
}

/** 상대 import를 따라가며 닿는 파일 전부 */
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    if (!fs.existsSync(f) || !/\.(ts|tsx)$/.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const r = resolveImport(f, m[1]);
      if (r) stack.push(r);
    }
  }
  return seen;
}

describe('번들 의존 — 원고 import 없음', () => {
  test('lib/align.ts는 아무것도 import하지 않는다', () => {
    const src = fs.readFileSync(path.join(ROOT, 'lib/align.ts'), 'utf8');
    expect(src.match(/^\s*import\s/gm)).toBeNull();
  });

  for (const entry of ['lib/align.ts', 'lib/sttQuality.ts', 'lib/fluency.ts']) {
    test(`${entry}에서 닿는 파일에 원고·drama.ts·words.ts·store 없음`, () => {
      const files = [...reachable(path.join(ROOT, entry))];
      const bad = files.filter((f) => FORBIDDEN.some((re) => re.test(f)));
      expect(bad).toEqual([]);
    });
  }
});
