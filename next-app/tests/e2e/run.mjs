/**
 * E2E 스모크 러너 — 빌드된 앱(.next)을 로컬 서버로 띄우고 tests/e2e/NN-*.mjs를
 * 순서대로 실행한다(파일별 독립 프로세스). 하나라도 실패하면 비정상 종료.
 *
 * 사용: npm run build && npm run test:e2e
 * 순서 주의: 04-api-guard는 rate limit 상태를 소비하므로 서버를 공유하는
 * 다른 API 실호출 테스트보다 뒤에 둔다(현재 01~03은 라우트를 mock/미사용).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '../..');
const PORT = process.env.E2E_PORT || '3100';
const BASE = `http://localhost:${PORT}`;

if (!fs.existsSync(path.join(appRoot, '.next'))) {
  console.error('빌드가 없습니다 — 먼저 `npm run build`를 실행하세요.');
  process.exit(1);
}

console.log(`▶ next start -p ${PORT}`);
const server = spawn('npx', ['next', 'start', '-p', PORT], { cwd: appRoot, stdio: 'ignore' });

async function waitReady(timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/app`);
      if (r.ok) return true;
    } catch {
      /* 아직 안 뜸 */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

if (!(await waitReady())) {
  console.error('서버가 30초 안에 뜨지 않았습니다.');
  server.kill('SIGKILL');
  process.exit(1);
}
console.log('▶ 서버 준비 완료\n');

const files = fs
  .readdirSync(__dirname)
  .filter((f) => /^\d\d-.*\.mjs$/.test(f))
  .sort();

let failed = 0;
for (const f of files) {
  console.log(`── ${f}`);
  const code = await new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(__dirname, f)], {
      cwd: appRoot,
      stdio: 'inherit',
      env: { ...process.env, BASE_URL: BASE },
    });
    p.on('close', resolve);
  });
  if (code !== 0) failed++;
  console.log('');
}

server.kill('SIGKILL');
console.log(failed ? `✗ ${failed}/${files.length} 파일 실패` : `✓ ${files.length}개 테스트 파일 전부 통과`);
process.exit(failed ? 1 : 0);
