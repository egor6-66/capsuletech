---
tags: [hca, architecture, layers]
status: documented
---

# 🪜 Слои HCA

Снизу вверх. Каждый слой имеет ровно одну ответственность и ровно один способ общения с соседями.

```
┌─────────────────────────────────────────────────┐
│  Page         композиция верхнего уровня         │  pages/
├─────────────────────────────────────────────────┤
│  Widget       композиция Entity + Controller     │  widgets/
├─────────────────────────────────────────────────┤
│  Feature      domain logic, API, services        │  features/
├─────────────────────────────────────────────────┤
│  Controller   поведение, FSM, meta-перехват      │  controllers/
├─────────────────────────────────────────────────┤
│  Entity       stateless UI, "тень"               │  entities/
└─────────────────────────────────────────────────┘
```

> [!warning]
> Стрелка зависимостей идёт **только вверх**: Widget зависит от Feature/Controller/Entity, но не наоборот. Подробнее — [[golden-rules]].

---

## 🟦 Entity — Stateless UI

**Файлы:** `*/entities/<group>/<name>.tsx`
**Wrapper:** `Entity(({ Field, Button, Input, List }) => JSX)`
**Знает только:** Solid.js + типы.

```tsx
// apps/sandbox/src/entities/_auth/loginForm.tsx
const LoginForm = Entity(({ Field, Button }) => (
  <Field>
    <Field.Label>Email</Field.Label>
    <Field.Content>
      <Input name="email" meta={{ tags: ['email', '@inputs'] }} />
    </Field.Content>
    <Button name="submit" meta={{ tags: ['submit'] }}>Войти</Button>
  </Field>
));
```

**Что нельзя:**
- Импортировать другую Entity.
- Импортировать XState, API-клиент, router.
- Хранить локальное состояние (`createSignal` ради бизнес-логики).
- Знать имя своей Feature.

**Как UI узнаёт, что делать:** ничего не узнаёт. [[ui-proxy|UiProxy]] подменяет `onClick`/`onInput`/`disabled`/`class` сверху, см. [[lifecycle]].

---

## 🟩 Controller — Поведение / FSM

**Файлы:** `*/controllers/<group>/<name>.tsx`
**Wrapper:** `Controller((services) => ({ initial, states }))`
**Знает только:** свою FSM-схему, meta-теги детей, `next()` к родителю.

```tsx
const Form = Controller(() => ({
  initial: 'idle',
  states: {
    idle: {
      onClick: async ({ target, store, next, state }) => {
        if (target.meta?.tags?.includes('submit')) {
          state.set('submitting');
          await next(store.ctx.data);
          state.set('idle');
        }
      },
    },
    submitting: { /* ... */ },
  },
}));
```

**Что приходит в хэндлер:**
| Поле | Что |
|---|---|
| `target` | `{ name, value, type, meta, dynamicMeta }` — данные с DOM-ноды и meta-теги |
| `context` | `state.context` от XState (через [[bridge\|store.ctx]]) |
| `store` | bridge: `update`, `setLoading`, `setStyles`, `setErrors`, `registerComponent` + геттеры |
| `next(payload?)` | вызов одноимённого метода у родительского Controller/Feature, см. [[overrides]] |
| `state` | `{ current, set(name) }` — переключение FSM-состояний |

**Что нельзя:**
- Импортировать другой Controller.
- Делать `fetch`. Только через `next()` → Feature.
- Знать конкретику Entity (имя класса, тег HTML).

---

## 🟨 Feature — Domain Logic / API

**Файлы:** `*/features/<group>/<name>.tsx`
**Wrapper:** `Feature((services) => ({ initial, states }))`
**Знает:** API, services, бизнес-правила.

> [!info]
> `FeatureWrapper` и `ControllerWrapper` (`packages/web/core/src/wrappers/{feature,controller}.tsx`) — оба `createLogicWrapper(kind)` из `engine/logic-wrapper.tsx` (ADR 002, копипаста уже свернута). Семантическое различие: Feature получает `services.api` через `getApiClient()` дополнительно к `router`; Controller — только `router` (compliance запрещает IO в Controller'е).

```tsx
const Auth = Feature(({ router }) => ({
  initial: 'idle',
  states: {
    idle: {
      onClick: async ({ target, store }) => {
        store.setLoading(true);
        const res = await api.login(target.payload);
        store.setLoading(false);
        if (res.ok) router.goTo('/dashboard');
      },
    },
  },
}));
```

**Что нельзя:**
- Импортировать другую Feature.
- Знать про конкретный Controller сверху.

---

## 🟪 Widget — Композиция

**Файлы:** `*/widgets/<group>/<name>.tsx`
**Wrapper:** `Widget(({ Card, Layout, ... }) => JSX)`

Единственное место, где Entity и Controller склеиваются.

```tsx
const AuthForm = Widget(({ Card }) => (
  <Features.Auth.Login>
    <Controllers.Universal.Form overrides={{ onClick: 'login' }}>
      <Card>
        <Card.Content>
          <Entities.Auth.LoginForm />
        </Card.Content>
      </Card>
    </Controllers.Universal.Form>
  </Features.Auth.Login>
));
```

**Что разрешено:**
- Использовать **любые** Entity, Controller, Feature через namespace (`Entities.*`, `Controllers.*`, `Features.*`).
- Передавать `overrides` для ремапа имён методов.

**Что нельзя:**
- Содержать бизнес-логику. Если в Widget появился `if`/`fetch` — это нарушение, выноси в Controller или Feature.

---

## 🟥 Page — Корневой layout

**Файлы:** `*/pages/<route>/<name>.tsx`
**Wrapper:** `Page(({ Layout, Outlet }) => JSX)`

Корневой компонент роута. `Outlet` приходит от TanStack Router'а. Папка `pages/` зеркалится плагином [[vite-plugins#RouterPlugin|RouterPlugin]] в `.capsule/routes/__pages/...` и собирается TanStack-CLI в `routeTree.gen.ts`.

```tsx
const Login = Page(({ Layout }) => (
  <Layout variant="centroid" slots={{ main: <Widgets.Forms.Auth /> }} />
));
```

---

## Куда смотреть в коде

| Слой | Wrapper | Файл |
|---|---|---|
| Entity | `EntityWrapper` | `packages/web/core/src/wrappers/entity.tsx` |
| Controller | `ControllerWrapper` | `packages/web/core/src/wrappers/controller.tsx` |
| Feature | `FeatureWrapper` | `packages/web/core/src/wrappers/feature.tsx` |
| Widget | `WidgetWrapper` | `packages/web/core/src/wrappers/widget.tsx` |
| Page | `PageWrapper` | `packages/web/core/src/wrappers/page.tsx` |
| Shape | `ShapeWrapper` | `packages/web/core/src/wrappers/shape/wrapper.tsx` |

## Связанное

- [[golden-rules|📜 Compliance]]
- [[lifecycle|🔄 Жизненный цикл]]
- [[ui-proxy|🪞 UiProxy]]
- [[controller-proxy|🧠 ControllerProxy]]
