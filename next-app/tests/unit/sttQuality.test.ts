import { describe, expect, test } from 'vitest';
import { assessQuality, blockingReason, echoMatch, gate, gateMessage, logprobMean } from '../../lib/sttQuality';

/**
 * 전사 품질 게이트 — 채점 전에 "믿어도 되는 전사인가"를 가른다.
 * 임계: silent = 세그먼트 과반 no_speech_prob > 0.6, unclear = avg_logprob 평균 < -1 또는
 * compression_ratio > 2.4, echo = 직전 TTS와 ≥80% 일치, busy = 429 재시도 실패.
 */
const seg = (o: Partial<{ start: number; end: number; avg_logprob: number; no_speech_prob: number; compression_ratio: number }> = {}) => ({
  start: 0,
  end: 2,
  avg_logprob: -0.3,
  no_speech_prob: 0.05,
  compression_ratio: 1.4,
  ...o,
});

describe('품질 게이트', () => {
  test('ok — 또렷한 발화', () => {
    expect(gate({ text: 'We found the reason and fixed it.', segments: [seg(), seg({ start: 2, end: 4 })] })).toBe('ok');
    expect(assessQuality({ text: 'We found it.', segments: [seg()] })).toEqual({ ok: true, reason: null, logprobMean: -0.3 });
  });

  test('silent — 세그먼트 과반이 no_speech_prob > 0.6(무음 환각)', () => {
    expect(gate({ text: 'Thank you.', segments: [seg({ no_speech_prob: 0.9 })] })).toBe('silent');
    // 3개 중 2개 → 과반
    expect(gate({ text: 'Thanks for watching.', segments: [seg({ no_speech_prob: 0.7 }), seg({ no_speech_prob: 0.8 }), seg()] })).toBe('silent');
    // 2개 중 1개는 과반이 아니다
    expect(gate({ text: 'We found it together.', segments: [seg({ no_speech_prob: 0.7 }), seg()] })).toBe('ok');
    // 경계값 0.6은 넘지 않은 것
    expect(gate({ text: 'We found it together.', segments: [seg({ no_speech_prob: 0.6 })] })).toBe('ok');
  });

  test('unclear — avg_logprob 평균 < -1 또는 compression_ratio > 2.4', () => {
    expect(gate({ text: 'We found it together.', segments: [seg({ avg_logprob: -1.2 })] })).toBe('unclear');
    // 평균이 기준 — 하나만 나빠도 평균이 -1 위면 통과
    expect(gate({ text: 'We found it together.', segments: [seg({ avg_logprob: -1.5 }), seg({ avg_logprob: -0.2 })] })).toBe('ok');
    expect(gate({ text: 'We found it it it it it it.', segments: [seg({ compression_ratio: 2.6 })] })).toBe('unclear');
    expect(gate({ text: 'We found it together.', segments: [seg({ compression_ratio: 2.4 })] })).toBe('ok');
  });

  test('echo — 직전 TTS 텍스트와 80% 이상 일치(스피커 누출)', () => {
    const tts = 'Who made the mistake with the servers?';
    expect(echoMatch('Who made the mistake with the servers?', tts)).toBe(100);
    expect(gate({ text: 'Who made the mistake with the servers?', segments: [seg()] }, tts)).toBe('echo');
    // 한 단어 빠져도 80% 넘으면 누출
    expect(gate({ text: 'Who made the mistake with servers?', segments: [seg()] }, tts)).toBe('echo');
    // 답변(다른 문장)은 통과
    expect(gate({ text: 'It was our team. We found the reason and fixed it.', segments: [seg()] }, tts)).toBe('ok');
    // 짧은 전사("Yes.")는 누출로 보지 않는다 — 우연 일치가 흔하다
    expect(gate({ text: 'Yes.', segments: [seg()] }, 'Yes.')).toBe('ok');
  });

  test('busy — 429 재시도 후에도 실패', () => {
    expect(gate({ text: '', reason: 'busy' })).toBe('busy');
    expect(assessQuality({ text: '', reason: 'busy' })).toEqual({ ok: false, reason: 'busy', logprobMean: 0 });
  });

  test('세그먼트 없음(기본 json·브라우저 인식) — 텍스트 유무와 echo만 본다', () => {
    expect(gate({ text: 'We found it together.' })).toBe('ok');
    expect(gate({ text: '' })).toBe('silent');
    expect(gate({ text: '   ' })).toBe('silent');
    expect(gate({ text: 'Who made the mistake with the servers?' }, 'Who made the mistake with the servers?')).toBe('echo');
    expect(logprobMean(undefined)).toBe(0);
  });

  test('lastTtsText 없음 — echo 판정을 하지 않는다(따라 말하기 경로)', () => {
    expect(gate({ text: 'Hang in there, buddy.', segments: [seg()] })).toBe('ok');
    expect(gate({ text: 'Hang in there, buddy.', segments: [seg()] }, '')).toBe('ok');
    expect(echoMatch('Hang in there, buddy.', undefined)).toBe(0);
  });

  test('판정 우선순위 — busy > silent > echo > unclear', () => {
    const tts = 'Who made the mistake with the servers?';
    expect(gate({ text: tts, reason: 'busy', segments: [seg({ no_speech_prob: 0.9 })] }, tts)).toBe('busy');
    expect(gate({ text: tts, segments: [seg({ no_speech_prob: 0.9, avg_logprob: -2 })] }, tts)).toBe('silent');
    expect(gate({ text: tts, segments: [seg({ avg_logprob: -2 })] }, tts)).toBe('echo');
  });

  test('blockingReason — busy·unclear·echo는 늘 막고, silent는 세그먼트가 있을 때만(빈 전사는 호출부 기존 처리로)', () => {
    expect(blockingReason({ text: '', reason: 'busy' })).toBe('busy');
    expect(blockingReason({ text: 'We found it.', segments: [seg({ avg_logprob: -2 })] })).toBe('unclear');
    expect(blockingReason({ text: 'Thank you.', segments: [seg({ no_speech_prob: 0.9 })] })).toBe('silent');
    expect(blockingReason({ text: '' })).toBeNull(); // 세그먼트 없는 빈 전사 → 브라우저 인식 재시도 경로
    expect(blockingReason({ text: 'We found it.', segments: [seg()] })).toBeNull();
    // 이미 계산된 quality가 있으면 그것을 쓴다
    expect(blockingReason({ text: 'x y z', quality: { ok: false, reason: 'echo', logprobMean: 0 } })).toBe('echo');
  });

  test('학습자 문구 — 네 가지 모두 한국어, ok는 빈 문자열', () => {
    for (const r of ['silent', 'unclear', 'echo', 'busy'] as const) expect(gateMessage(r)).toMatch(/[가-힣]/);
    expect(gateMessage('ok')).toBe('');
    expect(gateMessage(null)).toBe('');
  });
});
