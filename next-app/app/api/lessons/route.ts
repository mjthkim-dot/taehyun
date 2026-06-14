import { NextResponse } from 'next/server';
import type { Lesson } from '../../../lib/storage';

/**
 * 샘플 레슨 API — 실제로는 DB/Notion 등에서 조회한다.
 * useOfflineLessons 가 이 응답을 받아 IndexedDB 에 캐싱한다.
 */
const LESSONS: Lesson[] = [
  {
    id: 1,
    title: '기초 문법 & 발음',
    date: '2026-05-28',
    sentences: [
      { en: 'I eat rice every day.', kr: '나는 매일 밥을 먹는다.' },
      { en: "She doesn't drink coffee.", kr: '그녀는 커피를 마시지 않는다.' },
      { en: 'What do you do on weekends?', kr: '주말에 무엇을 합니까?' },
    ],
  },
  {
    id: 2,
    title: '관사 & 과거 시제',
    date: '2026-06-03',
    sentences: [
      { en: 'I went to the store to buy a shaver.', kr: '면도기를 사러 가게에 갔다.' },
      { en: "I didn't eat breakfast today.", kr: '오늘 아침을 먹지 않았다.' },
    ],
  },
];

export async function GET() {
  return NextResponse.json(LESSONS);
}
