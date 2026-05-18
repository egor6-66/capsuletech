---
tags: [hca, system, building.ts]
status: documented
---

# 🛠️ Vite-плагины

Все плагины живут в `packages/builders/vite/src/plugins/` и подключаются в `packages/builders/vite/src/defines/capsuleConfig.ts` (раньше — `packages/system/vite/src/plugins/` + `packages/core/src/builder/config.ts`, до builders-consolidation, PR #20).

## ExportGeneratorPlugin

**Файл:** `packages/builders/vite/src/plugins/exportGenerator.ts`

Следит за изменениями в `apps/<app>/src/{widgets,entities,controllers,features}/**` и поддерживает в актуальном состоянии файл-реестр:

```
.capsule/registry/wrappers.ts
```

Содержимое — глубокое дерево `lazy()`-импортов:

```ts
// генерируется автоматически
import { lazy } from 'solid-js';
export const Widgets = {
  Forms: {
    Auth: lazy(() => import('@widgets/forms/_auth') as Promise<{ default: any }>),
  },
};
export const Entities = {
  Auth: {
    LoginForm: lazy(() => import('@entities/_auth/loginForm') as Promise<{ default: any }>),
  },
};
// и т.д. для controllers, features
```

Дальше этот файл подсасывается через `unplugin-auto-import` (см. [[auto-import]]).

**Используемые библиотеки:** `ts-morph` (правка AST), `@nx/devkit/names` (нормализация PascalCase).

**События:** `add`, `addDir`, `unlink`, `unlinkDir`. На `add` — добавляется ветка дерева, на `unlink` — удаляется, и если после удаления родитель пуст — удаляется и он.

**Initial scan:** при старте dev-сервера плагин рекурсивно обходит `entities / controllers / features / widgets` в `apps/<app>/src/` и эмулирует `add`-ивент для каждого существующего файла. Без этого Vite-чокидар (с `ignoreInitial: true`) не выстреливает на ранее существовавшие файлы — registry мог оказаться неполным после удаления `.capsule/registry/wrappers.ts` или после переключения веток.

> [!warning]
> При пустом файле (например, `loginForm.tsx` нулевой длины) плагин всё равно создаст запись в реестре, и при попытке использовать её в JSX произойдёт runtime-error.

## RouterPlugin

**Файл:** `packages/builders/vite/src/plugins/router/index.ts`

Двухсоставной плагин:

1. **Generator** — следит за `apps/<app>/src/pages/**`. На каждый файл создаёт зеркальный route-файл из шаблона:
   ```
   src/pages/auth/login.tsx
        ↓
   .capsule/routes/__pages/__auth/login.tsx
   ```
   Содержимое генерируется из `template/__name__.tsx.template` через `generateFromTemplates` (`@capsuletech/file-manager`):
   ```tsx
   import { lazy } from 'solid-js';
   const Login = lazy(() => import('@pages/_auth/login') as Promise<{ default: any }>);
   import { createFileRoute } from '@tanstack/solid-router';
   export const Route = createFileRoute('/_auth/login')({ component: Login });
   ```

2. **TanStackRouterVite** — стандартный плагин TanStack, который из `.capsule/routes/` собирает `routeTree.gen.ts`.

**Префикс `__`** в путях директорий — это TanStack-конвенция для «pathless layout» сегментов.

**Защита:** перед `rm` нормализуются пути и блокируется удаление корневого `outDir`.

## CompliancePlugin

**Файл:** `packages/builders/vite/src/plugins/compliance.ts`

Тонкая обёртка над `@capsuletech/compliance.check()`. Запускается в `transform`-хуке (enforce: 'pre'), парсит файл через babel, ловит upward / horizontal / disallowed import + side-effect-fetch.

Дефолтный режим `warn` — нарушения логируются как warnings, dev-server не валится. Переключается в `error` когда репо чистое:

```ts
plugins.CompliancePlugin({ mode: 'error' });
```

Подробнее — [[compliance|@capsuletech/compliance]].

## HMRWrappingPlugin

**Файл:** `packages/builders/vite/src/plugins/HMRWrapping.ts`

Pre-transform на babel-AST. Решает проблему: HMR в Solid требует `export default`, и не любит, когда экспортируется значение, а не компонент.

**Что делает:**

```tsx
// исходник
const Login = Page(({ Layout }) => <Layout />);
```

```tsx
// после плагина
const Login = (props) => Page(({ Layout }) => <Layout />)(props);
export default Login;
```

**Триггеры:** распознаются вызовы `Page`, `Widget`, `Entity`, `Feature`, `Controller` (можно расширить через аргумент плагина).

**Что меняется:**
- имя переменной капитализируется (`login` → `Login`),
- инициализация оборачивается в стрелку с пробросом `props`,
- если `default export` отсутствует — добавляется.

**Без этого плагина:** при HMR Solid роняет приложение с ошибкой про невалидный компонент.

> [!warning] Грабли при дебаге
> `@capsuletech/vite-builder` отгружается консьюмеру **только через `dist/`** (см. `package.json#main`). Это значит:
> 1. Правка в `src/plugins/HMRWrapping.ts` без `pnpm --filter @capsuletech/vite-builder build` ни на что не повлияет.
> 2. **После** ребилда нужно **полностью убить** dev-процесс (Ctrl+C). `r` в Vite-prompt и HMR-reload **не** перечитывают плагин-модули — они импортятся ровно один раз при старте сервера.
>
> Быстрый smoke-тест что плагин действительно подтянулся: поставить `console.log('[HMR] module loaded')` на верхнем уровне (вне `transform`). Если на старте лога нет — dev-процесс держит старую `dist` в памяти Node.

## Watcher (общий ресурс)

**Файл:** `packages/builders/vite/src/utils/watcher.ts`

Singleton `WatcherManager` подписывает несколько плагинов на один `server.watcher` без дублирования. И ExportGenerator, и RouterPlugin используют его.

API:
```ts
watcherManager.init(server, watchPath);
watcherManager.subscribe(watchPath, {
  onStructureChange: (event, paths) => { ... },
  onContentChange: (paths) => { ... },
});
```

## Сборка конфига

**Файл:** `packages/builders/vite/src/defines/capsuleConfig.ts`

```ts
{
  root: '<workspace>/.capsule',           // Vite работает из .capsule, не из apps/sandbox
  build: { rollupOptions: { input: '.capsule/index.html' } },
  plugins: [
    ExportGeneratorPlugin({ out: '.capsule/registry/wrappers.ts', watchDir: 'src' }),
    RouterPlugin({ watchDir: 'src', outDir: '.capsule/routes' }),
    HMRWrappingPlugin(),
    tsconfigPaths({ projects: ['.capsule/paths.config.json'] }),
    solidPlugin(),
    tailwindcss(),
    AutoImport({
      imports: [{ '@capsuletech/core': ['Page', 'Widget', 'Entity', 'Controller', 'Feature'] }],
      dirs: ['.capsule/registry'],
      dts: './@types/capsule-imports.d.ts',
    }),
  ],
  resolve: { alias: [...] },              // ручные алиасы для @capsuletech/*
}
```

> [!warning]
> Алиасы здесь и в `tsconfig.base.json` дублируются. Если добавляешь пакет — обнови **обе точки**.

## Связанное

- [[auto-import]]
- [[cli]]
- [[core|@capsuletech/core]]
