/**
 * Канонический жизненный цикл canvas-движка. Любой адаптер обязан проходить
 * именно эти состояния — внутренние нюансы (например, отдельные фазы загрузки
 * шейдеров у Three vs. WASM-instantiate у Unreal) сворачиваются в ближайшую
 * стандартную фазу.
 *
 * Переход:
 *   idle → loading → initializing → ready → running ↔ paused → disposing → disposed
 *                                                                       ↘ error (из любой фазы)
 */
export type CanvasLifecycle =
  | 'idle'
  | 'loading'
  | 'initializing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'disposing'
  | 'disposed'
  | 'error';

export interface ICanvasLoadProgress {
  /** Байт загружено суммарно по всем ассетам. */
  loaded: number;
  /** Общий размер, если известен. `undefined` для streaming-источников. */
  total?: number;
  /** Опциональная разбивка по ассетам. Формат — на усмотрение адаптера. */
  detail?: Record<string, { loaded: number; total?: number }>;
}

export interface ICanvasError {
  /** В какой фазе произошла ошибка. */
  phase: CanvasLifecycle;
  message: string;
  cause?: unknown;
}
