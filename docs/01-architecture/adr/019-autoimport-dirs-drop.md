---
tags: [hca, adr, implemented]
status: implemented
date: 2026-05-27
---

# ADR 019 — AutoImport `dirs:` dropped to break createApi self-injection cycle

> [!success] Status: implemented (2026-05-27)
> PR #165 (`1859c58`) — dropped `dirs:` from AutoImport config. TDZ-ошибка в `createApi` исчезла, цикл разорван.

## Контекст

AutoImport в `capsuleConfig.ts` (`packages/builders/vite/src/defines/capsuleConfig.ts`) имел конфиг:

```ts
AutoImportPlugin({
  imports: [/* wrappers + factories */],
  dirs: [join(capsuleRoot, 'registry')],  // ← ЭТО
  // ...
})
```

Опция `dirs:` экспонирует каждый named export из `.capsule/registry/*.ts` как глобальный identifier — включая `endpoints` (генерится `EndpointsRegistryPlugin`'ом из `apps/*/src/endpoints/**`).

**Problem:** AutoImport работает на **AST-уровне до scope analysis**. Не отличает:
- локальный параметр функции (`function foo(endpoints) { ... }`)
- от unbound identifier'а (`console.log(endpoints)`).

`packages/web/query/src/createApi.ts` содержит:

```ts
export const createApi = (configInput: Partial<IApiConfig>, endpoints) => {
  // ↑ endpoints как параметр
  // ...
}
```

Когда `web-query` импортируется в `apps/*/src/endpoints/auth.ts`, AutoImport видит `endpoints` → инжектит `import { endpoints } from '/registry/endpoints'` **в сам файл createApi.ts** (фреймворка).

**Result:** Циклический ESM-граф:

```
auth.ts
  ↓ (imports @capsuletech/web-query)
createApi.ts
  ↓ (AutoImport инжектит import endpoints)
registry/endpoints.ts
  ↓ (re-exports endpoints, построенный из auth.ts)
auth.ts  ← ЦИКЛ
```

`defineEndpoint` в `auth.ts` попадает в **TDZ (Temporal Dead Zone)** — на момент парсинга `registry/endpoints` ещё инициализирует `endpoints`, но `auth.ts` уже в графе, что создаёт deadlock.

## Решение

**Убрать `dirs:` из AutoImport.**

Runtime-регистры (`Widgets`, `Views`, `Controllers`, `Features`, `Entities`) работают **без** `dirs:`:
- `bootstrap.tsx` делает `Object.assign(globalThis, _registry)` — инжектит сборку вручную.
- TS-типы из `/.capsule/@types/slots.d.ts` (генерится `ExportGeneratorPlugin`'ом) — даёт IDE навигацию Ctrl+Click.
- `AutoImport` нужен только для **define-factories**: `defineComponent`, `defineEndpoint`, etc. Они уже явно в `imports:` секции.

**`endpoints` никогда не был глобалом в app-code.** Canonical path — `services.api.X.Y(...)`, где `api` инжектится как service в Feature/Controller. Глобал `endpoints` из registry — это деталь реализации, которая никогда не должна была быть видна.

### What changed

- `capsuleConfig.ts`: удалена строка `dirs: [join(capsuleRoot, 'registry')]`.
- `.capsule/registry/endpoints.ts` больше не инжектится автоматически.
- `EndpointsRegistryPlugin` остаётся — он **pre-inject'ит** сборку в vite-дерево как отдельный модуль, не через AutoImport.

## Последствия

### ✅ Плюсы

- **TDZ-цикл разорван.** `createApi` инициализируется без deadlock.
- **Ясная граница AutoImport:** только define-factories (`imports:`), без directory-scan. Меньше чёрной магии.
- **Явное лучше неявного.** Если в будущем понадобится глобал из реестра — будет через явный Vite-плагин (как `EndpointsRegistryPlugin` уже делает).

### ⚠️ Минусы / Breaking changes

- **Паттерн «глобал из directory-scan» больше недоступен** для новых реестров. Если когда-то захочется создать, например, `globalVars` registry с auto-export в globals — нужно писать dedicate Vite-плагин, не полагаться на `dirs:`.

## Альтернативы

1. **Переименовать параметр в createApi** (`endpoints` → `importedEndpoints`) — хак, не решает: AutoImport всё равно инжектит для других файлов, где может быть переменная `endpoints`.
2. **Отключить AutoImport для @capsuletech/web-query** — помогает, но тогда фреймворк-пакет нужен будет инжектить вручную везде, где используется. Худше для DX.
3. **Сделать `dirs:` более «умным»** (exclude patterns, scope-aware) — слишком сложно, unplugin-auto-import не поддерживает.

## Связанное

- PR #165 (`1859c58`) — реализация.
- [[020-component-data-flow-split|ADR 020]] — одновременный рефакторинг data-flow.
- [[web-core]] — AI-anchor с описанием createApi и UiProxy.
- `docs/_meta/web-state.md` — update для store-контракта.
