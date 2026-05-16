---
tags: [hca, adr, implemented]
status: implemented
date: 2026-05-10
---

# ADR 004 — Линтер для compliance (No Upward / No Horizontal imports)

> [!success] Реализовано
> Пакет `@capsuletech/compliance` + Vite-плагин `CompliancePlugin` подключены в `packages/core/src/builder/config.ts`. Дефолтный режим — `warn`. Описание API и rules — [[compliance|@capsuletech/compliance]].

## Контекст

[[golden-rules]] запрещает upward и horizontal импорты, но **никакая автоматика** этого не проверяет. Сейчас единственная защита — ручной ревью. На проекте размером с sandbox это терпимо, при росте регламент размоется.

Что сейчас не enforced:
1. Entity тянет Feature/Controller/Widget.
2. `entities/auth/A.tsx` импортирует `entities/auth/B.tsx` (горизонталь внутри слоя).
3. Controller делает `fetch` (должно быть только во Feature).
4. Widget содержит бизнес-логику (`if`/`fetch`).

## Решение

Реализовать **`@capsuletech/compliance`** — двухсоставной чек:

1. **Vite-плагин `compliancePlugin`** (`packages/system/vite/src/plugins/compliance.ts`) — проверяет в `transform`-хуке, валит `dev`/`build` при нарушении.
2. **CLI-команда `capsule check`** (`packages/cli`) — обходит дерево статически, без Vite, для CI и pre-commit.

Оба используют **общее ядро** `@capsuletech/compliance` (новый пакет в `packages/system/compliance/`), которое инкапсулирует:
- классификатор «слой по пути файла»,
- таблицу разрешённых импортов,
- AST-парсер (Babel — уже в deps),
- репортер с `file:line:col` + советом.

> [!info]
> Biome 1.x не поддерживает кастомные правила в нужном объёме. ESLint — это новая build-зависимость и второй конфиг. Свой плагин даёт точный контроль над семантикой слоёв и ничего лишнего не приносит.

## Архитектура чекера

### Классификатор слоя

```ts
// packages/system/compliance/src/classify.ts
type Layer = 'entity' | 'controller' | 'feature' | 'widget' | 'page' | 'system' | 'app';

function classify(absPath: string): Layer | null;
// '/apps/sandbox/src/entities/_auth/loginForm.tsx' → 'entity'
// '/apps/sandbox/src/widgets/forms/_auth.tsx'      → 'widget'
// '/packages/ui/src/components/button/button.tsx' → 'system'
// '/.capsule/registry/wrappers.ts'                → null  (skip)
```

### Таблица правил

```ts
// packages/system/compliance/src/rules.ts
const allowed: Record<Layer, RegExp[]> = {
  entity: [
    /^solid-js/,
    /^@capsuletech\/style/,
    /^@capsuletech\/ui/,
    /^\.\.?\//,           // относительные импорты внутри своей папки
  ],
  controller: [
    /^solid-js/,
    /^xstate/,
    /^@xstate\/solid/,
    /^@capsuletech\/(state|router|style)/,
    /^es-toolkit/,
  ],
  feature: [
    // всё, что у controller, плюс API-клиенты:
    ...,
    /^@app\/api/,         // API-слой приложения
  ],
  widget: [
    /^solid-js/,
    /^@capsuletech\/(ui|style)/,
    // namespaces из .capsule/registry приходят через auto-import — их в коде не видно
  ],
  page: [
    /^solid-js/,
    /^@capsuletech\/(ui|style)/,
    /^@tanstack\/solid-router/,
  ],
  system: [/.*/], // системные пакеты не ограничиваем
  app: [/.*/],
};
```

### Запрет горизонталей

Дополнительная проверка: внутри слоя `X/<group>/<name>` запрещён импорт из `X/<other-group>` или `X/<group>/<sibling>`. Реализуется отдельным правилом в чекере.

### Запрет «опасных» вызовов

Помимо импортов — запрет вызовов `fetch(`, `XMLHttpRequest`, `axios.*` в `controllers/`, `entities/`, `widgets/`, `pages/`. Только в `features/`.

> [!info]
> Это AST-чек на `CallExpression`, не строковый. Работает на Babel-AST, который уже парсится для импортов.

## Vite-плагин

```ts
// packages/system/building.ts/src/plugins/compliance.ts
export const CompliancePlugin = (opts?: { mode?: 'error' | 'warn' }): Plugin => ({
  name: 'capsule-compliance',
  enforce: 'pre',
  transform(code, id) {
    const violations = check(id, code);
    if (!violations.length) return null;
    const msg = formatViolations(violations);
    if (opts?.mode === 'warn') this.warn(msg);
    else this.error(msg);
  },
});
```

## CLI

```bash
node packages/cli/bin/capsule.mjs check          # обход всего, exit 1 при нарушении
node packages/cli/bin/capsule.mjs check --fix    # (опционально) автодвижение неправильных импортов в Widget — TBD
```

В CI: вызов `capsule check` после `pnpm install`.

## Поэтапный rollout

1. **Этап 0 (сейчас).** Реализовать ядро + Vite-плагин в режиме `mode: 'warn'`. Включить в sandbox. Собрать список реальных нарушений в текущем коде.
2. **Этап 1.** Починить нарушения. Перевести Vite-плагин в `mode: 'error'` (по умолчанию).
3. **Этап 2.** Добавить CLI-команду + GitHub Action.
4. **Этап 3.** (опционально) Автофикс через ts-morph: предложение «вынеси этот импорт в Widget».

## Альтернативы

- **ESLint + `eslint-plugin-boundaries`** — рабочий вариант, но добавляет ESLint как вторую build-зависимость (Biome уже стоит). Отвергнуто.
- **Biome custom rules** — ограничены в Biome 1.x. Отвергнуто.
- **`madge --circular` + grep по импортам** — слишком грубо, не различает слои внутри `apps/`. Отвергнуто.

## Последствия

### Положительные
- Регламент превращается из договорённости в инвариант.
- Новый разработчик не сможет случайно нарушить правило — даже без знания HCA.
- Нарушения видны в `dev` сразу, не на ревью.

### Отрицательные
- Новый пакет `@capsuletech/compliance` (поддерживать).
- Babel-парсинг каждого файла в `transform` стоит времени; для крупных проектов — заметно. Mitigation: кэширование по hash, скип `node_modules`.
- Точная таблица allowlist'ов потребует подгонки под реальные нужды (например, разрешить ли `lodash-es` во всех слоях?).

## Open questions

> [!question]
> 1. Включаем ли первый rollout сразу как `error`, или сначала `warn`?
> 2. Список разрешённых внешних библиотек по слоям — фиксировать ли в коде, или вынести в `capsule.config.ts`?
> 3. Что делать с тестовыми файлами (`*.spec.ts`) — ослабленный режим?

## Связанное

- [[golden-rules]]
- [[layers]]
- [[vite-plugins]]
- [[002-controller-vs-feature|ADR 002]] (типизация services тоже даёт compile-time enforcement)
