import { describe, expect, test } from 'vitest';
import seed from '../../data/dramaSeed.json';
import { axesOf, KEYWORDS, LOOSE, LOOSE_RANGE, MINE, mineLines, MINED_EPISODES, RESULT_CARD_MSGS, RETELL_MARKERS, spokenOf, WORD_RANGE, wordCount } from '../../lib/dramaSeedMine';
import type { Episode } from '../../lib/drama';

const eps = (seed as unknown as { episodes: Episode[] }).episodes;
const SEED_NOS = eps.map((e) => e.no);

describe('상대 대사 채굴(MINE) — 역할극 재료', () => {
  test('원고 7화 전부 지정, 화마다 ≥5줄, 총 ≈35줄', () => {
    expect(MINED_EPISODES.sort()).toEqual(SEED_NOS.sort());
    let total = 0;
    for (const no of SEED_NOS) {
      const lines = mineLines(no);
      expect(lines.length, `EP${no}`).toBeGreaterThanOrEqual(5);
      // 지정 인덱스가 전부 실제로 읽혔다(잘못된 인덱스·태오 줄이 섞이면 건너뛰어 수가 줄어든다)
      expect(lines.length, `EP${no} 인덱스 유효`).toBe(MINE[no].sceneIdx.length);
      total += lines.length;
    }
    expect(total).toBeGreaterThanOrEqual(33);
    expect(total).toBeLessThanOrEqual(40);
  });

  test('인덱스는 상대가 실제로 말한 장면(line, 또는 who≠taeo인 meaning/fill)이고 who≠taeo, 중복 없음', () => {
    for (const ep of eps) {
      const idxs = MINE[ep.no].sceneIdx;
      expect(new Set(idxs).size, `EP${ep.no} 중복`).toBe(idxs.length);
      for (const idx of idxs) {
        const s = ep.scenes[idx];
        expect(s, `EP${ep.no}[${idx}] 존재`).toBeDefined();
        // 원고에 비태오 line이 모자란 화(EP6 4줄)가 있어 meaning/fill도 허용 — 단 line이 과반
        expect(['line', 'meaning', 'fill'], `EP${ep.no}[${idx}] type`).toContain(s.type);
        const sp = spokenOf(s)!;
        expect(sp.who, `EP${ep.no}[${idx}] who`).not.toBe('taeo');
        expect(sp.en.length).toBeGreaterThan(0);
        expect(sp.kr.length).toBeGreaterThan(0);
      }
      const lineCount = idxs.filter((i) => ep.scenes[i].type === 'line').length;
      expect(lineCount * 2, `EP${ep.no} line 과반`).toBeGreaterThan(idxs.length);
    }
  });

  test('단어 수 5~11(축약 한 단어) — 명시 예외(LOOSE)만 4~12', () => {
    for (const no of SEED_NOS) {
      let strict = 0;
      for (const l of mineLines(no)) {
        const n = wordCount(l.en);
        const key = `${no}:${l.idx}`;
        if (LOOSE.has(key)) {
          expect(n, `${key} 예외 범위`).toBeGreaterThanOrEqual(LOOSE_RANGE[0]);
          expect(n, `${key} 예외 범위`).toBeLessThanOrEqual(LOOSE_RANGE[1]);
          // 예외는 정말 범위 밖일 때만(안쪽이면 LOOSE에서 빼야 한다)
          expect(n < WORD_RANGE[0] || n > WORD_RANGE[1], `${key} 불필요한 예외`).toBe(true);
        } else {
          expect(n, `${key} "${l.en}"`).toBeGreaterThanOrEqual(WORD_RANGE[0]);
          expect(n, `${key} "${l.en}"`).toBeLessThanOrEqual(WORD_RANGE[1]);
          strict++;
        }
      }
      expect(strict, `EP${no} 기본 범위 줄 ≥3`).toBeGreaterThanOrEqual(3);
    }
    expect(LOOSE.size).toBeLessThanOrEqual(6);
  });

  test('모든 줄에 한국인 혼동축 1개 이상', () => {
    for (const no of SEED_NOS) for (const l of mineLines(no)) expect(axesOf(l.en).length, `EP${no}[${l.idx}] "${l.en}"`).toBeGreaterThanOrEqual(1);
  });

  test('fill 장면은 빈칸을 채운 한 문장으로 복원된다', () => {
    const ep7 = eps.find((e) => e.no === 7)!;
    expect(spokenOf(ep7.scenes[11])).toEqual({ who: 'diane', en: 'Are you free for lunch tomorrow?', kr: '내일 점심 시간 괜찮아요?' });
  });

  test('없는 화·AI 화는 빈 배열', () => {
    expect(mineLines(8)).toEqual([]);
    expect(mineLines(0)).toEqual([]);
  });
});

describe('리텔 키워드·담화 표지(M5용)', () => {
  test('7화 × 4개 한국어 키워드, 전체 중복 없음', () => {
    const all: string[] = [];
    for (const no of SEED_NOS) {
      const ks = KEYWORDS[no];
      expect(ks, `EP${no}`).toHaveLength(4);
      for (const k of ks) {
        expect(/[가-힣]/.test(k), `EP${no} "${k}" 한국어`).toBe(true);
        expect(k.trim()).toBe(k);
        all.push(k);
      }
    }
    expect(all).toHaveLength(28);
    expect(new Set(all).size).toBe(28);
  });

  test('담화 표지 6개 로테이션 + 결과 카드 문구 8개', () => {
    expect(RETELL_MARKERS).toEqual(['first', 'then', 'but', 'so', 'actually', 'in the end']);
    expect(new Set(RETELL_MARKERS).size).toBe(6);
    expect(RESULT_CARD_MSGS).toHaveLength(8);
    expect(new Set(RESULT_CARD_MSGS).size).toBe(8);
    for (const m of RESULT_CARD_MSGS) expect(/[가-힣]/.test(m)).toBe(true);
  });
});
