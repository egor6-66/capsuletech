# @capsuletech/web-dnd

Лёгкий drag-and-drop для Solid.js. Pointer-based (поддерживает мышь и touch без отдельных backend'ов), без HTML5 native dragenter/dragleave-флэйков.

API:
- `DnDProvider` — корневой context-провайдер, держит активный draggable, pointer, drop-targets.
- `createDraggable(opts)` — делает элемент перетаскиваемым.
- `createDroppable(opts)` — делает элемент drop-зоной с `accepts`/`onDrop`.
- `createSortable(opts)` — sortable-список с reorder через `items`/`onReorder`.
- `DragOverlay` — render-prop overlay, который следует за курсором (visual preview).
- `useDnD()` — низкоуровневый доступ к state (для кастомных UI).

Сборка: `pnpm nx build @capsuletech/web-dnd`.

> Реализация может быть переписана позже под другой подход (HTML5 DnD spec или
> dedicated lib). Текущая API-форма — стабильный контракт; меняйте только если
> переписывается ВСЁ.
