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
├── interfaces.ts                  re-export ./wrappers/interfaces (IAppConfig переехал в @capsuletech/web-query/app-config)
├── create/
│   ├── index.ts
│   └── createRoot.ts              render(Component, container) + ensureTheme
├── providers/
│   ├── index.ts
│   └── base.tsx                   BaseProviders<TRouteTree> — RouterProvider + (опц.) VitalsMonitoringProvider
├── engine/                        внутренний runtime — НЕ публичный API
│   ├── ctx.ts                     ICtx / IControllerHandle + Solid Context, useCtx
│   ├── controller-proxy.ts        ControllerProxy (FSM dispatch + next-цепочка)
│   ├── ui-proxy.tsx               UiProxy + EVENT_HANDLERS
│   ├── logic-wrapper.tsx          createLogicWrapper('controller' | 'feature')
│   ├── derivation.ts              deriveInputType / deriveClassName / ...
│   └── registry.ts                getGlobalRegistry<K>(key) — единый для slot-registry
├── ui-kit/
│   ├── imports.tsx                lazy()-обёртки над @capsuletech/web-ui
│   └── index.ts
└── wrappers/
    ├── index.ts                   re-export Entity/Widget/Page/Controller/Feature/Shape + useShapeUi
    ├── interfaces.ts              IEntityRenderer/IWidgetRenderer/IPageRenderer + IDefineStateSchema/IHandlerApi/IServices/ITarget + Widgets/Entities/Controllers/Features/Shapes (CapsuleApi живёт в @capsuletech/web-query)
    ├── entity.tsx · widget.tsx · page.tsx
    ├── controller.tsx · feature.tsx (оба = createLogicWrapper(kind))
    └── shape/
        ├── index.ts
        ├── wrapper.tsx · context.tsx · ui-tracker.ts · types.ts
```

> Структура — после Phase E (engine/wrappers split). Раньше было
> `wrappers/{ui, logic}/...` с дублированием интерфейсов и шаппы внутри
> `wrappers/logic/shape/`.

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

`wrappers/interfaces.ts` объявляет пустые global-интерфейсы — `Widgets`, `Entities`, `Controllers`, `Features`, `Shapes`. Через `interface merging` их дополняет codegen `.capsule/@types/slots.d.ts` от `ExportGeneratorPlugin`'а. Это даёт типизацию слотов в Widget/Page/Entity.

Глобальный `CapsuleApi` (для типизации `services.api.<endpoint>` в Feature) живёт в `@capsuletech/web-query/src/createApi.ts` — родной дом, поскольку это возвращаемый тип `getApiClient()`. `EndpointsRegistryPlugin` сливает в него `InferApi<Endpoints>` через `.capsule/@types/api.d.ts`.

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
