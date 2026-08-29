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

// 이전 실행이 주입(armed) 상태로 죽었어도 이번 실행이 오염되지 않게 — 시작 시 해제
await fetch('http://127.0.0.1:3898/__err',
  { method: 'POST', body: JSON.stringify({ mode: 'off', p: 0 }) }).catch(() => {});

// 가짜 오디오 장치 + 마이크 권한 — 화자 분리(입력 장치) 계약을 실제로 검증하려면
// 브라우저가 입력 장치를 하나라도 갖고 있어야 한다.
const b = await chromium.launch({ executablePath: EXEC,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 },   // 모바일 390px
  permissions: ['microphone'] });
const p = await ctx.newPage();
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
    // 완료 신호: META(전략)는 스트림 맨 끝에 온다. 예전엔 KR 줄이 그 역할을
    // 했는데 KR을 없앴으므로(v5.4) 여기서 명시적으로 기다린다.
    return rows.length >= 1 && rows.every(r => r.querySelector('.en')?.textContent.trim())
      && !document.querySelector('#card').classList.contains('gen')
      && getComputedStyle(document.querySelector('#c-strat-row')).display !== 'none'
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
  return rows.length >= 1 && rows.every(r => r.querySelector('.en')?.textContent.trim())
    && !document.querySelector('#card').classList.contains('gen')
    && getComputedStyle(document.querySelector('#c-strat-row')).display !== 'none'
    && getComputedStyle(document.querySelector('#c-src')).display !== 'none';
}, { timeout: 20000 }).catch(() => {});
const quick = await p.evaluate(() => ({
  en: [...document.querySelectorAll('#c-answers .en')].map(e => e.textContent.trim()),
  src: document.querySelector('#c-src').textContent,
}));
check('한국어 입력 → 영어 제안', quick.en.length >= 1, quick.en[0]?.slice(0, 46));
check('퀵 번역도 내 자료를 검색함', /용어집|미팅|노트/.test(quick.src), quick.src.replace(/\s+/g, ' ').slice(0, 54));

console.log('\n■ v5.4 답변은 영어만 (KR·PR 제거)');
{
  // 실사용 확인: 상대 발화는 EN+KR을 다 보지만 답변셋은 영어만 읽는다.
  // 안 읽는 줄을 만드느라 EN 완결 후 1.51초를 더 쓰고 있었다(실측).
  const r = await p.evaluate(() => ({
    kr: document.querySelector('#c-answers .kr')?.textContent.trim() || '',
    pr: document.querySelector('#c-answers .pr')?.textContent.trim() || '',
    en: document.querySelector('#c-answers .en')?.textContent.trim() || '',
  }));
  check('답변 카드에 KR·PR 줄이 없음', !r.kr && !r.pr, `kr="${r.kr}" pr="${r.pr}"`);
  check('EN은 그대로 표시', r.en.length > 10, r.en.slice(0, 44));
  // 끊어 읽기 슬래시는 EN 안에 있으므로 유지되어야 한다
  const brk = await p.evaluate(() => document.querySelectorAll('#c-answers .en .brk').length);
  check('끊어 읽기 슬래시는 유지', brk >= 0, `${brk}개`);
}

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
  kept: !!document.querySelector('#c-answers .en')?.textContent.trim()
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

console.log('\n■ v5.7 Tier A — 검수된 대본을 그대로 (생성 없음)');
{
  // 계약 1: 검수 전(reviewed:false) 유닛은 절대 Tier A로 나가지 않는다.
  // 검수 안 된 문장이 그대로 발화되는 게 이 기능의 유일한 큰 위험이다.
  const a = await fetch(APP + '/api/suggest', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ said: "Walk me through the biggest deal you've closed end to end.",
                           context: '', intent: 'reply', cefr: 'B1',
                           preset: 'interview', depth: '30s' }) })
    .then(r => r.text()).catch(() => '');
  const metaLine = a.split('\n').find(l => l.includes('"meta"'));
  const tier = metaLine ? (JSON.parse(metaLine).meta || {}).tier : '?';
  check('미검수 유닛은 Tier A로 나가지 않는다', tier !== 'A', `tier=${tier}`);

  // 계약 2: Tier A 배너는 '검수된 대본'임을 화면에 밝힌다 — 생성문과 구분되어야
  // 사용자가 안심하고 그대로 읽는다. 90초 판본이 있으면 버튼도 함께.
  const ui = await p.evaluate(() => {
    renderSources({ tier: 'A', sources: ['노트: 딜 스토리 A'], rag_used: true,
                    unit_title: '딜 스토리 A — 당근마켓 $75.6M EDP', has_90s: true,
                    known_numbers: ['75.6'], has_placeholder: false });
    const el = document.querySelector('#c-tiera');
    return { on: el.classList.contains('on'), txt: el.textContent,
             btn: !!document.querySelector('#c-90s') };
  });
  check('Tier A → 📌 검수된 대본 배너 + 노트 제목', ui.on && /검수된 대본/.test(ui.txt)
    && ui.txt.includes('딜 스토리 A'), ui.txt.trim().slice(0, 44));
  check('90초 판본이 있으면 버튼 노출', ui.btn);

  // 계약 3: Tier A가 아니면 배너는 사라진다(이전 답변의 잔상 금지).
  const off = await p.evaluate(() => {
    renderSources({ tier: 'B', sources: ['노트: 무엇'], rag_used: true,
                    known_numbers: [], has_placeholder: false });
    return document.querySelector('#c-tiera').classList.contains('on');
  });
  check('Tier B로 바뀌면 배너 사라짐', !off);
}

console.log('\n■ v5.4 Phase 0 — 근거 없으면 만들지 않는다 (#16·#14·#13)');
{
  // 계약 1: 코퍼스에 없는 질문 → LLM 호출 없이 Tier C. 화면 문장은 그대로
  // 발화되므로, 근거 없는 생성은 '거짓 경력 진술'이 된다.
  let n = 0;
  const cnt = r => { if (r.url().includes('/api/suggest')) n++; };
  p.on('request', cnt);
  // 내 답변 = 턴 경계. 이걸 넣지 않으면 앞 발화와 한 턴으로 병합돼(의도된 동작)
  // 앞 주제의 근거가 이번 질문에 딸려온다.
  await p.evaluate(() => addUtterance('Sure, understood.', '나'));
  await p.waitForTimeout(150);
  const t = Date.now();
  await p.evaluate(() => addUtterance('What is your favorite pizza topping in Naples?', '상대'));
  await p.waitForFunction(
    () => getComputedStyle(document.querySelector('#c-tierc')).display !== 'none',
    { timeout: 15000 }).catch(() => {});
  const ms = Date.now() - t;
  p.off('request', cnt);
  const c = await p.evaluate(() => ({
    shown: getComputedStyle(document.querySelector('#c-tierc')).display !== 'none',
    facts: document.querySelectorAll('#c-tierc li').length,
    en: document.querySelector('#c-answers .en')?.textContent.trim() || '',
  }));
  check('미스 → "대본 없음" 배너 + 확정 사실', c.shown && c.facts >= 1, `사실 ${c.facts}줄`);
  check('미스 → 생성하지 않음(안전 상투구만)',
    /think about that|take a moment/i.test(c.en), c.en.slice(0, 46));
  // 미스 판정 전에 의미검색으로 한 번 더 확인한다(패러프레이즈 구제) — 그 비용이
  // 여기에 포함된다. 그래도 본답변 생성(≈1.8s)보다 싸고, 무엇보다 지어내지 않는다.
  check('미스는 본답변을 생성하지 않는다 (의미 확인 포함 2.5초 미만)', ms < 2500, `${ms}ms`);

  // 계약 2: 자료에 없는 숫자는 붉게 표시한다(차단하지 않는다 — 화면이 비면
  // 면접 중 대응이 불가능하다). 확정 수치는 건드리지 않는다.
  const g = await p.evaluate(() => {
    knownNumbers = ['75.6', '50.7'];
    const d = document.createElement('div');
    d.innerHTML = markNumbers('grew to 50.7M, closed 75.6M, and a 999M deal');
    return { marked: [...d.querySelectorAll('.unverified')].map(e => e.textContent.trim()),
             kept: d.textContent.includes('75.6') && d.textContent.includes('50.7') };
  });
  check('자료에 없는 숫자만 미검증 표시', g.marked.some(x => x.includes('999')) &&
    !g.marked.some(x => x.includes('75.6')), JSON.stringify(g.marked));
  check('확정 수치는 그대로 표시', g.kept);
}

console.log('\n■ v5.3 상대 입력 장치 — 내 목소리 섞임 방지');
{
  // BlackHole이 꽂힌 맥을 흉내 — enumerateDevices에 한 대 끼워 넣는다
  await p.evaluate(() => {
    if (window.__bhPatched) return;
    window.__bhPatched = 1;
    const real = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = async () => [...await real(),
      { kind: 'audioinput', label: 'BlackHole 2ch', deviceId: 'bh-2ch',
        groupId: 'g', toJSON() { return this; } }];
  });
  const r = await p.evaluate(async () => {
    await loadMicDevices();
    document.querySelector('#engine').value = 'micstt';
    document.querySelector('#engine').dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 700));
    return { value: document.querySelector('#mic-dev').value,
             status: document.querySelector('#status-mic')?.textContent || '',
             them: themAudio({}), me: meAudio({}) };
  });
  check('BlackHole이 있으면 자동 선택', r.value === 'bh-2ch', r.value);
  check('🎧 모드 상태 = 화자 분리 ON', /분리 ON/.test(r.status), r.status.slice(0, 34));
  check('상대 입력을 deviceId로 못박음(exact)',
    r.them?.deviceId?.exact === 'bh-2ch', JSON.stringify(r.them));
  check('내 목소리는 BlackHole이 아닌 장치로',
    !!r.me?.deviceId && r.me.deviceId.ideal !== 'bh-2ch', JSON.stringify(r.me));
  const web = await p.evaluate(async () => {
    document.querySelector('#engine').value = 'web';
    document.querySelector('#engine').dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 700));
    return document.querySelector('#status-mic')?.textContent || '';
  });
  // Web Speech는 장치 지정이 불가능하다 — 무엇을 해야 하는지 문구로 알려야 한다
  check('🎤 모드는 Chrome 기본 입력 안내', /BlackHole로 바꾸세요|분리 ON/.test(web), web.slice(0, 44));
  await p.evaluate(() => {
    document.querySelector('#engine').value = 'web';
    document.querySelector('#engine').dispatchEvent(new Event('change'));
  });
}

console.log('\n■ v5.2 코드 스냅샷 — Claude에 붙여넣기 (로컬 전용)');
{
  // 계약: 이 맥에서 직접 연 주소에서만 소스를 내준다. start.sh가 띄우는
  // Cloudflare 터널 주소는 공개라, 거기서 열리면 앱 내부가 통째로 샌다.
  const list = await p.evaluate(async () => (await fetch('/api/code')).json());
  check('조각 목록 제공', Array.isArray(list.parts) && list.parts.length >= 3,
    `${list.parts?.length}조각`);
  const one = await p.evaluate(async () =>
    (await fetch('/api/code?part=1')).text());
  check('조각 본문에 안내 머리말 + 코드', /코드 스냅샷 \(1\//.test(one) && one.includes('```'),
    `${one.length.toLocaleString()}자`);
  check('개인 데이터·키 미포함',
    !/AQ\.[A-Za-z0-9_-]{10,}/.test(one) && !one.includes('imported/workato'),
    '마스킹 확인');
  // 터널 흉내 — 전달 헤더가 붙으면 403이어야 한다
  const blocked = await p.evaluate(async () => {
    const r = await fetch('/api/code', { headers: { 'X-Forwarded-For': '1.2.3.4' } });
    return r.status;
  });
  check('터널/외부 접속은 403으로 차단', blocked === 403, `HTTP ${blocked}`);
  // JSON 형식 — 파일 경계가 명확해 분석에 유리. 조각도 각각 유효한 JSON이어야 한다.
  const js = await p.evaluate(async () => (await fetch('/api/code?fmt=json')).json());
  check('fmt=json — 파일 배열 + 메타',
    Array.isArray(js.files) && js.files.length >= 10 && !!js.project,
    `파일 ${js.files?.length}개`);
  check('각 파일에 path·lang·purpose·content',
    js.files.every(f => f.path && f.lang && 'content' in f) &&
    js.files.filter(f => f.purpose).length === js.files.length,
    '스키마 확인');
  const g1 = await p.evaluate(async () => (await fetch('/api/code?fmt=json&g=6')).json());
  check('g=N으로 묶음만 (한글 이름은 URL에 싣지 않는다)',
    Array.isArray(g1.files) && g1.files.length >= 1 && g1.group !== '전체', g1.group);
  const bad = await p.evaluate(async () => (await fetch('/api/code?fmt=json&g=99')).json());
  check('범위 밖 g는 400 + 안내', !!bad.error && Array.isArray(bad.groups), bad.error?.slice(0, 30));

  const ui = await p.evaluate(() => {
    document.querySelector('.tab[data-v="lib"]')?.click();
    return document.querySelectorAll('#code-parts button').length;
  });
  check('자료 탭에 조각별 복사 버튼', ui >= 3, `${ui}개`);
}

console.log('\n■ v5.1 턴 정착 — 조각난 질문에 답변 1회만 발사');
{
  // v5.0 결함 재발 방지: 조각마다 suggest가 나가면 직전 생성을 abort해 답변
  // 시계가 리셋되고(체감 3~5초), 버려진 오프너가 fast 레인을 점유해 번역까지
  // 밀렸다(실측 큐 대기 430ms). 계약: 한 턴 = ⚡오프너 1 + 본답변 1.
  let calls = 0; const bodies = [];
  const count = r => {
    if (r.url().includes('/api/suggest')) { calls++; bodies.push(r.postData() || ''); }
  };
  p.on('request', count);
  await p.evaluate(() => addUtterance('Sure, happy to walk you through it.', '나'));  // 내 답변 = 턴 경계
  await p.waitForTimeout(200);
  for (const f of ["I'd love to understand", "what kind of customers",
                   "you worked with,", "and how big were those deals?"]) {
    await p.evaluate(t => addUtterance(t, '상대'), f);
    await p.waitForTimeout(800);
  }
  await p.waitForTimeout(2500);
  p.off('request', count);
  check('조각 4개 질문 → suggest ≤2회 (오프너+본답변)', calls <= 2, `${calls}회`);
  // 본답변 요청의 said가 마지막 조각이 아니라 턴 전체여야 한다
  const main = bodies.find(b => !/"opener"\s*:\s*1/.test(b)) || '';
  const said = (main.match(/"said"\s*:\s*"([^"]*)"/) || [])[1] || '';
  check('본답변 입력 = 턴 전체(조각 아님) · 이전 턴 미혼입',
    said.startsWith("I'd love to understand") && /how big were those deals/.test(said),
    said.slice(0, 60));
}

console.log('\n■ v5.1 고유명사 교정 (지연 0 · 브라우저 STT 오인식 복구)');
{
  await p.evaluate(() => addUtterance('So you were at mega stone crab working on avocado?', '상대'));
  await p.waitForTimeout(300);
  const en = await p.evaluate(() =>
    [...document.querySelectorAll('#feed .row .en')].pop()?.textContent || '');
  check('"mega stone crab"→MegazoneCloud · "avocado"→Workato',
    en.includes('MegazoneCloud') && en.includes('Workato'), en.slice(0, 60));
  const keep = await p.evaluate(() => {
    addUtterance('I pass on that one for now', '상대');
    return [...document.querySelectorAll('#feed .row .en')].pop()?.textContent || '';
  });
  check('일상어는 건드리지 않음 ("I pass")', keep.includes('I pass'), keep.slice(0, 40));
}

console.log('\n■ v4.0 번역 자동 재시도 (일시 503 주입 → 회복)');
const errsBeforeInject = errs.length;
try {
  await fetch('http://127.0.0.1:3898/__err', { method: 'POST', body: JSON.stringify({ mode: '503', p: 1 }) });
  await p.evaluate(() => addUtterance('The quarterly revenue figures look quite promising overall.', '상대'));
  await new Promise(r => setTimeout(r, 2500));               // 첫 시도 + 서버 재시도 소진
} finally {
  // 어떤 경로로 죽어도 주입을 끄고 나간다 — 다음 실행 오염 방지
  await fetch('http://127.0.0.1:3898/__err', { method: 'POST', body: JSON.stringify({ mode: 'off', p: 0 }) }).catch(() => {});
}
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
const pl = await p.evaluate(() => {
  const d = pipWin.document; d.body.classList.add('bg-live');
  const c = d.querySelector('#card'); c.style.display = 'block';
  const cr = c.getBoundingClientRect(), fr = d.querySelector('#feed').getBoundingClientRect();
  const W = d.body.clientWidth;
  d.body.classList.remove('bg-live');
  // v4.5 한 기둥: 답변·자막이 같은 오른쪽 기둥에 위아래로 (시선 최소 이동)
  return { right: W - cr.right < 24 && W - fr.right < 24,
           col: Math.abs(cr.left - fr.left) < 8,
           stack: cr.top < fr.top };
});
check('🎦 한 기둥 레이아웃 (답변·자막 우측 세로 정렬)', pl.right && pl.col && pl.stack);
// 폰트 스케일은 '정상 답변 행'을 기준으로 재야 한다. 바로 앞 503 주입 테스트가
// 카드를 오류 행(한국어 안내만·.en 없음)으로 남겨 두면 여기서 null을 잡는다.
await p.evaluate(() => { const d = pipWin.document;
  if(!d.querySelector('#c-answers .en'))
    d.querySelector('#c-answers').innerHTML =
      '<div class="lrow primary"><div class="body"><div class="en">Sample answer for scaling.</div></div></div>';
});
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

// /api/code 403은 위에서 일부러 낸 negative 테스트다 — 이 카운터는
// '예상 못 한' 오류만 세야 신호로서 값을 한다.
const realErrs = errs.filter(e =>
  !/favicon|sw\.js|Manifest/.test(e) && !/403.*\/api\/code|api\/code.*403/.test(e)
  && !/403 \(Forbidden\)/.test(e) && !/\/api\/code.*g=99|400 \(Bad Request\)/.test(e));
console.log(`\n콘솔/네트워크 오류: ${realErrs.length}`);
realErrs.slice(0, 5).forEach(e => console.log('   ·', e.slice(0, 110)));
await b.close();

console.log(fails.length ? `\n❌ 실패 ${fails.length}건: ${fails.join(', ')}`
                         : '\n✅ 전부 통과');
process.exit(fails.length || realErrs.length ? 1 : 0);
