import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [solid({ hot: false })],
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    // jsdom is required for component render tests (matrix resize, flex items).
    // Pure-logic tests (normalizeSlot) are unaffected — jsdom globals don't interfere.
    environment: 'jsdom',
    globals: false,
    // vitest.setup.ts installs ResizeObserver mock (jsdom does not ship it).
    setupFiles: ['./vitest.setup.ts'],
    // Several deps ship .jsx/.tsx source files in dev conditions.
    // Node natively cannot process JSX — inline these deps so Vite transforms them.
    // - @capsuletech/web-dnd: imported by matrix.tsx and drag-badge.tsx (peer dep, must inline for tests)
    // - @capsuletech/web-router: imported by matrix.tsx (RouterContext)
    // - @tanstack/solid-router + @solidjs/meta: transitive deps of web-router
    // - @kobalte/core: ships .jsx in dist/polymorphic (corvu resizable dependency chain)
    server: {
      deps: {
        inline: [
          /@capsuletech\/web-dnd/,
          /@capsuletech\/web-router/,
          /@tanstack\/solid-router/,
          /@solidjs\/meta/,
          /@kobalte\/core/,
          /solid-prevent-scroll/,
          /solid-presence/,
        ],
      },
    },
  },
});
