'use client';

/**
 * 데일리 퀘스트 — 오늘 할 일 3개(미션 완주·문장 연습·복습 채점)와 XP.
 * 전부 기존 학습 데이터로 계산하며, 달성분은 하루 1회 XP로 적립된다.
 * refreshKey가 바뀌면(미션 완료 등) 즉시 재계산해 그 자리에서 채워진다.
 */
import { useEffect, useState } from 'react';
import { getQuests, awardQuestXp, weeklyXp, type Quest } from '../lib/habits';
import { CheckIcon } from './icons';

export default function DailyQuests({ refreshKey = 0 }: { refreshKey?: number }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [xp, setXp] = useState(0);
  const [week, setWeek] = useState<{ label: string; xp: number; today: boolean }[]>([]);

  useEffect(() => {
    setQuests(getQuests());
    setXp(awardQuestXp());
    setWeek(weeklyXp());
  }, [refreshKey]);

  if (!quests.length) return null;
  const maxWeek = Math.max(...week.map((w) => w.xp), 1);

  return (
    <div className="quests">
      <div className="quests-head">
        <span className="quests-title">오늘의 퀘스트</span>
        <span className="quests-xp">+{xp} XP</span>
      </div>
      {quests.map((q) => (
        <div className={`quest-row${q.done ? ' done' : ''}`} key={q.id}>
          <span className="quest-check">{q.done ? <CheckIcon size={13} /> : null}</span>
          <div className="quest-main">
            <div className="quest-label">{q.label}</div>
            {q.note ? (
              <div className="quest-note">{q.note}</div>
            ) : (
              <div className="quest-bar">
                <div className="quest-bar-fill" style={{ width: `${(q.progress / q.goal) * 100}%` }} />
              </div>
            )}
          </div>
          <span className="quest-meta">
            {q.done ? `+${q.xp}` : `${q.progress}/${q.goal}`}
          </span>
        </div>
      ))}
      <div className="quests-week">
        {week.map((w, i) => (
          <div className="qw-col" key={i}>
            <div className="qw-bar">
              <div className={`qw-fill${w.today ? ' today' : ''}`} style={{ height: `${Math.max((w.xp / maxWeek) * 100, w.xp > 0 ? 8 : 0)}%` }} />
            </div>
            <span className={`qw-label${w.today ? ' today' : ''}`}>{w.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
