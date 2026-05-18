---
tags: [hca, adr, implemented]
status: implemented
date: 2026-05-18
---

# ADR 013 — `defineAppConfig` через explicit import, не через auto-import + transform

> [!success] Реализовано
> Identity-функция `defineAppConfig` экспортирована из `@capsuletech/web-query/app-config`. CLI-шаблон для новых apps использует explicit import. Legacy-bridge (`globalThis.defineAppConfig` инжект в jiti-runtime + regex-transform в `AppConfigPlugin`) оставлен для существующих apps (`sandbox` / `agent` / `ewc`) — они продолжают работать без изменений.

## Контекст

Контракт `apps/<app>/capsule.app.ts`:

```ts
export default defineAppConfig({
  meta: { tags: ['click'] },
  aliases: {},
  api: ({ mw }) => ({ middleware: [mw.cookies()] }),
});
```

`defineAppConfig` — это identity-функция (просто возвращает аргумент), нужна только для типизации (TS контекст подхватывает `IAppConfig` и даёт автокомплит).

В первой реализации `defineAppConfig` был глобальной фабрикой, инжектируемой в двух местах:

1. **Node side** (jiti reads `capsule.app.ts` через CLI): `packages/cli/src/cli/defines.ts` ставит `globalThis.defineAppConfig = identity`.
2. **Browser side** (Vite bundles `capsule.app.ts` в браузер): `AppConfigPlugin.transform` через regex заменяет `defineAppConfig(x)` на `((__x__)=>__x__)` — inline identity.

Оба механизма НЕОБХОДИМЫ, иначе сборка падает:

- Без (1) — jiti при load капсула-конфига даёт `ReferenceError: defineAppConfig is not defined`.
- Без (2) — браузер при загрузке `apps/<app>/.capsule/app-config.gen.ts` (который `import appConfig from '../capsule.app'`) даёт `ReferenceError` в проде.

## Проблема (S-8 в cleanup-plan)

**Это хрупкий контракт** — два независимых механизма для одного интерфейса. Каждый sneak-edge ломает сборку:

- **S-1** (закрыт): `AppConfigPlugin.transform` сравнивал `id` ↔ `configPath` через строгое `===`. На Windows `path.join` → backslash, Vite нормализует id к forward slash + добавляет query-суффиксы (`?import`, `?t=...`). Условие никогда не сматчилось → `defineAppConfig` уходил в браузер как bare identifier → `ReferenceError`. Чинилось `normalizePath(id)`-функцией; покрыто 7 тестами.
- Любая будущая правка regex'а / path-normalization — потенциальная регрессия того же класса.
- Регекс на bare identifier'е ловит и user-комментарии вида `// see defineAppConfig docs` — false-positive replace в комментариях, который технически не ломает (replace на identity), но мусорит код.

## Решение

**Identity-функция как обычный ESM export.** Импортируется в `capsule.app.ts` явно:

```ts
import { defineAppConfig } from '@capsuletech/web-query/app-config';
export default defineAppConfig({ ... });
```

В этой схеме:
- **Node side**: jiti обычно резолвит ESM-импорт через workspace-paths, identity-функция доступна без globalThis-инжекта.
- **Browser side**: Vite транспилирует обычный ESM-импорт, никаких transform-хаков.

Контракт типизации остаётся идентичным: TS видит `defineAppConfig<T extends IAppConfig>(config: T): T`, IDE автокомплит работает.

## Что выбрано в реализации

**Identity-функция доступна в `@capsuletech/web-query/app-config`** рядом с `IAppConfig`. Это logical location: оба нужны вместе для `capsule.app.ts`, оба — design-time только (зачем тащить в браузерный bundle, если apps уже его явно импортит).

**CLI-шаблон обновлён** — новые apps генерятся с explicit-import:

```ts
// packages/cli/src/templates/app/capsule.app.ts.template
import { defineAppConfig } from '@capsuletech/web-query/app-config';
export default defineAppConfig({ ... });
```

**Legacy-bridge оставлен для существующих apps:**
- `packages/cli/src/cli/defines.ts` всё ещё ставит `globalThis.defineAppConfig` (для jiti-load existing `capsule.app.ts` без explicit-import).
- `AppConfigPlugin.transform` всё ещё делает regex-replace (для Vite-бандла того же).

Это позволяет `sandbox` / `agent` / `ewc` не править. В будущем (когда apps мигрируют на explicit-import) legacy-bridge можно будет удалить отдельным проходом.

## Wrapper'ы (Page/Widget/Entity/Controller/Feature/Shape)

**НЕ затрагиваются.** Они остаются на `unplugin-auto-import` (см. `packages/builders/vite/src/defines/capsuleConfig.ts:AutoImport`). Причина:

- Wrapper'ы пишутся в **каждом файле** Entity/Widget/Page/Controller/Feature/Shape — десятки/сотни импортов. Auto-import даёт идиоматичный flat-стиль:
  ```tsx
  // apps/sandbox/src/entities/viewer/loginForm.tsx
  const LoginForm = Entity(({ Field, Button, Input }) => (...));
  export default LoginForm;
  ```
- В отличие от `defineAppConfig`, wrapper'ы НЕ участвуют в Vite-transform трюке. Они импортятся `AutoImport`'ом как обычные ESM-импорты из `@capsuletech/web-core` — то есть в browser-бандл попадают через стандартный путь. Class бага S-1 для них **невозможен**.
- Альтернатива (explicit import) добавила бы 5-6 строк в каждый файл слоя — overhead не окупается улучшением.

## Последствия

- `defineAppConfig` теперь стабильно резолвится через ESM. Будущие edge-баги класса S-1 невозможны для новых apps.
- Стартовый bundle для новых apps станет на 1 import меньше hidden, чем для existing (явный vs auto-injected). Косметика для DX (читая `capsule.app.ts` понятно откуда что).
- Existing apps НЕ ломаются — legacy-bridge оставлен.
- Когда последний app мигрирует на explicit-import (вручную) — `packages/cli/src/cli/defines.ts` и `AppConfigPlugin.transform` можно удалить, окончательно закрыв S-8.

## Альтернативы, которые мы НЕ взяли

- **Удалить legacy-bridge сейчас.** Сломает все existing apps. Юзер сейчас в активной разработке — не делать.
- **`defineAppConfig` в `@capsuletech/web-core`.** Близко, но web-core теперь НЕ тянет web-query (см. ADR'ы web-query). Identity-функция рядом с `IAppConfig` логичнее.
- **Полностью убрать `defineAppConfig` (использовать прямой literal).** Потеря автокомплита и runtime-проверки типов через TS — `as IAppConfig` для каждого case'а уродливо.

## Связанное

- [[001-xstate-as-canonical-fsm|ADR 001]] — другой контракт через wrapper-фабрики (`Controller((services) => schema)`).
- [[004-compliance-linter|ADR 004]] — другая area где fragility транспила могла бы быть проблемой; решена через линтер.
