# @capsuletech/vite-builder

Все Vite-плагины и `defines` фреймворка Capsule в одном пакете.

## Что внутри

| Раздел | Что |
|---|---|
| `defines` | `libConfig`, `appConfig`, `capsuleConfig` — фабрики Vite-конфигов для библиотек, приложений и dev-сервера Capsule |
| `plugins` | `HMRWrappingPlugin`, `ExportGeneratorPlugin`, `EndpointsRegistryPlugin`, `RouterPlugin`, `CompliancePlugin`, `AppConfigPlugin`, `EnsureScaffoldPlugin`, `AliasesPlugin`, `staticCopyPlugin` |

## Использование

Через [`@capsuletech/cli`](../../cli):

```bash
capsule dev      # → createDevCapsuleServer(config, appRoot, wsRoot)
capsule build    # → buildCapsuleApp(config, appRoot, wsRoot)
```

CLI читает `capsule.config.ts` приложения и кормит в эти actions; они собирают Vite-конфиг через `capsuleConfig` define + плагины.

Напрямую (например, в собственной библиотеке Capsule):

```ts
// vite.config.mts
import { libConfig } from '@capsuletech/vite-builder';

export default libConfig({
  entry: 'src/index.ts',
  name: 'MyLib',
});
```

## Связанное

- [docs/09-packages/builders.md](../../../docs/09-packages/builders.md) — общая дока по `packages/builders/*`
- [docs/08-system/vite-plugins.md](../../../docs/08-system/vite-plugins.md) — что делает каждый плагин
- [docs/_meta/builders.md](../../../docs/_meta/builders.md) — AI-anchor с file:line refs и gotchas
