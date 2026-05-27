---
tags: [hca, adr, implemented]
status: implemented
date: 2026-05-27
---

# ADR 021 — UiProxy auto-injects kind-tag into meta.tags for whitelist primitives

> [!success] Status: implemented (2026-05-27)
> PR #167 (`1ce2bda`) — добавлена KIND_TAGS whitelist. UiProxy автоматически аппендит kind-tag (e.g. 'input', 'button') в `meta.tags` известных примитивов. Новое знание в `docs/01-architecture/tagging-system.md`.

## Контекст

View'ы регулярно содержали паттерн вроде:

```tsx
<Input meta={{ tags: ['login', 'input'] }} />
<Input meta={{ tags: ['password', 'input'] }} />
<Textarea meta={{ tags: ['description', 'input'] }} />
```

Тег `'input'` повторяется для **каждого** input на странице, хотя это не уникальная роль, а **kind** (тип/семейство компонента). Знание Capsule'а — у нас есть: Ui-namespace явно типизирован (Input vs Card vs Button).

**Problem:**
- Repetitive boilerplate — пишется много раз.
- Знание о kind разбросано по Views — если когда-то переименуем Input → TextField, нужно обновлять везде.
- Error-prone — easy забыть добавить 'input' для одного из полей.

## Решение

### 1. KIND_TAGS whitelist

В `packages/web/core/src/engine/ui-proxy.tsx` — module-private const:

```ts
const KIND_TAGS = {
  Input: 'input',
  Textarea: 'input',
  Select: 'input',
  Checkbox: 'input',
  Button: 'button',
} as const
```

Только primitives, имеющие чёткую **интерактивную роль**. Sub-components (Card.Header, Field.Label) — исключены (они структурные).

### 2. Auto-inject механизм

UiProxy-getter (в `.get(prop)` intercept'е):

```ts
new Proxy({...Ui}, {
  get(target, prop) {
    // target[prop] = примитив вроде Input
    const wrapped = wrapComponent(target[prop], prop)  // ← prop.name инжектится
    return wrapped
  }
})
```

`wrapComponent(component, componentName)` — берёт имя и пробрасывает дальше в `ComponentWrapper` factory.

`ComponentWrapper` в method `getEffectiveMeta()`:

```ts
getEffectiveMeta() {
  const kindTag = KIND_TAGS[componentName]
  const userTags = meta.tags || []
  
  if (kindTag && !userTags.includes(kindTag)) {
    return { ...meta, tags: [...userTags, kindTag] }
  }
  return meta
}
```

Аппендит в конец, **если ещё не там**. User-tags (первый non-@ tag = имя) остаются первыми.

### 3. Hotpath-readers use effectiveMeta

Все места, где читается meta:
- `registerComponent()` — для `meta.tags` в комп-реестр
- `store.pick(['@input'])` — раскрытие alias'а
- `deriveName()` — вычисление `name`
- event-binding'и — match по тегам
- compliance-check'и — форматирование для логов

Используют `getEffectiveMeta()` вместо сырого `meta`.

Sub-components (Card.Header) — не проходят через main proxy, остаются как есть, не получают auto-tag.

## Примеры

### До (ручно)
```tsx
<Input meta={{ tags: ['email', 'input'] }} />
<Input meta={{ tags: ['password', 'input'] }} />
<Button meta={{ tags: ['submit', 'button'] }} />
```

### После (авто)
```tsx
<Input meta={{ tags: ['email'] }} />
<Input meta={{ tags: ['password'] }} />
<Button meta={{ tags: ['submit'] }} />
```

Auto-injected tags:
- Input email: `['email', 'input']`
- Input password: `['password', 'input']`
- Button submit: `['submit', 'button']`

Queries работают как раньше:
```ts
store.pick(['@input'])  // находит email, password, и любые другие inputs
store.match(['submit']) // находит button
```

## Последствия

### ✅ Плюсы

- **Чище JSX** — нет дублирования kind-tag'а.
- **Меньше ошибок** — забыть auto-tag невозможно по определению.
- **Скейлируемое расширение:** добавить новый primitive (например, `DatePicker → 'input'`) — update KIND_TAGS + тест. Все Views автоматически подхватывают.

### ⚠️ Минусы / Constraints

- **Имя primitiva в Ui-namespace становится контрактом.** Переименование `Input → TextField` в web-ui сломает auto-tag (нужно обновить KIND_TAGS, иначе теги не инжектятся).
  - Mitigation: если когда-то переименуем, update KIND_TAGS + migration guide.

- **Sub-components не получают auto-tag.** `<Card.Header meta={{...}}>` не получит `'card-header'` kind-tag — это намеренно:
  - Card.Header структурный (не интерактивный)
  - Kind-tag имеет смысл только для листовых интерактивных элементов
  - Если когда-то захочется, можно добавить, но сейчас не нужно.

- **Whitelist — source of truth внутри фреймворка.** Если user хочет свой kind-tag для custom-primitive, нельзя расширить KIND_TAGS из app-code (он module-private). Options:
  1. Юзер пишет kind-tag явно в JSX (сейчас работает)
  2. Просит фреймворк-агента добавить в KIND_TAGS (proper way, через PR)

## Альтернативы

1. **Каждый primitive объявляет static `__kindTag__`** — отвергнуто: распыляет знание по web-ui, увеличивает контакт-поверхность, сложнее тестировать.

2. **Kind-tag через имя файла primitiva** (e.g. `Button.tsx` → 'button') — соблазнительно, но:
   - Не все файлы = контрактные имена (есть `index.ts`, `parts.tsx`, `variants.ts`)
   - Более opaque — пришлось бы документировать алгоритм

3. **Не делать (пусть пишет вручную)** — отвергнуто: пользователь явно попросил убрать дубль.

## Связанное

- PR #167 (`1ce2bda`) — реализация.
- [[019-autoimport-dirs-drop|ADR 019]], [[020-component-data-flow-split|ADR 020]] — одновременные рефакторинги.
- `docs/01-architecture/tagging-system.md > Auto kind-tags section` — user-facing docs.
- `docs/_meta/web-core.md` — UiProxy behaviour update.
- [[005-tag-aliases-registry|ADR 005]] — tag-alias механизм (используется в `store.pick(['@input'])`).
