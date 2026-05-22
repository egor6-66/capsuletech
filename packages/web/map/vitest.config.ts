import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [solid({ hot: false })],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    // vite-plugin-solid auto-injects '@testing-library/jest-dom/vitest' as a setupFile
    // when it detects the package is resolvable (it is, via workspace hoisting). By
    // explicitly listing it here, we (a) satisfy the plugin's "already handled" guard
    // so it does not double-inject, and (b) ensure it resolves in this package's context.
    setupFiles: ['@testing-library/jest-dom/vitest'],
  },
});
