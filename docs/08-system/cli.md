---
tags: [hca, system, cli]
status: documented
---

# 💻 CLI

**Пакет:** `@capsuletech/cli` (`packages/cli`)
**Бинарь:** `packages/cli/bin/capsule.mjs`

## Запуск

```bash
# из корня sandbox-приложения (apps/sandbox)
pnpm dev

# или напрямую
node packages/cli/bin/capsule.mjs              # интерактивное меню
node packages/cli/bin/capsule.mjs <subcmd>     # программный режим (commander)
```

`bin/capsule.mjs` принудительно включает цвет (`FORCE_COLOR=3`), пробует включить `isTTY` под JetBrains, и через `jiti` подгружает `src/index.ts`.

## Структура

```
packages/cli/src/
├── index.ts          re-export RunCli
├── cli/
│   ├── index.ts      главное меню
│   ├── dev-tools/    подменю Dev-инструментов
│   └── create-wrappers/  (закомментировано в текущей версии)
└── kit/
    ├── index.ts      barrel
    ├── controller.ts меню-цикл (intro → select → action → repeat)
    ├── shell.ts      вызов sh-команд через execa
    ├── store.ts      conf-стор для настроек
    ├── table.ts      console-table-printer
    └── ui.ts         clack/prompts обёртки
```

## Что умеет (текущая версия)

```
CAPSULE CLI
└── ⚙️ Инструменты разработки 🔧
    ├── 🚀 Разработка (Dev Server)        → createDevServer
    ├── 📦 Сборка (Build)                 → buildApp
    └── 👀 (watch-preview)                → createPreviewServer
```

Все три действия делегируют в `@capsuletech/vite-builder` (`packages/builders/vite/src/defines/capsuleConfig.ts`), который читает `capsule.config.ts` через `jiti` и кормит его в Vite.

## capsule.config.ts

В корне приложения (`apps/sandbox/capsule.config.ts`):

```ts
export default defineCapsuleConfig({
  devServerPort: 2233,
});
```

`defineCapsuleConfig` — глобальная функция, объявляется в `@capsuletech/core/builder/index.ts` через `globalThis.defineCapsuleConfig = (c) => c`.

## Расширение CLI

Чтобы добавить пункт меню:

1. Создать модуль с `action` (async-функция).
2. Добавить в `kit.controller({ options: [...] })` в `dev-tools/index.ts` или в новом подменю.

Меню работает на `kit.controller` (см. `kit/controller.ts`) — это просто цикл с `intro` + select.

## Связанное

- [[core|@capsuletech/core]]
- [[vite-plugins]]
