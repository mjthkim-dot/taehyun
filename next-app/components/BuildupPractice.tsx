'use client';

/**
 * 문장 빌드업 드릴(스픽 벤치마크) — 긴 문장을 한 번에 말하게 하지 않고,
 * 문장 끝에서부터 구간을 쌓아 올리며(backchaining) 여러 번 발화하게 한다:
 *   "for the delay." → "apologize for the delay." → "I want to apologize for the delay."
 * 끝에서부터 쌓으면 문장 끝 억양이 자연스럽게 유지된다(통역 훈련의 표준 기법).
 * 각 구간을 발음 채점으로 통과해야 다음 구간이 열리고, 마지막(전체 문장) 통과가
 * 미션의 '말하기' 단계 완료로 이어진다. 발화 횟수가 문장당 1회 → 2~3회로 늘어난다.
 */
import { useEffect, useMemo, useState } from 'react';
import SpeakingPractice from './SpeakingPractice';
import { useLessonStore } from '../store/useLessonStore';
import { SPEAK_PASS_SCORE } from '../lib/missionProgress';
import { CheckIcon } from './icons';

/** 문장을 끝에서부터 쌓아 올리는 구간들로 나눈다. 짧으면 [전체]만. */
export function buildupStages(sentence: string): string[] {
  const words = sentence.trim().split(/\s+/);
  const tail = (n: number) => words.slice(-n).join(' ');
  if (words.length <= 4) return [sentence.trim()];
  if (words.length <= 8) return [tail(4), sentence.trim()];
  return [tail(4), tail(8), sentence.trim()];
}

export default function BuildupPractice({ sentence, prompt }: { sentence: string; prompt?: string }) {
  const stages = useMemo(() => buildupStages(sentence), [sentence]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [sentence]);

  const accuracyScore = useLessonStore((s) => s.accuracyScore);
  const currentSentence = useLessonStore((s) => s.currentSentence);

  // 현재 구간을 통과 점수로 넘기면 잠깐 여운을 주고 다음 구간으로.
  useEffect(() => {
    if (accuracyScore >= SPEAK_PASS_SCORE && currentSentence === stages[idx] && idx < stages.length - 1) {
      const t = setTimeout(() => setIdx((i) => Math.min(i + 1, stages.length - 1)), 700);
      return () => clearTimeout(t);
    }
  }, [accuracyScore, currentSentence, idx, stages]);

  return (
    <div className="buildup">
      {stages.length > 1 && (
        <div className="buildup-steps">
          {stages.map((s, i) => (
            <button
              type="button"
              key={i}
              className={`buildup-step${i === idx ? ' active' : ''}${i < idx ? ' done' : ''}`}
              onClick={() => setIdx(i)}
            >
              {i < idx && <CheckIcon size={11} />}
              {i === stages.length - 1 ? '전체 문장' : `구간 ${i + 1}`}
            </button>
          ))}
          <span className="buildup-hint">끝에서부터 쌓아 올리기</span>
        </div>
      )}
      <SpeakingPractice
        key={`${sentence}:${idx}`}
        sentence={stages[idx]}
        prompt={idx === stages.length - 1 ? prompt : undefined}
      />
    </div>
  );
}
