import { createSignal, For, onMount } from 'solid-js';

const STORAGE_KEY = 'capsule-theme';

// Eager-импорт всех тем — сами CSS-файлы попадут в бандл потребителя,
// а имена пойдут в выпадайку. Не надо отдельно подключать @capsuletech/web-style/themes.
// @ts-expect-error
const themeModules = import.meta.glob('../themes/*.css', { eager: true });
const DISCOVERED_THEMES = Object.keys(themeModules)
  .map((p) => p.match(/([^/]+)\.css$/)?.[1] ?? '')
  .filter((n) => n && n !== 'index')
  .sort();

interface IProps {
  /** Список имён тем. По умолчанию — все темы из ../themes/*.css. */
  themes?: string[];
  /** Куда вешать data-theme. По умолчанию — `<html>`. */
  target?: HTMLElement;
  /** Стартовая тема, если в localStorage пусто. */
  defaultTheme?: string;
  /** Доп. классы на корневой `<select>`. */
  class?: string;
  /** Колбэк при смене темы. */
  onChange?: (theme: string) => void;
}

/**
 * Рантайм-свитчер темы: пишет `data-theme="X"` на target-элемент и сохраняет
 * выбор в localStorage. CSS-переменные темы скоупаются именно этим атрибутом
 * (см. scripts/scope-themes.mjs).
 */
export const ThemeSwitcher = (props: IProps) => {
  const themes = () => props.themes ?? DISCOVERED_THEMES;
  const [current, setCurrent] = createSignal<string>('');

  const apply = (name: string) => {
    const target = props.target ?? document.documentElement;
    target.setAttribute('data-theme', name);
  };

  onMount(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const list = themes();
    const initial = stored && list.includes(stored) ? stored : (props.defaultTheme ?? list[0]);
    if (!initial) return;
    setCurrent(initial);
    apply(initial);
  });

  const select = (name: string) => {
    setCurrent(name);
    apply(name);
    localStorage.setItem(STORAGE_KEY, name);
    props.onChange?.(name);
  };

  return (
    <select
      value={current()}
      onChange={(e) => select(e.currentTarget.value)}
      class={`px-3 py-1.5 text-sm rounded-md border border-border bg-card text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring ${props.class ?? ''}`}
    >
      <For each={themes()}>{(name) => <option value={name}>{name}</option>}</For>
    </select>
  );
};
