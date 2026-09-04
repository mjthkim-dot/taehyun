'use client';

/**
 * 표현 딥카드 — 표현 하나를 6층 깊이로 펼친다: 뉘앙스·격식도 / 변형 3종 /
 * 한국인 흔한 실수 / 상대의 예상 응답 페어 / 미니 체크 / 리콜 단계(뜻 보고
 * 영어 떠올리기). 정적 큐레이션이 없으면 AI가 같은 스키마로 생성(캐시).
 */
import { useEffect, useState } from 'react';
import { getDepth, generatePhraseDepth, type PhraseDepth } from '../lib/phraseDepth';
import { GroqError } from '../lib/groq';
import { groqKoText } from '../lib/aiGuard';
import { groqKey } from '../lib/state';
import { speakText } from './SpeakButton';
import { SpeakerIcon, CheckIcon } from './icons';

const REGISTER_LABEL: Record<1 | 2 | 3, string> = { 1: '캐주얼', 2: '중립', 3: '포멀' };

export default function PhraseDeepCard({
  en,
  kr,
  missionTitle,
  recallDone,
  onRecallDone,
}: {
  en: string;
  kr: string;
  missionTitle: string;
  recallDone: boolean;
  onRecallDone: () => void;
}) {
  const [depth, setDepth] = useState<PhraseDepth | null>(() => getDepth(en));
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState('');
  const [checkPick, setCheckPick] = useState<number | null>(null);
  const [explain, setExplain] = useState('');
  const [explainBusy, setExplainBusy] = useState(false);
  // 리콜: 한국어만 보이고 영어는 가려진 상태 → 떠올린 뒤 확인 → 자가 판정
  const [revealed, setRevealed] = useState(false);

  // 정적/캐시에 없고 키가 있으면 자동으로 AI 분석을 생성한다.
  useEffect(() => {
    let alive = true;
    if (!depth && groqKey()) {
      setGenBusy(true);
      generatePhraseDepth(en, kr, missionTitle)
        .then((d) => alive && setDepth(d))
        .catch((err) => {
          if (!alive) return;
          const e = err as Error;
          setGenError(e instanceof GroqError && e.message === 'NO_GROQ_KEY' ? 'Groq 키를 등록하면 상세 분석을 볼 수 있어요.' : e.message);
        })
        .finally(() => alive && setGenBusy(false));
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [en]);

  return (
    <div className="deep-card">
      {/* 리콜 단계 — 카드 최상단: 펼치자마자 뜻만 보고 떠올려보게 한다 */}
      <div className="deep-recall">
        <div className="deep-recall-head">
          리콜 체크 {recallDone && <span className="deep-pass"><CheckIcon size={12} /> 통과</span>}
        </div>
        {!recallDone ? (
          <>
            <div className="deep-recall-kr">“{kr}”</div>
            {!revealed ? (
              <button className="deep-recall-btn" onClick={() => setRevealed(true)}>
                영어로 떠올렸어요 — 정답 확인
              </button>
            ) : (
              <>
                <div className="deep-recall-en">{en}</div>
                <div className="deep-recall-grade">
                  <button className="deep-recall-yes" onClick={onRecallDone}>맞았어요</button>
                  <button className="deep-recall-no" onClick={() => setRevealed(false)}>다시 해볼게요</button>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="deep-recall-donemsg">뜻만 보고 떠올리는 데 성공했어요.</div>
        )}
      </div>

      {genBusy && <div className="deep-loading">표현 분석 중…</div>}
      {genError && !depth && <div className="deep-error">{genError}</div>}
      {!depth && !genBusy && !genError && (
        <div className="deep-loading">Groq 키를 등록하면 뉘앙스·변형·실수 분석을 볼 수 있어요.</div>
      )}

      {depth && (
        <>
          <div className="deep-sec">
            <div className="deep-sec-head">
              뉘앙스
              <span className="deep-register" data-r={depth.register}>{REGISTER_LABEL[depth.register]}</span>
            </div>
            <div className="deep-nuance">{depth.nuance}</div>
          </div>

          <div className="deep-sec">
            <div className="deep-sec-head">상황별 변형</div>
            {depth.variations.map((v) => (
              <div className="deep-var" key={v.en}>
                <span className="deep-var-tone">{v.tone}</span>
                <div className="deep-var-txt">
                  <div className="deep-var-en">{v.en}</div>
                  <div className="deep-var-kr">{v.kr}</div>
                </div>
                <button className="mission-ic" title="듣기" onClick={() => speakText(v.en)}>
                  <SpeakerIcon size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="deep-sec">
            <div className="deep-sec-head">한국인이 흔히 하는 실수</div>
            <div className="deep-mistake">
              <div className="deep-mistake-wrong">✕ {depth.mistake.wrong}</div>
              <div className="deep-mistake-right">✓ {depth.mistake.right}</div>
              <div className="deep-mistake-why">{depth.mistake.why}</div>
            </div>
          </div>

          {depth.reply.en && (
            <div className="deep-sec">
              <div className="deep-sec-head">이렇게 주고받아요</div>
              <div className="deep-reply">
                <div className="deep-reply-line">
                  <span className="deep-reply-who">상대</span>
                  <div>
                    <div className="deep-var-en">{depth.reply.en}</div>
                    <div className="deep-var-kr">{depth.reply.kr}</div>
                  </div>
                </div>
                <div className="deep-reply-line me">
                  <span className="deep-reply-who">나</span>
                  <div>
                    <div className="deep-var-en">{depth.reply.mine}</div>
                    <div className="deep-var-kr">{depth.reply.mineKr}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {depth.check.options.length > 0 && (
            <div className="deep-sec">
              <div className="deep-sec-head">확인 문제</div>
              <div className="deep-check-q">{depth.check.q}</div>
              <div className="deep-check-opts">
                {depth.check.options.map((o, i) => {
                  const state = checkPick == null ? '' : i === depth.check.a ? ' correct' : i === checkPick ? ' wrong' : '';
                  return (
                    <button key={i} className={`deep-check-opt${state}`} onClick={() => setCheckPick(i)} disabled={checkPick != null}>
                      {o}
                    </button>
                  );
                })}
              </div>
              {checkPick != null && (
                <div className={`deep-check-result${checkPick === depth.check.a ? ' ok' : ''}`}>
                  {checkPick === depth.check.a ? '정확해요!' : `정답: ${depth.check.options[depth.check.a]}`}
                </div>
              )}
              {checkPick != null && checkPick !== depth.check.a && !explain && (
                <button
                  className="deep-explain-btn"
                  disabled={explainBusy}
                  onClick={async () => {
                    setExplainBusy(true);
                    try {
                      // 영어로 답하면 한 번 다시 묻는다 — 그래도 실패면 안내 문구
                      const txt = await groqKoText(
                        [
                          { role: 'system', content: '너는 한국인 영어 학습자를 돕는 튜터다. 오답에 대해 왜 그 답이 틀렸고 정답이 맞는지 한국어 2~3문장으로 간결히 설명한다. 설명만 출력.' },
                          { role: 'user', content: `표현: "${en}"\n문제: ${depth.check.q}\n보기: ${depth.check.options.join(' / ')}\n학습자가 고른 오답: ${depth.check.options[checkPick]}\n정답: ${depth.check.options[depth.check.a]}` },
                        ],
                        { temperature: 0.3, maxTokens: 260 }
                      );
                      setExplain(txt ?? '설명을 가져오지 못했어요. 잠시 후 다시 시도해주세요.');
                    } catch {
                      setExplain('설명을 가져오지 못했어요. 잠시 후 다시 시도해주세요.');
                    } finally {
                      setExplainBusy(false);
                    }
                  }}
                >
                  {explainBusy ? '설명 불러오는 중…' : '왜 틀렸는지 AI 설명 보기'}
                </button>
              )}
              {explain && <div className="deep-explain">{explain}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
