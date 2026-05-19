/**
 * Bridge-протокол: tagged-сообщения для общения JS ↔ engine.
 *
 * Почему именно tagged-messages, а не свободный imperative API:
 *   - адаптер может жить out-of-process (WASM worker, OffscreenCanvas), там
 *     все вызовы всё равно сериализуются;
 *   - Controller остаётся portable между движками: одна и та же FSM пишет
 *     `send({ type: 'camera:move', payload })` независимо от того, Three это
 *     или Unreal;
 *   - tag-namespace (`'<scope>:<verb>'`) упрощает аудит/телеметрию.
 *
 * Конкретные адаптеры сужают `TCommand` / `TEvent` через generics
 * (`ICanvasEngineAdapter<Config, ThreeCommand, ThreeEvent>`).
 */
export interface ICanvasCommand<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload?: TPayload;
}

export interface ICanvasEvent<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload?: TPayload;
}

export type CanvasEventHandler<E extends ICanvasEvent = ICanvasEvent> = (event: E) => void;

export type CanvasUnsubscribe = () => void;
