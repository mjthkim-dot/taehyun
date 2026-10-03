import { describe, expect, test } from 'vitest';
import { diagnose, LAPSE_TIPS } from '../../lib/pronunciation';

describe('pronunciation.diagnose — 한국인 혼동축 핵심 6케이스(M9)', () => {
  test('work → walk는 R/L', () => {
    const issues = diagnose('I work from home.', 'I walk from home.');
    expect(issues.length).toBe(1);
    expect(issues[0].key).toBe('r-l');
    expect(issues[0].target).toBe('work');
    expect(issues[0].heard).toBe('walk');
    expect(issues[0].label).toBe(LAPSE_TIPS['r-l'].label);
  });

  test('coffee → copy는 F/P', () => {
    const issues = diagnose('Shall we grab coffee?', 'Shall we grab copy?');
    expect(issues.map((i) => i.key)).toEqual(['f-p']);
  });

  test('very → berry는 V/B', () => {
    const issues = diagnose('That would be very helpful.', 'That would be berry helpful.');
    expect(issues.map((i) => i.key)).toEqual(['v-b']);
  });

  test('three → tree는 TH', () => {
    const issues = diagnose('We have three options.', 'We have tree options.');
    expect(issues.map((i) => i.key)).toEqual(['th']);
  });

  test('단어가 아예 빠지면 omission(관사·전치사는 각각의 축)', () => {
    const missing = diagnose('We collect usage logs.', 'We usage logs.');
    expect(missing.map((i) => i.key)).toEqual(['omission']);
    expect(missing[0].target).toBe('collect');
    expect(missing[0].heard).toBe('');
    const article = diagnose('Send the file.', 'Send file.');
    expect(article.map((i) => i.key)).toEqual(['article']);
  });

  test('정답이면 빈 배열(대소문자·문장부호 무시), 빈 입력도 빈 배열', () => {
    expect(diagnose('We ship updates every two weeks.', 'we ship updates every two weeks')).toEqual([]);
    expect(diagnose('Hello.', '')).toEqual([]);
    expect(diagnose('', 'hello')).toEqual([]);
  });
});
