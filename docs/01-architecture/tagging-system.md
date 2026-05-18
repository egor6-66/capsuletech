---
tags: [hca, architecture, tagging]
status: documented
---

# 🏷️ Система мета-тегов

Меха-теги — основной язык, на котором Controller разговаривает с UI. Controller не знает про HTML-теги, имена компонентов и классы; он знает, что у элемента есть `meta.tags=['submit']` или `dynamicMeta.tags=['@login-form']`.

## Два слоя тегов

| Поле | Источник | Семантика | Меняется? |
|---|---|---|---|
| `meta`        | inner JSX (`<Button meta={...}>` внутри Entity) | **авторская роль** — что это за элемент | нет (зашит в Entity) |
| `dynamicMeta` | outer prop (`<Entities.X meta={...} />` на Entity в Widget) | **сценарная окраска** — в каком сценарии используется | да — разная в разных Widget'ах |

Это даёт **гибкое переиспользование**: одна Entity, разный сценарный контекст:

```tsx
// Widget A:
<Entities.Auth.LoginForm meta={{ tags: ['@login-form'] }} />

// Widget B:
<Entities.Auth.LoginForm meta={{ tags: ['@checkout-payment'] }} />
```

Внутри Entity тэги `meta` (email, password, submit) одинаковые, но Controller через `pick(['@login-form'])` достаёт ровно тех, кому Widget накинул сценарий.

## Как меты попадают в обработчик

В `getTargetData` (`packages/web/core/src/engine/ui-proxy.tsx`) на каждом событии собирается:

```ts
{
  name,         // выведено из meta.tags (первый без @-префикса)
  value, type,
  meta,         // авторская роль
  dynamicMeta,  // сценарная окраска от Widget
  key, modifiers,  // для keyboard-событий
}
```

Это `target`, который приходит первым аргументом в каждый хэндлер Controller/Feature.

## Деривация `name`

`name` больше не пишется в JSX. Выводится из `meta.tags`:

```ts
deriveName(meta) = meta?.tags?.find(t => !t.startsWith('@'))
```

Примеры:
- `meta={{tags:['email','@inputs']}}` → `name='email'`
- `meta={{tags:['submit']}}` → `name='submit'`
- `meta={{tags:['@inputs']}}` (только алиасы) → `name=undefined`

`name` далее:
- пишется в `target.name` для удобной адресации,
- прокидывается в DOM (`<input name="email">`) для form-data / accessibility,
- используется в `store.styles[name]` для адресной стилизации.

## Tag-операции в `store`

`store` (bridge) предоставляет методы для адресации компонентов по тегам:

```ts
store.pick(['@inputs'])         // Record<id, ITarget> — все смонтированные с тегом
store.omit(['disabled'])        // Record<id, ITarget> — все, КРОМЕ
store.match(['submit'])         // ITarget | undefined  — первый совпавший
store.matchEntry(['submit'])    // (ITarget & { id }) | undefined
```

Объединяют `meta.tags` + `dynamicMeta.tags`. Опция `{ lookDynamic: false }` отключает второй источник.

## Регистрация (политика C)

В `store.components` попадают **только элементы с собственным `meta`** на JSX-узле. Структурные обёртки (`Field`, `Field.Label`, `Field.Content`) — не попадают, даже если унаследовали `dynamicMeta` от Entity.

Это значит: `meta` стало явным opt-in флагом «элемент участвует в HCA-потоке». Подробнее — [[ui-proxy|UiProxy]].

## Соглашения по тегам

| Префикс | Значение | Примеры |
|---|---|---|
| (без) | конкретная роль | `submit`, `email`, `password` |
| `@` | алиас (группа тегов) | `@inputs`, `@actions`, `@login-form` |

Алиасы реализованы — см. [[005-tag-aliases-registry|ADR 005]] и [[tag-registry|реестр]]. Раскрытие происходит на стороне запроса в `pickByTags / omitByTags / matchByTags`, рекурсивно с защитой от циклов. Дефолтный набор: `@inputs` → `[email, password, phone, text, number]`, `@actions` → `[submit, cancel, reset]`. Расширяется через `registerAliases({...})`.

## Связанное

- [[ui-proxy]]
- [[controller-proxy]]
- [[tag-registry|🏷️ Реестр тегов и алиасов (план)]]
