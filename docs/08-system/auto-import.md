---
tags: [hca, system, build]
status: documented
---

# 📦 Auto-import + .capsule/registry

Капсула спрятана за двумя слоями автоматики: глобальные wrapper-функции и namespaced ленивые компоненты. Поэтому в `apps/sandbox` нет ни одного `import`-а для `Page`, `Widget`, `Entities`, `Controllers` и т.д.

## Два источника

### 1. Wrapper-функции (от `@capsuletech/core`)

Подключаются через `unplugin-auto-import`:

```ts
AutoImport({
  imports: [{ '@capsuletech/core': ['Page', 'Widget', 'Entity', 'Controller', 'Feature'] }],
  dts: './@types/capsule-imports.d.ts',
})
```

Доступны **глобально** в любом `.tsx` внутри сборки: можно писать `Page(...)`, `Entity(...)` без импортов.

### 2. Реестры компонентов (от твоего же приложения)

Папка `.capsule/registry/`. Сейчас здесь один файл — `wrappers.ts`, который **генерится** [[vite-plugins#ExportGeneratorPlugin|ExportGeneratorPlugin]] на лету.

Структура файла отражает структуру `apps/<app>/src/`:

```ts
// .capsule/registry/wrappers.ts (автогенерация)
import { lazy } from 'solid-js';

export const Widgets = {
  Forms: {
    Auth: lazy(() => import('@widgets/forms/_auth') as Promise<{ default: any }>),
  },
  Lists: {
    Base: lazy(() => import('@widgets/lists/base') as Promise<{ default: any }>),
  },
};

export const Entities = {
  Viewer: {
    LoginForm: lazy(() => import('@entities/viewer/loginForm') as Promise<{ default: any }>),
  },
};

export const Controllers = {
  Universal: {
    Form: lazy(() => import('@controllers/universal/form') as Promise<{ default: any }>),
    List: lazy(() => import('@controllers/universal/list') as Promise<{ default: any }>),
    Validator: lazy(() => import('@controllers/universal/validator') as Promise<{ default: any }>),
  },
};
```

`unplugin-auto-import` сканирует `dirs: ['.capsule/registry']` и делает все экспорты глобальными.

## Что в итоге доступно глобально

| Имя | Источник | Что |
|---|---|---|
| `Page`, `Widget`, `Entity`, `Controller`, `Feature` | `@capsuletech/core` | Wrapper-функции |
| `Widgets.<Group>.<Name>` | `.capsule/registry/wrappers.ts` | Lazy-компонент |
| `Entities.<Group>.<Name>` | то же | Lazy-компонент |
| `Controllers.<Group>.<Name>` | то же | Lazy-компонент |
| `Features.<Group>.<Name>` | то же | Lazy-компонент |

## Где живёт всё .capsule/

```
.capsule/
├── index.html              входная точка сборки
├── tsconfig.json           tsconfig, на котором работает esbuild
├── registry/
│   └── wrappers.ts         автогенерация ExportGeneratorPlugin
├── routes/
│   ├── __pages/...         автогенерация RouterPlugin
│   └── routeTree.gen.ts    автогенерация TanStack Router
└── @types/
    └── capsule-imports.d.ts  типы от unplugin-auto-import
```

> [!info]
> Папка `.capsule/` — артефакт сборки. Её безопасно удалять; будет восстановлена при следующем `dev`/`build`.

## Подводные камни

- **IDE может не видеть глобальные имена** до первого запуска dev-сервера, потому что `.d.ts` генерится в рантайме. После первого запуска — TypeScript цепляется и автодополняет.
- **Имя файла = имя в namespace.** `widgets/forms/auth.tsx` → `Widgets.Forms.Auth`. Это `names(...).className` из `@nx/devkit` (PascalCase).
- **Default export не обязателен.** Генератор берёт `module.default || первая function-экспорт`. См. [[vite-plugins#HMRWrappingPlugin|HMRWrappingPlugin]] — он сам добавляет `export default`.

## Связанное

- [[vite-plugins]]
- [[layers]]
