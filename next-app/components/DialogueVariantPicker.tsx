'use client';

/**
 * 대화 선택 칩 — [원본] [변형…] [🎲 새 대화] 를 보여주고, 선택/생성된 대화를
 * 부모(대화 플레이어)에 넘긴다. StudyScreen(레슨)과 DialoguePractice(숙제) 양쪽에서
 * 같은 UI/동작을 공유한다. 생성한 대화는 레슨별로 저장돼 다시 들을 수 있다.
 */
import { useEffect, useRef, useState } from 'react';
import type { Dialogue, Lesson } from '../lib/lessons';
import { loadLessons } from '../lib/lessonData';
import { generateDialogueVariant, loadVariants, removeVariant, saveVariant, MAX_VARIANTS } from '../lib/dialogueVariants';
import { groqKey } from '../lib/state';
import { GroqError } from '../lib/groq';

export default function DialogueVariantPicker({
  lessonId,
  original,
  onChange,
}: {
  lessonId: number;
  original: Dialogue;
  /** 활성 대화가 바뀔 때(선택/생성/삭제) 호출 — 재생 중이면 부모가 멈추고 교체한다. */
  onChange: (d: Dialogue) => void;
}) {
  const [variants, setVariants] = useState<Dialogue[]>([]);
  const [active, setActive] = useState(0); // 0 = 원본, 1.. = 변형 index+1
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    setVariants(loadVariants(lessonId));
    setActive(0);
    setError('');
    setHasKey(!!groqKey());
  }, [lessonId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function pick(idx: number) {
    setActive(idx);
    onChange(idx === 0 ? original : variants[idx - 1]);
  }

  async function generate() {
    // 이벤트 핸들러라 비동기 로드가 자연스럽다 — 게이트 밖(홈 미션 대화)에서도 안전
    const { ALL_LESSONS } = await loadLessons();
    const lesson: Lesson | undefined = ALL_LESSONS.find((l) => l.id === lessonId);
    if (!lesson || busy) return;
    setBusy(true);
    setError('');
    try {
      const d = await generateDialogueVariant(lesson, variants);
      if (!mountedRef.current) return;
      const list = saveVariant(lessonId, d);
      setVariants(list);
      const idx = list.length; // 방금 추가된 변형 선택
      setActive(idx);
      onChange(list[idx - 1]);
    } catch (err) {
      if (!mountedRef.current) return;
      const e = err as Error;
      setError(e instanceof GroqError && e.message === 'NO_GROQ_KEY'
        ? '⚡ 회화 탭에서 무료 Groq 키를 등록하면 새 대화를 만들 수 있어요.'
        : `❌ ${e.message}`);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  function removeActive() {
    if (active === 0) return;
    if (!window.confirm('이 대화를 삭제할까요?')) return;
    const list = removeVariant(lessonId, active - 1);
    setVariants(list);
    setActive(0);
    onChange(original);
  }

  return (
    <div className="dlgv">
      <div className="dlgv-chips">
        <button type="button" className={`dlgv-chip${active === 0 ? ' active' : ''}`} onClick={() => pick(0)}>
          원본
        </button>
        {variants.map((v, i) => (
          <button
            type="button"
            key={i}
            className={`dlgv-chip${active === i + 1 ? ' active' : ''}`}
            onClick={() => pick(i + 1)}
            title={v.title}
          >
            🎲 {i + 1}
          </button>
        ))}
        {hasKey && variants.length < MAX_VARIANTS && (
          <button type="button" className="dlgv-chip dlgv-new" onClick={generate} disabled={busy}>
            {busy ? '⏳ 만드는 중…' : '🎲 새 대화'}
          </button>
        )}
        {active > 0 && (
          <button type="button" className="dlgv-chip dlgv-del" onClick={removeActive} title="이 대화 삭제">
            🗑
          </button>
        )}
      </div>
      {error && <div className="dlgv-error">{error}</div>}
      {!hasKey && variants.length === 0 && (
        <div className="dlgv-hint">💡 Groq 키를 등록하면 이 상황에 맞는 새 원어민 대화를 계속 만들어 들을 수 있어요.</div>
      )}
    </div>
  );
}
