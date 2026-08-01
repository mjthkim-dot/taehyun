/**
 * E2E 스모크 테스트 공용 헬퍼 — 세션 QA에서 검증된 패턴을 영구 테스트로 옮긴 것.
 * 프레임워크 없이 playwright 라이브러리 + 단순 체크 카운터로 유지한다(의존성 최소).
 */
import { chromium } from 'playwright';

export const BASE = process.env.BASE_URL || 'http://localhost:3100';

let failures = 0;
let checks = 0;

export function check(name, cond, extra = '') {
  checks++;
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

/** 테스트 파일 마지막에 호출 — 실패가 있으면 비정상 종료로 러너에 알린다. */
export function finish(title) {
  console.log(`${title}: ${checks - failures}/${checks} passed`);
  process.exit(failures ? 1 : 0);
}

/** 로컬(PLAYWRIGHT_BROWSERS_PATH)·CI 어디서든 뜨도록 폴백 포함 런치.
 *  모든 페이지에서 첫 실행 온보딩을 기본으로 건너뛴다 — 각 테스트는 자기 기능을
 *  검증해야지 온보딩을 통과하는 데 줄을 쓰면 안 된다.
 *  온보딩 자체를 보려면 테스트에서 va_onboarded를 지우면 된다(22-onboarding). */
export async function launch() {
  const browser = await (async () => {
    try {
      return await chromium.launch();
    } catch {
      return await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    }
  })();
  const orig = browser.newPage.bind(browser);
  browser.newPage = async (opts) => {
    const page = await orig(opts);
    await page.addInitScript(() => localStorage.setItem('va_onboarded', 'true'));
    return page;
  };
  return browser;
}

/** Groq 채팅 프록시 mock — 스트림/논스트림 모두 고정 응답. */
export async function mockGroq(page, { onSystem } = {}) {
  await page.route('**/app/api/groq', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.stream) {
      const sys = (body.messages || []).find((m) => m.role === 'system');
      if (sys && onSystem) onSystem(sys.content);
      const sse = 'data: {"choices":[{"delta":{"content":"Sure, let\'s begin."}}]}\n\ndata: [DONE]\n\n';
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }),
      });
    }
  });
}

/** localStorage에 가짜 Groq 키 시드(채팅 경로 활성화). */
export function seedKey(page) {
  return page.addInitScript(() => localStorage.setItem('va_groq_key', JSON.stringify('gsk_test_key')));
}
