import { defineConfig } from 'vitest/config';

// lib/ 순수 로직 단위 테스트 — 브라우저 없이 돈다(localStorage는 setup에서 메모리 구현).
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.ts'],
  },
});
