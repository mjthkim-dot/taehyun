'use client';

/**
 * 직무 어휘 — 기능 탭에 이름만 있고 실체가 없던 '어휘' 영역을 실제 화면으로 만든 것.
 *
 * 단어장이 아니라 **연어 중심 학습 화면**이다: 표제어와 함께 쓰는 덩어리,
 * 바로 쓸 수 있는 예문, 한국어 화자가 틀리는 지점을 한 카드에 담는다.
 * 자기 점검 퀴즈에서 틀린 항목은 복습(SRS) 큐로 넘겨, 여기서 끝나지 않고
 * 암기 카드에서 다시 만나게 한다.
 */
import { useMemo, useState } from 'react';
import { VOCAB_DOMAINS, type VocabEntry } from '../lib/domainVocab';
import { addPhrase, addWeakItem } from '../lib/state';
import SpeakButton from './SpeakButton';
import Note from './Note';

type Quiz = { entry: VocabEntry; options: string[] };

export default function VocabScreen() {
  const [domainKey, setDomainKey] = useState(VOCAB_DOMAINS[0].key);
  const [open, setOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [quiz, setQuiz] = useState<Quiz[] | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const domain = VOCAB_DOMAINS.find((d) => d.key === domainKey) ?? VOCAB_DOMAINS[0];

  /** 예문을 표현장에 저장 — 드릴·암기 카드에서 다시 만나도록 */
  function save(e: VocabEntry) {
    addPhrase({ en: e.example.en, kr: e.example.kr, lesson: `vocab:${domainKey}` });
    setSaved((prev) => (prev.includes(e.term) ? prev : [...prev, e.term]));
  }

  /** 뜻 → 용어 4택 5문항. 오답은 복습 큐로 보낸다. */
  function startQuiz() {
    const pool = domain.entries;
    const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(5, pool.length));
    const made: Quiz[] = picks.map((entry) => {
      const distractors = pool
        .filter((x) => x.term !== entry.term)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((x) => x.term);
      return { entry, options: [entry.term, ...distractors].sort(() => Math.random() - 0.5) };
    });
    setQuiz(made);
    setQIdx(0);
    setPicked(null);
    setScore(0);
  }

  function answer(opt: string) {
    if (picked || !quiz) return;
    setPicked(opt);
    const cur = quiz[qIdx];
    if (opt === cur.entry.term) {
      setScore((s) => s + 1);
    } else {
      // 틀린 용어는 예문 형태로 복습 큐에 넣는다(암기 카드에서 다시 나온다)
      addWeakItem({ en: cur.entry.example.en, kr: cur.entry.example.kr, lesson: `vocab:${domainKey}`, cat: '어휘' });
    }
  }

  const totalSaved = useMemo(() => saved.length, [saved]);

  if (quiz) {
    const cur = quiz[qIdx];
    const last = qIdx >= quiz.length - 1;
    const correct = picked === cur.entry.term;
    return (
      <div className="study-screen">
        <div className="study-card">
          <h3>자기 점검 — {domain.label}</h3>
          <div className="vocab-quiz-meta">
            {qIdx + 1} / {quiz.length} · 맞힘 {score}
          </div>
          <div className="vocab-quiz-q">{cur.entry.kr}</div>
          <div className="vocab-quiz-opts">
            {cur.options.map((opt) => {
              const state = !picked ? '' : opt === cur.entry.term ? ' right' : opt === picked ? ' wrong' : '';
              return (
                <button key={opt} className={`vocab-opt${state}`} onClick={() => answer(opt)} disabled={!!picked}>
                  {opt}
                </button>
              );
            })}
          </div>
          {picked && (
            <div className="vocab-quiz-feedback">
              <div className={correct ? 'ok' : 'bad'}>{correct ? '정확해요' : `정답: ${cur.entry.term}`}</div>
              <div className="ex">
                {cur.entry.example.en} <SpeakButton text={cur.entry.example.en} />
              </div>
              <div className="ex-kr">{cur.entry.example.kr}</div>
              {!correct && <div className="note-line">복습 큐에 담았어요 — 암기 카드에서 다시 만납니다.</div>}
            </div>
          )}
          {picked && (
            <button
              className="btn primary"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => {
                if (last) {
                  setQuiz(null);
                } else {
                  setQIdx((i) => i + 1);
                  setPicked(null);
                }
              }}
            >
              {last ? `끝내기 (${score}/${quiz.length})` : '다음 문항 →'}
            </button>
          )}
          {!picked && (
            <button className="btn ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => setQuiz(null)}>
              그만두기
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>직무 어휘</h3>
        <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.6, marginBottom: 12 }}>
          단어만 외워도 못 쓰는 이유는 <b>함께 쓰는 덩어리</b>를 모르기 때문입니다. 연어·예문·한국인 오용 지점을 같이 익히세요.
          카드를 탭하면 자세히 열립니다.
        </p>

        <div className="vocab-tabs">
          {VOCAB_DOMAINS.map((d) => (
            <button
              key={d.key}
              className={`vocab-tab${d.key === domainKey ? ' active' : ''}`}
              onClick={() => {
                setDomainKey(d.key);
                setOpen(null);
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="vocab-domain-desc">{domain.desc}</div>

        <button className="btn ghost-accent" style={{ width: '100%', marginBottom: 12 }} onClick={startQuiz}>
          자기 점검 5문항 시작
        </button>

        {domain.entries.map((e) => {
          const isOpen = open === e.term;
          return (
            <div className={`vocab-card${isOpen ? ' open' : ''}`} key={e.term}>
              <button className="vocab-head" onClick={() => setOpen(isOpen ? null : e.term)}>
                <div className="vocab-term-row">
                  <span className="vocab-term">{e.term}</span>
                  <span className="vocab-level">{e.level}</span>
                </div>
                <div className="vocab-kr">{e.kr}</div>
              </button>

              {isOpen && (
                <div className="vocab-body">
                  <div className="vocab-sec-label">함께 쓰는 덩어리</div>
                  <div className="vocab-collos">
                    {e.collocations.map((c) => (
                      <span className="vocab-collo" key={c}>
                        {c}
                      </span>
                    ))}
                  </div>

                  <div className="vocab-sec-label">바로 쓰는 예문</div>
                  <div className="vocab-ex">
                    <span>{e.example.en}</span> <SpeakButton text={e.example.en} /> <SpeakButton text={e.example.en} slow />
                  </div>
                  <div className="vocab-ex-kr">{e.example.kr}</div>

                  <div className="vocab-sec-label">주의 · 뉘앙스</div>
                  {/* note는 **볼드**·줄바꿈을 쓰므로 반드시 Note 렌더러를 거쳐야 한다 */}
                  <div className="vocab-note">
                    <Note text={e.note} />
                  </div>

                  <button className="btn ghost vocab-save" onClick={() => save(e)} disabled={saved.includes(e.term)}>
                    {saved.includes(e.term) ? '표현장에 저장됨' : '예문 표현장에 저장'}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {totalSaved > 0 && <div className="vocab-saved-note">이번 세션에 {totalSaved}개 예문을 표현장에 담았어요.</div>}
      </div>
    </div>
  );
}
