import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // Phase 0 skeleton — runtime ещё не написан, тестов нет.
    // Снимется в Phase 1, когда появится первая реализация (Provider + transport).
    passWithNoTests: true,
  },
});
