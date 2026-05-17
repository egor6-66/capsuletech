import type { ApiConfig, MwToolbox } from './createApi';

/**
 * Конфиг приложения — то, что разработчик пишет в `apps/<app>/capsule.app.ts`.
 *
 * Раньше жил в `@capsuletech/web-core/interfaces.ts`, но из-за `api`-поля тянул
 * `ApiConfig` + `MwToolbox` из `@capsuletech/web-query` в web-core (инверсия:
 * тонкий core зависит от тяжёлого query ради одного интерфейса). Перенесён
 * сюда отдельным подпутем `@capsuletech/web-query/app-config`, чтобы web-core
 * больше не зависел от web-query на уровне типов.
 *
 * AppConfigPlugin (Vite) читает этот файл, кормит рантайм-реестры
 * (`registerAliases`) и генерит `.d.ts` с union'ом тегов для строгой
 * типизации `meta.tags`.
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
   * middleware (`cookies`, `auth`, `statusMapper`, `on401`, `log`, `retry`).
   * Реальная сборка — в bootstrap'е через `createApi(config.api, endpoints)`.
   *
   * Сделано только в форме функции (не union с литералом), чтобы TS-контекстное
   * выведение корректно типизировало `({ mw })` без явных аннотаций.
   */
  api?: (ctx: { mw: MwToolbox }) => ApiConfig;
}
