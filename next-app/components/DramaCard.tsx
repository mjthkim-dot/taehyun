'use client';

/**
 * 홈의 '오늘의 에피소드' — 드라마 레슨으로 들어가는 단 하나의 버튼.
 *
 * 하루 한 편: 오늘 이미 봤으면 주 버튼은 다음 화가 아니라 '오늘의 복습'(표현 떠올리기 →
 * 없으면 가장 어려웠던 화를 자막 없이 다시 듣기)이고, 다음 화는 작은 '보너스' 링크다.
 * 키 없이 7화를 다 봤으면 막다른 'EP 8 보기' 대신 복습을 권하고 AI 연결은 보조로.
 * (예전엔 오늘 본 뒤에도 주 버튼이 'EP N 미리 보기'라 일주일 원고가 이틀 만에 끝났다)
 *
 * M3: 불꽃의 연료 = 발화. 카드 안에 '🔥 발화 n/goal' 한 줄 + 점 4개(에피소드/리텔/회상/회화 — 키 없는 8일차+는
 * '에피소드' 대신 '다시 듣기'), 반불꽃이면 'n문장만 더 말하면 켜져요'. 주 버튼은 dramaPlan이 정한다:
 * speak(오늘 봤는데 발화 목표 전 → 말로 떠올리기/역할극 다시) · ladder(키 없는 날 0.9→1.0→1.2× 자막 없이 다시 듣기).
 * 홈 청크 예산 — habits·drama·words를 import하지 않고 homeLite.speakLine(저장값 읽기)만 쓴다.
 *
 * M4 하루 조절: 카드를 길게 누르거나 '⋯'(키보드)로 DayModeSheet([오늘은 5분만] [조용히 모드]) — 시트는 dynamic()이라
 * 홈 첫 청크에 dayGovernor가 실리지 않는다. 배너는 homeLite.bannerFor(dayLite()) 하나만(복귀 첫날 자동이 최우선).
 */
import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Mode } from './NavBar';
import { primeAudio } from './SpeakButton';
// 원고(lib/drama)가 아니라 경량 모듈만 — 홈 첫 프레임에 바로 그린다(감사 v1.31 G26)
import { bannerFor, dayLite, type DayBanner } from '../lib/homeLite';
import { DRAMA_NOTICE_KEY, dramaPlan, dramaResumeExists, dramaWatchedList, episodeLite, requestDrama, requestDramaAutoplay, speakLine, type DramaPlan, type SpeakLine } from '../lib/homeLite';
import { CAST_ICONS, SERIES_NAME, type EpisodeLite } from '../lib/dramaIndex';
import { load, store } from '../lib/state';

const DayModeSheet = dynamic(() => import('./DayModeSheet'), { ssr: false });
/** 길게 누르기로 보는 시간(ms) */
const LONG_PRESS_MS = 550;

/** 백업 권유 — 3화 이상 봤는데 한 번도(또는 14일 넘게) 백업하지 않았으면. '나중에'는 7일 쉰다 */
const BACKUP_EVERY = 14 * 86400000;
const SNOOZE_KEY = 'va_backup_snooze';

interface CardState {
  plan: DramaPlan;
  line: SpeakLine;
  ep: EpisodeLite | null;
  prev: EpisodeLite | null;
  resume: boolean;
  notice: boolean;
  nudge: boolean;
  /** 브라우저가 영구 저장을 거절했다(기록이 지워질 수 있다) */
  volatile: boolean;
  /** 하루 배너(M4 bannerFor — 하루 1개) */
  banner: DayBanner | null;
}

function compute(): CardState {
  const plan = dramaPlan();
  const at = load<number>('va_backup_at', 0);
  const snooze = load<number>(SNOOZE_KEY, 0);
  const seenN = dramaWatchedList().length;
  const since = seenN - load<number>('va_backup_eps', 0);
  const line = speakLine(plan);
  return {
    plan,
    line,
    banner: bannerFor(dayLite(), line),
    ep: episodeLite(plan.nextNo),
    prev: episodeLite(plan.nextNo - 1),
    resume: dramaResumeExists(plan.nextNo),
      notice: load<string>(DRAMA_NOTICE_KEY, '') === 'reseeded',
      // 3화 이상 봤는데 백업한 적이 없거나, 14일이 지났거나, 백업 뒤로 7화를 더 봤으면
      nudge: seenN >= 3 && (!at || Date.now() - at > BACKUP_EVERY || since >= 7) && Date.now() - snooze > 7 * 86400000,
    volatile: load<boolean | null>('va_persisted', null) === false,
  };
}

export default function DramaCard({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  // 첫 렌더에서 바로 계산(홈은 마운트 뒤에만 그려지므로 하이드레이션과 어긋나지 않는다)
  const [st, setSt] = useState<CardState>(compute);
  const { plan } = st;
  // M4 하루 모드 시트 — 길게 누르기(터치) 또는 '⋯' 버튼(키보드). 길게 누른 뒤의 click은 버튼에 닿지 않게 삼킨다
  const [sheet, setSheet] = useState(false);
  const press = useRef<{ t: ReturnType<typeof setTimeout> | null; fired: boolean }>({ t: null, fired: false });
  const cancelPress = () => {
    if (press.current.t) clearTimeout(press.current.t);
    press.current.t = null;
  };
  const pressHandlers = {
    onPointerDown: () => {
      cancelPress();
      press.current.fired = false;
      press.current.t = setTimeout(() => {
        press.current.fired = true;
        setSheet(true);
      }, LONG_PRESS_MS);
    },
    onPointerUp: cancelPress,
    onPointerLeave: cancelPress,
    onPointerCancel: cancelPress,
    onClickCapture: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (!press.current.fired) return;
      press.current.fired = false;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu: (e: { preventDefault: () => void }) => {
      if (press.current.t || press.current.fired) e.preventDefault();
    },
  };
  const go = () => {
    primeAudio(); // 탭 안에서 오디오 언락(iOS 첫 대사 무음 방지)
    requestDramaAutoplay();
    onNavigate('drama');
  };
  const review = () => {
    primeAudio();
    requestDrama({ kind: 'review' });
    onNavigate('drama');
  };
  const replay = () => {
    if (!plan.replayNo) return;
    primeAudio();
    requestDrama({ kind: 'replay', no: plan.replayNo, subsOff: true });
    onNavigate('drama');
  };
  /** 발화 목표 전 — 기한 된 표현이 있으면 말로 떠올리기, 없으면 가장 어려웠던 화를 역할극으로 다시 */
  const speak = () => {
    primeAudio();
    if (plan.due > 0) requestDrama({ kind: 'review' });
    else if (plan.replayNo) requestDrama({ kind: 'replay', no: plan.replayNo });
    onNavigate('drama');
  };
  const ladder = () => {
    if (!plan.ladder) return;
    primeAudio();
    requestDrama({ kind: 'replay', no: plan.ladder.no, subsOff: true, speed: plan.ladder.speed, ladder: true });
    onNavigate('drama');
  };
  const { line } = st;
  const left = Math.max(1, Math.ceil(line.goal - line.spoken));
  const dotsLabel = line.dots.map((d) => `${d.label} ${d.on ? '✓' : '–'}`).join(' · ');
  const faces = ['taeo', 'maya', 'jun', 'diane', 'grant'].map((id) => CAST_ICONS[id] || '🙂');
  const allSeen = plan.needAi;
  // 키 없이 다 본 날 복습까지 마쳤으면 같은 복습을 또 조르지 않는다
  const doneToday = allSeen && plan.practiced;
  return (
    <>
    {sheet && <DayModeSheet onClose={() => setSheet(false)} onChanged={() => setSt(compute())} />}
    <section className="study-card dr-card" data-tilt aria-label="오늘의 에피소드" style={{ position: 'relative' }} {...pressHandlers}>
      <button
        type="button"
        className="mini-btn dg-more"
        aria-label="오늘 분량 고르기"
        aria-haspopup="dialog"
        onClick={() => setSheet(true)}
        style={{ position: 'absolute', top: 8, right: 8, minWidth: 44, minHeight: 44 }}
      >
        ⋯
      </button>
      <div className="dr-card-faces" aria-hidden="true">
        {faces.map((f, i) => (
          <span key={i}>{f}</span>
        ))}
      </div>
      <div className="pg-kicker">
        {doneToday ? '오늘 복습 완료 ✓' : plan.today ? '오늘 에피소드 완료 ✓' : '오늘의 에피소드'} · {SERIES_NAME}
      </div>
      <h2 className="dr-card-title">{allSeen ? `${plan.nextNo - 1}화까지 다 봤어요! 👏` : `EP ${plan.nextNo} ${st.ep ? `· ${st.ep.titleKr}` : '· 새 이야기'}`}</h2>
      <p className="dr-card-hook">
        {doneToday
          ? '오늘의 불꽃은 켜졌어요. 내일 또 복습으로 이어가요.'
          : allSeen
          ? `EP ${plan.nextNo}부터는 AI 작가가 이어서 써요. 그때까지는 복습으로 오늘의 불꽃을 켜요.`
          : plan.today
            ? `내일 EP ${plan.nextNo} 공개 — ${st.prev ? st.prev.cliff : ''}`
            : st.prev
              ? `지난 이야기: ${st.prev.cliff}`
              : '서울의 글로벌 스타트업에 첫 출근하는 태오. 그런데 엘리베이터가 멈췄다.'}
      </p>
      {st.notice && (
        <p className="dr-msg dr-card-note" role="status">
          4~7화가 새 원고로 바뀌었어요 — 4화부터 새 이야기로 이어가요. 전에 배운 표현은 복습에 그대로 있어요.{' '}
          <button
            type="button"
            className="dr-link"
            onClick={() => {
              store(DRAMA_NOTICE_KEY, '');
              setSt({ ...st, notice: false });
            }}
          >
            알겠어요
          </button>
        </p>
      )}
      {st.banner && (
        <p className="dr-msg dr-card-note dg-banner" data-banner={st.banner.id} role="status">
          {st.banner.text}
        </p>
      )}
      {/* 홈은 screens.css를 받지 않는다(첫 청크 CSS 예산) — 점은 글자(●○)로, 문단은 기존 dr-msg로 */}
      <p className="dr-msg rc-fuel" data-level={line.lit ? 'lit' : line.half ? 'half' : 'off'}>
        {line.lit ? '🔥' : line.half ? '🕯️' : '🪵'} 발화 {Math.floor(line.spoken)}/{line.goal}{' '}
        <span className="rc-dots" title={dotsLabel} aria-label={dotsLabel}>
          {line.dots.map((d) => (d.on ? '●' : '○')).join('')}
        </span>
        {plan.ladder?.done && ' · 👂 귀 뚫림 ✓'}
        {line.half && <span className="rc-fuel-hint"> — {left}문장만 더 말하면 켜져요</span>}
      </p>
      {plan.kind === 'speak' ? (
        <button type="button" className="btn primary dr-go rc-go" onClick={speak}>
          🗣 {left}문장 더 말하기 — {plan.due > 0 ? `표현 ${plan.due}개 떠올리기` : `EP ${plan.replayNo} 역할극`}
        </button>
      ) : plan.kind === 'ladder' && plan.ladder ? (
        <button type="button" className="btn primary dr-go rc-go" onClick={ladder}>
          🎧 EP {plan.ladder.no} {plan.ladder.speed.toFixed(1)}×로 다시 듣기
        </button>
      ) : plan.kind === 'review' ? (
        <button type="button" className={`btn ${doneToday ? 'ghost' : 'primary'} dr-go`} onClick={review}>
          {doneToday ? `🧠 한 번 더 복습하기(표현 ${plan.due}개)` : `🧠 오늘의 복습 — 표현 ${plan.due}개 떠올리기`}
        </button>
      ) : plan.kind === 'replay' && plan.replayNo ? (
        <button type="button" className={`btn ${doneToday ? 'ghost' : 'primary'} dr-go`} onClick={replay}>
          {doneToday ? `🎧 한 번 더 듣기 — EP ${plan.replayNo}` : `🎧 EP ${plan.replayNo} 자막 없이 다시 듣기`}
        </button>
      ) : (
        <button type="button" className="btn primary dr-go" onClick={go}>
          {st.resume ? `EP ${plan.nextNo} 이어 보기` : `EP ${plan.nextNo} 보기 · 약 5분`}
        </button>
      )}
      {(plan.kind === 'next' || plan.kind === 'ladder') && plan.due > 0 && (
        <button type="button" className="dr-link" onClick={review}>
          🧠 표현 복습 {plan.due}개도 있어요
        </button>
      )}
      {plan.kind !== 'next' &&
        (allSeen ? (
          <button type="button" className="dr-link" onClick={() => onNavigate('apikey')}>
            AI 연결하고 EP {plan.nextNo} 보기
          </button>
        ) : (
          <button type="button" className="dr-link muted" onClick={go}>
            보너스로 EP {plan.nextNo} 먼저 보기 (내일 볼 화가 줄어요)
          </button>
        ))}
      {st.nudge && (
        <p className="dr-msg dr-card-note">
          {st.volatile ? '💾 이 브라우저는 기록을 지울 수 있어요 — 파일로 보관하거나 홈 화면에 추가하세요.' : '💾 기록은 이 기기에만 있어요.'}{' '}
          <button type="button" className="dr-link" onClick={() => onNavigate('backup')}>
            파일로 보관하기
          </button>{' '}
          <button
            type="button"
            className="dr-link muted"
            onClick={() => {
              store(SNOOZE_KEY, Date.now());
              setSt({ ...st, nudge: false });
            }}
          >
            나중에
          </button>
        </p>
      )}
    </section>
    </>
  );
}
