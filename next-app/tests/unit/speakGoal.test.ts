/**
 * M3 불꽃 연료 교체 — 발화 목표(lib/speakGoal: 10 → 20 → +5/7일 → 35, 키 없음 10·가중 1.0, 캡 확정, 주간 5/7 프리즈),
 * bumpSpoken(weight, kind) 채점/자기확인 분리 집계, flameState 집중 분기(lit = 발화 ≥ 목표 · 반불꽃 = 에피소드만 ·
 * 짧은 날 ×0.5 · 적응일 ×0.6), homeLite dramaPlan 'speak'·'ladder'·사다리 정산, 홈 경량 모듈의 import 금지 목록.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import seed from '../../data/dramaSeed.json';
import { bumpSpoken, load, speakGoalLite, spokenToday } from '../../lib/state';
import { capSpeakGoalToday, speakGoal } from '../../lib/speakGoal';
import { getFreezeCount, getQuests } from '../../lib/habits';
import { flameState } from '../../lib/streak';
import { advanceLadder, dramaPlan, ladderState, speakLine } from '../../lib/homeLite';
import { completeEpisode, type Episode } from '../../lib/drama';
import { shiftKey, todayKey } from '../../lib/dates';

const eps = (seed as unknown as { episodes: Episode[] }).episodes;
const KEY = () => localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key'));
beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

/** day일째(0부터) 아침으로 시계를 옮긴다 */
const START = new Date('2026-10-01T09:00:00').getTime();
const at = (day: number) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START + day * 86400000);
};
/** 그날 n문장 말하기(채점 1.0) */
const speak = (n: number) => {
  for (let k = 0; k < n; k++) bumpSpoken();
};

describe('bumpSpoken(weight?, kind?) — 채점/자기확인 분리 집계', () => {
  test('기존 호출(인자 없음)은 1.0·scored — va_spoken·va_spoken_log·va_speak_goal.scoredToday', () => {
    KEY();
    bumpSpoken();
    bumpSpoken();
    expect(spokenToday()).toBe(2);
    expect(load<Record<string, number>>('va_spoken_log', {})[todayKey()]).toBe(2);
    expect(load<{ scoredToday: number; selfToday: number }>('va_speak_goal', { scoredToday: 0, selfToday: 0 })).toMatchObject({ scoredToday: 2, selfToday: 0 });
  });
  test('키 있음: 자기확인 0.5 · 직접 준 가중(조용히 0.5)', () => {
    KEY();
    bumpSpoken(undefined, 'self');
    bumpSpoken(undefined, 'self');
    bumpSpoken(0.5, 'self');
    bumpSpoken();
    expect(spokenToday()).toBe(2.5);
    expect(load<{ scoredToday: number; selfToday: number }>('va_speak_goal', { scoredToday: 0, selfToday: 0 })).toMatchObject({ scoredToday: 1, selfToday: 1.5 });
  });
  test('키 없는 구간: 자기확인도 1.0(그 구간엔 자기확인이 유일한 경로)', () => {
    bumpSpoken(undefined, 'self');
    bumpSpoken(undefined, 'self');
    expect(spokenToday()).toBe(2);
    expect(load<{ selfToday: number; keyless: boolean }>('va_speak_goal', { selfToday: 0, keyless: false })).toMatchObject({ selfToday: 2, keyless: true });
  });
  test('speakGoalLite가 읽는 goal·kind 필드는 유지된다', () => {
    KEY();
    speakGoal();
    bumpSpoken();
    expect(speakGoalLite()).toEqual({ goal: 10, kind: 'scored' });
  });
});

describe('speakGoal — 10 → 20 → 25 → 30 → 35(상한)', () => {
  test('첫 14일 10, 15일째 20, 목표를 7일 연속 채울 때마다 +5, 35에서 멈춘다', () => {
    KEY();
    const goals: number[] = [];
    for (let day = 0; day < 60; day++) {
      at(day);
      localStorage.setItem('va_days', JSON.stringify([todayKey(new Date(START))]));
      const g = speakGoal().goal;
      goals.push(g);
      speak(g); // 매일 목표만큼 말한다
    }
    expect(goals.slice(0, 14).every((g) => g === 10)).toBe(true);
    expect(goals[14]).toBe(20);
    expect(goals[20]).toBe(20);
    expect(goals[21]).toBe(25); // 15~21일째 7일 연속 달성
    expect(goals[28]).toBe(30);
    expect(goals[35]).toBe(35);
    expect(Math.max(...goals)).toBe(35);
    expect(goals[59]).toBe(35);
  });
  test('하루 빠지면 연속일이 0으로 — 가산은 그대로(목표가 다시 내려가지 않는다)', () => {
    KEY();
    for (let day = 0; day < 22; day++) {
      at(day);
      localStorage.setItem('va_days', JSON.stringify([todayKey(new Date(START))]));
      speak(speakGoal().goal);
    }
    at(22);
    expect(speakGoal()).toMatchObject({ goal: 25, streakDays: 22 });
    at(24); // 22일째 말하고, 23일째 비움
    const st = speakGoal();
    expect(st.streakDays).toBe(0);
    expect(st.goal).toBe(25);
  });
  test('키 없는 구간은 10 고정·kind self(자기확인이 기본)', () => {
    at(0);
    localStorage.setItem('va_days', JSON.stringify([shiftKey(todayKey(), -40)]));
    expect(speakGoal()).toMatchObject({ goal: 10, kind: 'self', keyless: true });
    KEY();
    expect(speakGoal()).toMatchObject({ goal: 20, kind: 'scored', keyless: false });
  });
  test('20분 캡 — 그날 목표를 지금 발화 수로 확정(내려가기만, 최소 1), 다음 날엔 원래대로', () => {
    KEY();
    at(0);
    localStorage.setItem('va_days', JSON.stringify([shiftKey(todayKey(), -40)]));
    expect(speakGoal().goal).toBe(20);
    speak(13);
    expect(capSpeakGoalToday().goal).toBe(13);
    expect(speakGoal().goal).toBe(13); // 같은 날 다시 계산해도 확정값
    expect(flameState().level).toBe('lit');
    at(1);
    const st = speakGoal();
    expect(st.goal).toBe(20);
    expect(st.streakDays).toBe(1); // 캡 확정일은 달성으로 센다
  });
  test('주간 발화 목표 5/7일 → 프리즈 1개(주 1회)', () => {
    KEY();
    for (let day = 0; day < 6; day++) {
      at(day);
      speak(speakGoal().goal);
    }
    expect(getFreezeCount()).toBe(1);
    at(6);
    speakGoal();
    expect(getFreezeCount()).toBe(1); // 같은 주에는 한 번만
  });
  test('집중 모드 퀘스트의 발화 목표 = 저장된 발화 목표', () => {
    KEY();
    at(0);
    localStorage.setItem('va_days', JSON.stringify([shiftKey(todayKey(), -40)]));
    speakGoal();
    const q = getQuests().find((x) => x.id === 'speak')!;
    expect(q.goal).toBe(20);
  });
});

describe('날짜 경계 — 어제 기록은 어제 값으로(A5·A6·A7)', () => {
  test('A5: 캡 다음 날 첫 발화(bumpSpoken)가 어제의 낮춘 목표·capped를 오늘로 복사하지 않고, 어제 캡 보호는 남긴다', () => {
    KEY();
    at(0);
    localStorage.setItem('va_days', JSON.stringify([shiftKey(todayKey(), -40)]));
    expect(speakGoal().goal).toBe(20);
    speak(5);
    expect(capSpeakGoalToday().goal).toBe(5);
    at(1);
    speak(1); // 드라마를 열기 전 다른 화면(단어 퀴즈 등)에서 먼저 말했다
    const raw = load<Record<string, unknown>>('va_speak_goal', {});
    expect(raw.capped).toBe(false);
    expect(raw.goal).toBe(20); // 캡 전 목표로 돌아간다
    expect(speakGoalLite().goal).toBe(20);
    expect((raw.prev as { date: string; capped: boolean }).capped).toBe(true);
    const st = speakGoal();
    expect(st.goal).toBe(20);
    expect(st.capped).toBe(false);
    expect(st.streakDays).toBe(1); // 어제는 캡(5)으로 확정 — 달성
  });
  test('A6: 짧은 날(×0.5)·적응일(×0.6)에 감면된 목표를 채웠으면 다음 날 정산에서도 달성', () => {
    KEY();
    at(0);
    localStorage.setItem('va_days', JSON.stringify([shiftKey(todayKey(), -40)]));
    speakGoal();
    const d0 = todayKey();
    localStorage.setItem('va_day_gov', JSON.stringify({ date: d0, mode: 'short' }));
    speak(10); // 20 × 0.5 = 10 — 홈 불꽃은 켜졌다
    expect(flameState().level).toBe('lit');
    at(1);
    const d1 = todayKey();
    // 하루 조절기가 날을 넘기며 어제를 hist로 옮긴 모양
    localStorage.setItem('va_day_gov', JSON.stringify({ date: d1, mode: 'normal', adapt: true, hist: { [d0]: { mode: 'short' } } }));
    speak(12); // 20 × 0.6 = 12
    expect(speakGoal().streakDays).toBe(1);
    at(2);
    localStorage.setItem('va_day_gov', JSON.stringify({ date: todayKey(), mode: 'normal', hist: { [d0]: { mode: 'short' }, [d1]: { mode: 'normal', adapt: true } } }));
    expect(speakGoal().streakDays).toBe(2);
  });
  test('A7: 어제 키 없이(목표 10) 채우고 오늘 아침 키를 등록해도 어제는 10 기준으로 판정', () => {
    at(0);
    localStorage.setItem('va_days', JSON.stringify([shiftKey(todayKey(), -40)]));
    speakGoal();
    for (let k = 0; k < 10; k++) bumpSpoken(undefined, 'self'); // 키 없는 구간 — 자기확인 1.0
    expect(load<{ kl: boolean }>('va_speak_goal', { kl: false }).kl).toBe(true);
    at(1);
    KEY(); // 아침에 키 등록
    expect(speakGoal().streakDays).toBe(1); // 예전엔 오늘 키 기준(20)으로 어제를 판정해 연속이 끊겼다
  });
  test('A7: 키 등록 후 첫 발화가 정산보다 먼저여도(prev) 어제 키 유무를 쓴다', () => {
    at(0);
    localStorage.setItem('va_days', JSON.stringify([shiftKey(todayKey(), -40)]));
    speakGoal();
    for (let k = 0; k < 10; k++) bumpSpoken(undefined, 'self');
    at(1);
    KEY();
    bumpSpoken();
    const raw = load<Record<string, unknown>>('va_speak_goal', {});
    expect(raw.keyless).toBe(false); // 오늘은 키 있음
    expect((raw.prev as { keyless: boolean }).keyless).toBe(true);
    expect(speakGoal().streakDays).toBe(1);
  });
});

describe('flameState 집중 분기 — 연료는 발화', () => {
  test('에피소드만 보면 반불꽃(ember·half), 발화 ≥ 목표면 lit', () => {
    KEY();
    speakGoal();
    completeEpisode(eps[0], 90, 3);
    let f = flameState();
    expect(f.focus).toBe(true);
    expect(f.level).toBe('ember');
    expect(f.half).toBe(true);
    speak(9);
    expect(flameState().level).toBe('ember');
    speak(1);
    f = flameState();
    expect(f).toMatchObject({ level: 'lit', spoken: 10, goal: 10 });
  });
  test('짧은 날(M4 va_day_gov short) 목표 ×0.5, 적응 발동일 ×0.6', () => {
    KEY();
    localStorage.setItem('va_speak_goal', JSON.stringify({ goal: 20, kind: 'scored' }));
    localStorage.setItem('va_day_gov', JSON.stringify({ date: todayKey(), mode: 'short' }));
    expect(flameState().goal).toBe(10);
    localStorage.setItem('va_day_gov', JSON.stringify({ date: todayKey(), adapt: true }));
    expect(flameState().goal).toBe(12);
    localStorage.setItem('va_day_gov', JSON.stringify({ date: '2020-01-01', mode: 'short' }));
    expect(flameState().goal).toBe(20); // 다른 날 값은 무시
  });
  test('전체 모드는 예전 그대로(에피소드 한 편이면 lit)', () => {
    localStorage.setItem('va_mode', JSON.stringify('full'));
    completeEpisode(eps[0], 90, 3);
    expect(flameState().level).toBe('lit');
  });
});

describe("homeLite — dramaPlan 'speak'·'ladder', 발화 줄", () => {
  test("오늘 봤고 발화 < 목표 → 'speak', 목표를 채우면 예전 분기", () => {
    KEY();
    completeEpisode(eps[0], 50, 3);
    expect(dramaPlan()).toMatchObject({ kind: 'speak', spoken: 0, goal: 10 });
    speak(10);
    expect(dramaPlan().kind).toBe('replay');
  });
  test("키 없이 원고를 다 보면 'ladder' 0.9 → 1.0 → 1.2(이해도 60% 이상만 오른다), 3단 통과 = 귀 뚫림", () => {
    // 시청을 0일째에 고정 — 실제 시계로 기록하면 실제 오늘이 START+2와 같은 날(2026-10-03) '오늘 본 것'이 되어 실패했다
    at(0);
    for (const e of eps) completeEpisode(e, 80, 3);
    at(2);
    const p = dramaPlan();
    expect(p.kind).toBe('ladder');
    const no = p.ladder!.no;
    expect(p.ladder).toMatchObject({ speed: 0.9, step: 0 });
    expect(advanceLadder(no, 0.9, 40).step).toBe(0); // 이해도 미달 — 그대로
    expect(advanceLadder(no, 1.2, 100).step).toBe(0); // 다른 속도로 들은 건 단이 아니다
    expect(advanceLadder(no, 0.9, 70)).toMatchObject({ step: 1, speed: 1 });
    expect(advanceLadder(no, 1, 60)).toMatchObject({ step: 2, speed: 1.2 });
    expect(advanceLadder(no, 1.2, 90)).toMatchObject({ step: 3, done: true });
    // 사다리를 마쳤는데 발화 목표 전 → 말하기(복습이 있으면 말로 떠올리기)
    expect(dramaPlan().kind).toBe('speak');
    speak(10);
    expect(['review', 'replay']).toContain(dramaPlan().kind);
    at(3);
    expect(ladderState(no)).toMatchObject({ step: 0, done: false }); // 다음 날은 처음부터
  });
  test("발화 줄 — 점 4개(키 없는 8일차+는 '다시 듣기'), 반불꽃", () => {
    at(0); // 날짜에 따라 결과가 바뀌지 않게(위 사다리 테스트와 같은 이유)
    completeEpisode(eps[0], 90, 3);
    let l = speakLine();
    expect(l.dots.map((d) => d.label)).toEqual(['에피소드', '리텔', '회상', '회화']);
    expect(l.dots[0].on).toBe(true);
    expect(l.half).toBe(true);
    for (const e of eps) completeEpisode(e, 80, 3);
    at(2);
    l = speakLine();
    expect(l.dots[0].label).toBe('다시 듣기');
  });
  test('홈 경량 모듈(homeLite·DramaCard·MasterScreen·streak)은 habits·drama·words·speakGoal·원고를 import하지 않는다', () => {
    const root = path.resolve(__dirname, '../..');
    const files = ['lib/homeLite.ts', 'components/DramaCard.tsx', 'lib/streak.ts'];
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      const imports = [...src.matchAll(/^import[^;]*from '([^']+)'/gm)].map((m) => m[1]);
      for (const bad of ['habits', '/drama', 'words', 'speakGoal', 'dramaSeed']) {
        expect(imports.some((i) => i.endsWith(bad) || i.includes(`${bad}.`)), `${f} → ${bad}`).toBe(false);
      }
    }
    const master = fs.readFileSync(path.join(root, 'components/MasterScreen.tsx'), 'utf8');
    expect(master).not.toMatch(/from '\.\.\/lib\/(drama|words|speakGoal)'/);
  });
});
