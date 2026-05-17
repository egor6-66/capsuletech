---
tags: [hca, package, core]
status: documented
---

# @capsuletech/web-core

**Расположение:** `packages/web/core/`
**Зависит от:** `@capsuletech/web-state`, `@capsuletech/web-router`, `@capsuletech/web-ui`, `@capsuletech/web-style`, `@capsuletech/web-query`, `@capsuletech/web-profiler`, `@capsuletech/shared-zod`, `@capsuletech/vite-builder`, `@capsuletech/shared-file-manager`

Сердце фреймворка. Тут живут:

- 6 wrapper-функций ([[layers|слои HCA]] + `Shape`),
- двойная Proxy-механика ([[ui-proxy]] + [[controller-proxy]]),
- path-tracker для [[shape]],
- `createRoot` и `BaseProviders`.

## Карта файлов

```
packages/web/core/src/
├── index.ts                       barrel: wrappers + Providers + interfaces
├── interfaces.ts                  re-export wrapper-интерфейсов (IAppConfig переехал в @capsuletech/web-query/app-config)
├── index.css                      (резерв — сами стили в @capsuletech/web-style)
├── create/
│   ├── index.ts
│   └── createRoot.ts              render(Component, #root) + ensureTheme
├── providers/
│   ├── index.ts
│   └── base.tsx                   BaseProviders — RouterProvider + (опц.) VitalsMonitoringProvider
└── wrappers/
    ├── index.ts                   реэкспорт Entity/Widget/Page + Controller/Feature/Shape + ShapeUiContext/useShapeUi
    ├── ctx.ts                     Solid Context — { state, store, controller, parent }
    ├── interfaces.ts              re-export ui/logic interfaces
    ├── ui/
    │   ├── entity.tsx · widget.tsx · page.tsx
    │   ├── interfaces.ts          IEntityWrapper / IWidgetWrapper / IPageWrapper + глобальные slot-интерфейсы (Widgets/Entities/Controllers/Features/Shapes/CapsuleApi)
    │   └── ui-kit/
    │       ├── imports.tsx        lazy()-обёртки над @capsuletech/web-ui
    │       └── proxy.tsx          UiProxy
    └── logic/
        ├── controller.tsx · feature.tsx (оба = createLogicWrapper(kind))
        ├── interfaces.ts          IDefineStateSchema / IHandlerApi / IServices / ITarget / IStateApi
        ├── utils/
        │   ├── createLogicWrapper.tsx
        │   └── proxy.ts           ControllerProxy
        └── shape/
            ├── wrapper.tsx · context.tsx · types.ts · ui-tracker.ts
```

## Точки входа

`package.json` экспортирует три подпути:

```jsonc
{
  "exports": {
    ".":          { "types": "./dist/index.d.ts",          "import": "./dist/index.mjs"          },
    "./create":   { "types": "./dist/create/index.d.ts",   "import": "./dist/create.mjs"   },
    "./providers":{ "types": "./dist/providers/index.d.ts","import": "./dist/providers.mjs"}
  }
}
```

Что откуда:

```ts
// @capsuletech/web-core (главный barrel)
import { Entity, Widget, Page, Controller, Feature, Shape, useShapeUi } from '@capsuletech/web-core';
import type { IDefineStateSchema, IHandlerApi /* ... */ } from '@capsuletech/web-core';

// IAppConfig живёт в @capsuletech/web-query (см. capsule.app.ts):
import type { IAppConfig } from '@capsuletech/web-query/app-config';

// @capsuletech/web-core/create — для apps/<app>/.capsule/index.ts
import { createRoot } from '@capsuletech/web-core/create';

// @capsuletech/web-core/providers — для apps/<app>/.capsule/bootstrap.tsx
import { BaseProviders } from '@capsuletech/web-core/providers';
```

## Зависимости wrapper'ов друг от друга

```
Page ────┐
Widget ──┼─→ Ui (lazy from @capsuletech/web-ui)
Entity ──┘   + UiProxy(ctx)
                ↑
                ctx ← Solid Context
                ↑
Controller, Feature ─→ создают ControllerProxy и кладут в Context
                       ↑
                       useMachine(createState(...))  // @capsuletech/web-state
Shape  ────→ читает proxied Ui из ShapeUiContext, который проставляет Entity
```

## Глобальные slot-интерфейсы

`wrappers/ui/interfaces.ts` объявляет пустые global-интерфейсы — `Widgets`, `Entities`, `Controllers`, `Features`, `Shapes`, `CapsuleApi`. Через `interface merging` их дополняет codegen (`.capsule/@types/slots.d.ts` от `ExportGeneratorPlugin`'а и `.capsule/@types/api.d.ts` от `EndpointsRegistryPlugin`). Это даёт типизацию слотов в Widget/Page/Entity и поля `services.api.<endpoint>` в Feature.

Сами реестры рантайма (`globalThis.Widgets`/`Entities`/…) кладёт `apps/<app>/.capsule/bootstrap.tsx` через `Object.assign(globalThis, registry)`.

## Что **не** входит в core

- API-клиенты — `@capsuletech/web-query` (Feature получает `services.api`).
- Bridge между Solid и XState — `@capsuletech/web-state`.
- UI-компоненты — `@capsuletech/web-ui`.
- Темизация — `@capsuletech/web-style`.
- Vite-плагины / builder — `@capsuletech/vite-builder`.

## Связанное

- [[layers]]
- [[ui-proxy]] · [[controller-proxy]] · [[shape]]
- [[state|@capsuletech/web-state]]
- [[ui|@capsuletech/web-ui]]
