import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import seed from '../../data/dramaSeed.json';
import { allEpisodes, completeEpisode, INTERACTIVE, nextEpisodeNo, validateEpisode, watched, watchedToday, type Episode } from '../../lib/drama';
import { load } from '../../lib/state';
import { startProgram, todayPlan } from '../../lib/program';

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());
/** 드라마 카드는 다음 날부터 복습 기한 — 이틀 뒤로 시계를 돌린다 */
const later = (days = 2) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + days * 86400000);
};
const eps = (seed as unknown as { episodes: Episode[] }).episodes;

describe('원고(1~3화) 품질', () => {
  test('각 화가 검증기를 통과한다(원고도 AI와 같은 기준)', () => {
    for (const e of eps) expect(validateEpisode(e, e.no), `EP${e.no}`).not.toBeNull();
  });
  test('참여 문항 3~4개, 형식 3종 이상 — 반복 형식 방지', () => {
    for (const e of eps) {
      const inter = e.scenes.filter((s) => INTERACTIVE.has(s.type));
      expect(inter.length).toBeGreaterThanOrEqual(3);
      expect(new Set(inter.map((s) => s.type)).size).toBeGreaterThanOrEqual(3);
    }
  });
  test('매 화 표현 2개 + 다음 화 예고', () => {
    for (const e of eps) {
      expect(e.learn.length).toBe(2);
      expect(e.cliff.length).toBeGreaterThan(10);
    }
  });
  test('choice는 정답 정확히 1개, 오답엔 이유', () => {
    for (const e of eps)
      for (const s of e.scenes)
        if (s.type === 'choice') {
          expect(s.opts.filter((o) => o.ok).length).toBe(1);
          for (const o of s.opts) if (!o.ok) expect(o.why).toBeTruthy();
        }
  });
});

describe('검증기 — AI 원고 거부 기준', () => {
  const base = eps[0];
  test('타입이 틀린 보기(문자열 대신 숫자)는 거부 — 플레이어가 죽지 않게', () => {
    const scenes = base.scenes.map((s) => (s.type === 'meaning' ? { ...s, opts: [1, 2, 3] } : s));
    expect(validateEpisode({ ...base, scenes }, 8)).toBeNull();
  });
  test('뜻 문항 바로 앞 대사에 같은 영어가 있으면(자막이 정답 노출) 거부', () => {
    const k = base.scenes.findIndex((s) => s.type === 'meaning');
    const m = base.scenes[k] as { en: string };
    const scenes = [...base.scenes.slice(0, k), { type: 'line', who: 'diane', en: `Well. ${m.en}`, kr: '음. 그렇죠.' }, ...base.scenes.slice(k)];
    expect(validateEpisode({ ...base, scenes }, 8)).toBeNull();
  });
  test('choice 반응(reply) 필드가 비면 거부', () => {
    const scenes = base.scenes.map((s) => (s.type === 'choice' ? { ...s, opts: s.opts.map((o) => (o.ok ? { ...o, reply: { who: 'diane', en: '', kr: '' } } : o)) } : s));
    expect(validateEpisode({ ...base, scenes }, 8)).toBeNull();
  });
  test('참여 문항이 1개뿐이면 거부', () => {
    const scenes = base.scenes.filter((s) => !INTERACTIVE.has(s.type) || s.type === 'choice');
    expect(validateEpisode({ ...base, scenes }, 4)).toBeNull();
  });
  test('정답이 2개인 choice는 거부', () => {
    const scenes = base.scenes.map((s) => (s.type === 'choice' ? { ...s, opts: s.opts.map((o) => ({ ...o, ok: true })) } : s));
    expect(validateEpisode({ ...base, scenes }, 4)).toBeNull();
  });
  test('너무 긴 화(23장면+)는 거부 — 하루 5분 유지', () => {
    const extra = Array.from({ length: 10 }, () => ({ type: 'narr', kr: '장면이 이어진다.' }));
    expect(validateEpisode({ ...base, scenes: [...base.scenes, ...extra] }, 4)).toBeNull();
  });
});

describe('진행', () => {
  test('처음엔 1화, 보고 나면 2화', () => {
    expect(nextEpisodeNo()).toBe(1);
    completeEpisode(eps[0], 100);
    expect(watched()).toEqual([1]);
    expect(watchedToday()).toBe(true);
    expect(nextEpisodeNo()).toBe(2);
  });
  test('본 화의 표현 2개가 복습 카드로', () => {
    completeEpisode(eps[0], 80);
    const weak = load<{ en: string; cat?: string }[]>('va_weak', []);
    expect(weak.filter((w) => w.cat === '드라마').map((w) => w.en)).toEqual(eps[0].learn.map((l) => l.en));
  });
  test('원고 7화(첫 일주일은 AI 없이) + 생성분이 합쳐진다', () => {
    expect(allEpisodes().map((e) => e.no)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    localStorage.setItem('va_drama_eps', JSON.stringify([{ ...eps[2], no: 8, ai: true }]));
    expect(allEpisodes().map((e) => e.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  test('다시 본 화는 처음 본 날짜를 유지', () => {
    localStorage.setItem('va_drama', JSON.stringify({ done: { 1: '2026-01-01' }, score: { 1: 50 } }));
    completeEpisode(eps[0], 100);
    const p = JSON.parse(localStorage.getItem('va_drama')!);
    expect(p.done['1']).toBe('2026-01-01');
    expect(p.score['1']).toBe(100);
    expect(watchedToday()).toBe(false);
  });
  test('다음 화 첫머리 복습 — 지난 화 표현을 영어로 고르기(정답 1, 보기 3)', async () => {
    const { recallItems } = await import('../../lib/drama');
    expect(recallItems(1)).toEqual([]);
    const r = recallItems(2);
    expect(r.length).toBe(1);
    expect(r[0].opts.length).toBe(3);
    expect(r[0].opts[r[0].a]).toBe(eps[0].learn[0].en);
    expect(new Set(r[0].opts).size).toBe(3);
  });
  test('복습 기한이 된 드라마 표현을 우선 물어본다', async () => {
    const { recallItems } = await import('../../lib/drama');
    completeEpisode(eps[0], 100);
    completeEpisode(eps[1], 100);
    expect(recallItems(3).length).toBe(1); // 오늘 배운 건 오늘 묻지 않는다(기한은 내일) → 직전 화 표현 하나
    later();
    const due = recallItems(3, 2).map((r) => r.en);
    expect(due.length).toBe(2);
    for (const en of due) expect([...eps[0].learn, ...eps[1].learn].map((l) => l.en)).toContain(en);
  });
  test('듣기 문항 2개 이상이면 CEFR 듣기 증거가 남는다(처음 볼 때만)', () => {
    completeEpisode(eps[0], 80, 3);
    completeEpisode(eps[0], 90, 3);
    const ev = JSON.parse(localStorage.getItem('va_cefr_evidence') || '[]');
    expect(ev.filter((e: { skill: string }) => e.skill === 'listening').length).toBe(1);
  });
  test('드라마를 보면 레슨의 실전 단계도 완료', () => {
    startProgram({ why: 't', minutes: 25 });
    completeEpisode(eps[0], 100);
    expect(todayPlan()!.blocks.find((b) => b.key === 'field')!.done).toBe(true);
  });
});

describe('v1.31 — 오답 복습·난이도 적응·표현 재활용', () => {
  test('틀린 문장이 복습 카드(드라마)로 들어가고 다음 화 첫머리에 나온다', async () => {
    const { recallItems } = await import('../../lib/drama');
    completeEpisode(eps[0], 33, 3, [{ en: 'Yes, I can hear you clearly.', kr: '잘 들린다고 답하기' }]);
    const weak = load<{ en: string; cat?: string; lesson?: string }[]>('va_weak', []);
    expect(weak.find((w) => w.en === 'Yes, I can hear you clearly.')).toMatchObject({ cat: '드라마', lesson: 'drama:1' });
    later();
    const asked = recallItems(2, 5).map((r) => r.en);
    expect(asked).toContain('Yes, I can hear you clearly.');
  });
  test('정답과 거의 같은 문장은 복습 보기로 쓰지 않는다(정답이 둘로 보이지 않게)', async () => {
    const { recallItems } = await import('../../lib/drama');
    completeEpisode(eps[0], 50, 2, [{ en: "Yes, it's my first day.", kr: '첫 출근이라고 답하기' }]);
    for (const r of recallItems(2, 5)) {
      if (r.en === "It's my first day.") expect(r.opts).not.toContain("Yes, it's my first day.");
      if (r.en === "Yes, it's my first day.") expect(r.opts).not.toContain("It's my first day.");
    }
  });
  test('이번 화에서 틀린 문장은 이번 화 첫머리에 묻지 않는다(앞 화 것만)', async () => {
    const { recallItems } = await import('../../lib/drama');
    completeEpisode(eps[2], 33, 3, [{ en: 'Missed in three.', kr: '3화 오답' }]);
    later();
    expect(recallItems(3, 5).map((r) => r.en)).not.toContain('Missed in three.');
    expect(recallItems(4, 5).map((r) => r.en)).toContain('Missed in three.');
  });
  test('최근 두 화 이해도가 낮으면 다음 AI 화는 한 단계 쉽게, 높으면 한 단계 어렵게', async () => {
    const { dramaLevel } = await import('../../lib/drama');
    expect(dramaLevel('B1')).toBe('B1');
    expect(completeEpisode(eps[0], 20, 3).levelChange).toBe(0);
    expect(completeEpisode(eps[1], 30, 3).levelChange).toBe(-1);
    expect(dramaLevel('B1')).toBe('A2');
    expect(dramaLevel('A1')).toBe('A1'); // 바닥
    completeEpisode(eps[2], 90, 3);
    expect(completeEpisode(eps[3], 100, 3).levelChange).toBe(1);
    expect(dramaLevel('B1')).toBe('B1');
  });
  test('다시 본 화·문항이 적은 화는 난이도 판단에 쓰지 않는다', async () => {
    const { dramaLevel } = await import('../../lib/drama');
    completeEpisode(eps[0], 10, 3);
    completeEpisode(eps[0], 10, 3); // 다시 보기
    completeEpisode(eps[1], 10, 1); // 문항 1개
    expect(dramaLevel('B1')).toBe('B1');
  });
  test('이야기 속에 다시 나온 지난 표현을 맞히면 간격 반복 한 번으로 채점', async () => {
    const { gradeRecycled } = await import('../../lib/drama');
    completeEpisode(eps[0], 100, 3); // "It's my first day.", "Hang in there." 카드(기한=내일)
    later();
    const hit = gradeRecycled('Okay. Hang in there, everyone!', true, 3);
    expect(hit).toEqual(['Hang in there.']);
    const w = load<{ en: string; box: number }[]>('va_weak', []).find((x) => x.en === 'Hang in there.')!;
    expect(w.box).toBe(1);
    // 같은 화에서 배운 표현은 채점하지 않는다
    expect(gradeRecycled("It's my first day.", true, 1)).toEqual([]);
  });
  test('AI 원고: 요청 레벨보다 문장이 너무 길면 거부', () => {
    const long = 'We should carefully review every single line of the monthly invoice before the meeting tomorrow';
    const scenes = eps[0].scenes.map((s) => (s.type === 'line' ? { ...s, en: long } : s));
    expect(validateEpisode({ ...eps[0], scenes }, 8, 'A2')).toBeNull();
    expect(validateEpisode({ ...eps[0], scenes }, 8, 'B2')).not.toBeNull();
    expect(validateEpisode(eps[0], 8, 'A1')).not.toBeNull();
  });
  test('손상된 진행 기록(done이 배열 등)이어도 죽지 않는다', () => {
    localStorage.setItem('va_drama', JSON.stringify({ done: [1, 2], score: 'x', hist: 'y', adj: 9 }));
    expect(watched()).toEqual([]);
    expect(nextEpisodeNo()).toBe(1);
    localStorage.setItem('va_drama_eps', JSON.stringify([null, { no: 8 }, 'bad']));
    expect(allEpisodes().map((e) => e.no)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('v1.31 비평 반영 — 복습 루프·하루 한 편·레벨 증거·검증', () => {
  test('오늘의 추천: 처음엔 새 화, 오늘 봤으면 복습/다시 듣기(다음 화는 보너스)', async () => {
    const { dramaPlan } = await import('../../lib/drama');
    expect(dramaPlan().kind).toBe('next');
    completeEpisode(eps[0], 40, 3);
    const p = dramaPlan();
    expect(p.today).toBe(true);
    expect(p.kind).toBe('replay'); // 오늘 배운 카드는 내일부터 → 떠올릴 게 없으면 자막 없이 다시 듣기
    expect(p.replayNo).toBe(1);
    later();
    expect(dramaPlan().kind).toBe('next'); // 다음 날엔 다시 새 화(표현 복습은 보조)
    expect(dramaPlan().due).toBe(2);
  });
  test('키 없이 7화를 다 봤으면 막다른 8화 대신 복습', async () => {
    const { dramaPlan } = await import('../../lib/drama');
    for (const e of eps) completeEpisode(e, 80, 3);
    later();
    const p = dramaPlan();
    expect(p.needAi).toBe(true);
    expect(p.nextNo).toBe(8);
    expect(p.kind).toBe('review');
  });
  test('표현 복습 세션 — 기한 된 카드만, 오래 밀린 것부터, 안 본 화 표현은 보기에 없다', async () => {
    const { reviewItems } = await import('../../lib/drama');
    expect(reviewItems()).toEqual([]);
    completeEpisode(eps[0], 100, 3);
    later();
    const r = reviewItems();
    expect(r.map((x) => x.en).sort()).toEqual(eps[0].learn.map((l) => l.en).sort());
    const unseen = eps.slice(1).flatMap((e) => e.learn.map((l) => l.en));
    for (const it of r) {
      expect(it.opts.length).toBe(3);
      for (const o of it.opts) expect(unseen).not.toContain(o);
    }
  });
  test('다시 본 화·표현 복습도 오늘의 연습(불꽃·퀘스트)', async () => {
    const { dramaPracticedToday } = await import('../../lib/homeLite');
    localStorage.setItem('va_drama', JSON.stringify({ done: { 1: '2026-01-01' }, score: { 1: 50 } }));
    expect(dramaPracticedToday()).toBe(false);
    completeEpisode(eps[0], 90, 3); // 다시 보기
    expect(watchedToday()).toBe(false);
    expect(dramaPracticedToday()).toBe(true);
  });
  test('원고의 B1 문항 성적 → B1 듣기 증거(드라마만 해도 다음 레벨 진척)', () => {
    completeEpisode(eps[4], 100, 4, [], { A2: { asked: 3, ok: 3 }, B1: { asked: 1, ok: 1 } });
    const ev = JSON.parse(localStorage.getItem('va_cefr_evidence') || '[]') as { skill: string; level: string; score: number }[];
    expect(ev.some((e) => e.skill === 'listening' && e.level === 'B1' && e.score === 100)).toBe(true);
    expect(ev.some((e) => e.skill === 'listening' && e.level === 'A2')).toBe(true);
  });
  test('원고 4~7화에 B1 문항, 2~7화엔 지난 표현이 문항 정답으로 다시 나온다', () => {
    for (const no of [4, 5, 6, 7]) expect(eps[no - 1].scenes.some((s) => (s as { level?: string }).level === 'B1'), `EP${no}`).toBe(true);
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
    for (const no of [2, 3, 4, 5, 6, 7]) {
      const earlier = eps.slice(0, no - 1).flatMap((e) => e.learn.map((l) => norm(l.en)));
      const answers = eps[no - 1].scenes.flatMap((s) =>
        s.type === 'meaning' ? [s.en] : s.type === 'fill' ? [`${s.before} ${s.opts[s.a]} ${s.after}`] : s.type === 'choice' ? s.opts.filter((o) => o.ok).map((o) => o.en) : []
      );
      expect(answers.some((a) => earlier.some((l) => ` ${norm(a)} `.includes(` ${l} `))), `EP${no}`).toBe(true);
    }
  });
  test('검증기: 고른 대사 뜻(kr) 필수, 오늘의 표현은 이야기에 나와야, 지난 표현 재등장 요구', () => {
    const base = eps[0];
    const noKr = base.scenes.map((s) => (s.type === 'choice' ? { ...s, opts: s.opts.map(({ kr: _k, ...o }) => o) } : s));
    expect(validateEpisode({ ...base, scenes: noKr }, 8)).toBeNull();
    expect(validateEpisode({ ...base, learn: [{ en: 'Totally unrelated phrase.', kr: '무관', note: '' }] }, 8)).toBeNull();
    expect(validateEpisode(base, 8, 'A2', ['Could I get an iced americano, please?'])).toBeNull();
    expect(validateEpisode(base, 8, 'A2', ["It's my first day."])).not.toBeNull(); // 1화 choice 정답에 들어 있다
  });
});

describe('간격 반복 시뮬레이션 — 표현 복습이 box 1에서 멈추지 않는다(감사 v1.31 G34)', () => {
  test('30일 동안 하루 한 편 + 표현 복습(다 맞힘) → 카드 절반 넘게 box 3 이상', async () => {
    const { reviewItems, gradeRecall } = await import('../../lib/drama');
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = new Date('2026-10-01T09:00:00').getTime();
    for (let day = 0; day < 30; day++) {
      vi.setSystemTime(start + day * 86400000);
      if (day < eps.length) completeEpisode(eps[day], 90, 3);
      for (const it of reviewItems(8)) gradeRecall(it.en, true);
    }
    const cards = load<{ cat?: string; box: number }[]>('va_weak', []).filter((w) => w.cat === '드라마');
    const strong = cards.filter((w) => w.box >= 3).length;
    expect(cards.length).toBe(eps.length * 2);
    expect(strong / cards.length).toBeGreaterThan(0.5);
  });
});
