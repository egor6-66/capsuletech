# @capsuletech/web-editor

Design-time зона визуального редактора: реестр спецификаций компонентов (manifests), операции над JSON-деревом (state) и generic-инспектор пропсов (inspector). Все три раньше жили как отдельные пакеты (`@capsuletech/web-manifests`/`-editor-state`/`-inspector`) — слиты в один с подпутями.

```ts
// Можно одним импортом, но для tree-shaking предпочтительно через subpath:
import { getManifest, canAcceptChild } from '@capsuletech/web-editor/manifests';
import { addNode, moveNode }           from '@capsuletech/web-editor/state';
import { Inspector }                   from '@capsuletech/web-editor/inspector';
```

Runtime-рендер по JSON-схеме — в отдельном пакете [`@capsuletech/web-renderer`](../renderer): он без deps на zod/manifests и подходит для прода.

Сборка: `pnpm nx build @capsuletech/web-editor` (multi-entry: `index` + `manifests` + `state` + `inspector`).
