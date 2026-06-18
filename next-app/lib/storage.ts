/**
 * 프롬프트 2 — IndexedDB 캐싱 유틸리티
 *
 * idb 라이브러리(https://github.com/jakearchibald/idb)를 사용해
 * 학습한 '영어 문장 세트(Lesson)'를 브라우저 IndexedDB 에 저장/조회한다.
 * 오프라인 상태에서도 이전에 받아온 레슨을 복습할 수 있도록 한다.
 *
 *   npm i idb
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/** 문장 한 개 (한↔영 쌍). 기존 voice-assistant 앱의 데이터 형태와 동일하다. */
export interface Sentence {
  en: string;
  kr: string;
}

/** 학습 단위 = 문장 세트 */
export interface Lesson {
  id: number;
  title: string;
  date: string;
  sentences: Sentence[];
  /** 마지막으로 로컬에 캐싱된 시각(ms). 조회 시 자동 기록된다. */
  cachedAt?: number;
}

interface LessonDB extends DBSchema {
  lessons: {
    key: number;
    value: Lesson;
    indexes: { 'by-date': string };
  };
}

const DB_NAME = 'preply-english-coach';
const DB_VERSION = 1;
const STORE = 'lessons';

let _dbPromise: Promise<IDBPDatabase<LessonDB>> | null = null;

/** 싱글턴 DB 핸들. SSR(window 없음) 환경에서는 호출하지 않도록 가드한다. */
function getDB(): Promise<IDBPDatabase<LessonDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in the browser'));
  }
  if (!_dbPromise) {
    _dbPromise = openDB<LessonDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('by-date', 'date');
        }
      },
    });
  }
  return _dbPromise;
}

/**
 * 문장 세트 배열을 로컬에 저장(upsert)한다.
 * 동일 id 가 있으면 덮어쓴다. 하나의 트랜잭션으로 일괄 처리한다.
 */
export async function saveLessonsToLocal(lessons: Lesson[]): Promise<void> {
  if (!lessons?.length) return;
  const db = await getDB();
  const now = Date.now();
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all([
    ...lessons.map((l) => tx.store.put({ ...l, cachedAt: now })),
    tx.done,
  ]);
}

/**
 * 로컬에 저장된 모든 문장 세트를 date 오름차순으로 반환한다.
 * 특정 id 만 필요하면 getLessonFromLocal(id) 를 사용한다.
 */
export async function getLessonsFromLocal(): Promise<Lesson[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE, 'by-date');
}

/** 단일 문장 세트 조회. 없으면 undefined. */
export async function getLessonFromLocal(id: number): Promise<Lesson | undefined> {
  const db = await getDB();
  return db.get(STORE, id);
}

/** 로컬 캐시 전체 삭제(로그아웃/초기화용). */
export async function clearLocalLessons(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}
