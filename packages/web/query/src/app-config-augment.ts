import type { ApiConfig, MwToolbox } from './createApi';

declare module '@capsuletech/web-core/app-config' {
  interface IAppConfig {
    /**
     * API-конфиг — фабрика `({ mw }) => ApiConfig`. Получает toolbox встроенных
     * middleware (`cookies`, `auth`, `statusMapper`, `on401`, `log`, `retry`).
     * Реальная сборка — в bootstrap'е через `createApi(config.api, endpoints)`.
     *
     * Расширение через module augmentation — web-core не знает про web-query.
     * Активируется при импорте чего-либо из `@capsuletech/web-query`.
     */
    api?: (ctx: { mw: MwToolbox }) => ApiConfig;
  }
}

// Side-effect file: активирует augmentation при импорте.
export {};
