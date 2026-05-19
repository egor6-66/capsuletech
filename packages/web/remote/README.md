# @capsuletech/web-remote

> [!warning] Status: skeleton (Phase 0)
> Контракты типов описаны, runtime пуст. См. [ADR 015](../../../docs/01-architecture/adr/015-remote-modules.md) и roadmap там же.

Runtime для подключения независимо собранных **remote-модулей** в host-приложение Capsule. Своё runtime, без завязки на `@module-federation/*`.

## Что должно получиться (полный API)

```tsx
// apps/<app>/src/main.tsx
<RemoteProvider
  serverUrl={config.mfServerUrl}     // опционально — для cross-origin standalone / cross-device
  modules={[
    { name: 'geo',  url: 'https://map.zone1.com:14228', props: { ... } },
    { name: 'auth', url: 'https://auth.zone1.com' },
  ]}
>
  <App />
</RemoteProvider>
```

```tsx
// В Widget
const { Remote } = useRemote();
<Remote name="geo" instanceId="left"  center={[55.7, 37.6]} />
<Remote name="geo" instanceId="right" center={[59.9, 30.3]} />
```

```ts
// В Feature
Feature(({ remote }) => ({
  states: {
    idle: {
      async openGeo() { await remote('geo').openStandalone({ lat: 55.7 }); },
      async ping()    { return remote('auth').request('user.sync', {}); },
    },
  },
}));
```

## Транспорт

Выбирается автоматически:

| Сценарий | Транспорт |
|---|---|
| Embedded (one window) | Local signal-bus |
| Same-origin, multi-window | `BroadcastChannel` |
| Cross-origin, opener доступен | `window.postMessage` |
| Cross-origin standalone (refresh / прямая ссылка) | socket-сервер (если `serverUrl` задан) |
| Cross-device | socket-сервер |

## Roadmap

См. [ADR 015 → Migration / Roadmap](../../../docs/01-architecture/adr/015-remote-modules.md).

- Phase 0 — **skeleton + contract** (текущее)
- Phase 1 — embedded transport
- Phase 2 — multi-window (BroadcastChannel + standalone через router)
- Phase 3 — socket transport
- Phase 4 — manifest typing (codegen `.d.ts`)
- Phase 5 — HCA-injection (`Feature(({ remote }) => ...)`) + compliance-rule
