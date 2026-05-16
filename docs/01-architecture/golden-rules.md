---
tags: [hca, architecture, compliance]
status: documented
---

# 📜 Золотой регламент (Compliance)

Правила, нарушение которых ломает архитектуру. Сейчас **не enforced линтером** — проверяй вручную и помечай нарушения как `> [!warning]` в карточках компонентов.

---

## 1. No Upward Imports

> Слой ниже **никогда** не импортирует слой выше.

| Что | Можно импортировать |
|---|---|
| Entity | Solid.js, типы, `@capsuletech/style` |
| Controller | XState, services (router), типы |
| Feature | API-клиенты, services, типы |
| Widget | `Entities.*`, `Controllers.*`, `Features.*` (через namespace) |
| Page | `Widgets.*`, `Layout` |

> [!example]- ❌ Нарушение
> ```ts
> // entities/_auth/loginForm.tsx
> import { AuthFeature } from '@features/_auth/login'; // ❌ Entity тянет Feature
> ```

> [!example]- ✅ Корректно
> ```tsx
> // widgets/forms/_auth.tsx — композиция в Widget
> <Features.Auth.Login>
>   <Entities.Auth.LoginForm />
> </Features.Auth.Login>
> ```

---

## 2. No Horizontal Imports

> В пределах одного слоя элементы **не импортируют друг друга**.

- `Entity.Button` не импортирует `Entity.Icon` — иконка передаётся через children/slots в Widget.
- `Controller.Auth` не знает о `Controller.Validation` — взаимодействие через цепочку: оба наследуют общую Feature, общение идёт через [[controller-proxy|`next()`]].
- `Feature.A` не импортирует `Feature.B` — если им нужна общая логика, её выносят в `services` или в общий слой `services/`.

> [!info]
> Композиция «составных» компонентов — `Card.Header`, `Field.Label` — это **части одного Entity**, а не два разных. Это допустимо: они живут в одной папке (`packages/ui/src/components/card/parts.tsx`).

---

## 3. Stateless Entity

> Entity **не хранит** состояние. Никаких `createSignal` для бизнес-логики.

Допустимо:
- ✅ `createSignal` для чисто визуальных состояний (collapsed/expanded), не влияющих на бизнес.
- ✅ `createMemo` для производных от props.

Недопустимо:
- ❌ Хранить значение поля ввода (это `store.ctx.components`).
- ❌ Хранить флаги loading/disabled (это `store.loading`).
- ❌ Делать `fetch` в `onMount`.

---

## 4. Composition Only in Widgets

> Если две Entity встречаются в одном дереве — это происходит **в Widget**, не глубже.

Это значит: внутри Entity нельзя писать `<OtherEntity />`. Можно только `<Field.Label>`, потому что `Field.Label` — это часть **той же** Entity.

Если очень хочется «у меня везде Field с Input внутри» — это на самом деле уже Widget. Заведи `widgets/forms/field-with-input.tsx`.

---

## 5. Entity Isolation

> Entity не знает про XState, API, router, store.

Entity получает только то, что приходит через props. Проброс store/контроллера в props — нарушение. Связь с миром — только через [[ui-proxy|UiProxy]], который Entity *не видит*.

---

## 6. Вырываемость

> Любой компонент любого слоя должен переноситься в другой проект **без шлейфа** соседей.

Если ты не можешь скопировать `entities/auth/loginForm.tsx` в новый репо и заставить работать (с базовым UI-kit) — где-то нарушено правило 1, 2 или 5.

---

## 🔧 Как enforce'ить (пока нет линтера)

При ревью PR проверяй три вещи:

1. **Импорты в файле слоя.** Открой импорты — что там? Если есть `@features/*` в `entities/*` — отклоняй.
2. **JSX-композиция.** В Entity ищи теги вида `<OtherEntity />` — это нарушение.
3. **Сторонние эффекты.** В Entity/Widget ищи `fetch`, `axios`, `await` — должны быть только во Feature.

> [!success]
> Линтер реализован: [[004-compliance-linter|ADR 004]] + [[compliance|@capsuletech/compliance]]. Vite-плагин `CompliancePlugin` подключён, режим `warn`. Когда репо чистое — переключим в `error`.

---

## Связанное

- [[philosophy]]
- [[layers]]
- [[lifecycle]]
