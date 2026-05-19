# @capsuletech/canvas-ui

UI-оверлеи для canvas-приложений. Готовые Entity-обёртки, которые подписываются
на состояние движка через Bridge из [`@capsuletech/canvas-host`](../host/README.md)
и рендерят DOM поверх canvas — там, где привычная HCA-механика
(`meta`-теги, Proxy, store) уже работает нормально.

## Планируемые компоненты

| Entity | Назначение |
|---|---|
| `LoadingOverlay` | Прогресс-бар + статус во время `loading` / `initializing`. Слушает `onProgress` адаптера. |
| `ErrorOverlay` | Сообщение об ошибке + кнопка retry. Активируется в `error`. |
| `PauseOverlay` | Полупрозрачный экран в состоянии `paused`. |
| `FpsCounter` | Виджет FPS / frame-time. Опционально включается через config. |
| `FullscreenToggle` | Кнопка fullscreen → нативный Fullscreen API на родительском контейнере. |
| `ResizeObserver` | Helper, репортит размер контейнера → `adapter.send({ type:'viewport:resize' })`. |

Все компоненты — обычные HCA-Entity, использующие Solid + `data-meta`. Они **не**
opaque-Entity (это DOM, не canvas), и работают в рамках стандартного Proxy/meta
flow.

## Статус

Scaffold. Реализация — после того, как контракт `canvas-host`
зафиксируется на ревью.
