/**
 * Path-tracker — Proxy который запоминает цепочку property-access'ов.
 *
 * Используется в Shape factory: `ui.Navigation.Item` возвращает объект с
 * захваченным путём `['Navigation', 'Item']`. На render-этапе Shape резолвит
 * этот путь по **реальному** проксированному Ui из Entity-контекста,
 * получая правильный wrapped-компонент (с UiProxy-event-binding'ом).
 *
 * Почему так: factory вызывается на import (один раз), real proxied Ui
 * ещё не существует. Tracker позволяет декларативно ссылаться на
 * `ui.X.Y`, а резолв делается lazy в момент рендера.
 */

const PATH = Symbol.for('@capsuletech/core:shape-ui-path');

type Tracker = ((..._: unknown[]) => unknown) & {
  readonly [PATH]: readonly string[];
  readonly [key: string]: Tracker;
};

export const createUiTracker = (path: readonly string[] = []): Tracker => {
  const target = (() => undefined) as unknown as Tracker;
  return new Proxy(target, {
    get(_, key) {
      if (key === PATH) return path;
      if (typeof key === 'symbol') return undefined;
      return createUiTracker([...path, key]);
    },
  }) as Tracker;
};

/** Возвращает путь tracker'а или `undefined`, если это не tracker. */
export const getTrackerPath = (x: unknown): readonly string[] | undefined => {
  if (typeof x !== 'function' && (typeof x !== 'object' || x === null)) return undefined;
  const p = (x as Record<symbol, unknown>)[PATH];
  return Array.isArray(p) ? (p as readonly string[]) : undefined;
};

/** Walks `root` по `path` — `root.a.b.c`. */
export const resolveByPath = (root: unknown, path: readonly string[]): unknown => {
  let cur: unknown = root;
  for (const seg of path) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
};
