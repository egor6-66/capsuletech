---
tags: [hca, adr, implemented]
status: implemented
date: 2026-05-10
---

# ADR 005 — Реестр тег-алиасов

## Контекст

В коде sandbox и `.clauderules` алиасы (`@inputs`, `@actions`, `@login-form`) использовались как **соглашение** — без места, где они были бы определены. Раскрытие при поиске нигде не происходило: `pick(['@inputs'])` находил только элементы с буквальным тегом `@inputs`, не email/password.

Это ломало главную идею тегов: алиас — это «зонтик», группа конкретных тегов. Контроллер хочет «отключи все инпуты» через `pick(['@inputs'])` — а получал пустоту, если разработчик не дублировал `@inputs` рядом с конкретными тегами.

## Решение

Реестр алиасов живёт в **`@capsuletech/state`** (там же, где helpers работают с тегами). Раскрытие происходит **на стороне запроса** в `pickByTags / omitByTags / matchByTags / matchEntryByTags`. Реестр поддерживает рекурсивное раскрытие (алиасы алиасов) с защитой от циклов.

### API

```ts
import {
  registerAliases,
  clearAliases,
  getAliases,
  expandTags,
} from '@capsuletech/state';

// Расширение реестра (merge)
registerAliases({
  '@form-action': ['submit', 'reset'],
  '@inputs': ['email', 'password', 'phone', 'text', 'number', 'date'],  // override default
});

// Полная очистка (например, перед своей конфигурацией)
clearAliases();

// Снимок (read-only)
const all = getAliases();

// Прямое раскрытие — обычно не нужно, helpers зовут сами
expandTags(['@inputs']);
// → ['@inputs', 'email', 'password', 'phone', 'text', 'number']
```

### Дефолты

Фреймворк ставит минимальный стартовый набор:

```ts
{
  '@inputs': ['email', 'password', 'phone', 'text', 'number'],
  '@actions': ['submit', 'cancel', 'reset'],
}
```

Эти дефолты можно расширить через `registerAliases({...})` или полностью заменить через `clearAliases()` + `registerAliases({...})`.

### Семантика раскрытия

Запрос `pick(['@inputs'])` находит элементы, у которых **в их тегах** (`meta.tags ∪ dynamicMeta.tags`) есть хотя бы один из:
- сам `@inputs`,
- любой из его раскрытий (`email`, `password`, `phone`, ...),
- раскрытия раскрытий (если `@inputs` содержит другой алиас).

Раскрытие **рекурсивное** через breadth-first обход с множеством посещённых тегов:

```ts
const expandTags = (tags) => {
  const out = new Set();
  const queue = [...tags];
  const seen = new Set();
  while (queue.length) {
    const tag = queue.shift();
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.add(tag);
    for (const t of aliases[tag] ?? []) {
      if (!seen.has(t)) queue.push(t);
    }
  }
  return [...out];
};
```

### Опция `expandAliases`

Helpers и `bridge.pick/omit/match/matchEntry` принимают опцию `{ expandAliases?: boolean }` (default: `true`). При `false` — теги матчатся буквально, без раскрытия.

```ts
store.pick(['@inputs'])                              // с раскрытием — все email/password/phone/...
store.pick(['@inputs'], { expandAliases: false })    // только элементы с буквальным '@inputs'
```

## Альтернативы

### A. Раскрытие обеих сторон (query + element tags)
Симметрично: `pick(['email'])` находит и элементы с `'email'`, и с `'@inputs'`. Отвергнуто — асимметрия раскрытия только запроса достаточна для use case'ов и проще для intuitive поиска (запрашиваешь группу — получаешь группу; запрашиваешь конкретное — получаешь конкретное).

### B. Реестр через config-файл
Алиасы декларируются в `capsule.config.ts`, парсятся при сборке. Отвергнуто — рантаймовое API проще, легче подгрузить алиасы динамически из домена приложения.

### C. Без дефолтов
Полностью пустой реестр на старте. Отвергнуто — `@inputs` уже фигурирует в `.clauderules` и sandbox-коде; разумно ставить дефолты, которые можно перекрыть.

## Последствия

### Положительные
- `@inputs` и подобные алиасы наконец работают — `pick(['@inputs'])` реально находит email/password.
- Реестр расширяемый: команда домена может зарегистрировать `@payment-fields`, `@admin-actions` под свой словарь.
- Рекурсия даёт композицию: `@form-fields = ['@inputs', 'select', 'checkbox']`.
- Backwards-compat: helpers по-прежнему принимают `lookDynamic: boolean` третьим аргументом (старый sig).

### Отрицательные
- Глобальный mutable state (`aliases` в module scope). Для тестов потребует `clearAliases()` в setup. Принимаем как trade-off ради простоты API.
- Нет проверки конфликтов: можно зарегистрировать алиас, который циклически ссылается на себя — runtime пройдёт благодаря защите, но логически это бессмысленно. Линтер (см. [[004-compliance-linter|ADR 004]]) может это валидировать в будущем.

## Связанное

- [[tag-registry|🏷️ Реестр тегов и алиасов]]
- [[tagging-system]]
- [[ui-proxy]]
- [[004-compliance-linter|ADR 004]] — будущая валидация реестра
