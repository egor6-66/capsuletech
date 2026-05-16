---
tags: [hca, package, state]
status: documented
---

# @capsuletech/state

**Расположение:** `packages/state/`
**Зависит от:** `xstate`, `@xstate/solid`, `es-toolkit`

Тонкая обёртка над XState для интеграции с Solid + helpers для tag-операций.

## API

```ts
import {
  createState,
  createBridge,
  pickByTags,
  omitByTags,
  matchByTags,
  matchEntryByTags,
} from '@capsuletech/state';

import type {
  IDefineStateSchema,
  IStateHandlers,
  IMachineContext,
} from '@capsuletech/state';
```

## `createState(schema)`

Фабрика, которая по `IDefineStateSchema` строит **конкретную** XState-машину:

- `states` из схемы → реальные XState-стейты (без entry/exit действий — те живут в [[controller-proxy|createLogicWrapper]]).
- Динамические переходы: для каждого имени стейта `S` генерится транзит `__GOTO_S__: '.S'`. Через них работает `state.set('foo')`.
- Универсальные store-ивенты: `SET_DATA`, `SET_LOADING`, `SET_STYLES`, `SET_ERRORS`, `REGISTER_COMPONENT`, `UNREGISTER_COMPONENT` — работают на любой машине, мутируют `context`.

Структура `context`:

```ts
{
  data:       TCtx,                    // переданный schema.context
  loading:    false,
  errors:     {} as Record<string, string>,
  styles:     {} as Record<string, string>,
  components: {} as Record<string, ITarget>,
}
```

> [!info]
> UI-события (`onClick`, `onInput`, ...) и `onInit`/`onExit` обрабатываются **не** через XState event-bus, а через [[controller-proxy|ControllerProxy]] и `createEffect` в [[controller-proxy|createLogicWrapper]]. XState — источник правды для `state.value` и transitions; всё остальное живёт сверху. См. [[008-hybrid-fsm-api|ADR 008]].

## `createBridge(state, send)`

Геттер-обёртка над XState `state`/`send`. Solid реактивно ловит обращения через геттеры.

```ts
{
  // снимки (реактивно через геттеры)
  ctx, loading, styles, errors, components,

  // мутации (отправляют ивент в машину)
  update(payload),               // SET_DATA
  setLoading(value),             // SET_LOADING
  setStyles(styles),             // SET_STYLES
  setErrors(errors),             // SET_ERRORS
  registerComponent(payload),    // REGISTER_COMPONENT
  unregisterComponent(id),       // UNREGISTER_COMPONENT

  // tag-операции (объединяют meta.tags + dynamicMeta.tags)
  pick(tags, opts),              // Record<id, ITarget> — найти всех с тегами
  omit(tags, opts),              // Record<id, ITarget> — отбросить с тегами
  match(tags, opts),             // ITarget | undefined  — первый совпавший
  matchEntry(tags, opts),        // (ITarget & { id }) | undefined
}
```

Опции для tag-операций: `{ lookDynamic?: boolean }` — учитывать ли `dynamicMeta.tags`. По умолчанию `true` (то есть Widget-сценарные теги тоже матчатся).

## `helpers` (низкоуровневые)

Те же `pickByTags / omitByTags / matchByTags / matchEntryByTags` экспортируются напрямую — для случаев, когда работаем с `components`-картой не через bridge:

```ts
import { pickByTags } from '@capsuletech/state';
const inputs = pickByTags(componentsMap, ['@inputs']);
```

Отличие от методов bridge: эти принимают `data: ComponentsList` первым аргументом и `lookDynamic: boolean` третьим (без объекта-опций).

## Где используется

- [[controller-proxy|createLogicWrapper]] создаёт по одной машине на каждый Controller/Feature.
- [[ui-proxy|UiProxy]] зовёт `store.registerComponent({ [id]: ... })` / `unregisterComponent(id)` через bridge на mount/unmount компонента.
- Хэндлеры Controller/Feature получают `store` в [[controller-proxy|IHandlerApi]] и используют `pick/omit/match` для адресации компонентов по тегам.

## Связанное

- [[controller-proxy]]
- [[ui-proxy]]
- [[tagging-system]]
- [[001-xstate-as-canonical-fsm|ADR 001]] · [[008-hybrid-fsm-api|ADR 008]]
