/**
 * Playwright E2E — 샘플 트랜스크립트를 주입해 자막·요약·퀵리액션·RAG를 검증한다.
 *
 * 마이크는 CI에서 쓸 수 없으므로 STT 결과를 직접 주입한다(addUtterance).
 * 그 아래(번역 큐·요약 코얼레싱·RAG 검색·뱃지·복습 카드)는 실제 코드가 그대로 돈다.
 *
 * 실행:
 *   bash start.sh                         # 다른 터미널
 *   node tests/e2e.mjs                    # 기본 http://127.0.0.1:3799
 *   MC_BASE=http://127.0.0.1:3799 node tests/e2e.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.MC_BASE ?? 'http://127.0.0.1:3799';
const EXEC = process.env.PW_CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOT = process.env.MC_SHOT ?? '';

const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

// 실제 미팅 흐름 — 인사 → 가격 반론 → 종속성 우려 → 마무리
const SAMPLE = [
  ["상대", "Thanks for making time today. It's been a while — how have you been?"],
  ["나",   "Doing well, thanks. I'm looking forward to walking you through the proposal."],
  ["상대", "Honestly, your quote is quite a bit higher than the other vendor."],
  ["상대", "We're also worried about being locked in to a single cloud."],
  ["나",   "Understood. Let me align internally and get back to you."],
];

const b = await chromium.launch({ executablePath: EXEC });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });   // 모바일 390px
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('response', r => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url().replace(APP, '')}`); });

await p.goto(APP + '/app.html');
await p.waitForTimeout(700);

console.log('\n■ 자막 + 번역');
const t0 = Date.now();
for (const [who, text] of SAMPLE) {
  await p.evaluate(([t, w]) => addUtterance(t, w), [text, who]);
  await p.waitForTimeout(120);
}
check('자막 5줄 표시', await p.evaluate(() => document.querySelectorAll('#feed .row').length) >= 5);
await p.waitForFunction(
  () => [...document.querySelectorAll('#feed .row .kr')].filter(e => e.textContent.trim()).length >= 2,
  { timeout: 15000 }).catch(() => {});
const krs = await p.evaluate(() =>
  [...document.querySelectorAll('#feed .row .kr')].map(e => e.textContent.trim()).filter(Boolean));
check('상대 발언에 한국어 번역', krs.length >= 2 && /[가-힣]{3,}/.test(krs[0]), krs[0]?.slice(0, 26));
check('내 발언은 번역하지 않음(호출 절약)',
  await p.evaluate(() => [...document.querySelectorAll('#feed .row')]
    .filter(r => r.textContent.startsWith('나')).every(r => !r.querySelector('.kr')?.textContent.trim())));

console.log('\n■ 롤링 요약 배너');
await p.waitForFunction(() => (document.querySelector('#status-txt')?.textContent || '').length > 4,
  { timeout: 15000 }).catch(() => {});
const banner = await p.evaluate(() => document.querySelector('#status-txt').textContent.trim());
check('현재 논의 주제 한 줄', /[가-힣]{4,}/.test(banner), banner.slice(0, 32));

console.log('\n■ 퀵 리액션 4버튼 + RAG');
const btns = await p.evaluate(() =>
  [...document.querySelectorAll('.actions button.main')].map(b => b.dataset.intent));
check('주 버튼 4개 = 동의/반박/질문/제안',
  JSON.stringify(btns) === JSON.stringify(['agree', 'pushback', 'ask', 'propose']), btns.join(','));

for (const intent of ['agree', 'pushback', 'ask', 'propose']) {
  const t = Date.now();
  await p.click(`.actions [data-intent="${intent}"]`);
  // v2.5: 생성 중에도 이전 답변이 유지되므로 .kr 존재만으로는 완료가 아니다 —
  // 진행 표시(.gen) 해제 + 근거(#c-src) 표시까지 기다린다
  await p.waitForFunction(() => {
    const rows = [...document.querySelectorAll('#c-answers .lrow')];
    return rows.length >= 1 && rows.every(r => r.querySelector('.kr')?.textContent.trim())
      && !document.querySelector('#card').classList.contains('gen')
      && getComputedStyle(document.querySelector('#c-src')).display !== 'none';
  }, { timeout: 20000 }).catch(() => {});
  const card = await p.evaluate(() => ({
    en: [...document.querySelectorAll('#c-answers .en')].map(e => e.textContent.trim()),
    src: document.querySelector('#c-src').textContent,
    shown: getComputedStyle(document.querySelector('#c-src')).display !== 'none',
    badges: document.querySelectorAll('#c-answers .learned').length,
  }));
  const secs = ((Date.now() - t) / 1000).toFixed(2);
  // 구어체 계약: 단일 답변 — 첫 문장 ≤8단어(즉답 오프너), 이후 문장 ≤12단어
  const long = card.en.flatMap(e =>
    e.split(/(?<=[.!?])\s+/).filter((s, i) =>
      s.split(/\s+/).filter(Boolean).length > (i === 0 ? 8 : 12)));
  check(`[${intent}] 단일 답변 · ${secs}s`, card.en.length >= 1, card.en[0]?.slice(0, 46));
  check(`[${intent}] 오프너≤8·이후≤12단어`, long.length === 0, long[0] ? `초과: ${long[0]}` : '');
  check(`[${intent}] 근거를 내 자료로 표시`, card.shown && /용어집|미팅|노트/.test(card.src),
    card.src.replace(/\s+/g, ' ').slice(0, 54));
  check(`[${intent}] 📚 배운 표현 뱃지`, card.badges >= 1, `${card.badges}개`);
}

console.log('\n■ 하단 한→영 퀵 번역 (같은 RAG 파이프라인)');
await p.fill('#say-in', '다음 미팅이 기대된다고 말하고 싶어요');
await p.click('#say-go');
await p.waitForFunction(() => {
  const rows = [...document.querySelectorAll('#c-answers .lrow')];
  return rows.length >= 1 && rows.every(r => r.querySelector('.kr')?.textContent.trim())
    && !document.querySelector('#card').classList.contains('gen')
    && getComputedStyle(document.querySelector('#c-src')).display !== 'none';
}, { timeout: 20000 }).catch(() => {});
const quick = await p.evaluate(() => ({
  en: [...document.querySelectorAll('#c-answers .en')].map(e => e.textContent.trim()),
  src: document.querySelector('#c-src').textContent,
}));
check('한국어 입력 → 영어 제안', quick.en.length >= 1, quick.en[0]?.slice(0, 46));
check('퀵 번역도 내 자료를 검색함', /용어집|미팅|노트/.test(quick.src), quick.src.replace(/\s+/g, ' ').slice(0, 54));

console.log('\n■ v3.0 발음 표기 (PR 라인)');
check('발음 표기(🗣 한글 발음 + IPA) 표시', await p.evaluate(() => {
  const t = document.querySelector('#c-answers .pr')?.textContent || '';
  return t.includes('🗣') && /[가-힣]/.test(t);
}));

console.log('\n■ v2.5 글랜스 UI (표시 계층만)');
const g1 = await p.evaluate(() => {
  const el = document.querySelector('#c-answers .lrow.primary .en');
  const s = el && getComputedStyle(el);
  return s && { size: parseFloat(s.fontSize), weight: +s.fontWeight };
});
check('추천 문장 ≥18px · semibold', !!g1 && g1.size >= 18 && g1.weight >= 600,
  g1 ? `${g1.size}px w${g1.weight}` : 'primary 없음');
const g2 = await p.evaluate(() => {
  const me = document.querySelector('.row.me'); if (!me) return null;
  const b = me.querySelector('.bubble').getBoundingClientRect();
  const f = document.querySelector('#feed').getBoundingClientRect();
  return (f.right - b.right) < (b.left - f.left);
});
check('화자 구분 = 정렬 (내 발화 우측)', g2 === true);
const g3 = await p.evaluate(() => {
  for (let i = 0; i < 6; i++) addUtterance(`Filler line ${i} to make the feed scrollable.`, '상대');
  feed.scrollTop = 0;                                  // 사용자가 위로 스크롤한 상태
  feed.dispatchEvent(new Event('scroll'));
  addUtterance('This new line must not yank the scroll.', '상대');
  const held = feed.scrollTop < 40;
  const btn = getComputedStyle(document.querySelector('#new-msg')).display !== 'none';
  document.querySelector('#new-msg').click();
  const returned = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 8;
  return { held, btn, returned };
});
check('위로 스크롤 중 앵커 해제 + "새 메시지 ↓" 표시', g3.held && g3.btn);
check('버튼 클릭 → 최신 자막으로 복귀', g3.returned);
await p.click('.actions [data-intent="agree"]');
const g4 = await p.evaluate(() => ({
  gen: document.querySelector('#card').classList.contains('gen'),
  // v3.7: ⚡오프너가 이전 답변을 새 첫 문장으로 이미 교체했을 수도 있다 — 둘 다 정상
  kept: !!document.querySelector('#c-answers .kr')?.textContent.trim()
        || document.querySelector('#card').classList.contains('opened')
        || !!document.querySelector('#c-answers .en')?.textContent.trim(),
}));
check('생성 중 이전 답변 유지(또는 ⚡오프너) + 진행 바', g4.gen && g4.kept);
await p.waitForFunction(() =>
  !document.querySelector('#card').classList.contains('gen')
  && getComputedStyle(document.querySelector('#c-src')).display !== 'none',
  { timeout: 20000 }).catch(() => {});

console.log('\n■ v3.2 대화 전환 인지 (중간 질문 감지 + 낡음 표시)');
check('물음표 없는 중간 질문 감지 (Q_LEADS·쉼표 분할)', await p.evaluate(() =>
  wantsReply('my next question is what are your strengths and weaknesses') &&
  wantsReply('moving on, could you describe your current role') &&
  !wantsReply('sure, sounds good')));
check('새 상대 발화(비질문) → 이전 답변 stale 표시', await p.evaluate(() => {
  addUtterance('That was a really interesting answer indeed.', '상대');
  return document.querySelector('#card').classList.contains('stale');
}));
await p.click('.actions [data-intent="ask"]');
check('새 생성 시작 → stale 해제', await p.evaluate(() =>
  !document.querySelector('#card').classList.contains('stale')));
await p.waitForFunction(() =>
  !document.querySelector('#card').classList.contains('gen')
  && getComputedStyle(document.querySelector('#c-src')).display !== 'none',
  { timeout: 20000 }).catch(() => {});

console.log('\n■ v3.7 끊어 읽기 슬래시');
check('EN의 " / " 구분자가 .brk로 렌더 + 본문 유지', await p.evaluate(() => {
  renderCard('EN: I want to change / how customers work.\nKR: 방식 자체를 바꾸고 싶습니다.\nPR: 아이 원트 투 체인지 하우 커스터머스 워크.');
  const en = document.querySelector('#c-answers .en');
  return !!en.querySelector('.brk') && en.textContent.includes('customers');
}));

console.log('\n■ v4.0 번역 자동 재시도 (일시 503 주입 → 회복)');
const errsBeforeInject = errs.length;
await fetch('http://127.0.0.1:3898/__err', { method: 'POST', body: JSON.stringify({ mode: '503', p: 1 }) });
await p.evaluate(() => addUtterance('The quarterly revenue figures look quite promising overall.', '상대'));
await new Promise(r => setTimeout(r, 2500));                 // 첫 시도 + 서버 재시도 소진
await fetch('http://127.0.0.1:3898/__err', { method: 'POST', body: JSON.stringify({ mode: 'off', p: 0 }) });
// 주입 구간의 의도된 5xx는 오류 집계에서 제외 (그 외 오류는 그대로 잡는다)
const during = errs.splice(errsBeforeInject);
errs.push(...during.filter(e => !/HTTP 5\d\d|500|Failed to load/.test(e)));
const trOk = await p.waitForFunction(() => {
  const rows = [...document.querySelectorAll('#feed .row')];
  const last = rows.reverse().find(r => r.querySelector('.en')?.textContent.includes('quarterly revenue'));
  const kr = last?.querySelector('.kr')?.textContent || '';
  return kr.length > 2 && !kr.includes('·') && !kr.includes('실패');
}, { timeout: 25000 }).then(() => true).catch(() => false);
check('일시 503 후 번역 자동 회복 (백오프 재시도·스윕)', trOk);

console.log('\n■ 오버레이 인터뷰 모드 (v2.4 플로팅 패널 — PiP 안에서 검증)');
await p.evaluate(() => { try { localStorage.removeItem('mc_ov'); } catch {} });
await p.click('#btn-pip'); await p.waitForTimeout(400);
const ov1 = await p.evaluate(() => {
  const d = pipWin?.document;
  return {
    pip: !!pipWin,
    bar: d && getComputedStyle(d.querySelector('#ov-bar')).display !== 'none',
    pause: d && !!d.querySelector('#ov-pause'),
    bg: d && !!d.querySelector('#ov-bg'),
    interview: d?.body.classList.contains('mode-interview'),
    statusShown: d && getComputedStyle(d.querySelector('#status')).display !== 'none',
    ctrlsShown: d && getComputedStyle(d.querySelector('#ctrls')).display !== 'none',
    moreHidden: d && getComputedStyle(d.querySelector('.actions button.more')).display === 'none',
    a70: d?.body.classList.contains('ov-70'),
  };
});
check('PiP 열림 + 플로팅 바 (⏸⏹·라이브 필·🎦)', ov1.pip && ov1.bar && ov1.pause && ov1.bg);
check('기본 = 인터뷰 모드 (요약 스트립·고스트 액션 표시, .more 숨김)',
  ov1.interview && ov1.statusShown && ov1.ctrlsShown && ov1.moreHidden);
check('기본 = 반투명 배경 (ov-70 ON)', ov1.a70);
const ov2 = await p.evaluate(() => {
  const d = pipWin.document;
  d.querySelector('#card').style.display = 'block'; fitCard();
  const cr = d.querySelector('#card').getBoundingClientRect();
  const fr = d.querySelector('#feed').getBoundingClientRect();
  return { top: cr.top < fr.top, wide: cr.width > d.body.clientWidth * 0.9,
           feedShort: fr.height <= 150 };
});
check('답변 카드 최상단·전폭 + 자막 1~2줄', ov2.top && ov2.wide && ov2.feedShort);
const f1 = await p.evaluate(() =>
  parseFloat(getComputedStyle(pipWin.document.querySelector('#c-answers .en')).fontSize));
await p.evaluate(() => pipWin.document.querySelector('[data-ovs="L"]').click());
await p.waitForTimeout(150);
const st2 = await p.evaluate(() => ({
  f: parseFloat(getComputedStyle(pipWin.document.querySelector('#c-answers .en')).fontSize),
  scale: pipWin.document.body.style.getPropertyValue('--ovscale'), w: pipWin.innerWidth }));
check('프리셋 L → 폰트 스케일 1.15', st2.scale === '1.15' && st2.f >= f1, `${f1}px→${st2.f}px`);
console.log(`   ℹ️ resizeTo 시도 후 창 폭 ${st2.w}px (Chrome 허용 여부에 따라 다름)`);
await p.evaluate(() => pipWin.document.querySelector('#ov-alpha').click());
check('투명도 토글 (기본 70% → 100% 불투명)', await p.evaluate(() =>
  !pipWin.document.body.classList.contains('ov-70')));
await p.evaluate(() => pipWin.document.querySelector('#ov-mode').click());
check('전체 모드 전환 (카드가 하단으로 복귀)', await p.evaluate(() =>
  !pipWin.document.body.classList.contains('mode-interview') &&
  getComputedStyle(pipWin.document.querySelector('#card')).order === '1'));
check('설정이 localStorage에 저장됨', await p.evaluate(() => {
  try { const s = JSON.parse(localStorage.getItem('mc_ov'));
        return s.mode === 'full' && s.alpha === 100 && s.size === 'L'; }
  catch { return false; }
}));
await p.click('#btn-pip'); await p.waitForTimeout(300);   // 닫기
// 헤드리스는 PiP 폭을 페이지 뷰포트로 클램프하므로 절대값 대신
// "저장된 크기로 다시 열리는가"(복원 로직)를 검증한다
const savedW = await p.evaluate(() => +localStorage.getItem('mc_pip_w') || 0);
await p.click('#btn-pip'); await p.waitForTimeout(400);   // 재열기 → 복원 확인
const ov3 = await p.evaluate(() => ({
  full: !pipWin.document.body.classList.contains('mode-interview'),
  a70: pipWin.document.body.classList.contains('ov-70'),
  scale: pipWin.document.body.style.getPropertyValue('--ovscale'), w: pipWin.innerWidth }));
check('재열기 후 설정 복원 (전체·100%·L)', ov3.full && !ov3.a70 && ov3.scale === '1.15');
check('저장된 창 크기로 재열림', savedW > 0 && Math.abs(ov3.w - Math.min(savedW, 390)) < 60,
  `저장 ${savedW}px → 재열림 ${ov3.w}px (헤드리스는 뷰포트 클램프)`);
await p.evaluate(() => { ovPrefs.mode = 'interview'; ovPrefs.alpha = 70; ovPrefs.size = 'M'; saveOv(); });
await p.click('#btn-pip'); await p.waitForTimeout(300);   // 닫고 본창 복귀
check('오버레이 닫힘 — 본창 복귀 (기존 기능 유지)', await p.evaluate(() =>
  pipWin === null && !!document.querySelector('main #view-live')));

console.log('\n■ 카드가 하단 컨트롤을 가리지 않는지');
check('제안 카드 ↔ 퀵 액션 비겹침', !await p.evaluate(() => {
  const c = document.querySelector('#card').getBoundingClientRect();
  const a = document.querySelector('.actions').getBoundingClientRect();
  return c.bottom > a.top + 2;
}));

console.log('\n■ 자료 탭 · 수동 동기화 (자동 백그라운드 없음)');
await p.click('.tab[data-v="lib"]');
await p.waitForTimeout(400);
check('동기화 버튼 존재', await p.evaluate(() => !!document.querySelector('#sync-go')));
await p.click('#sync-go');
await p.waitForFunction(() => (document.querySelector('#sync-st')?.textContent || '').includes('✅'),
  { timeout: 20000 }).catch(() => {});
check('수동 동기화 성공', (await p.evaluate(() => document.querySelector('#sync-st').textContent)).includes('✅'),
  (await p.evaluate(() => document.querySelector('#sync-st').textContent)).slice(0, 48));

console.log('\n■ ⏹ 미팅 종료 — 요약 + 적재 + 복습 자산화');
await p.click('.tab[data-v="live"]');
p.on('dialog', d => d.accept('E2E 종료검증 미팅'));   // 미팅 이름 프롬프트
await p.click('#btn-stop');
await p.waitForFunction(() => [...document.querySelectorAll('#feed .row')]
  .some(r => r.textContent.includes('세션 요약')), { timeout: 30000 }).catch(() => {});
const endTxt = await p.evaluate(() => [...document.querySelectorAll('#feed .row')]
  .map(r => r.textContent).join('\n'));
check('종료 요약 버블 표시', endTxt.includes('세션 요약'));
check('트랜스크립트 적재 안내', /적재/.test(endTxt));
check('복습 카드 생성 안내', /복습 카드/.test(endTxt));
await p.waitForTimeout(400);
const revDoc = await p.evaluate(() => {
  document.querySelector('.tab[data-v="rev"]').click();
  return document.querySelector('#rev-doc').textContent;
});
check('복습 자료: 이번 미팅 표현', revDoc.includes('이번 미팅 표현'));
check('복습 자료: 진옥 선생님께 물어볼 것', revDoc.includes('진옥 선생님께 물어볼 것'), revDoc.slice(0, 0));
await p.click('.tab[data-v="live"]').catch(()=>{});

console.log('\n■ 복습 탭 (SRS)');
await p.click('.tab[data-v="rev"]');
await p.waitForTimeout(800);
const rev = await p.evaluate(() => ({
  stat: document.querySelector('#rev-stat').textContent,
  list: document.querySelector('#rev-list').textContent.slice(0, 60),
  saveBtn: !!document.querySelector('#rev-save'),
}));
check('복습 통계 표시', /전체/.test(rev.stat), rev.stat.replace(/\s+/g, ' ').slice(0, 40));
check('Notion 저장은 버튼(확인)으로만', rev.saveBtn);

if (SHOT) {
  await p.click('.tab[data-v="live"]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: SHOT, fullPage: false });
  console.log(`\n📸 ${SHOT} (390×844)`);
}

const realErrs = errs.filter(e => !/favicon|sw\.js|Manifest/.test(e));
console.log(`\n콘솔/네트워크 오류: ${realErrs.length}`);
realErrs.slice(0, 5).forEach(e => console.log('   ·', e.slice(0, 110)));
await b.close();

console.log(fails.length ? `\n❌ 실패 ${fails.length}건: ${fails.join(', ')}`
                         : '\n✅ 전부 통과');
process.exit(fails.length || realErrs.length ? 1 : 0);
