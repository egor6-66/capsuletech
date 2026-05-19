import type { CanvasEventHandler, CanvasUnsubscribe, ICanvasCommand, ICanvasEvent } from './bridge';
import type { CanvasLifecycle, ICanvasError, ICanvasLoadProgress } from './lifecycle';

/**
 * Контракт, который реализует каждый адаптер движка (`canvas-three`,
 * `canvas-ue`, ...). Controller из `canvas-host` дёргает методы в строгом
 * порядке:
 *
 *   load → mount → start → (pause/resume)* → dispose
 *
 * Правила:
 *   - адаптер НЕ владеет canvas-элементом — он приходит из Solid, удалять/
 *     заменять его нельзя; адаптер только присоединяется/отсоединяется;
 *   - адаптер обязан эмитить переходы через `onState`, чтобы FSM Controller'а
 *     оставалась в синхроне;
 *   - все ошибки (включая фейлы загрузки/инициализации) пробрасываются через
 *     `onError`, а не выбрасываются из методов после успешного `load()`.
 *
 * Дженерики:
 *   - `TConfig`   — конфиг загрузки (URL ассетов, опции движка);
 *   - `TCommand`  — union поддерживаемых команд (`{type:'camera:move', ...}`);
 *   - `TEvent`    — union эмитируемых событий (`{type:'object:clicked', ...}`).
 */
export interface ICanvasEngineAdapter<
  TConfig = unknown,
  TCommand extends ICanvasCommand = ICanvasCommand,
  TEvent extends ICanvasEvent = ICanvasEvent,
> {
  /** Стабильный идентификатор: `'three' | 'babylon' | 'ue' | …`. */
  readonly name: string;

  /** Загрузка ассетов / WASM / шейдеров. Прогресс через `onProgress`. */
  load(
    config: TConfig,
    opts?: { onProgress?: (p: ICanvasLoadProgress) => void; signal?: AbortSignal },
  ): Promise<void>;

  /** Привязка к DOM-элементу `<canvas>`. Требует завершённого `load()`. */
  mount(canvas: HTMLCanvasElement): Promise<void>;

  /** Старт рендер-цикла. */
  start(): void;

  /** Приостановка рендер-цикла без освобождения ресурсов. */
  pause(): void;

  /** Возобновление из `paused`. */
  resume(): void;

  /** Финальная очистка: GL-context, WASM-память, подписки. Terminal. */
  dispose(): Promise<void>;

  /** RPC: послать команду, дождаться ответа. Конкретные команды — в `TCommand`. */
  send<R = unknown>(command: TCommand): Promise<R>;

  /** Подписка на события движка (`object:clicked`, `scene:loaded`, …). */
  on<E extends TEvent['type']>(
    event: E,
    handler: CanvasEventHandler<Extract<TEvent, { type: E }>>,
  ): CanvasUnsubscribe;

  /** Подписка на переходы lifecycle-FSM (`running → paused`, …). */
  onState(handler: (state: CanvasLifecycle) => void): CanvasUnsubscribe;

  /** Подписка на ошибки. Все runtime-ошибки приходят сюда, не throw. */
  onError(handler: (err: ICanvasError) => void): CanvasUnsubscribe;
}
