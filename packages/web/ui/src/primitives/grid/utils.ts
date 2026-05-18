import type { JSX } from 'solid-js';

/**
 * Один трек — число (превращается в `repeat(N, minmax(0,1fr))`), массив строк
 * (склеивается через пробел) или сырая CSS-строка.
 */
export type GridTrack = number | string | string[];

/** Gap — число (×0.25rem, как Tailwind spacing) или сырое CSS-значение. */
export type GridGap = number | string;

export const toTrack = (v: GridTrack): string => {
  if (typeof v === 'number') return `repeat(${v}, minmax(0, 1fr))`;
  if (Array.isArray(v)) return v.join(' ');
  return v;
};

export const toGap = (v: GridGap): string => (typeof v === 'number' ? `${v * 0.25}rem` : v);

/** `['a a b', 'c c b']` → `"'a a b' 'c c b'"` для `grid-template-areas`. */
export const toAreas = (areas: string[]): string => areas.map((row) => `'${row}'`).join(' ');

/**
 * Сериализует CSSProperties-объект в инлайн-строку. Используется, когда юзер
 * передал `style` строкой, а нам нужно приписать к ней вычисленные правила.
 */
export const serializeStyle = (s: JSX.CSSProperties): string =>
  Object.entries(s)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

/**
 * Мерж пользовательского `style` (строка | объект | undefined) с вычисленными
 * CSS-правилами. Возвращает то же, что подаётся в JSX `style` атрибут.
 */
export const mergeStyle = (
  computed: JSX.CSSProperties,
  user: JSX.CSSProperties | string | undefined,
): JSX.CSSProperties | string => {
  if (user === undefined) return computed;
  if (typeof user === 'string') {
    const head = serializeStyle(computed);
    return [head, user].filter(Boolean).join('; ');
  }
  return { ...computed, ...user };
};
