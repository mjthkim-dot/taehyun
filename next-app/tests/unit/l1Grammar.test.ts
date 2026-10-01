import { describe, expect, test } from 'vitest';
import { GRAMMAR_RULES, KONGLISH_RULES, L1_RULES, applyRule, detectL1 } from '../../lib/l1Grammar';

describe('L1 간섭 규칙 — 콘텐츠', () => {
  test('문법 8 + 콩글리시 10, id 유일', () => {
    expect(GRAMMAR_RULES.length).toBe(8);
    expect(KONGLISH_RULES.length).toBe(10);
    expect(new Set(L1_RULES.map((r) => r.id)).size).toBe(18);
  });
  test('규칙마다 example.wrong은 걸리고 example.right는 통과, better도 다시 걸리지 않는다', () => {
    for (const r of L1_RULES) {
      const hit = applyRule(r, r.example.wrong);
      expect(hit, `${r.id} wrong 검출`).not.toBeNull();
      expect(hit!.kr.length).toBeGreaterThan(0);
      expect(applyRule(r, r.example.right), `${r.id} right 통과`).toBeNull();
      expect(applyRule(r, hit!.better), `${r.id} better 재검출`).toBeNull();
    }
  });
  test('대표 규칙의 better 문장', () => {
    expect(applyRule(GRAMMAR_RULES[0], 'He work at Samsung.')!.better).toBe('He works at Samsung.');
    expect(applyRule(GRAMMAR_RULES[0], 'My boss have a meeting.')!.better).toBe('My boss has a meeting.');
    expect(applyRule(GRAMMAR_RULES[1], "I've been here since 3 years ago.")!.better).toBe("I've been here for 3 years.");
    expect(applyRule(GRAMMAR_RULES[3], "I'm not agree.")!.better).toBe("I don't agree.");
    expect(applyRule(GRAMMAR_RULES[7], 'No, I do.')!.better).toBe('Yes, I do.');
    expect(applyRule(KONGLISH_RULES[0], 'My hand phone is dead.')!.better).toBe('My cell phone is dead.');
    expect(applyRule(KONGLISH_RULES[7], 'I live in a one-room.')!.better).toBe('I live in a studio.');
  });
});

describe('detectL1', () => {
  test('걸린 규칙 최대 2개, 문법이 먼저', () => {
    const hits = detectL1('He work at Samsung and he use a hand phone and aircon.');
    expect(hits.length).toBe(2);
    expect(hits[0].id).toBe('third-person-s');
    expect(hits[0].wrong).toBe('He work');
    expect(hits[1].kind).toBe('konglish');
  });
  test('콩글리시 칩: wrong 구간과 고친 문장', () => {
    const [h] = detectL1('Please put your phone on manner mode.');
    expect(h.id).toBe('manner-mode');
    expect(h.wrong).toBe('manner mode');
    expect(h.better).toBe('Please put your phone on silent mode.');
  });
  test('빈 발화·한글 발화는 빈 배열', () => {
    expect(detectL1('')).toEqual([]);
    expect(detectL1('오늘 너무 피곤해요')).toEqual([]);
  });
  test('오탐 방지 — 정상 문장은 통과한다', () => {
    const ok = [
      "I've worked here since 2020.", // since + 시점
      'Does he like coffee? Make it work.', // 조동사·사역 뒤 원형
      'He arrived to find the door locked.', // 목적 부정사
      'Is it close to the station?', // close 형용사
      'Got it. Thanks for waiting.', // 관용구
      'I opened the Databricks notebook and the door handle was broken.', // 노트북 맥락·door handle
      'We offer after-sales service and customer service for every meeting.', // service/meeting 미매칭
      'The launch event is next week.', // 할인 없는 event
      "Yes, I don't mind.", // 자연스러운 긍정+부정
      "I'm so hot.", // 날씨 단서 없음 → 애매하니 통과
      'There is only one room left in the hotel.', // 한정사 없는 one room
      'Please have a rest day and think about it.', // 명령문
    ];
    for (const s of ok) expect(detectL1(s), s).toEqual([]);
  });
  test('양성 케이스 모음', () => {
    const bad: [string, string][] = [
      ['She go to work by bus.', 'third-person-s'],
      ["I've lived in Seoul since 3 years.", 'since-duration'],
      ["I'm interested at cloud.", 'prep-choice'],
      ["He's good in English.", 'prep-choice'],
      ['I am agree with that.', 'am-agree'],
      ['Went to Busan last weekend.', 'no-subject'],
      ['Was fun. Watched a movie with my son.', 'no-subject'],
      ['I need to take a rest.', 'take-a-rest'],
      ["I'm so hot today.", 'im-so-hot'],
      ["Yes, I didn't finish it.", 'neg-question-yes'],
      ['I lost my hand phone.', 'hand-phone'],
      ['I need a new notebook for the demo.', 'notebook'],
      ['Turn off the aircon, please.', 'aircon'],
      ['Pass me the remocon.', 'remocon'],
      ['I grabbed the handle while driving.', 'handle'],
      ['I called A/S for my laptop.', 'after-service'],
      ['I saw it on SNS.', 'sns'],
      ['I live in a one room.', 'one-room'],
      ['Set it to manner mode.', 'manner-mode'],
      ['The cafe has a 1+1 event today.', 'event'],
    ];
    for (const [s, id] of bad) expect(detectL1(s).map((h) => h.id), s).toContain(id);
  });
});
