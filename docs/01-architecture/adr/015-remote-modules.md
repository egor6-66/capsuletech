---
tags: [hca, adr, proposed]
status: proposed
date: 2026-05-19
---

# ADR 015 — Remote Modules: своё runtime, pluggable transport, manifest-driven

> [!warning] Status: proposed
> Фиксирует контракт для нового пакета `@capsuletech/web-remote`. Имплементация — отдельный этап (см. roadmap в конце).

## Контекст

Появилась задача: подгружать в host-приложение независимо собранные **remote-модули** (пример: модуль карты, развёрнутый на отдельном поддомене). Требования заказчика:

1. **Минимальная конфигурация наружу.** Один Provider в корне со списком модулей; в коде модуль вставляется как компонент.
2. **Динамическая смена URL.** Прилетело событие «вышла v2 модуля X» → меняем URL в provider'е → инстансы перезагружаются. Без рестарта приложения.
3. **Несколько инстансов одного модуля.** Два `<Remote.geo />` на странице — два независимых state'а, независимые каналы общения.
4. **Standalone-режим.** Тот же модуль может работать как отдельное приложение в отдельном окне; общение с host'ом должно идти через тот же API.
5. **Cross-origin.** Карта на `https://map.zone1.com:14228`, host на `https://host.zone1.com` — это **разные origin'ы**. Нативные browser channels между origin'ами не работают.

Reference-реализация (PROTEI: `@reacttools/module-federation` + `module-federation-server`):

- React-side — обёртка над `@module-federation/vite` + `@module-federation/runtime`. Provider хранит конфиг в zustand, `<RemoteModule>` дергает `loadRemote()`, `useMF` даёт send/openInNewWindow/subscribed/isStandalone.
- Server-side — socket.io message-bus, маршрутизирующий сообщения внутри `sessionId`. Не каталог модулей, а **rendezvous-point**.

Что **плохо** в reference-подходе для Capsule:

1. **`@module-federation/vite` под Solid — risk.** MF 2.0 заточен под React/Vue/Angular, его `shared`-механика (singleton react-dom) для Solid бесполезна; интеграция с Solid-плагином не тестирована. Тянуть тяжёлую инфраструктуру MF ради `loadRemote('name')` (== `import(url)`) — overkill.
2. **socket.io как обязательная зависимость.** В кейсе embedded (модуль внутри host'а, same window) сервер не нужен; в кейсе same-origin multi-window — тоже не нужен (есть `BroadcastChannel`). Сервер становится обязательным только в cross-origin standalone и cross-device. Жёсткая завязка делает простой кейс «развернул на одном домене» невозможным без поднятия Node-сервиса.
3. **Multi-instance сломан.** Ключ маршрутизации в их `ws.ts` — `${name}-${isStandalone}-${sessionId}`. Два standalone-инстанса одного модуля в одной сессии переписывают друг друга (а `duplicates.ts` ещё и режет второй). Архитектурно невоспроизводимо без `instanceId`.
4. **Типизация remote-модулей через `.d.ts` download.** В рефе есть `downloadDtsPlugin` — тянет `.d.ts` отдельно, что хрупко (несовпадение версий, network в build). У них этот плагин в README указан с URL'ом на mp3 (заглушка). Решение не доделано.
5. **`openInNewWindow` через голый `window.open` + query-string.** Standalone-окно после refresh теряет `opener`, deep-link недружелюбен, URL уродский.

## Решение

### 1. Новый пакет `@capsuletech/web-remote`

Полностью свой runtime — никакой завязки на `@module-federation/*`. Лежит в `packages/web/remote/`.

**Не HCA-слой.** Это инфраструктурный пакет (как `web-router`, `web-state`), а не Entity/Controller/Feature/Widget/Page. Используется **внутри** Widget'ов (композиция) и Feature'ов (коммуникация).

### 2. Public API — стабильный контракт

```tsx
// Корень приложения
<RemoteProvider
  serverUrl={config.mfServerUrl}     // опционально — pluggable transport
  modules={[
    { name: 'geo', url: config.mapModule.moduleUrl, props: config.mapModule },
    { name: 'auth', url: config.authModule.moduleUrl },
  ]}
>
  <App />
</RemoteProvider>

// В Widget
const FormsAuth = Widget(({ Card }, _, _, _) => {
  const { Remote } = useRemote();
  return (
    <Card>
      <Remote name="auth" onSuccess={(u) => /*...*/} />
      <Remote name="geo" instanceId="left"  center={[55.7, 37.6]} />
      <Remote name="geo" instanceId="right" center={[59.9, 30.3]} />
    </Card>
  );
});

// В Feature
const Auth = Feature(({ remote }) => ({
  initial: 'idle',
  states: {
    idle: {
      async openGeo({ next }) {
        await remote('geo').openStandalone({ lat: 55.7 });
      },
      async syncUser({ payload, next }) {
        const res = await remote('auth').request('user.sync', payload);
        remote('auth').on('user.updated', (u) => next.with({ user: u }));
      },
    },
  },
}));
```

`instanceId` опционален. Без него — `createUniqueId()` под капотом (стабильный per-mount). С ним — стабильный идентификатор, можно адресовать снаружи (`remote('geo', 'left')`).

### 3. Транспорт — pluggable, выбирается автоматически

| Сценарий | Транспорт | Когда |
|---|---|---|
| Embedded, same window | Solid signal-bus через RemoteContext | всегда доступен |
| Same-origin, разные окна | `BroadcastChannel` | окна на одном origin'е |
| Cross-origin, есть `window.opener` | `window.postMessage` | окно только что открыто из host'а |
| Cross-origin standalone (refresh / прямая ссылка) | socket-сервер | если `serverUrl` задан в Provider |
| Cross-device | socket-сервер | если `serverUrl` задан в Provider |

Resolver выбирает наиболее лёгкий транспорт, доступный для пары `(from, to)`. Если `serverUrl` не задан и нет нативного канала — `remote.send()` логирует warning и no-op (НЕ throw, чтобы не ломать UI). `remote.request()` — reject через timeout.

### 4. Manifest вместо `.d.ts` download

Каждый remote-модуль публикует `capsule.manifest.json` рядом с `index.html`:

```json
{
  "name": "geo",
  "version": "2.1.0",
  "entry": "/assets/index.es.js",
  "styles": ["/assets/style.css"],
  "props": { /* zod-схема, сериализованная через zod-to-json-schema */ },
  "events": {
    "user.updated": { /* zod-схема payload */ }
  }
}
```

Host при `<RemoteProvider modules>`:
1. Резолвит `${module.url}/capsule.manifest.json`.
2. Кеширует manifest реактивно (Solid `createResource`).
3. Использует `entry` для `import()` (динамический ESM), `styles` — для `<link>` (с дедупликацией по id).
4. Валидирует props через zod-схему перед mount.

**Vite-плагин `RemoteManifestPlugin`** (в `packages/builders/vite/`) — read-side: качает манифесты на dev/build, генерит `.capsule/@types/remotes.d.ts` с типизацией `remote('geo').send<'user.updated'>(payload)`. Write-side (модуль-кандидат публикует manifest) — отдельный build-time helper в том же пакете.

### 5. Multi-instance — `instanceId` в ключе маршрутизации

Ключ сообщения: `{ from, to, fromInstance, toInstance?, sessionId, requestId }`.

`fromInstance` — обязателен (каждый `<Remote>` имеет id).
`toInstance` — опционален: `undefined` = broadcast всем инстансам с именем `to`.

Серверный ключ хранения: `${name}:${instanceId}:${isStandalone}:${sessionId}`. Никаких `duplicates`-чеков (см. п.2 контекста про сломанный multi-instance в рефе).

### 6. Реактивная смена URL — через Solid store

Provider держит `createStore`:

```ts
const [remotes, setRemotes] = createStore<Record<string, IRemoteEntry>>({});

// Снаружи (например, из Feature после получения уведомления):
const ctx = useRemoteContext();
ctx.updateModule('geo', { url: 'https://.../v2' });
// → manifest рефетчится, все <Remote name="geo" /> ремаунтятся
```

Никакого `mergeArrays`-костыля из рефа — в Solid глубокая реактивность бесплатна.

### 7. Standalone — через `routerService`, не `window.open`

Standalone-окно — это **обычный route** в host-приложении (или в отдельной standalone-сборке модуля), который рендерит `<RemoteStandalone name="..." />`. Открытие:

```ts
remote('geo').openStandalone({ lat: 55.7 });
// внутри:
//   1. resolve standalone-URL (из manifest или из конфига модуля)
//   2. router.openInWindow(url, { sessionId, instanceId, props })
//   3. в новом окне standalone-route парсит query, монтирует <RemoteStandalone>
//   4. RemoteStandalone сам поднимает transport (socket если cross-origin)
```

`router.openInWindow` — новый метод в `@capsuletech/web-router`, оборачивает `window.open` с правильными features + возвращает handle для последующего общения через `postMessage` (если cross-origin позволяет).

URL красивый (`/remote/geo?session=...&instance=left`), refresh-safe, deep-linkable.

### 8. HCA-интеграция

- `RemoteProvider` подключается на app-уровне (`apps/<app>/src/main.tsx` или в `BaseProviders`), как `RouterProvider`.
- В **Widget** доступен `<Remote name="..." />` через `useRemote()` хук (или через слот, см. п.9 — это open question).
- В **Feature** доступен `remote('name')` через инжектируемый сервис: `Feature(({ remote }) => ...)`. Это требует расширения `services` в `createLogicWrapper` (`packages/web/core/src/engine/logic-wrapper.tsx`) — добавить `remote` рядом с `api`, `router`.
- В **Controller** НЕДОСТУПНО. Controller не знает про IO. Communication с remote — задача Feature (по правилам [[004-compliance-linter|ADR 004]]). Compliance-линтер расширяется: импорт `@capsuletech/web-remote` в Controller-файле → warning.
- В **Entity** НЕДОСТУПНО (stateless UI).

### Что НЕ делаем (open questions, отдельные ADR)

- **Server implementation.** v1 — node + socket.io как референс (повторяем PROTEI, но с фиксом multi-instance ключа). v2 — rust (`backend/mf-bus/`). Это отдельное решение.
- **CSS-изоляция.** Remote-модуль может конфликтовать с host'овыми стилями. В v1 — без изоляции (модуль сам отвечает за scoping; рекомендуем CSS Modules / data-attribute scoping в их build'е). Shadow DOM как вариант — отдельный ADR при появлении реального конфликта.
- **Shared dependencies.** MF умеет «singleton react». У нас Solid — теоретически тоже могут быть проблемы со сторонними либами (две копии xstate в host и remote). В v1 — ничего, каждый модуль везёт свои deps. Optimization-плагин — потом.
- **Slot-style композиция в Widget.** Альтернативный API — Widget получает remote'ы позиционным аргументом как сейчас entity/controller: `Widget((ui, features, controllers, entities, remotes) => ...)`. Решение отложено до прототипа — посмотрим что удобнее в реальных Widget'ах.

## Альтернативы

### A. Обернуть `@module-federation/vite` 1-в-1 (как PROTEI)

Быстрее (~неделя на v1), знакомый паттерн. Минусы:
- React-mind зависимость в Solid-стэке — будут глюки на edge-кейсах (ownership, HMR).
- `shared`-механика бесполезна, тащим её как dead weight.
- `loadRemote(name)` под капотом — это `import(url)`, нам не нужна вся MF-инфраструктура.
- Обязательная завязка на их манифест-формат (`mf-manifest.json`), переехать потом сложно.

Отвергнуто — мы получим долг сразу.

### B. Использовать `native-federation` (Angular-flavored MF без webpack)

Ближе по духу (ESM-нативно, без хака `shared`), но всё ещё framework-agnostic в Angular-стиле. Зависимость на их CLI для build модулей. Меньше community вокруг, чем у `@module-federation/*`.

Отвергнуто — выгода маргинальная, зависимость остаётся.

### C. Iframe-only

Каждый remote — `<iframe>`. Изоляция бесплатна, нативный `postMessage`. Минусы:
- Layout-проблемы (iframe не растягивается естественно, resize observers нужны).
- Двойной layout/render у браузера, тяжело на CPU.
- Tree-вне-дерева для Solid (нельзя shared signals на уровне реактивности, всё через message-bus).
- Стили host'а не наследуются (хорошо для изоляции, плохо для UX-консистентности).

Отвергнуто как **default**. Iframe оставляем как opt-in адаптер для кейсов untrusted-источников (legacy app в iframe, security-критичные).

### D. Только сервер, без локальных транспортов

Reference-подход PROTEI. Простая ментальная модель, единая точка маршрутизации. Минусы:
- Embedded (one window) сценарий требует Node-сервиса — overkill для dev и для маленьких setup'ов.
- Лишний hop через WebSocket для тривиального case'а.

Отвергнуто — pluggable дешевле в эксплуатации.

### E. Отложить до появления реального requestor'а

«Не строй, пока не понадобится». Минусы:
- Задача уже от заказчика (см. контекст).
- API форма влияет на routerService (новый метод `openInWindow`) и на `createLogicWrapper` (новый инжектируемый сервис `remote`) — лучше зафиксировать сейчас, чем переделывать после первой имплементации в `apps/<app>`.

Отвергнуто — задача уже есть.

## Последствия

### Положительные

- Нулевая завязка на `@module-federation/*` — Solid-friendly с первого дня.
- Pluggable transport — простой кейс работает без сервера, сложный — с сервером.
- Manifest-driven типизация — `.d.ts` генерится из zod-схем, нет network'a за `.d.ts`.
- Multi-instance работает корректно (что в рефе сломано).
- Standalone через router → URL красивые, refresh-safe.

### Отрицательные

- Свой код = свой maintenance. MF community-стэк нам не помогает.
- В v1 нет shared dependencies → bundle-size remote-модулей > чем мог бы быть.
- Server-side нужно написать с нуля (хоть он тонкий).

### Migration / Roadmap

**Phase 0 (этот ADR + skeleton — текущая работа):**
- ADR-015 написан, status: proposed.
- Skeleton-пакет `@capsuletech/web-remote` создан, exports пустые, типы из этого ADR описаны как interfaces.
- Алиас зарегистрирован в `tsconfig.base.json` + `optimizeDeps.exclude`.

**Phase 1 — minimal viable (embedded, без сервера):**
- `RemoteProvider` + `useRemote()` + `<Remote>` компонент.
- Local signal-bus как единственный transport.
- Manifest-loader (без validation, props as any).
- Поднять прототип в новом `apps/<demo>` (после `chore: remove demo apps` #75 демо-apps отсутствуют, нужен новый под эту задачу) с фейковым remote-модулем (другой пакет в monorepo).

**Phase 2 — multi-window, no server:**
- `BroadcastChannel` transport.
- `openStandalone` через router (новый метод `router.openInWindow`).
- Standalone-route в том же demo-app для верификации.

**Phase 3 — server transport:**
- Node-сервер в `backend/mf-bus/` (повторяем PROTEI с фиксом `instanceId` в ключе).
- Socket-transport в клиенте.
- `serverUrl` опция в `RemoteProvider`.

**Phase 4 — manifest typing:**
- `RemoteManifestPlugin` в `packages/builders/vite/`.
- Кодген `.capsule/@types/remotes.d.ts`.
- Zod-валидация props на mount.

**Phase 5 — compliance + HCA-injection:**
- Расширение `createLogicWrapper` для инжекции `remote` в Feature.
- Compliance-rule: `@capsuletech/web-remote` запрещён в Controller/Entity.
- Документация в `docs/`.

Каждая phase — отдельный PR. ADR переходит в `status: implemented` только после Phase 5.

## Связанное

- [[003-router-context-based|ADR 003]] — Router (будет расширен методом `openInWindow`)
- [[004-compliance-linter|ADR 004]] — Линтер (будет расширен правилом про remote)
- [[002-controller-vs-feature|ADR 002]] — Controller vs Feature (remote = IO = Feature)
- Reference (не входит в репо): `D:\CODING\projects\PROTEI\new\module-federation-server`, `D:\CODING\projects\PROTEI\new\reacttools\modules\module-federation`
