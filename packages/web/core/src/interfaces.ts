import type { ApiConfig, MwToolbox } from '@capsuletech/web-query';

/**
 * Конфиг приложения (apps/<app>/capsule.app.ts). Здесь разработчик
 * объявляет домен-специфичные настройки: валидные meta-теги, алиасы и т.п.
 *
 * AppConfigPlugin читает этот файл, кормит рантайм-реестры (`registerAliases`)
 * и генерит d.ts с union'ом тегов для строгой типизации `meta.tags`.
 */
export interface IAppConfig {
  meta?: {
    /** Список валидных тегов приложения. Превращается в `CapsuleTags` (для автокомплита). */
    tags?: readonly string[];
  };
  /** Алиасы тегов. Ключи попадают в `CapsuleAliases` (строгий whitelist `@`-литералов). */
  aliases?: Record<string, readonly string[]>;
  /**
   * API-конфиг — фабрика `({ mw }) => ApiConfig`. Получает toolbox встроенных
   * middleware (`cookies`, `_auth`, `statusMapper`, `on401`, `log`, `retry`).
   * Реальная сборка — в bootstrap'е через `createApi(config.api, endpoints)`.
   *
   * Сделано только в форме функции (не union с литералом), чтобы TS-контекстное
   * выведение корректно типизировало `({ mw })` без явных аннотаций.
   */
  api?: (ctx: { mw: MwToolbox }) => ApiConfig;
}

export * from './wrappers/interfaces';
