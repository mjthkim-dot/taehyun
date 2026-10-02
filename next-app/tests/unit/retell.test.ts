import { beforeEach, describe, expect, test } from 'vitest';
import {
  RETELL_SCHEDULE, LISTENERS, RETELL_GUIDES, MARKERS, DAILY_QUESTIONS, MIX_ROUND, ROUND_333,
  retellPhase, retellPlanFor, keywordsOf, markersFor, dailyQuestionFor, dailyQuestionDue, weeklyMixDue,
  scoreRetell, usedLearn, saveRetell, retellHistory, retelledToday,
  firstSundayOf, monthly333Due, daysSinceStart, pauseMarks, countFillers, dailyQScore,
} from '../../lib/retell';

const EP = {
  no: 1, level: 'A2', recap: '첫 출근날 엘리베이터가 멈췄다.', cliff: '엘리베이터에서 만난 Diane이 CEO였다!',
  learn: [{ en: "It's my first day.", kr: '오늘 첫 출근이에요.' }, { en: 'Hang in there.', kr: '조금만 버텨요.' }],
};
const KW = [
  { kr: '엘리베이터', en: ['elevator', 'lift'] },
  { kr: '멈췄다', en: ['stuck', 'broken', 'stopped'] },
  { kr: 'CEO', en: ['ceo', 'boss'] },
  { kr: '긴장', en: ['nervous'] },
];

describe('retell — 정적 콘텐츠', () => {
  test('시간표 3세트: first14 1회 20초, A2 45/30/20, B1+ 60/45/30', () => {
    expect(RETELL_SCHEDULE.first14.rounds.map((r) => r.sec)).toEqual([20]);
    expect(RETELL_SCHEDULE.first14.rounds[0].label).toBe('3문장 20초');
    expect(RETELL_SCHEDULE.A2.rounds.map((r) => r.sec)).toEqual([45, 30, 20]);
    expect(RETELL_SCHEDULE['B1+'].rounds.map((r) => r.sec)).toEqual([60, 45, 30]);
    // 기본 카드엔 1회차만, 나머지는 '조금 더 ▾'
    for (const s of Object.values(RETELL_SCHEDULE)) expect(s.rounds.filter((r) => r.basic)).toHaveLength(1);
    expect(MIX_ROUND.sec).toBe(60);
    expect(ROUND_333.map((r) => r.sec)).toEqual([30, 30, 30]);
  });
  test('청자 3명·안내 7개·표지 6개·질문 템플릿 6개', () => {
    expect(LISTENERS.map((l) => l.id)).toEqual(['maya', 'jun', 'diane']);
    for (const l of LISTENERS) expect(l.kr).toMatch(/[가-힣]/);
    expect(Object.keys(RETELL_GUIDES)).toHaveLength(7);
    expect(RETELL_GUIDES.short).toContain('3문장');
    expect(MARKERS).toHaveLength(6);
    expect(DAILY_QUESTIONS).toHaveLength(6);
    for (const q of DAILY_QUESTIONS) { expect(q.en).toBeTruthy(); expect(q.kr).toMatch(/[가-힣]/); }
  });
});

describe('retell — phase 경계 14일', () => {
  test('0~14일은 first14, 15일부터 레벨로', () => {
    expect(retellPhase(0, 'A2')).toBe('first14');
    expect(retellPhase(14, 'A2')).toBe('first14');
    expect(retellPhase(15, 'A2')).toBe('A2');
    expect(retellPhase(15, 'B1')).toBe('B1+');
    expect(retellPhase(100, 'B2')).toBe('B1+');
  });
  test('A1은 일차와 무관하게 first14', () => {
    expect(retellPhase(60, 'A1')).toBe('first14');
  });
});

describe('retell — 계획·질문 요일', () => {
  test('월·수·금만 질문, 토요일은 교차', () => {
    expect(dailyQuestionDue('2026-10-05')).toBe(true); // 월
    expect(dailyQuestionDue('2026-10-06')).toBe(false); // 화
    expect(dailyQuestionDue('2026-10-07')).toBe(true); // 수
    expect(dailyQuestionDue('2026-10-09')).toBe(true); // 금
    expect(dailyQuestionDue('2026-10-10')).toBe(false); // 토
    expect(weeklyMixDue('2026-10-10')).toBe(true);
    expect(weeklyMixDue('2026-10-09')).toBe(false);
  });
  test('질문은 변수가 치환되고 20초', () => {
    const q = dailyQuestionFor(EP, '2026-10-05');
    expect(q).not.toBeNull();
    expect(q!.sec).toBe(20);
    expect(q!.en).not.toMatch(/\{\w+\}/);
    expect(q!.kr).not.toMatch(/\{\w+\}/);
    expect(dailyQuestionFor(EP, '2026-10-06')).toBeNull();
  });
  test('retellPlanFor: 회차·키워드·표지 2개·청자·질문', () => {
    const p = retellPlanFor({ ...EP, keywords: KW }, 20, '2026-10-07');
    expect(p.phase).toBe('A2');
    expect(p.rounds).toHaveLength(3);
    expect(p.rounds.map((r) => r.listener.id)).toEqual(['maya', 'jun', 'diane']);
    expect(p.listener.id).toBe('maya');
    expect(p.keywords).toEqual(KW);
    expect(p.markers).toHaveLength(2);
    expect(p.markers[0].en).not.toBe(p.markers[1].en);
    expect(p.question).not.toBeNull();
    expect(markersFor('2026-10-07')).toEqual(p.markers);
    // 첫 2주: 키워드 3개·short 안내·질문 없음(화요일)
    const s = retellPlanFor({ ...EP, keywords: KW }, 3, '2026-10-06');
    expect(s.phase).toBe('first14');
    expect(s.keywords).toHaveLength(3);
    expect(s.guide).toBe(RETELL_GUIDES.short);
    expect(s.question).toBeNull();
  });
  test('keywordsOf 폴백: learn 2 + 인물명', () => {
    const k = keywordsOf(EP, 4);
    expect(k).toHaveLength(4);
    expect(k[0].en).toEqual(["It's my first day."]);
    expect(k[2].en[0]).toMatch(/maya|jun|diane/);
    expect(keywordsOf({ ...EP, keywords: [] }, 3)).toHaveLength(3);
  });
});

describe('retell — scoreRetell', () => {
  const markers = markersFor('2026-10-07');
  const learn = EP.learn.map((l) => l.en);
  test('전부 맞히고 시간 안 → 100', () => {
    const said = `${markers[0].en} it's my first day and the elevator got stuck. ${markers[1].en} I was really nervous. The CEO said hang in there.`;
    const r = scoreRetell({ said, keywords: KW, markers, learn, durationMs: 30000, wpm: 70, targetSec: 45 });
    expect(r.keywordHits).toBe(4);
    expect(r.markerHits).toBe(2);
    expect(r.learnHits).toBe(2);
    expect(r.score).toBe(100);
    expect(r.chips).toContain('키워드 4/4');
    expect(r.chips).toContain('표지 ✓');
    expect(r.chips).toContain('45초 안 ✓');
  });
  test('절반 — 키워드 2/4, 표현 1/2, 표지 0, 시간 안', () => {
    const said = 'The lift was broken. It is my first day. Hang in there, I said.';
    const r = scoreRetell({ said, keywords: KW, markers, learn, durationMs: 20000, wpm: 50, targetSec: 45 });
    expect(r.keywordHits).toBe(2);
    expect(r.learnHits).toBe(1); // "It is my first day" ≠ "It's my first day" — 그대로 써야 표현으로 친다
    expect(r.markerHits).toBe(0);
    // 40*0.5 + 30*0.5 + 0 + 20 = 55
    expect(r.score).toBe(55);
    expect(r.chips).toContain('표지 –');
    expect(usedLearn("it's my first day, hang in there", learn)).toHaveLength(2);
  });
  test('빈 발화·너무 짧음 → 0, 항목 없는 축은 분모에서 제외', () => {
    const r = scoreRetell({ said: '', keywords: KW, markers, learn, durationMs: 1000, wpm: 0, targetSec: 20 });
    expect(r.score).toBe(0);
    expect(r.chips).toContain('너무 짧아요');
    // learn 없음(AI 화) + 키워드 전부 + 시간 안 = 40+10+20 = 70/70 → 100
    const ok = scoreRetell({ said: 'elevator stuck ceo nervous first then', keywords: KW, markers: [MARKERS[0], MARKERS[1]], learn: [], durationMs: 15000, wpm: 60, targetSec: 20 });
    expect(ok.score).toBe(100);
    // 시간 초과는 10점
    const over = scoreRetell({ said: 'elevator', keywords: [KW[0]], markers: [], learn: [], durationMs: 40000, wpm: 60, targetSec: 20 });
    expect(over.score).toBe(Math.round(((40 + 10) / 60) * 100));
  });
});

describe('retell — va_retell', () => {
  beforeEach(() => localStorage.clear());
  test('저장·최근 n일·오늘 여부, 60건 상한', () => {
    saveRetell({ date: '2026-10-01', epNo: 1, round: 'short', wpm: 55, score: 70, durationMs: 18000 });
    saveRetell({ date: '2026-10-07', epNo: 2, round: 1, wpm: 60, score: 80, durationMs: 40000 });
    // n일 = 오늘 포함 n일(7일이면 10-01~10-07)
    expect(retellHistory(6, '2026-10-07')).toHaveLength(1);
    expect(retellHistory(7, '2026-10-07')).toHaveLength(2);
    expect(retelledToday(2, '2026-10-07')).toBe(true);
    expect(retelledToday(1, '2026-10-07')).toBe(false);
    for (let i = 0; i < 70; i++) saveRetell({ date: '2026-10-08', epNo: 3, round: 2, wpm: 1, score: 1, durationMs: 1 });
    expect(JSON.parse(localStorage.getItem('va_retell')!)).toHaveLength(60);
  });
});


describe('retell — 월 1회 3/3/3·시작일·표시 도우미', () => {
  beforeEach(() => localStorage.clear());
  test('첫째 일요일 계산', () => {
    expect(firstSundayOf('2026-10-02')).toBe('2026-10-04');
    expect(firstSundayOf('2026-11-15')).toBe('2026-11-01');
  });
  test('첫째 일요일 이후, 그 달 333 기록이 없으면 due', () => {
    expect(monthly333Due('2026-10-03', [])).toBe(false);
    expect(monthly333Due('2026-10-04', [])).toBe(true);
    expect(monthly333Due('2026-10-20', [{ date: '2026-10-05', epNo: 3, round: '333', wpm: 60, score: 70, durationMs: 30000 }])).toBe(false);
    expect(monthly333Due('2026-11-02', [{ date: '2026-10-05', epNo: 3, round: '333', wpm: 60, score: 70, durationMs: 30000 }])).toBe(true);
  });
  test('daysSinceStart — speakGoal.since → va_days 가장 이른 날 → 오늘', () => {
    expect(daysSinceStart('2026-10-02')).toBe(0);
    localStorage.setItem('va_days', JSON.stringify(['2026-09-20', '2026-09-10']));
    expect(daysSinceStart('2026-10-02')).toBe(22);
    localStorage.setItem('va_speak_goal', JSON.stringify({ since: '2026-09-28' }));
    expect(daysSinceStart('2026-10-02')).toBe(4);
  });
  test('pauseMarks — 300ms 이상 간격 뒤에 멈춤', () => {
    const w = [
      { word: 'I', start: 0, end: 0.2 },
      { word: 'was', start: 0.25, end: 0.4 },
      { word: 'nervous', start: 1.0, end: 1.4 },
    ];
    expect(pauseMarks(w).map((t) => t.pauseAfter)).toEqual([false, true, false]);
  });
  test('countFillers — 표지로 고른 actually는 빼고', () => {
    expect(countFillers('um actually I like it, uh', [])).toBe(4);
    expect(countFillers('um actually I like it, uh', ['actually', 'so'])).toBe(3);
  });
  test('dailyQScore — 20단어면 100', () => {
    expect(dailyQScore(0)).toBe(0);
    expect(dailyQScore(10)).toBe(50);
    expect(dailyQScore(40)).toBe(100);
  });
});
