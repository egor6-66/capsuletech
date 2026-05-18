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

/**
 * Identity-функция для `apps/<app>/capsule.app.ts`. Просто возвращает
 * аргумент — нужна только для типизации (контекст TS подхватит `IAppConfig`
 * и даст автокомплит для `meta.tags` / `aliases` / `api`).
 *
 * Раньше `defineAppConfig` существовал в двух местах:
 *  1. `globalThis.defineAppConfig = identity` инжект в Node-CLI (для jiti-load);
 *  2. `AppConfigPlugin.transform` — regex-replace `defineAppConfig(x)` → `((__x__)=>__x__)`
 *     в Vite-бандле (для браузера, где globalThis-инжекта нет).
 *
 * Оба механизма работают, но это хрупкий контракт (S-8 в cleanup-plan):
 * любой sneak-edge case (e.g. Windows path-mismatch в transform → ловит не
 * каждый файл → ReferenceError в браузере; S-1 уже починен) валит сборку.
 *
 * Эта identity-функция — рекомендованный путь forward (см. ADR 011).
 * Новые apps в CLI-шаблоне импортят её явно:
 *
 *     import { defineAppConfig } from '@capsuletech/web-query/app-config';
 *     export default defineAppConfig({ ... });
 *
 * Существующие apps (sandbox/agent/ewc) с `globalThis.defineAppConfig` —
 * продолжают работать без правок благодаря legacy-bridge.
 */
export const defineAppConfig = <T extends IAppConfig>(config: T): T => config;
