import { beforeEach, describe, expect, test } from 'vitest';
import {
  buildupStages,
  canRetry,
  canShadow,
  canSkip,
  disputeCount,
  finalScore,
  flashMs,
  hideAxisChip,
  logRoleResult,
  mineDefaultMode,
  pickChip,
  recallInlineItems,
  recordDispute,
  resultMessage,
  RETRY_MAX,
  ROLE_PASS,
  SHADOW_MAX,
  shadowScore,
  SKIP_MAX,
  speakStatsFrom,
  sttPath,
  unlimitedSkips,
  type RoleResult,
} from '../../lib/roleStep';
import { load } from '../../lib/state';
import { RESULT_CARD_MSGS } from '../../lib/dramaSeedMine';

beforeEach(() => localStorage.clear());

const base = (over: Partial<RoleResult> = {}): RoleResult => ({
  sceneIdx: 2,
  en: 'Is it… broken?',
  kr: '고장… 난 건가요?',
  who: 'taeo',
  said: 'is it broken',
  score: 100,
  diff: [],
  missed: [],
  lapses: [],
  tries: 1,
  mode: 'role',
  skipped: false,
  disputed: false,
  self: false,
  passed: true,
  path: 'whisper',
  ...over,
});

describe('빌드업 — 10단어 경계', () => {
  test('9단어는 전체 한 구간, 10단어부터 끝 4 → 끝 8 → 전체', () => {
    const nine = 'one two three four five six seven eight nine';
    expect(buildupStages(nine)).toEqual([nine]);
    const ten = 'one two three four five six seven eight nine ten';
    expect(buildupStages(ten)).toEqual(['seven eight nine ten', 'three four five six seven eight nine ten', ten]);
  });
  test('minWords를 낮추면(호출부 슬롯) 그 기준으로 쪼갠다 — 8단어면 끝 8이 전체와 같아 두 구간', () => {
    const eight = 'one two three four five six seven eight';
    expect(buildupStages(eight, 8)).toEqual(['five six seven eight', eight]);
  });
});

describe('통과·한 번 더·2차 점수', () => {
  test('60점 통과, 미만이면 한 번 더(최대 2회 = 시도 3회)', () => {
    expect(ROLE_PASS).toBe(60);
    expect(RETRY_MAX).toBe(2);
    expect(canRetry(1, 59)).toBe(true);
    expect(canRetry(2, 30)).toBe(true);
    expect(canRetry(3, 30)).toBe(false);
    expect(canRetry(1, 60)).toBe(false); // 통과했으면 권하지 않는다
  });
  test('2차 점수 — 최종은 가장 좋은 시도(두 번째가 더 나빠도 깎지 않는다)', () => {
    expect(finalScore([40, 72])).toBe(72);
    expect(finalScore([72, 40])).toBe(72);
    expect(finalScore([])).toBe(0);
  });
  test('플래시 — 첫 시도만(키 있음 1.5초, 키 없음 2초), 2차 시도부터 kr만(0)', () => {
    expect(flashMs(0, 'whisper')).toBe(1500);
    expect(flashMs(0, 'self')).toBe(2000);
    expect(flashMs(1, 'whisper')).toBe(0);
  });
});

describe('넘어가기 상한', () => {
  test('화당 3회, 넘으면 불가', () => {
    expect(SKIP_MAX).toBe(3);
    expect(canSkip(0)).toBe(true);
    expect(canSkip(2)).toBe(true);
    expect(canSkip(3)).toBe(false);
  });
  test('키 없음·마이크 거부·복귀·조용히는 무제한', () => {
    for (const p of [{ keyless: true }, { micDenied: true }, { returning: true }, { quiet: true }]) {
      expect(unlimitedSkips(p)).toBe(true);
      expect(canSkip(99, p)).toBe(true);
    }
    expect(unlimitedSkips({})).toBe(false);
  });
});

describe('섀도잉', () => {
  test('화당 상한 4회', () => {
    expect(SHADOW_MAX).toBe(4);
    expect(canShadow(3)).toBe(true);
    expect(canShadow(4)).toBe(false);
  });
  test('채점은 단어 회수율·길이 비만 — 혼동축 없음', () => {
    const r = shadowScore({ target: 'Nervous is good. It means you care.', said: 'nervous is good it means you care', modelMs: 2000, mineMs: 3000 });
    expect(r.score).toBe(100);
    expect(r.recall).toBe(1);
    expect(r.ratio).toBe(1); // 꼬리 1초를 뺀 길이 비
    const half = shadowScore({ target: 'Nervous is good. It means you care.', said: 'nervous is good', modelMs: 2000, mineMs: 2000 });
    expect(half.recall).toBe(0.43);
    expect(half.score).toBeLessThan(ROLE_PASS);
  });
  test('전사가 없으면(키 없음 recordOnly) 길이 비로만 — 범위 안이면 통과', () => {
    expect(shadowScore({ target: 'Hello there.', modelMs: 1500, mineMs: 2600 }).score).toBe(100);
    expect(shadowScore({ target: 'Hello there.', modelMs: 1500, mineMs: 1100 }).score).toBe(50); // 0.07× — 거의 안 말함
    expect(shadowScore({ target: 'Hello there.' }).score).toBe(0);
  });
  test('키 없으면 지정 상대 대사는 섀도잉 기본 ON, 키 있으면 보통 재생(길게 누르기)', () => {
    expect(mineDefaultMode('self')).toBe('shadow');
    expect(mineDefaultMode('webspeech')).toBe('shadow');
    expect(mineDefaultMode('whisper')).toBeNull();
  });
});

describe('키 없음 분기', () => {
  test('whisper > webspeech > self', () => {
    expect(sttPath({ whisper: true, webSpeech: true })).toBe('whisper');
    expect(sttPath({ whisper: false, webSpeech: true })).toBe('webspeech');
    expect(sttPath({ whisper: false, webSpeech: false })).toBe('self');
  });
  test('자기확인 결과는 시도 로그에 넣지 않고 발화 수에만 센다', () => {
    logRoleResult(base({ self: true, path: 'self', said: '', score: 100 }), 1);
    expect(load<unknown[]>('va_attempt_log', []).length).toBe(0);
    expect(load<{ count: number }>('va_spoken', { count: 0 }).count).toBe(1);
  });
});

describe('칩 1개 규칙 — 혼동축 > 리듬 > WPM', () => {
  const issue = { target: 'really', heard: 'leally', key: 'r-l' as const, label: 'R / L', tip: '혀끝' };
  test('혼동축이 있으면 그것만', () => {
    const c = pickChip({ issues: [issue], rhythm: { ratio: 1.0, chip: '내용어를 더 길게 — 뜻이 실린 단어를 눌러 주세요', ok: false }, wpm: 120 });
    expect(c?.kind).toBe('axis');
    expect(c?.key).toBe('r-l');
  });
  test('축이 없고 리듬이 범위 밖이면 리듬, 리듬이 좋으면 WPM', () => {
    expect(pickChip({ issues: [], rhythm: { ratio: 1.0, chip: '내용어를 더 길게 — 뜻이 실린 단어를 눌러 주세요', ok: false }, wpm: 120 })?.kind).toBe('rhythm');
    expect(pickChip({ issues: [], rhythm: { ratio: 1.5, chip: '리듬 좋아요 — 기능어가 가볍게 흘렀어요', ok: true }, wpm: 120 })?.kind).toBe('wpm');
    expect(pickChip({ issues: [] })).toBeNull();
  });
  test('같은 문장 2회 신고 → 축 칩 숨김(리듬·WPM으로 내려간다)', () => {
    recordDispute('Is it… broken?', 20);
    expect(hideAxisChip('Is it… broken?')).toBe(false);
    recordDispute('is it broken', 25); // 정규화해서 같은 문장
    expect(disputeCount('Is it… broken?')).toBe(2);
    expect(hideAxisChip('Is it… broken?')).toBe(true);
    expect(pickChip({ issues: [issue], wpm: 90, hideAxis: true })?.kind).toBe('wpm');
  });
  test('va_dispute_log는 최근 100건만', () => {
    for (let k = 0; k < 120; k++) recordDispute(`line ${k}`, 10);
    expect(load<unknown[]>('va_dispute_log', []).length).toBe(100);
    expect(disputeCount('line 0')).toBe(0);
    expect(disputeCount('line 119')).toBe(1);
  });
});

describe('이의 제기(disputed) — 자기확인 통과·기록', () => {
  test('disputed 결과는 통과로 세고 시도 로그에 disputed:true', () => {
    const r = base({ score: 22, passed: true, disputed: true, lapses: ['r-l'] });
    logRoleResult(r, 1);
    const log = load<{ disputed?: boolean; score: number; patternKey?: string; src?: string }[]>('va_attempt_log', []);
    expect(log.length).toBe(1);
    expect(log[0]).toMatchObject({ disputed: true, score: 22, patternKey: 'drama:1:2', src: 'drama' });
    // 통과했으니 복습 카드에는 넣지 않는다
    expect(load<unknown[]>('va_weak', []).length).toBe(0);
    expect(speakStatsFrom([r]).disputed).toBe(1);
    expect(resultMessage(r)).toBe(RESULT_CARD_MSGS[7]);
  });
  test('60점 미만은 복습 카드(드라마, 내일) + 혼동축 누적(역할극만)', () => {
    logRoleResult(base({ score: 40, passed: false, lapses: ['r-l'] }), 3);
    const weak = load<{ en: string; cat?: string; lesson?: string; due: number }[]>('va_weak', []);
    expect(weak[0]).toMatchObject({ en: 'Is it… broken?', cat: '드라마', lesson: 'drama:3' });
    expect(weak[0].due - Date.now()).toBeGreaterThan(80000000);
    expect(load<{ key: string }[]>('va_pron', []).map((p) => p.key)).toEqual(['r-l']);
    logRoleResult(base({ mode: 'shadow', score: 40, passed: false, lapses: ['f-p'], en: 'Fine.' }), 3);
    expect(load<{ key: string }[]>('va_pron', []).map((p) => p.key)).toEqual(['r-l']); // 섀도잉은 누적 안 함
    expect(load<{ src?: string }[]>('va_attempt_log', []).map((a) => a.src)).toEqual(['drama', 'shadow']);
  });
  test('넘어간 대사는 복습 카드(내일)만, 발화 수에 세지 않는다', () => {
    logRoleResult(base({ skipped: true, passed: false, score: 0 }), 2);
    expect(load<{ en: string }[]>('va_weak', [])[0].en).toBe('Is it… broken?');
    expect(load<{ count: number }>('va_spoken', { count: 0 }).count).toBe(0);
  });
});

describe('세션 집계·재소환', () => {
  test('speakStats — spoken/passed/lapsesTop/disputed/skipped', () => {
    const s = speakStatsFrom([
      base({ lapses: ['r-l', 'th'] }),
      base({ score: 30, passed: false, lapses: ['r-l'] }),
      base({ skipped: true, passed: false }),
      base({ disputed: true, passed: true, score: 10 }),
    ]);
    expect(s).toMatchObject({ spoken: 3, passed: 2, disputed: 1, skipped: 1 });
    expect(s.lapsesTop[0]).toEqual({ key: 'r-l', count: 2 });
  });
  test('재소환 — 방금 60점 미만 최대 2개, 같은 문장 한 번, 넘어감·이의·입모양 제외', () => {
    const items = recallInlineItems([
      base({ sceneIdx: 1, en: 'A one.', score: 10, passed: false }),
      base({ sceneIdx: 1, en: 'A one.', score: 20, passed: false }),
      base({ sceneIdx: 2, en: 'B two.', skipped: true, passed: false }),
      base({ sceneIdx: 3, en: 'C three.', disputed: true, passed: true, score: 5 }),
      base({ sceneIdx: 4, en: 'D four.', mode: 'lip', self: true, passed: false, score: 0 }),
      base({ sceneIdx: 5, en: 'E five.', score: 59, passed: false }),
      base({ sceneIdx: 6, en: 'F six.', score: 0, passed: false }),
    ]);
    expect(items.map((x) => x.en)).toEqual(['A one.', 'E five.']);
  });
});
