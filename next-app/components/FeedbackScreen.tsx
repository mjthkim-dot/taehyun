'use client';

/**
 * 피드백 — "쓰다가 거슬린 것"을 그 자리에서 적어두는 곳.
 *
 * 이 앱의 개선은 사용자의 피드백 한 줄에서 시작돼 왔다(기계음, 무응답,
 * 매일 같은 콘텐츠, 홈 접근성…). 그 한 줄을 나중에 기억해내지 않아도 되게,
 * 발견 즉시 기록 → 모아서 "전체 복사" → 개발 대화에 붙여넣는 루프.
 *
 * 저장은 로컬(va_feedback, 백업에 포함) — 개인용 앱이라 서버 수집이 없고,
 * 외부 자동 발송도 하지 않는다(수동 복사가 전송의 전부).
 */
import { useState } from 'react';
import { load, store } from '../lib/state';

interface FeedbackItem {
  t: number;
  screen: string;
  text: string;
}

const KEY = 'va_feedback';
const MAX = 100;
const SCREENS = ['홈', '회화', '세션', '드릴', '몰입 스토리', '실전 코스', '면접', '기타'];

function items(): FeedbackItem[] {
  return load<FeedbackItem[]>(KEY, []);
}

function fmtDate(t: number): string {
  const d = new Date(t);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function FeedbackScreen() {
  const [list, setList] = useState<FeedbackItem[]>(() => items());
  const [text, setText] = useState('');
  const [screen, setScreen] = useState('기타');
  const [msg, setMsg] = useState('');

  function save() {
    const t = text.trim();
    if (!t) return;
    const next = [{ t: Date.now(), screen, text: t }, ...list].slice(0, MAX);
    store(KEY, next);
    setList(next);
    setText('');
    setMsg('저장했어요 — 모이면 "전체 복사"로 개발 대화에 붙여넣으세요.');
  }

  function remove(t: number) {
    const next = list.filter((i) => i.t !== t);
    store(KEY, next);
    setList(next);
  }

  async function copyAll() {
    const md = list
      .map((i) => `- [${i.screen}] ${i.text} (${fmtDate(i.t)})`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(`앱 피드백 ${list.length}건:\n${md}`);
      setMsg(`${list.length}건을 복사했어요 — 개발 대화에 붙여넣으면 반영됩니다.`);
    } catch {
      setMsg('복사에 실패했어요 — 항목을 길게 눌러 직접 복사해 주세요.');
    }
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.7, margin: 0 }}>
          쓰다가 거슬리거나 바라는 게 생기면 <b>그 자리에서</b> 적어두세요. 지금까지의 개선(기계음 수정, 매일 새
          콘텐츠, 홈 개편…)이 전부 이런 한 줄에서 시작됐어요.
        </p>
      </div>

      <div className="study-card">
        <div className="fb-chips">
          {SCREENS.map((s) => (
            <button key={s} type="button" className={`fb-chip${screen === s ? ' on' : ''}`} onClick={() => setScreen(s)}>
              {s}
            </button>
          ))}
        </div>
        <textarea
          className="text-input fb-input"
          rows={3}
          placeholder="예: 드릴에서 정답 소리가 너무 커요"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="button" className="btn primary" style={{ width: '100%', marginTop: 8 }} disabled={!text.trim()} onClick={save}>
          기록하기
        </button>
      </div>

      {msg && <p className="pp-imported">✅ {msg}</p>}

      {list.length > 0 && (
        <>
          <div className="mn-sec-title">
            📋 기록 {list.length}건
            <button type="button" className="mini-btn" onClick={() => void copyAll()}>
              📄 전체 복사
            </button>
          </div>
          {list.map((i) => (
            <div key={i.t} className="fb-item">
              <div className="fb-item-head">
                <span className="fb-tag">{i.screen}</span>
                <span className="fb-date">{fmtDate(i.t)}</span>
                <button type="button" className="fb-del" aria-label="삭제" onClick={() => remove(i.t)}>
                  ✕
                </button>
              </div>
              <div className="fb-text">{i.text}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
