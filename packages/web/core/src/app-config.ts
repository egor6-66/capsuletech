// `api?:` ссылается на типы ApiConfig + MwToolbox из web-query. Это type-only
// зависимость web-core → web-query — она существует и так (web-core depends on
// web-query для runtime `getApiClient`). NB: исторически здесь стоял
// `declare module '@capsuletech/web-core/app-config' { interface IAppConfig {
// api?: ... } }` в `web-query/src/app-config-augment.ts`, но TS не резолвил
// этот augmentation (TS2664) — у web-query нет dep на web-core, и paths/exports
// его не вытягивали в context augmentation. Вернули inline-объявление здесь —
// type-inversion приемлема, runtime-cycle она не создаёт.
import type { ApiConfig, MwToolbox } from '@capsuletech/web-query';

/**
 * Конфиг приложения — то, что разработчик пишет в `apps/<app>/capsule.app.ts`.
 */
export interface IAppConfig {
  meta?: {
    /** Список валидных тегов. Превращается в `CapsuleTags` (автокомплит). */
    tags?: readonly string[];
  };
  /** Алиасы тегов. Ключи попадают в `CapsuleAliases` (whitelist `@`-литералов). */
  aliases?: Record<string, readonly string[]>;
  /**
   * API-конфиг — фабрика `({ mw }) => ApiConfig`. Получает toolbox встроенных
   * middleware (`cookies`, `auth`, `statusMapper`, `on401`, `log`, `retry`).
   * Реальная сборка — в bootstrap'е через `createApi(config.api, endpoints)`.
   */
  api?: (ctx: { mw: MwToolbox }) => ApiConfig;
}

/**
 * Identity-функция для `capsule.app.ts`. Используется для type inference.
 * AppConfigPlugin transform replace'нет вызов в browser bundle.
 */
export const defineAppConfig = <T extends IAppConfig>(config: T): T => config;
