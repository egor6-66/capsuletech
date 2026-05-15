import '@capsule/web-style/css';
import '@capsule/web-style/themes';
import '../index.css';

import type { JSX } from 'solid-js';
import { render } from 'solid-js/web';

const DEFAULT_THEME = 'black';

function ensureTheme() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!root.hasAttribute('data-theme')) {
    root.setAttribute('data-theme', DEFAULT_THEME);
  }
}

export function createRoot(
  Component: () => Node | JSX.ArrayElement | string | number | boolean | null | undefined,
) {
  ensureTheme();

  const container = document.getElementById('root');

  if (!container) throw new Error('root not found');

  return render(Component, container);
}
