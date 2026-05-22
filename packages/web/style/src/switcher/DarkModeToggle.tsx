import { createSignal, onMount } from 'solid-js';

const STORAGE_KEY = 'capsule-theme-mode';

interface IProps {
  /** Element to toggle .dark on. Defaults to `document.documentElement`. */
  target?: HTMLElement;
  /** Extra classes on the root `<button>`. */
  class?: string;
  /** Callback fired after mode changes. */
  onChange?: (isDark: boolean) => void;
}

/**
 * Toggles `.dark` class on target (default: `<html>`) orthogonally to
 * `data-theme`. Persists to localStorage under `capsule-theme-mode`.
 * On first mount reads persisted value, falling back to `prefers-color-scheme`.
 */
export const DarkModeToggle = (props: IProps) => {
  const [isDark, setIsDark] = createSignal(false);

  const apply = (dark: boolean) => {
    const el = props.target ?? document.documentElement;
    if (dark) {
      el.classList.add('dark');
      // Дублируем `.dark` на <body> — некоторые сторонние пакеты (solid-map-gl)
      // наблюдают именно `document.body.classList` через MutationObserver и
      // не реагируют на изменения у <html>.
      document.body?.classList.add('dark');
    } else {
      el.classList.remove('dark');
      document.body?.classList.remove('dark');
    }
  };

  onMount(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    let initial: boolean;
    if (stored !== null) {
      initial = stored === 'dark';
    } else {
      initial = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    setIsDark(initial);
    apply(initial);
  });

  const toggle = () => {
    const next = !isDark();
    setIsDark(next);
    apply(next);
    localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    props.onChange?.(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}
      class={`px-3 py-1.5 text-sm rounded-md border border-border bg-card text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${props.class ?? ''}`}
    >
      {isDark() ? '☀' : '☾'}
    </button>
  );
};
