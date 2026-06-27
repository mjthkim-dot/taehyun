'use client';

/**
 * "꾹 눌러 물어보기" — 학습 화면 어디서든 영어 텍스트를 길게 눌러(모바일) 또는
 * 드래그해(데스크탑) 선택하면 그 위에 "🤔 물어보기" 버튼이 뜨고, 누르면 하단
 * 시트가 올라와 AI 튜터가 한국어 설명 + 영어 예문으로 답해준다.
 *
 * 전역에 한 번만 마운트해 모든 화면(회화·레슨·표현장 등)의 텍스트 선택에 반응한다.
 * 선택 감지는 표준 Selection API(selectionchange)로 하고, 입력창(input/textarea)
 * 안의 선택과 시트 자체 안의 선택은 무시한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ASK_MODES, askModeDef, buildAskMessages, addAskHistory, type AskAnswer, type AskMode } from '../lib/askPrompts';
import { groqComplete, GroqError } from '../lib/groq';
import { addPhrase, groqKey } from '../lib/state';
import { speakText, primeAudio } from './SpeakButton';

interface Trigger {
  x: number;
  y: number;
  text: string;
}

// 선택된 텍스트가 "물어볼 만한" 영어인지 — 영문자가 있고 너무 짧거나 길지 않을 때만.
function isAskable(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 240) return false;
  return /[A-Za-z]/.test(t);
}

function selectionInExcludedArea(): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  let node: Node | null = sel.anchorNode;
  while (node) {
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
      if (el.classList.contains('ask-sheet') || el.classList.contains('ask-trigger')) return true;
    }
    node = node.parentNode;
  }
  return false;
}

export default function AskWidget() {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [mode, setMode] = useState<AskMode>('meaning');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [error, setError] = useState('');
  const [freeText, setFreeText] = useState('');
  const [saved, setSaved] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshTrigger = useCallback(() => {
    if (open) return; // 시트가 떠 있으면 트리거를 다시 띄우지 않는다
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setTrigger(null);
      return;
    }
    const text = sel.toString();
    if (!isAskable(text) || selectionInExcludedArea()) {
      setTrigger(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setTrigger(null);
      return;
    }
    // 선택 영역 위쪽 가운데에 버튼을 띄운다(화면 밖으로 나가지 않게 클램프).
    const x = Math.min(Math.max(rect.left + rect.width / 2, 70), window.innerWidth - 70);
    const y = Math.max(rect.top - 8, 44);
    setTrigger({ x, y, text: text.trim() });
  }, [open]);

  useEffect(() => {
    const onSelChange = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(refreshTrigger, 200);
    };
    const onScroll = () => setTrigger(null);
    document.addEventListener('selectionchange', onSelChange);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('selectionchange', onSelChange);
      window.removeEventListener('scroll', onScroll, true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshTrigger]);

  const run = useCallback(async (p: string, m: AskMode, free?: string) => {
    setLoading(true);
    setError('');
    setAnswer(null);
    try {
      const raw = await groqComplete(buildAskMessages(p, m, free), { temperature: 0.4, maxTokens: 700, json: true });
      const parsed = JSON.parse(raw || '{}') as Partial<AskAnswer>;
      const result: AskAnswer = {
        answer_ko: String(parsed.answer_ko || '').trim() || '설명을 가져오지 못했어요. 다시 시도해주세요.',
        examples: Array.isArray(parsed.examples)
          ? parsed.examples.filter((e) => e && e.en).map((e) => ({ en: String(e.en), ko: String(e.ko || '') })).slice(0, 3)
          : [],
      };
      setAnswer(result);
      addAskHistory({ phrase: p, mode: m, answer_ko: result.answer_ko, gloss: result.examples[0]?.ko, date: new Date().toISOString() });
    } catch (err) {
      const e = err as Error;
      if (e instanceof GroqError && e.message === 'NO_GROQ_KEY') {
        setError('⚡ AI 튜터 연결이 필요해요. 회화 탭에서 무료 Groq 키를 먼저 등록해주세요.');
      } else {
        setError(`❌ 오류: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function openSheet() {
    if (!trigger) return;
    primeAudio(); // iOS 오디오 언락 — 사용자 제스처 안에서
    const p = trigger.text;
    setPhrase(p);
    setMode('meaning');
    setFreeText('');
    setSaved(false);
    setOpen(true);
    setTrigger(null);
    window.getSelection()?.removeAllRanges();
    run(p, 'meaning');
  }

  function pickMode(m: AskMode) {
    setMode(m);
    setFreeText('');
    run(phrase, m);
  }

  function askFree() {
    const q = freeText.trim();
    if (!q) return;
    run(phrase, mode, q);
  }

  function close() {
    setOpen(false);
    setAnswer(null);
    setError('');
  }

  function savePhrase() {
    if (!phrase) return;
    addPhrase({ en: phrase, kr: answer?.examples?.[0]?.ko || '' });
    setSaved(true);
  }

  const hasKey = typeof window !== 'undefined' ? !!groqKey() : true;

  return (
    <>
      {trigger && !open && (
        <button
          className="ask-trigger"
          style={{ left: trigger.x, top: trigger.y }}
          // pointerdown + preventDefault: 클릭으로 선택이 풀려 트리거가 사라지기 전에 잡는다
          onPointerDown={(e) => {
            e.preventDefault();
            openSheet();
          }}
        >
          🤔 물어보기
        </button>
      )}

      {open && (
        <div className="ask-overlay" onClick={close}>
          <div className="ask-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ask-sheet-handle" />

            <div className="ask-phrase">
              <span className="ask-phrase-label">선택한 표현</span>
              <span className="ask-phrase-text">“{phrase}”</span>
              <button className="ask-phrase-speak" onClick={() => speakText(phrase)} title="듣기">
                🔊
              </button>
            </div>

            <div className="ask-modes">
              {ASK_MODES.map((m) => (
                <button
                  key={m.mode}
                  className={`ask-mode-chip${mode === m.mode ? ' active' : ''}`}
                  onClick={() => pickMode(m.mode)}
                  disabled={loading}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>

            <div className="ask-answer">
              {loading && (
                <div className="ask-loading">
                  <span className="ask-dot" />
                  <span className="ask-dot" />
                  <span className="ask-dot" />
                  <span className="ask-loading-txt">{askModeDef(mode).label} 알아보는 중…</span>
                </div>
              )}
              {!loading && error && <div className="ask-error">{error}</div>}
              {!loading && !error && answer && (
                <>
                  <div className="ask-answer-ko">{answer.answer_ko}</div>
                  {answer.examples.length > 0 && (
                    <div className="ask-examples">
                      {answer.examples.map((ex, i) => (
                        <div className="ask-example" key={i}>
                          <button className="ask-example-speak" onClick={() => speakText(ex.en)} title="듣기">
                            🔊
                          </button>
                          <div className="ask-example-text">
                            <div className="ask-example-en">{ex.en}</div>
                            {ex.ko && <div className="ask-example-ko">{ex.ko}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {hasKey && (
              <div className="ask-free">
                <input
                  className="text-input"
                  placeholder="더 궁금한 점을 물어보세요 (예: 비슷한 표현은?)"
                  value={freeText}
                  maxLength={200}
                  onChange={(e) => setFreeText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      askFree();
                    }
                  }}
                  disabled={loading}
                />
                <button className="btn primary ask-free-send" onClick={askFree} disabled={loading || !freeText.trim()}>
                  질문
                </button>
              </div>
            )}

            <div className="ask-foot">
              <button className="ask-foot-btn" onClick={savePhrase} disabled={saved}>
                {saved ? '✅ 저장됨' : '📌 표현장에 저장'}
              </button>
              <button className="ask-foot-btn" onClick={close}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
