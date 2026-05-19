# @capsuletech/canvas-three

Реализация [`ICanvasEngineAdapter`](../host/src/adapter.ts) для **Three.js**.
Первый рабочий движок в namespace `canvas-*` — эталон, по которому будут
делаться остальные адаптеры (Babylon, Unreal, Unity).

## План

```ts
import { createThreeAdapter } from '@capsuletech/canvas-three';

const adapter = createThreeAdapter({
  // Three-specific config (sceneUrl, lights, postprocessing, …)
});

// adapter: ICanvasEngineAdapter<ThreeConfig, ThreeCommand, ThreeEvent>
```

### Маппинг lifecycle → Three.js

| `CanvasLifecycle` | Что делает адаптер |
|---|---|
| `loading` | Грузит `GLTFLoader` сцены / текстуры / HDR-окружение. Прогресс через `THREE.LoadingManager`. |
| `initializing` | Создаёт `WebGLRenderer`, `Scene`, `PerspectiveCamera`. Compile shaders (`renderer.compile`). |
| `ready` | Привязан к canvas через `renderer.setAnimationLoop(null)`. Не рендерит. |
| `running` | `renderer.setAnimationLoop(tick)` запущен. |
| `paused` | `renderer.setAnimationLoop(null)` (тики останавливаются, ресурсы живы). |
| `disposing` | `scene.traverse(geometry.dispose / material.dispose)` + `renderer.dispose()`. |

### Маппинг bridge → Three.js

Команды (`adapter.send`):
- `camera:move` / `camera:lookAt` → методы `PerspectiveCamera`.
- `scene:add` / `scene:remove` → `scene.add` / `scene.remove`.
- `viewport:resize` → `renderer.setSize` + `camera.aspect`.
- `raycast` → `Raycaster.intersectObjects(scene, true)`.

События (`adapter.on`):
- `object:clicked` → раскастер на pointerup, рассылка по hit'ам.
- `frame:rendered` → перед/после каждого тика (для FPS-счётчиков).
- `scene:loaded` → когда `LoadingManager.onLoad` стрельнул.

## Что НЕ делает

- Не предоставляет hooks вида `<MeshComponent />` (это не Solid-Three Fiber).
  Three-объекты живут **внутри** адаптера, наружу — только bridge-команды.
  Это намеренно: один и тот же Controller должен уметь работать поверх UE/Unity
  без переписывания.
- Не включает physics/post-processing — это отдельные команды/опции, не часть
  базового адаптера.

## Статус

Scaffold. Реализация — после ревью контракта.
