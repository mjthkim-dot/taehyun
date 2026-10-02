'use client';

/**
 * 드라마 말풍선(M2에서 DramaScreen에서 추출) — 대화 기록 한 줄(해설·대사·해설 노트)을 그린다.
 *
 * 왜 따로 두는가: 이후 모듈(M7 디코더 표시·M11 자막 모드)이 말풍선만 고치면 되게, DramaScreen의
 * 재생 흐름과 분리한다. 슬롯:
 *   · extraSlot — 말풍선 아래 한 줄(디코더 마크·칩 등). 없으면 아무것도 안 그린다.
 *   · subsMode  — 'on' | 'off' | 'earFirst'(M11: 영어도 가리고 소리 먼저). 없으면 subs 불리언을 따른다.
 *   · onLongPress — 길게(500ms) 누르면 호출(상대 대사 '같이 말하기'). 길게 누른 뒤의 click은 무시한다.
 * M7: 설정(백업 '고급 ▾' 플래그 soundLine, 기본 꺼짐)이 켜져 있고 extraSlot이 비어 있으면, 그 대사에 디코더 구간
 *   (gonna·플랩 T·연음)이 있을 때만 extraSlot 자리에 '🔊 원어민 소리' 회색 한 줄(spokenLine)을 넣는다 — DramaScreen 무수정.
 * 기존 동작: 누르면 그 줄의 한국어를 보여 주고(자막을 꺼 둔 채 들을 때) 다시 듣는다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { castOf } from '../../lib/drama';
import { FLAGS_EVENT, isOn } from '../../lib/flags';
import { spokenLine } from '../../lib/connectedSpeech';

/** '원어민 소리' 줄 설정 — 백업 화면에서 바꾸면(같은 탭 va:flags 이벤트) 바로 따라온다 */
function useSoundLine(): boolean {
  const [on, setOn] = useState(() => {
    try {
      return isOn('soundLine');
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const f = () => setOn(isOn('soundLine'));
    window.addEventListener(FLAGS_EVENT, f);
    return () => window.removeEventListener(FLAGS_EVENT, f);
  }, []);
  return on;
}

export type LogItem = { kind: 'narr'; kr: string } | { kind: 'line'; who: string; en: string; kr: string } | { kind: 'note'; ok: boolean; text: string };
export type SubsMode = 'on' | 'off' | 'earFirst';

/** 길게 누르기 판정(ms) */
export const LONG_PRESS_MS = 500;

export default function Bubble({
  item,
  subs,
  onReplay,
  extraSlot,
  subsMode,
  onLongPress,
  mark,
}: {
  item: LogItem;
  subs: boolean;
  onReplay: (en: string, who?: string) => void;
  extraSlot?: ReactNode;
  subsMode?: SubsMode;
  onLongPress?: (item: Extract<LogItem, { kind: 'line' }>) => void;
  /** 말풍선 구석 작은 표시(지정 상대 대사 '👄' 등) */
  mark?: ReactNode;
}) {
  // 자막을 꺼 둔 채 들을 때 — 못 알아들은 말풍선만 눌러서 한국어를 볼 수 있다(듣기 먼저, 뜻은 나중)
  const [reveal, setReveal] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const soundLine = useSoundLine();
  if (item.kind === 'narr') return <div className="dr-narr">{item.kr}</div>;
  if (item.kind === 'note') return <div className={`dr-note${item.ok ? ' ok' : ''}`}>{item.text}</div>;
  const c = castOf(item.who);
  const me = item.who === 'taeo';
  const mode: SubsMode = subsMode ?? (subs ? 'on' : 'off');
  const showKr = (mode === 'on' || reveal) && !!item.kr;
  // 귀 먼저(M11): 영어도 누르기 전엔 가린다
  const showEn = mode !== 'earFirst' || reveal;
  const spoken = !extraSlot && soundLine && showEn ? spokenLine(item.en) : null;
  const extra =
    extraSlot ??
    (spoken ? (
      <span className="bb-sound">
        <span className="bb-sound-lbl">🔊 원어민 소리</span> <span lang="en">{spoken}</span>
      </span>
    ) : null);

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const onPointerDown = onLongPress
    ? () => {
        longFired.current = false;
        clearPress();
        pressTimer.current = setTimeout(() => {
          longFired.current = true;
          onLongPress(item);
        }, LONG_PRESS_MS);
      }
    : undefined;

  return (
    <div className={`dr-line${me ? ' me' : ''}${onLongPress ? ' bb-pressable' : ''}`}>
      {!me && <span className="dr-av" aria-hidden="true">{c.icon}</span>}
      <button
        type="button"
        className="dr-bub"
        onPointerDown={onPointerDown}
        onPointerUp={onLongPress ? clearPress : undefined}
        onPointerLeave={onLongPress ? clearPress : undefined}
        onPointerCancel={onLongPress ? clearPress : undefined}
        onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
        onClick={() => {
          // 길게 눌러 섀도잉이 열렸으면 그 손가락의 click은 '다시 듣기'가 아니다
          if (longFired.current) {
            longFired.current = false;
            return;
          }
          setReveal(true);
          onReplay(item.en, item.who);
        }}
      >
        {/* 접근성 이름 = 보이는 내용 그대로(인물·영어·자막) — 예전엔 aria-label이 자막을 덮어 한국어가 읽히지 않았다 */}
        <span className={me ? 'sr-only' : 'dr-name'}>{c.name}</span>
        <span className="dr-en" lang="en">
          {showEn ? item.en : '…'}
        </span>
        {showKr && <span className="dr-kr">{item.kr}</span>}
        <span className="sr-only">(다시 듣기{onLongPress ? ' · 길게 누르면 같이 말하기' : ''})</span>
        {mark && <span className="bb-mark" aria-hidden="true">{mark}</span>}
        {extra && <span className="bb-extra">{extra}</span>}
      </button>
      {me && <span className="dr-av" aria-hidden="true">{c.icon}</span>}
    </div>
  );
}
