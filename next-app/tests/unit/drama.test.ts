import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import seed from '../../data/dramaSeed.json';
import { allEpisodes, completeEpisode, INTERACTIVE, nextEpisodeNo, validateEpisode, watched, watchedToday, type Episode } from '../../lib/drama';
import { gradeWeakItem, load, SRS_INTERVAL_DAYS, SRS_MAX_BOX, srsDue, dueWeak, isMastered, weakItems } from '../../lib/state';
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
    // M3: 불꽃 연료가 발화로 바뀌어 '오늘 봤고 발화 < 목표'면 replay 대신 speak(역할극 다시·말로 떠올리기)가 먼저다
    expect(p.kind).toBe('speak');
    expect(p.replayNo).toBe(1);
    // 발화 목표(10)를 채운 날은 예전 그대로 — 떠올릴 게 없으면 자막 없이 다시 듣기
    const { todayKey } = await import('../../lib/dates');
    localStorage.setItem('va_spoken', JSON.stringify({ date: todayKey(), count: 10 }));
    expect(dramaPlan().kind).toBe('replay');
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
    // M3: 키 없는 8일차부터는 속도 사다리(0.9×부터 자막 없이 다시 듣기)가 주 행동 — 복습은 보조 링크(due는 그대로)
    expect(p.kind).toBe('ladder');
    expect(p.ladder).toMatchObject({ step: 0, speed: 0.9, done: false });
    expect(p.due).toBeGreaterThan(0);
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

describe('M3 — 30일 시뮬: 말로 떠올리기로 바뀐 뒤에도 카드가 자란다', () => {
  test('box 0은 고르기(맞힘) → 이후 speak(70점) — 30일 뒤 절반 넘게 box 3 이상, speak 문항이 실제로 나온다', async () => {
    const { reviewItems, gradeRecall } = await import('../../lib/drama');
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = new Date('2026-10-01T09:00:00').getTime();
    let speakAsked = 0;
    for (let day = 0; day < 30; day++) {
      vi.setSystemTime(start + day * 86400000);
      if (day < eps.length) completeEpisode(eps[day], 90, 3);
      for (const it of reviewItems(8, { mode: 'speak' })) {
        if (it.mode === 'speak') {
          speakAsked++;
          gradeRecall(it.en, 70);
        } else gradeRecall(it.en, true);
      }
    }
    const cards = load<{ cat?: string; box: number }[]>('va_weak', []).filter((w) => w.cat === '드라마');
    expect(speakAsked).toBeGreaterThan(10);
    expect(cards.filter((w) => w.box >= 3).length / cards.length).toBeGreaterThan(0.5);
  });
  test('두 번째 실패(힌트로 맞힘 = hard)가 섞여도 카드가 box 1 아래로 떨어지지 않는다', async () => {
    const { reviewItems, gradeRecall } = await import('../../lib/drama');
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = new Date('2026-10-01T09:00:00').getTime();
    for (let day = 0; day < 30; day++) {
      vi.setSystemTime(start + day * 86400000);
      if (day < eps.length) completeEpisode(eps[day], 90, 3);
      reviewItems(8, { mode: 'speak' }).forEach((it, k) => (it.mode === 'speak' && k % 3 === 0 ? gradeRecall(it.en, true, { hinted: true }) : gradeRecall(it.en, it.mode === 'speak' ? 80 : true)));
    }
    const cards = load<{ cat?: string; box: number }[]>('va_weak', []).filter((w) => w.cat === '드라마');
    expect(cards.every((w) => w.box >= 1)).toBe(true);
  });
});

describe('M1 — 간격 반복 8상자·이어 보기 판·말하기 회상', () => {
  test('상자 6~8의 간격은 70·120·180일, 숙달 판정은 그대로 box≥5', () => {
    expect(SRS_MAX_BOX).toBe(8);
    expect(SRS_INTERVAL_DAYS).toMatchObject({ 6: 70, 7: 120, 8: 180 });
    localStorage.setItem('va_weak', JSON.stringify([{ en: 'Hang in there.', kr: '힘내요', box: 5, lapses: 0, due: 0 }]));
    const w0 = weakItems()[0];
    expect(isMastered(w0)).toBe(true);
    gradeWeakItem('Hang in there.', 'good');
    const w = weakItems()[0];
    expect(w.box).toBe(6);
    expect(Math.round((w.due - Date.now()) / 86400000)).toBe(70);
    expect(dueWeak().length).toBe(0);
    later(69);
    expect(dueWeak().length).toBe(0);
    later(71);
    expect(dueWeak().length).toBe(1); // 70일 뒤 다시 기한
    gradeWeakItem('Hang in there.', 'good');
    gradeWeakItem('Hang in there.', 'good');
    gradeWeakItem('Hang in there.', 'good'); // 8에서 멈춘다
    expect(weakItems()[0].box).toBe(8);
    expect(Math.round((weakItems()[0].due - Date.now()) / 86400000)).toBe(180);
    expect(Math.round((srsDue(9) - Date.now()) / 86400000)).toBe(180);
  });
  test('300일 시뮬 — 매번 맞히면 카드가 8상자(누적 252일)까지 가고 기한이 한 달 밖으로 밀린다', async () => {
    const { reviewItems, gradeRecall } = await import('../../lib/drama');
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = new Date('2026-10-01T09:00:00').getTime();
    for (let day = 0; day < 300; day++) {
      vi.setSystemTime(start + day * 86400000);
      if (day < eps.length) completeEpisode(eps[day], 90, 3);
      for (const it of reviewItems(20)) gradeRecall(it.en, true);
    }
    const cards = load<{ cat?: string; box: number; due: number }[]>('va_weak', []).filter((w) => w.cat === '드라마');
    expect(cards.length).toBe(eps.length * 2);
    expect(cards.every((w) => w.box >= 6)).toBe(true);
    expect(cards.some((w) => w.box === 8)).toBe(true);
    expect(Math.min(...cards.map((w) => w.due)) - Date.now()).toBeGreaterThan(30 * 86400000);
  });
  test('이어 보기 판(v)이 다르면 null — 옛 저장본·판 없음·다른 판 모두', async () => {
    const { loadResume, saveResume, RESUME_VERSION } = await import('../../lib/drama');
    expect(RESUME_VERSION).toBe(2);
    const base = { no: 2, i: 3, ok: 1, asked: 1, log: [{ kind: 'narr', kr: '해설' }], missed: [], retryIdx: [], rc: [], at: Date.now() };
    localStorage.setItem('va_drama_resume', JSON.stringify(base));
    expect(loadResume(2)).toBeNull();
    localStorage.setItem('va_drama_resume', JSON.stringify({ ...base, v: 1 }));
    expect(loadResume(2)).toBeNull();
    localStorage.setItem('va_drama_resume', JSON.stringify({ ...base, v: 2 }));
    expect(loadResume(2)?.i).toBe(3);
    saveResume({ no: 2, i: 4, ok: 0, asked: 0, log: [], missed: [], retryIdx: [], rc: [] });
    expect(load<{ v?: number }>('va_drama_resume', {}).v).toBe(2);
    expect(loadResume(2)?.v).toBe(2);
  });
  test('A9: 이어 보기에 역할극 넘어가기 수·결과 요약을 선택 필드로 저장/복원(없으면 0·빈 배열, 손상 줄은 버림)', async () => {
    const { loadResume, saveResume } = await import('../../lib/drama');
    const { roleSummary, roleFromSummary, speakStatsFrom } = await import('../../lib/roleStep');
    const full = { sceneIdx: 2, en: 'Is it… broken?', kr: '고장?', who: 'taeo', said: 'is it broken', score: 90, diff: [], missed: [], lapses: ['r-l' as const], tries: 1, mode: 'role' as const, skipped: false, disputed: false, self: false, passed: true, path: 'whisper' as const, audio: new Blob(['x']) };
    const skipped = { ...full, sceneIdx: 5, en: 'Thanks.', skipped: true, passed: false, score: 0 };
    saveResume({ no: 2, i: 6, ok: 0, asked: 0, log: [], missed: [], retryIdx: [], rc: [], skips: 1, roles: [roleSummary(full), roleSummary(skipped)] });
    const raw = load<{ roles: Record<string, unknown>[] }>('va_drama_resume', { roles: [] });
    expect(raw.roles[0].audio).toBeUndefined(); // 녹음은 저장하지 않는다
    const r = loadResume(2)!;
    expect(r.skips).toBe(1);
    expect(r.roles!.length).toBe(2);
    expect(speakStatsFrom(r.roles!.map(roleFromSummary))).toMatchObject({ spoken: 1, passed: 1, skipped: 1 });
    // 예전 저장본(필드 없음) — 0·빈 배열
    saveResume({ no: 2, i: 6, ok: 0, asked: 0, log: [], missed: [], retryIdx: [], rc: [] });
    expect(loadResume(2)).toMatchObject({ skips: 0, roles: [] });
    // 손상된 줄은 버린다
    localStorage.setItem('va_drama_resume', JSON.stringify({ ...load<object>('va_drama_resume', {}), roles: [{ en: 3 }, roleSummary(full)] }));
    expect(loadResume(2)!.roles!.length).toBe(1);
  });
  test('speak 모드 회상(rc)은 보기 없이 저장 → 복원 통과, choice는 여전히 보기·정답 필수', async () => {
    const { loadResume, saveResume } = await import('../../lib/drama');
    saveResume({ no: 2, i: 2, ok: 0, asked: 0, log: [], missed: [], retryIdx: [], rc: [{ en: 'Hang in there.', kr: '힘내요', mode: 'speak' } as never] });
    const r = loadResume(2);
    expect(r).not.toBeNull();
    expect(r!.rc[0]).toMatchObject({ en: 'Hang in there.', mode: 'speak', opts: [], a: 0 });
    saveResume({ no: 2, i: 2, ok: 0, asked: 0, log: [], missed: [], retryIdx: [], rc: [{ en: 'Hang in there.', kr: '힘내요', opts: ['Hang in there.', 'See you.', 'No problem.'], a: 0, mode: 'choice' }] });
    expect(loadResume(2)!.rc[0].mode).toBe('choice');
    saveResume({ no: 2, i: 2, ok: 0, asked: 0, log: [], missed: [], retryIdx: [], rc: [{ en: 'Hang in there.', kr: '힘내요', mode: 'choice' } as never] });
    expect(loadResume(2)).toBeNull(); // choice인데 보기가 없다 → 버린다
    saveResume({ no: 2, i: 2, ok: 0, asked: 0, log: [], missed: [], retryIdx: [], rc: [{ en: 'Hang in there.', kr: '힘내요', mode: 'sing' } as never] });
    expect(loadResume(2)).toBeNull(); // 모르는 모드
  });
});

describe('M2 — 역할극: answerTexts·speakStats·validateProfile·엔딩 카드 레지스트리', () => {
  test('answerTexts에 태오 line/speak가 들어가고, 지정 상대 대사는 shadow=true일 때만', async () => {
    const { answerTexts, roleTargets } = await import('../../lib/drama');
    const { mineLines } = await import('../../lib/dramaSeedMine');
    const ep1 = eps[0];
    const taeo = ep1.scenes.filter((s) => (s.type === 'line' || s.type === 'speak') && s.who === 'taeo');
    expect(taeo.length).toBeGreaterThanOrEqual(3);
    for (const s of taeo) expect(answerTexts(s)).toEqual([(s as { en: string }).en]);
    const diane = ep1.scenes.find((s) => s.type === 'line' && s.who !== 'taeo')!;
    expect(answerTexts(diane)).toEqual([]);
    expect(answerTexts(diane, true)).toEqual([(diane as { en: string }).en]);
    // roleTargets = 태오 line/speak 전부 + 지정 상대 대사(장면 번호 순, 중복 없음)
    const targets = roleTargets(ep1);
    const roleIdx = targets.filter((t) => t.kind === 'role').map((t) => t.idx);
    expect(roleIdx).toEqual(ep1.scenes.map((s, i) => ((s.type === 'line' || s.type === 'speak') && s.who === 'taeo' ? i : -1)).filter((i) => i >= 0));
    expect(targets.filter((t) => t.kind === 'mine').map((t) => t.idx)).toEqual(mineLines(1).map((m) => m.idx));
    expect(new Set(targets.map((t) => t.idx)).size).toBe(targets.length);
    expect(targets.map((t) => t.idx)).toEqual([...targets.map((t) => t.idx)].sort((a, b) => a - b));
    // 뜻·빈칸 문항에 지정된 상대 줄은 afterQuiz(퀴즈 뒤에 붙는다)
    for (const t of targets) expect(t.afterQuiz).toBe(t.kind === 'mine' && ep1.scenes[t.idx].type !== 'line');
    // 7화 전부 화당 역할극 대상 ≥ 6(태오 ≥1 + 상대 ≥5)
    for (const e of eps) expect(roleTargets(e).length, `EP${e.no}`).toBeGreaterThanOrEqual(6);
  });
  test('alignedScore를 drama.ts에서 re-export(결과는 lib/align과 동일)', async () => {
    const { alignedScore } = await import('../../lib/drama');
    const { alignedScore: a } = await import('../../lib/align');
    expect(alignedScore('We found it.', 'we found it')).toEqual(a('We found it.', 'we found it'));
  });
  test('speakStats → completeEpisode(선택 인자) → episodeSpeakStats로 읽힌다(없으면 null, 기존 호출은 그대로)', async () => {
    const { episodeSpeakStats } = await import('../../lib/drama');
    expect(episodeSpeakStats(1)).toBeNull();
    completeEpisode(eps[0], 80, 3);
    expect(episodeSpeakStats(1)).toBeNull();
    const stats = { spoken: 7, passed: 5, lapsesTop: [{ key: 'r-l', count: 2 }], disputed: 1, skipped: 1 };
    completeEpisode(eps[0], 90, 3, [], {}, stats);
    expect(episodeSpeakStats(1)).toEqual(stats);
    expect(nextEpisodeNo()).toBe(2);
  });
  test('validateProfile — gpt-oss 첫 시도만 하드(태오 ≥5줄·A1/A2 5~8단어), 재시도·다른 모델은 소프트', async () => {
    const { validateProfile, acceptByProfile, taeoLines } = await import('../../lib/validateProfile');
    // 원고 1화는 태오 줄이 4개 → 역할극 분량 미달(AI 화에만 적용되는 기준)
    expect(taeoLines(eps[0]).length).toBe(4);
    const r0 = validateProfile('openai/gpt-oss-120b', eps[0], 0);
    expect(r0.ok).toBe(false);
    expect(r0.hard).toBe(true);
    expect(acceptByProfile(r0)).toBe(false);
    const r1 = validateProfile('openai/gpt-oss-120b', eps[0], 1);
    expect(r1.hard).toBe(false);
    expect(acceptByProfile(r1)).toBe(true);
    expect(acceptByProfile(validateProfile('qwen/qwen3-32b', eps[0], 0))).toBe(true);
    expect(acceptByProfile(validateProfile('llama-3.1-8b-instant', eps[0], 0))).toBe(true);
    // 5줄·평균 5~8단어면 통과
    const good = { level: 'A2', scenes: Array.from({ length: 5 }, (_, k) => ({ type: 'line' as const, who: 'taeo', en: `I can do this ${k} times today.`, kr: '뜻' })) };
    expect(validateProfile('openai/gpt-oss-120b', good, 0).ok).toBe(true);
    // B1+는 7~12단어
    const b1 = { level: 'B1', scenes: good.scenes.map((s) => ({ ...s, en: 'Could we go over the invoice line by line this afternoon?' })) };
    expect(validateProfile('openai/gpt-oss-120b', b1, 0).ok).toBe(true);
    expect(validateProfile('openai/gpt-oss-120b', { ...b1, level: 'A2' }, 0).ok).toBe(false); // A2엔 길다
  });
  test('validateEpisode — keywords 4개(한국어)는 소프트 필드로 실리고, 모자라면 뺀다', () => {
    const ok = validateEpisode({ ...eps[0], keywords: ['첫 출근', '엘리베이터', '긴장', 'CEO가 Diane'] }, 8);
    expect(ok?.keywords).toEqual(['첫 출근', '엘리베이터', '긴장', 'CEO가 Diane']);
    expect(validateEpisode({ ...eps[0], keywords: ['하나', 2, 'three'] }, 8)?.keywords).toBeUndefined();
    expect(validateEpisode(eps[0], 8)?.keywords).toBeUndefined();
  });
  test('엔딩 카드 레지스트리 — order 정렬, basic 3장까지 기본, 나머지는 조금 더 ▾, when() false·오류는 제외', async () => {
    const { registerEndingCard, endingCards, splitEndingCards, clearEndingCards, BASIC_MAX } = await import('../../components/drama/endingRegistry');
    clearEndingCards();
    const C = () => null;
    const ctx = { ep: eps[0], dateKey: '2026-10-01', keyless: false };
    registerEndingCard({ id: 'retell', order: 10, basic: true, when: () => true, Component: C });
    registerEndingCard({ id: 'recall', order: 20, basic: true, when: () => true, Component: C });
    registerEndingCard({ id: 'sound', order: 50, basic: false, when: () => true, Component: C });
    registerEndingCard({ id: 'season', order: 80, basic: true, when: () => false, Component: C });
    registerEndingCard({ id: 'dplus7', order: 70, basic: true, when: () => true, Component: C });
    registerEndingCard({ id: 'boom', order: 5, basic: true, when: () => { throw new Error('x'); }, Component: C });
    registerEndingCard({ id: 'extra', order: 60, basic: true, when: () => true, Component: C });
    registerEndingCard({ id: 'retell', order: 10, basic: true, when: () => true, Component: C }); // 같은 id 재등록 = 덮어쓰기
    expect(endingCards().map((c) => c.id)).toEqual(['boom', 'retell', 'recall', 'sound', 'extra', 'dplus7', 'season']);
    const { basic, more } = splitEndingCards(endingCards(), ctx);
    expect(BASIC_MAX).toBe(3);
    expect(basic.map((c) => c.id)).toEqual(['retell', 'recall', 'extra']); // basic 3장(order 순), boom은 오류·season은 when false
    expect(more.map((c) => c.id)).toEqual(['sound', 'dplus7']); // 비기본 + 기본 초과분
    clearEndingCards();
    expect(splitEndingCards(endingCards(), ctx)).toEqual({ basic: [], more: [] }); // 카드 0개여도 동작
  });
});
