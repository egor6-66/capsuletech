---
tags: [hca, adr, accepted]
status: accepted
date: 2026-05-09
---

# ADR 009 — Расширение перехватов UI-событий

## Контекст

UiProxy сейчас перехватывает только **`onClick`** и **`onInput`** (`packages/core/src/wrappers/ui/ui-kit/proxy.tsx:40-50`). Этого хватает для прототипа, но не покрывает базовые UX-кейсы:

| Событие | Зачем | Где не хватит |
|---|---|---|
| `onChange` | финальное значение (select / commit) | формы с select-полями |
| `onBlur` | потеря фокуса | валидация по уходу с поля |
| `onFocus` | получение фокуса | подсветка / autocomplete |
| `onKeyDown` | клавиши (Enter, Escape, Tab) | submit-by-Enter, cancel-by-Escape, hotkeys |
| `onSubmit` | submit формы | native form submission |

Без них Controller вынужден лезть в Entity или нарушать [[golden-rules|stateless]]. Это противоречит философии [[philosophy|UI is a Shadow]].

## Решение

Расширить фиксированный набор перехватываемых событий до:

```
onClick, onInput, onChange, onBlur, onFocus, onKeyDown, onSubmit
```

Это **закрытый набор первого класса**. Расширяемая (pluggable) схема — отложена до конкретного запроса.

## Реализация

### 1. Расширение `getTargetData`

Для keyboard-событий добавить `key` и модификаторы:

```ts
const getTargetData = (e, finalProps) => {
  const el = e?.currentTarget;
  const meta = el?.getAttribute('meta');
  return {
    name: el?.name || finalProps.name,
    value: el?.value ?? (el?.type === 'checkbox' ? el.checked : el?.value),
    type: el?.type,
    meta: typeof meta === 'string' ? JSON.parse(meta) : finalProps.meta,
    dynamicMeta: finalProps?.dynamicMeta,
    // новое для keyboard:
    key: e?.key,
    modifiers: e
      ? { ctrl: !!e.ctrlKey, shift: !!e.shiftKey, alt: !!e.altKey, meta: !!e.metaKey }
      : undefined,
  };
};
```

### 2. Генерация `dynamicProps`

Вместо hand-roll-кода `onClick`/`onInput` — сгенерировать handlers из списка:

```ts
const EVENTS = [
  ['onClick',   { updateStore: false }],
  ['onInput',   { updateStore: true  }],   // обновляет store.components[id]
  ['onChange',  { updateStore: true  }],
  ['onBlur',    { updateStore: false }],
  ['onFocus',   { updateStore: false }],
  ['onKeyDown', { updateStore: false }],
  ['onSubmit',  { updateStore: false, preventDefault: true }],
] as const;

const dynamicProps = {
  get class() { /* ... */ },
  get disabled() { /* ... */ },
  ...Object.fromEntries(EVENTS.map(([eventName, opts]) => [
    eventName,
    (e) => {
      if (opts.preventDefault) e.preventDefault?.();
      const data = getTargetData(e, props);
      if (opts.updateStore && data.name) ctx.store.update({ [id]: data });
      Promise.resolve(ctx.controller[eventName]?.(data, ctx.store.ctx))
        .catch((err) => console.error(`[Controller] ${eventName} failed:`, err));
      props[eventName]?.(e);
    },
  ])),
};
```

Заодно решается проблема непойманных async-ошибок (бывшая в текущем коде).

### 3. Расширение `IStateHandlers`

См. [[008-hybrid-fsm-api|ADR 008]] — список методов в `IStateHandlers` уже содержит весь набор.

## Контракт UI-kit

Базовые компоненты `@capsuletech/ui` должны прокидывать все семь событий в DOM-узел. Сейчас `Button` (`packages/ui/src/components/button/button.tsx`) использует `splitProps` и через `{...others}` пробрасывает всё, что не Local/Variants — ✅ работает. Аналогично для Input. Проверить остальные при имплементации; добавить acceptance-test.

## Альтернативы

### A. Pluggable — пользовательский набор событий
Регистрация через `registerEvent(name, options)`. Гибче, но усложняет API и компиляцию схемы. Отложено: не видно сценария, где фиксированного набора не хватает на ближайшие итерации.

### B. Перехват через делегирование с document root
Один слушатель на верхнем уровне, события матчатся по `data-meta`. Меньше DOM-обвязки, но конфликтует с Solid event-binding и теряем `currentTarget`. Отвергнуто.

### C. Capture phase
Сейчас все обработчики идут на bubble phase. Capture (`onClickCapture`) можно добавить, но без конкретного use-case — лишний размах. Отложено.

## Последствия

### Положительные
- Form-флоу работают целиком из Controller (Enter-to-submit, blur-валидация, autocomplete-focus).
- Единый код-путь для всех событий — меньше пятой колонки багов.
- Async-ошибки логируются.

### Отрицательные
- В DOM навешивается 7 listener'ов на каждый UI-элемент. На простых страницах — копейки, на больших списках — нужно следить (event delegation как opt-in — задел на B).
- Расширять набор без break — нельзя, это явный контракт. Любое расширение в будущем = новый ADR.

## Open questions

> [!question]
> 1. Нужна ли сейчас `onSubmit` поверх `<form>`-узла? UI-kit пока не имеет компонента `Form` — добавим попутно?
> 2. Для `onKeyDown` хочется ли сразу high-level алиасы (`onEnter`, `onEscape`)? Или Controller сам разбирает `target.key`?

## Связанное

- [[008-hybrid-fsm-api|ADR 008]] — единый рефакторинг proxy
- [[ui-proxy]]
- [[ui|@capsuletech/ui]] — контракт прокидывания событий в DOM
- [[philosophy]]
