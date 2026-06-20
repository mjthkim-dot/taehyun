'use client';

/**
 * 앱 셸 — 기존 voice-assistant/index.html 의 8탭 하단 네비게이션을 React로 재구성.
 * 단계적 전환: 레슨/드릴 탭은 실제 데이터로 동작하고, 나머지는 ComingSoon 플레이스홀더.
 */
import { useState } from 'react';
import NavBar, { type Mode } from '../components/NavBar';
import StudyScreen, { defaultLesson } from '../components/StudyScreen';
import DrillScreen from '../components/DrillScreen';
import ComingSoon from '../components/ComingSoon';

const TAB_TITLE: Record<Mode, string> = {
  master: '홈',
  study: '레슨',
  drill: '드릴',
  talk: '회화',
  video: '영상',
  review: '복습',
  progress: '진도',
  features: '기능',
};

export default function Page() {
  const [mode, setMode] = useState<Mode>('study');
  const [lessonId, setLessonId] = useState<number>(defaultLesson().id);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>🗣️ PREPLY AI 코치</h1>
      </header>

      <div className="app-content">
        {mode === 'study' && <StudyScreen lessonId={lessonId} onSelectLesson={setLessonId} />}
        {mode === 'drill' && <DrillScreen lessonId={lessonId} />}
        {mode !== 'study' && mode !== 'drill' && <ComingSoon label={TAB_TITLE[mode]} />}
      </div>

      <NavBar mode={mode} onChange={setMode} />
    </main>
  );
}
