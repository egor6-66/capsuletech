---
tags: [hca, adr, implemented]
status: implemented
date: 2026-05-10
---

# ADR 003 — Роутер: Context-based вместо singleton

## Контекст

Старая реализация (`packages/router/src/service.ts`):

```ts
class RouterService {
  router: any;
  createRouter(routeTree) { this.router = createRouter({...}); return this.router; }
  goTo(path, params) { this.router.navigate({...}); }
  back() { history.back(); }
  current() { this.router.state.location.pathname; }   // ⚠️ забыт return
}
const routerService = new RouterService();
export { routerService };
```

Проблемы:
1. **Singleton**. Невозможно иметь два независимых роутера в одном приложении (мульти-shell). Тестируемость страдает: между тестами `routerService.router` остаётся «грязным».
2. **`router: any`**. Нет типов, потеряны TanStack-API-подсказки.
3. **`current()` без `return`** — тихо возвращает `undefined`.
4. **Хардкод `isAuthenticated: true`** в initial-context. Это значение должно решаться приложением, не библиотекой.
5. **`routerService` инжектится напрямую в `services.router` Controller'а через прямой импорт** в `createLogicWrapper.tsx`. Тесная связь Controller-слоя с глобальной переменной.

## Решение

Перевести роутер на **Context-based** модель.

### Внешние изменения

| Что | Было | Стало |
|---|---|---|
| Создание роутера | `routerService.createRouter(routeTree)` (singleton + side-effect) | `createRouter({ routeTree, context })` (factory) |
| Доступ из компонента | `import { routerService } from '@capsuletech/router'` | `import { useRouter } from '@capsuletech/router'` |
| Тип публичного API | (нет) | `ICapsuleRouter` |
| Контекст роутера | хардкод | `<Providers.Base routerContext={{...}} />` |
| API в `services.router` | `routerService` (singleton) | `ICapsuleRouter` (от useRouter) |

### Новые экспорты `@capsuletech/router`

```ts
export { createRouter, RouterContext, useRouter, RouterProvider };
export type { ICapsuleRouter, ICapsuleRouterContext, ICreateRouterOpts };
```

### Слои

```
Providers.Base (получает routeTree + опционально routerContext)
   ↓
createRouter({ routeTree, context }) → { raw, capsuleRouter }
   ↓
<RouterContext.Provider value={capsuleRouter}>
  <RouterProvider router={raw} />
</RouterContext.Provider>
   ↓
createLogicWrapper использует useRouter() → ICapsuleRouter → services.router
   ↓
Controller/Feature видят api.router.goTo/back/current/raw
```

### Публичный API хэндлера НЕ меняется

```ts
const Auth = Feature(({ router }) => ({
  states: {
    idle: {
      onClick: ({ target }) => {
        router.goTo('/dashboard');     // ← как было, так и осталось
      },
    },
  },
}));
```

Семантика `services.router` сохранена. Только под капотом — берётся из контекста, а не из глобала.

### Заодно фиксится

- `current()` возвращает `pathname` (был забыт `return`).
- Хардкод `isAuthenticated: true` — убран. Если приложению нужен initial-context для guards, передаёт через `<Providers.Base routerContext={...} />`.
- `router: any` → строгий тип `ICapsuleRouter`.

## Альтернативы

### A. Оставить singleton
Отвергнуто — проблемы выше.

### B. Использовать TanStack `useRouter()` напрямую
Можно, но привязывает Controller-слой к API TanStack. Если когда-то заменим роутер — переписывать каждое использование. Capsule-обёртка `ICapsuleRouter` даёт стабильный публичный контракт. Отвергнуто.

### C. Прокидывать роутер через каждый wrapper-prop
Без контекста, по-простому. Многословно, нарушает HCA — Controller получает «лишний» prop, не относящийся к его роли. Отвергнуто.

## Последствия

### Положительные
- Тестируемость: каждый тест может создать свой роутер.
- Типизация: TanStack-types доступны через `router.raw`.
- Чистый layering: `routerService` больше не глобальный side-channel.
- API хэндлера не сломался — пользовательский код Feature/Controller не трогаем.

### Отрицательные
- `useRouter()` бросает, если используется вне `<Providers.Base>`. Это сознательный trade-off: silent-undefined хуже явной ошибки.
- Один лишний слой Context. Минимальная цена за гибкость.

## Связанное

- [[router|@capsuletech/router]]
- [[controller-proxy]]
- [[002-controller-vs-feature|ADR 002]] (services-инъекция)
- [[014-router-api-extension|ADR 014]] — продолжение: `goTo` options-объект + generic `ICapsuleRouterContext`
