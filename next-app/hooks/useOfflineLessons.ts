'use client';

/**
 * 프롬프트 2 — 오프라인 우선 레슨 로딩 Hook
 *
 * 동작 방식:
 *  1) 온라인이면 /api/lessons 에서 최신 문장 세트를 받아 화면에 표시하고,
 *     동시에 IndexedDB(saveLessonsToLocal)에 캐싱한다.
 *  2) 오프라인(navigator.onLine === false)이거나 fetch 실패 시
 *     IndexedDB(getLessonsFromLocal)에서 이전에 학습한 세트를 불러온다.
 *  3) online/offline 이벤트를 구독해 네트워크 상태 변화에 자동 반응한다.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getLessonsFromLocal,
  saveLessonsToLocal,
  type Lesson,
} from '../lib/storage';

interface UseOfflineLessonsResult {
  lessons: Lesson[];
  loading: boolean;
  /** 현재 데이터 출처: 네트워크 / 로컬 캐시 */
  source: 'network' | 'cache' | null;
  isOnline: boolean;
  error: string | null;
  refresh: () => void;
}

const API_URL = '/api/lessons';

export function useOfflineLessons(): UseOfflineLessonsResult {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'network' | 'cache' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const loadFromCache = useCallback(async () => {
    try {
      const cached = await getLessonsFromLocal();
      setLessons(cached);
      setSource('cache');
      if (!cached.length) {
        setError('오프라인 상태이며 저장된 학습 세트가 없습니다.');
      }
    } catch (e) {
      setError('로컬 데이터를 불러오지 못했습니다.');
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setIsOnline(online);

    if (!online) {
      await loadFromCache();
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(API_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Lesson[] = await res.json();
      setLessons(data);
      setSource('network');
      // 백그라운드 캐싱 — 실패해도 화면 표시는 막지 않는다.
      void saveLessonsToLocal(data).catch(() => undefined);
    } catch {
      // 네트워크는 켜져 있지만 요청 실패 → 캐시 폴백
      await loadFromCache();
    } finally {
      setLoading(false);
    }
  }, [loadFromCache]);

  useEffect(() => {
    void load();

    const goOnline = () => {
      setIsOnline(true);
      void load();
    };
    const goOffline = () => {
      setIsOnline(false);
      void loadFromCache();
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [load, loadFromCache]);

  return { lessons, loading, source, isOnline, error, refresh: load };
}
