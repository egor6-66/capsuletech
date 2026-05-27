/**
 * Конфиг приложения — то, что разработчик пишет в `apps/<app>/capsule.app.ts`.
 *
 * `api?` field расширяется через module augmentation из `@capsuletech/web-query`
 * (когда app использует web-query — TS видит дополнение).
 */
export interface IAppConfig {
  meta?: {
    /** Список валидных тегов. Превращается в `CapsuleTags` (автокомплит). */
    tags?: readonly string[];
  };
  /** Алиасы тегов. Ключи попадают в `CapsuleAliases` (whitelist `@`-литералов). */
  aliases?: Record<string, readonly string[]>;
}

/**
 * Identity-функция для `capsule.app.ts`. Используется для type inference.
 * AppConfigPlugin transform replace'нет вызов в browser bundle.
 */
export const defineAppConfig = <T extends IAppConfig>(config: T): T => config;
