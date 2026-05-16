---
tags: [hca, binding, tagging]
status: documented
---

# 🏷️ Реестр тегов и алиасов

**Файл:** `packages/state/src/tag-registry.ts`
**API:** `registerAliases`, `clearAliases`, `getAliases`, `expandTags` — экспорт из `@capsuletech/state`

Реализация решения [[005-tag-aliases-registry|ADR 005]].

## Зачем

Алиас — это «зонтик», группа конкретных тегов. Без реестра запрос `pick(['@inputs'])` находил бы только элементы с буквальным `@inputs`. С реестром — раскрывается до `[email, password, phone, ...]` и матчится со всеми инпутами.

## Дефолты

Фреймворк ставит минимальный стартовый набор:

| Алиас | Раскрывается в |
|---|---|
| `@inputs` | `email`, `password`, `phone`, `text`, `number` |
| `@actions` | `submit`, `cancel`, `reset` |

## Регистрация своих алиасов

```ts
// в одном из модулей приложения, например apps/<app>/src/main.ts
import { registerAliases } from '@capsuletech/state';

registerAliases({
  // Доменные алиасы
  '@payment-fields': ['cardnumber', 'cvv', 'expiry'],
  '@admin-actions': ['delete', 'disable', 'restore'],

  // Расширение дефолта
  '@inputs': ['email', 'password', 'phone', 'text', 'number', 'date', 'tel'],
});
```

`registerAliases` — **merge**: одинаковые ключи перезаписываются, остальные дефолты сохраняются.

## Полная замена реестра

Если хочешь жёстко контролировать алиасы:

```ts
import { clearAliases, registerAliases } from '@capsuletech/state';
clearAliases();
registerAliases({ ... }); // теперь только твоё
```

## Раскрытие

Алгоритм: breadth-first обход с защитой от циклов.

```ts
expandTags(['@inputs']);
// → ['@inputs', 'email', 'password', 'phone', 'text', 'number']

// Композиция работает:
registerAliases({
  '@form-anything': ['@inputs', 'submit'],
});
expandTags(['@form-anything']);
// → ['@form-anything', '@inputs', 'submit', 'email', 'password', 'phone', 'text', 'number']
```

## Семантика поиска

Раскрытие происходит **только на стороне запроса**, не на стороне тегов элемента:

| Запрос | Element tags | Совпадает? |
|---|---|---|
| `['@inputs']` | `['email']` | ✅ да (запрос раскрылся, `email` ⊂ раскрытию) |
| `['@inputs']` | `['@inputs']` | ✅ да (`@inputs` остаётся в раскрытии) |
| `['email']` | `['@inputs']` | ❌ нет (запрос не раскрывается, элемент имеет только алиас) |

Если хочешь, чтобы элементы с алиасом-без-конкретики тоже находились через буквальный запрос — добавь конкретный тег в `meta.tags` на JSX-узле.

## Опция `expandAliases: false`

Если в конкретном случае нужно матчить буквально:

```ts
store.pick(['@inputs'], { expandAliases: false });
// → только элементы, у которых в meta.tags буквально есть '@inputs'
```

Это полезно, например, для отладки или для случая, когда вы намеренно хотите отделить «помеченные алиасом напрямую» от «попадающих под раскрытие».

## Соглашения по именованию

- **`@`-префикс обязателен** для всех алиасов. Без префикса — это конкретный тег.
- **lower-kebab-case** для имени: `@login-form`, `@admin-actions`.
- **Без вложенных `@`**: алиас `@@foo` — undefined behaviour.
- **Domain-prefix** при коллизиях: `@cart:checkout`, `@auth:flow`.

## Связанное

- [[tagging-system|🏷️ Система мета-тегов]]
- [[ui-proxy]]
- [[005-tag-aliases-registry|ADR 005]]
