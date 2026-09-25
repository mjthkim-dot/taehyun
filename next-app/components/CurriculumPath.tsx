'use client';

/**
 * 학습 경로(Path) — 듀오링고의 '길 위의 노드' 경험을 Calm Premium 톤으로 접목.
 * 커리큘럼(A1→C2)을 세로 경로로 그려 "다음 한 걸음"이 항상 명확하게 보이게 한다.
 *
 * 노드 상태:
 *  - done    : 드릴 정확도 80% 이상 달성한 유닛 (체크)
 *  - current : 경로에서 처음 만나는 미완료 유닛 — 크게 강조 + '여기부터' 라벨
 *  - todo    : 아직 안 한 유닛 (자유롭게 탭 가능 — 잠그지 않는다, 성인 학습자의 자유 유지)
 */
import { MASTER_CURRICULUM } from '../lib/curriculum';
import { getLessonStats } from '../lib/state';
import { CheckIcon, PlayIcon } from './icons';

type NodeState = 'done' | 'current' | 'todo';

export default function CurriculumPath({ onSelectUnit }: { onSelectUnit: (lessonId: number) => void }) {
  const stats = getLessonStats();

  // 유닛별 완료 판정 → 경로 전체에서 첫 미완료 유닛이 current
  const doneOf = (lessonId: number) => {
    const s = stats[lessonId];
    return !!s?.attempts && Math.round((s.correct / s.attempts) * 100) >= 80;
  };
  let currentAssigned = false;
  const levels = MASTER_CURRICULUM.map((lvl) => ({
    ...lvl,
    units: lvl.units.map((u) => {
      const done = doneOf(u.lessonId);
      let state: NodeState = done ? 'done' : 'todo';
      if (!done && !currentAssigned) {
        state = 'current';
        currentAssigned = true;
      }
      const s = stats[u.lessonId];
      const pct = s?.attempts ? Math.round((s.correct / s.attempts) * 100) : null;
      return { ...u, state, pct };
    }),
  }));

  return (
    <div className="path">
      {levels.map((lvl) => {
        const doneCount = lvl.units.filter((u) => u.state === 'done').length;
        return (
          <div className={`path-level${lvl.status === 'future' ? ' future' : ''}`} key={lvl.level}>
            <div className="path-level-head">
              <span className="path-level-badge">{lvl.cefr}</span>
              <span className="path-level-name">{lvl.name}</span>
              <span className="path-level-count">{doneCount}/{lvl.units.length}</span>
            </div>
            <div className="path-level-goal">{lvl.goal}</div>
            <div className="path-track">
              {lvl.units.map((u) => (
                <button
                  type="button"
                  className={`path-node ${u.state}`}
                  key={u.lessonId}
                  onClick={() => onSelectUnit(u.lessonId)}
                >
                  <span className="path-dot">
                    {u.state === 'done' ? <CheckIcon size={14} /> : u.state === 'current' ? <PlayIcon size={13} /> : null}
                  </span>
                  <span className="path-info">
                    {u.state === 'current' && <span className="path-here">여기부터 이어가기</span>}
                    <span className="path-title">{u.title}</span>
                    <span className="path-sub">
                      {u.sub}
                      {u.pct != null && u.state !== 'done' && <b className="path-pct"> · {u.pct}%</b>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
