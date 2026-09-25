/**
 * 최소대립쌍 훈련 — 발음 진단이 짚어준 축을 실제로 고치는 자리.
 *
 * 진단만으로는 발음이 바뀌지 않는다. "R/L이 어긋났다"는 말을 듣고 나면 다음에
 * 필요한 것은 **그 두 소리만 다른 단어를 번갈아 말해 보는 연습**이다. 소리 하나로
 * 뜻이 갈리는 짝(minimal pair)을 붙여 놓으면 귀가 먼저 차이를 잡고, 그다음 입이
 * 따라온다 — 발음 교정에서 오래 검증된 방식이다.
 *
 * 예문은 이 앱을 쓰는 맥락(클라우드·IT 영업)에서 실제로 말하게 될 문장으로 골랐다.
 * 훈련이 끝난 뒤 그 문장이 미팅에서 그대로 쓰이는 것이 목적이라, 발음 교재용
 * 무의미 문장(The cat sat on the mat) 대신 업무 문장을 쓴다.
 */
import type { LapseKey } from './pronunciation';

export interface MinimalPair {
  /** 목표 소리를 가진 단어 */
  a: string;
  /** 한국어 화자가 대신 내기 쉬운 단어 */
  b: string;
  aKr: string;
  bKr: string;
  /** a가 들어간 실전 문장 — 훈련이 곧바로 업무 발화가 되도록 */
  sentence: { en: string; kr: string };
}

const PAIRS: Partial<Record<LapseKey, MinimalPair[]>> = {
  'r-l': [
    { a: 'right', b: 'light', aKr: '맞는', bKr: '가벼운/빛', sentence: { en: "You're right about the timeline.", kr: '일정에 대해서는 말씀이 맞습니다.' } },
    { a: 'cloud', b: 'crowd', aKr: '클라우드', bKr: '군중', sentence: { en: "We're moving the workloads to the cloud this quarter.", kr: '이번 분기에 워크로드를 클라우드로 옮깁니다.' } },
    { a: 'collect', b: 'correct', aKr: '수집하다', bKr: '올바른', sentence: { en: 'We collect usage logs from every node.', kr: '모든 노드에서 사용 로그를 수집합니다.' } },
    { a: 'rate', b: 'late', aKr: '비율', bKr: '늦은', sentence: { en: 'The renewal rate went up last quarter.', kr: '지난 분기에 갱신율이 올랐습니다.' } },
    { a: 'arrive', b: 'alive', aKr: '도착하다', bKr: '살아 있는', sentence: { en: 'The signed contract should arrive by Friday.', kr: '서명된 계약서는 금요일까지 도착할 겁니다.' } },
  ],
  'f-p': [
    { a: 'file', b: 'pile', aKr: '파일', bKr: '더미', sentence: { en: "I'll send the file right after this call.", kr: '통화 끝나고 바로 파일 보내드릴게요.' } },
    { a: 'fair', b: 'pair', aKr: '공정한', bKr: '한 쌍', sentence: { en: 'I think that is a fair price for the scope.', kr: '이 범위에 대해서는 합리적인 가격이라고 봅니다.' } },
    { a: 'fast', b: 'past', aKr: '빠른', bKr: '과거', sentence: { en: 'The rollout was faster than we expected.', kr: '배포가 예상보다 빨랐습니다.' } },
    { a: 'coffee', b: 'copy', aKr: '커피', bKr: '사본', sentence: { en: 'Shall we grab coffee before the demo?', kr: '데모 전에 커피 한잔 할까요?' } },
    { a: 'feel', b: 'peel', aKr: '느끼다', bKr: '껍질을 벗기다', sentence: { en: 'I feel confident we can close this quarter.', kr: '이번 분기에 마무리할 수 있다고 봅니다.' } },
  ],
  'v-b': [
    { a: 'very', b: 'berry', aKr: '매우', bKr: '베리', sentence: { en: 'That would be very helpful, thank you.', kr: '그렇게 해주시면 큰 도움이 됩니다, 감사합니다.' } },
    { a: 'vendor', b: 'bender', aKr: '공급업체', bKr: '구부리는 것', sentence: { en: 'Our vendor handles the migration end to end.', kr: '저희 공급업체가 마이그레이션을 처음부터 끝까지 맡습니다.' } },
    { a: 'vote', b: 'boat', aKr: '표결하다', bKr: '배', sentence: { en: 'The steering committee will vote next week.', kr: '운영위원회가 다음 주에 표결합니다.' } },
    { a: 'vary', b: 'bury', aKr: '다양하다', bKr: '묻다', sentence: { en: 'Costs vary depending on the region.', kr: '비용은 리전에 따라 달라집니다.' } },
    { a: 'curve', b: 'curb', aKr: '곡선', bKr: '억제하다', sentence: { en: 'The adoption curve flattened after month three.', kr: '도입 곡선은 3개월 차 이후 완만해졌습니다.' } },
  ],
  th: [
    { a: 'three', b: 'tree', aKr: '셋', bKr: '나무', sentence: { en: 'We have three options on the table.', kr: '지금 검토 중인 선택지는 세 가지입니다.' } },
    { a: 'think', b: 'sink', aKr: '생각하다', bKr: '가라앉다', sentence: { en: 'I think we can get this over the line.', kr: '이건 마무리할 수 있다고 봅니다.' } },
    { a: 'thank', b: 'sank', aKr: '감사하다', bKr: '가라앉았다', sentence: { en: 'Thank you for the quick turnaround.', kr: '빠르게 처리해 주셔서 감사합니다.' } },
    { a: 'path', b: 'pass', aKr: '경로', bKr: '통과하다', sentence: { en: "That's the fastest path to production.", kr: '그게 운영 환경까지 가는 가장 빠른 경로입니다.' } },
    { a: 'both', b: 'boat', aKr: '둘 다', bKr: '배', sentence: { en: 'Both teams have signed off on the scope.', kr: '두 팀 모두 범위에 동의했습니다.' } },
  ],
  'z-s': [
    { a: 'rise', b: 'rice', aKr: '오르다', bKr: '쌀', sentence: { en: 'Costs rise after the first year.', kr: '비용은 1년 차 이후에 올라갑니다.' } },
    { a: 'phase', b: 'face', aKr: '단계', bKr: '얼굴', sentence: { en: "We'll roll it out in three phases.", kr: '세 단계로 나눠 배포하겠습니다.' } },
    { a: 'lose', b: 'loose', aKr: '잃다', bKr: '헐거운', sentence: { en: "I don't want to lose the momentum here.", kr: '지금의 흐름을 잃고 싶지 않습니다.' } },
    { a: 'raise', b: 'race', aKr: '올리다', bKr: '경주', sentence: { en: 'They plan to raise the budget next year.', kr: '내년에 예산을 늘릴 계획이라고 합니다.' } },
  ],
  'sh-s': [
    { a: 'she', b: 'see', aKr: '그녀', bKr: '보다', sentence: { en: 'She leads the platform engineering team.', kr: '그분이 플랫폼 엔지니어링 팀을 이끕니다.' } },
    { a: 'ship', b: 'sip', aKr: '출시하다', bKr: '홀짝이다', sentence: { en: 'We ship updates every two weeks.', kr: '저희는 2주마다 업데이트를 내보냅니다.' } },
    { a: 'sheet', b: 'seat', aKr: '시트/표', bKr: '좌석', sentence: { en: "I'll share the sheet with the numbers.", kr: '숫자가 담긴 시트를 공유드릴게요.' } },
    { a: 'shift', b: 'sift', aKr: '변화', bKr: '거르다', sentence: { en: "There's been a shift in their priorities.", kr: '그쪽 우선순위에 변화가 있었습니다.' } },
  ],
  'ch-j': [
    { a: 'cheap', b: 'jeep', aKr: '저렴한', bKr: '지프', sentence: { en: "The entry tier isn't cheap, but it scales well.", kr: '엔트리 등급이 저렴하진 않지만 확장성이 좋습니다.' } },
    { a: 'chair', b: 'share', aKr: '의장을 맡다', bKr: '공유하다', sentence: { en: 'Who will chair the review meeting?', kr: '검토 회의는 누가 진행하시나요?' } },
    { a: 'charge', b: 'large', aKr: '요금', bKr: '큰', sentence: { en: 'There is no extra charge for support.', kr: '지원에는 추가 요금이 없습니다.' } },
  ],
  'vowel-long': [
    { a: 'reach', b: 'rich', aKr: '연락하다', bKr: '부유한', sentence: { en: "Let's reach out to their security team first.", kr: '먼저 그쪽 보안팀에 연락해 보시죠.' } },
    { a: 'leave', b: 'live', aKr: '남기다', bKr: '살다', sentence: { en: "I'll leave the deck with you to review.", kr: '검토하시도록 자료를 남겨드리겠습니다.' } },
    { a: 'feel', b: 'fill', aKr: '느끼다', bKr: '채우다', sentence: { en: 'Let me know how you feel about the terms.', kr: '조건에 대해 어떻게 생각하시는지 알려주세요.' } },
    { a: 'least', b: 'list', aKr: '최소한', bKr: '목록', sentence: { en: 'At least three teams are already using it.', kr: '최소 세 팀이 이미 사용 중입니다.' } },
  ],
  'vowel-ae-e': [
    { a: 'bad', b: 'bed', aKr: '나쁜', bKr: '침대', sentence: { en: "The latency isn't bad at all for this region.", kr: '이 리전 기준으로는 지연이 전혀 나쁘지 않습니다.' } },
    { a: 'sand', b: 'send', aKr: '모래', bKr: '보내다', sentence: { en: "I'll send the revised quote today.", kr: '수정 견적서를 오늘 보내드리겠습니다.' } },
    { a: 'end', b: 'and', aKr: '끝', bKr: '그리고', sentence: { en: "Let's wrap this up by the end of the month.", kr: '이번 달 안으로 마무리하시죠.' } },
  ],
  vowel: [
    { a: 'bug', b: 'bag', aKr: '버그', bKr: '가방', sentence: { en: 'We fixed that bug in last night’s release.', kr: '그 버그는 어젯밤 릴리스에서 고쳤습니다.' } },
    { a: 'cut', b: 'cat', aKr: '줄이다', bKr: '고양이', sentence: { en: 'They had to cut the budget by fifteen percent.', kr: '예산을 15% 줄여야 했다고 합니다.' } },
    { a: 'much', b: 'match', aKr: '많이', bKr: '맞다', sentence: { en: 'How much would that add to the monthly cost?', kr: '월 비용에 얼마나 더해질까요?' } },
  ],
  'final-consonant': [
    { a: 'back', b: 'bag', aKr: '뒤로/다시', bKr: '가방', sentence: { en: "I'll get back to you by end of day.", kr: '오늘 안으로 회신드리겠습니다.' } },
    { a: 'right', b: 'ride', aKr: '맞는', bKr: '타다', sentence: { en: "That's the right approach for your team size.", kr: '팀 규모를 보면 그 방식이 맞습니다.' } },
    { a: 'lock', b: 'log', aKr: '잠그다', bKr: '기록', sentence: { en: "Let's lock the scope before we price it.", kr: '가격을 내기 전에 범위를 확정하시죠.' } },
    { a: 'card', b: 'cart', aKr: '카드', bKr: '카트', sentence: { en: 'We can put it on the corporate card.', kr: '법인 카드로 결제할 수 있습니다.' } },
  ],
  voicing: [
    { a: 'bag', b: 'back', aKr: '가방', bKr: '뒤로', sentence: { en: 'Could you bring that back to your team?', kr: '그 건을 팀에 다시 전달해 주실 수 있을까요?' } },
    { a: 'seed', b: 'seat', aKr: '씨앗', bKr: '좌석', sentence: { en: 'We added ten more seats to the plan.', kr: '플랜에 좌석 10개를 추가했습니다.' } },
    { a: 'proved', b: 'proof', aKr: '입증했다', bKr: '증거', sentence: { en: 'The pilot proved the performance claims.', kr: '파일럿에서 성능 수치가 입증됐습니다.' } },
  ],
};

/** 이 축에 훈련 세트가 있는가 — 없는 축(누락·기타)은 버튼을 감춘다. */
export function hasDrill(key: string): boolean {
  return (PAIRS[key as LapseKey]?.length ?? 0) > 0;
}

export function pairsFor(key: string): MinimalPair[] {
  return PAIRS[key as LapseKey] ?? [];
}

/** 드릴 큐로 넘길 문장들 — 훈련이 곧 실전 문장 연습이 되게 한다. */
export function drillItemsFor(key: string): { en: string; kr: string }[] {
  return pairsFor(key).map((p) => p.sentence);
}
