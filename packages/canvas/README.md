# `@capsuletech/canvas-*`

Namespace для интеграции **opaque-движков** (canvas/WASM/WebGL engines) в HCA.

## Зачем отдельный namespace

Canvas-движки (Three.js, Babylon, Unreal HTML5, Unity WebGL, Phaser) ломают
центральный постулат HCA *"UI is a Shadow"*: они владеют собственным
event-loop'ом, рендер-кадром и стейтом, мы не можем их обернуть в `UiProxy` +
`meta`-теги. Поэтому они классифицируются как **opaque-Entity**: чёрный ящик,
с которым HCA-слои общаются через стандартизированный bridge-протокол
(`send` JS → engine, `on` engine → JS), а не через Proxy/meta.

См. `host/README.md` для деталей контракта.

## Подпакеты

| Пакет | Назначение |
|---|---|
| [`@capsuletech/canvas-host`](./host/README.md) | Контракт `ICanvasEngineAdapter`, lifecycle-FSM, bridge-протокол. Движко-агностичен. |
| [`@capsuletech/canvas-ui`](./ui/README.md) | UI-оверлеи для canvas-приложений (LoadingOverlay, ErrorOverlay, FpsCounter, PauseOverlay). Entity-обёртки поверх host'а. |
| [`@capsuletech/canvas-three`](./three/README.md) | Реализация адаптера для Three.js. Эталон + первый рабочий движок. |

Планируется (не в этом PR):
- `@capsuletech/canvas-babylon` — адаптер Babylon.js.
- `@capsuletech/canvas-ue` — адаптер Unreal Engine HTML5 (community fork 4.27, emscripten/WASM).

## Статус

Скаффолд + контракт. Реализаций пока нет — это PR на ревью архитектуры.
Все три подпакета вынесены из release-групп `nx.json` намеренно — публикация
включится после первой рабочей версии `canvas-three`.
