'use client';

/**
 * 본문 문맥 질문 — "읽다가 궁금해지면 그 자리에서 바로 묻기".
 *
 * 기존 '꾹 눌러 물어보기'(AskWidget)는 **영어 표현을 선택해야** 열려서,
 * 한국어 설명을 읽다 생긴 의문이나 단락 전체에 대한 자유 질문은 물어볼 길이
 * 없었다. 이 컴포넌트는 단락마다 버튼 하나로 열리고, **지금 보고 있는 본문을
 * 통째로 문맥으로 넘겨** 자유 질문을 받는다. 답이 본문 밖이면 그렇다고 밝히도록
 * 프롬프트에서 강제해 지어내기를 막는다.
 */
import { useState } from 'react';
import { ASK_SUGGESTIONS, buildContextAskMessages, addAskHistory, type AskAnswer, type AskContext } from '../lib/askPrompts';
import { groqComplete, GroqError } from '../lib/groq';
import { groqKey } from '../lib/state';
import SpeakButton from './SpeakButton';

interface Turn {
  q: string;
  a: AskAnswer;
}

export default function ContextAsk({ ctx }: { ctx: AskContext }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function ask(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    if (!groqKey()) {
      setError('AI 키가 없어요. 기능 탭 → AI 키 등록에서 무료 키를 넣어주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const raw = await groqComplete(
        buildContextAskMessages(ctx, text, turns.map((t) => ({ q: t.q, a: t.a.answer_ko }))),
        { json: true, temperature: 0.3, maxTokens: 700 }
      );
      const parsed = JSON.parse(raw || '{}');
      const answer: AskAnswer = {
        answer_ko: String(parsed.answer_ko || '').trim(),
        examples: Array.isArray(parsed.examples) ? parsed.examples.slice(0, 3) : [],
      };
      if (!answer.answer_ko) throw new Error('EMPTY');
      setTurns((prev) => [...prev, { q: text, a: answer }]);
      setQuestion('');
      // 질문 기록에 남겨 나중에 다시 볼 수 있게 한다(기존 '내 질문 기록' 화면 재사용)
      addAskHistory({
        phrase: `${ctx.title} — ${text}`,
        mode: 'meaning',
        answer_ko: answer.answer_ko,
        gloss: answer.examples[0]?.ko,
        date: new Date().toISOString(),
      });
    } catch (err) {
      const e = err as Error;
      setError(
        e instanceof GroqError && e.message === 'NO_GROQ_KEY'
          ? 'AI 키가 없어요. 기능 탭 → AI 키 등록에서 무료 키를 넣어주세요.'
          : '답변을 받지 못했어요. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="ctx-ask-open" onClick={() => setOpen(true)}>
        이 부분 물어보기
      </button>
    );
  }

  return (
    <div className="ctx-ask">
      <div className="ctx-ask-head">
        <span className="ctx-ask-title">이 부분에 대해 물어보기</span>
        <button className="ctx-ask-close" onClick={() => setOpen(false)} aria-label="닫기">
          닫기
        </button>
      </div>

      {turns.map((t, i) => (
        <div className="ctx-ask-turn" key={i}>
          <div className="ctx-ask-q">{t.q}</div>
          <div className="ctx-ask-a">{t.a.answer_ko}</div>
          {t.a.examples.length > 0 && (
            <div className="ctx-ask-examples">
              {t.a.examples.map((ex, j) => (
                <div className="ctx-ask-example" key={j}>
                  <div className="ctx-ask-example-en">
                    <span>{ex.en}</span> <SpeakButton text={ex.en} />
                  </div>
                  <div className="ctx-ask-example-ko">{ex.ko}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {!turns.length && (
        <div className="ctx-ask-chips">
          {ASK_SUGGESTIONS.map((s) => (
            <button className="ctx-ask-chip" key={s} onClick={() => ask(s)} disabled={loading}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <div className="ctx-ask-error">{error}</div>}

      <div className="ctx-ask-input">
        <input
          className="text-input"
          placeholder={turns.length ? '이어서 더 물어보기' : '궁금한 점을 한국어로 물어보세요'}
          value={question}
          maxLength={200}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask(question)}
        />
        <button className="btn primary ctx-ask-send" onClick={() => ask(question)} disabled={loading || !question.trim()}>
          {loading ? '…' : '질문'}
        </button>
      </div>
    </div>
  );
}
