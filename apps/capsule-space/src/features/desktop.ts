import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Feature: Desktop
 * ----------------
 * Wrapper над Tauri window API в HCA-стиле. Phase 1.0 прототип:
 * вызывается из Controllers через next.with(Features.Desktop, 'method').
 *
 * После 2-3 use-cases (file dialog, fs, notifications) — extract в
 * @capsuletech/web-tauri package с proper service injection (services.desktop).
 * См. ADR 018 + комментарий главного в обсуждении.
 *
 * Tauri runtime отсутствует (e.g. browser preview) — catch + warn,
 * не бросаем чтобы не падал UI.
 */
const Desktop = Feature(() => ({
  initial: 'idle',
  states: {
    idle: {
      minimize: async () => {
        try {
          await getCurrentWindow().minimize();
        } catch (e) {
          console.warn('[Features.Desktop] minimize failed (Tauri unavailable?):', e);
        }
      },
      toggleMaximize: async () => {
        try {
          await getCurrentWindow().toggleMaximize();
        } catch (e) {
          console.warn('[Features.Desktop] toggleMaximize failed (Tauri unavailable?):', e);
        }
      },
      close: async () => {
        try {
          await getCurrentWindow().close();
        } catch (e) {
          console.warn('[Features.Desktop] close failed (Tauri unavailable?):', e);
        }
      },
    },
  },
}));

export default Desktop;
