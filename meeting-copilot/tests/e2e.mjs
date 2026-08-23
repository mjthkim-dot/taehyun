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
  await p.waitForFunction(() => {
    const rows = [...document.querySelectorAll('#c-answers .lrow')];
    return rows.length >= 1 && rows.every(r => r.querySelector('.kr')?.textContent.trim());
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
  return rows.length >= 1 && rows.every(r => r.querySelector('.kr')?.textContent.trim());
}, { timeout: 20000 }).catch(() => {});
const quick = await p.evaluate(() => ({
  en: [...document.querySelectorAll('#c-answers .en')].map(e => e.textContent.trim()),
  src: document.querySelector('#c-src').textContent,
}));
check('한국어 입력 → 영어 제안', quick.en.length >= 1, quick.en[0]?.slice(0, 46));
check('퀵 번역도 내 자료를 검색함', /용어집|미팅|노트/.test(quick.src), quick.src.replace(/\s+/g, ' ').slice(0, 54));

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
