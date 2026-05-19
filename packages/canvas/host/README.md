# @capsuletech/canvas-host

Контракт и HCA-обвязка для встраивания canvas/WASM/WebGL-движков как
**opaque-Entity** — единый интерфейс к Three.js, Babylon, Unreal HTML5,
Unity WebGL, Phaser и т.п.

## Зачем

HCA построена вокруг идеи *"UI is a Shadow"*: разметка — немая проекция
логики, всё общение идёт через Proxy + `meta`-теги. Canvas-движки в эту
модель не вписываются:

- они владеют **своим event-loop** (`requestAnimationFrame`, WASM-тики);
- стейт лежит **внутри движка** (scene graph, ECS, GPU-буферы) и недоступен
  через DOM-обход;
- события приходят **не из DOM**, а через колбэки движка
  (`raycaster.intersect`, `onPointerClick`).

Поэтому здесь мы вводим явное исключение: canvas-движок — **opaque-Entity**.
HCA-слои не лезут к нему через Proxy, а общаются через стандартный
bridge-протокол.

> Подробное обоснование оформим как ADR в `docs/01-architecture/adr/` после
> ревью этого PR.

## Контракт

### `ICanvasEngineAdapter<TConfig, TCommand, TEvent>`

См. [`src/adapter.ts`](./src/adapter.ts). Реализует каждый адаптер
(`canvas-three`, `canvas-babylon`, `canvas-ue`).

Методы вызываются Controller'ом из `canvas-host` в строгом порядке:

```
load → mount → start → (pause/resume)* → dispose
```

Адаптер обязан эмитить переходы lifecycle через `onState` и пробрасывать
runtime-ошибки через `onError`, а не throw'ать после `load()`.

### Lifecycle FSM

См. [`src/lifecycle.ts`](./src/lifecycle.ts). Девять канонических состояний:

```
idle → loading → initializing → ready → running ↔ paused → disposing → disposed
                                                                    ↘ error
```

Внутренние фазы движка (например, отдельная instantiate-фаза WASM у Unreal)
сворачиваются в ближайшее каноническое состояние.

### Bridge-протокол

См. [`src/bridge.ts`](./src/bridge.ts). Tagged-messages в обе стороны:

```ts
// JS → engine
adapter.send({ type: 'camera:move', payload: { x: 0, y: 5, z: 10 } });

// engine → JS
const unsub = adapter.on('object:clicked', (e) => console.log(e.payload));
```

Почему tagged, а не свободный imperative API:
1. адаптер может жить out-of-process (worker, OffscreenCanvas) — там всё
   равно нужна сериализация;
2. Controller остаётся portable между движками;
3. namespaced-теги (`scope:verb`) удобны для аудита/телеметрии.

## HCA-обвязка (план, не в этом PR)

После того как контракт примем на ревью, `canvas-host` получит:

- **`createCanvasEntity(adapter)`** — Entity-обёртка, рендерит `<canvas data-meta>`,
  форвардит ref в Controller через Bridge.
- **`createCanvasController(adapter)`** — Controller с FSM, повторяющей
  `CanvasLifecycle`. Колбэки entry/exit дёргают `adapter.start/pause/dispose`.
- **`createCanvasFeature(adapter)`** — Feature, держит инстанс адаптера,
  экспонирует `send`/`on` для downstream-слоёв.

## Что НЕ делает этот пакет

- не реализует ни одного движка (это работа `canvas-three`, `canvas-ue`, ...);
- не предоставляет UI-оверлеи (loading, error, FPS) — это `canvas-ui`;
- не привязан к конкретному UI-фреймворку (Solid) на уровне типов — типы
  ссылаются только на `lib.dom` (`HTMLCanvasElement`, `AbortSignal`).
  Solid-биндинги добавим в HCA-обвязке выше.

## Статус

Scaffold + контракт. Открыто для обсуждения формы:
- название методов адаптера;
- имена состояний lifecycle;
- shape команд/событий (tagged-objects vs. строгие классы).
