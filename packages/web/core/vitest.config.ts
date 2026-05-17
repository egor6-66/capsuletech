import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    // Pure-helper тесты живут в node-окружении. Тесты на UiProxy/ControllerProxy
    // (которые требуют DOM + Solid) добавим отдельным проходом с jsdom.
    environment: 'node',
    globals: false,
  },
});
