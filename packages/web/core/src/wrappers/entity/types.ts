import type { CapsuleZ } from '@capsuletech/shared-zod';

/**
 * Результат Entity factory — plain config объект с zod-схемой и опциональными
 * дефолтами. Не является компонентом — Entity не рендерится.
 *
 * Generic `TSchema` — тип zod-схемы (любой ZodType).
 * Generic `TDefaults` — тип массива дефолтов (infer'ится из `schema` автоматически
 * через wrapper).
 */
export interface IEntityDefinition<TSchema = unknown, TDefaults = unknown> {
  /** Zod-схема domain-объекта (или массива). */
  schema: TSchema;
  /** Дефолтные данные — примеры / sample fixtures для разработки и тестов. */
  defaults?: TDefaults;
}

/**
 * Фабрика Entity — функция, получающая `z` (CapsuleZ helper) и
 * возвращающая `IEntityDefinition`-совместимый объект.
 *
 * Generic `T` — тип возвращаемого definition. Используется wrapper'ом
 * чтобы пробросить структуру без потери информации о полях.
 */
export type IEntityFactory<T extends IEntityDefinition> = (z: CapsuleZ) => T;

/**
 * Публичный тип wrapper-функции `Entity`.
 *
 * `Entity((z) => ({ schema: z.array(...), defaults: [...] }))` возвращает
 * то же самое, что вернула factory — plain config object.
 *
 * Wrapper намеренно прозрачен (identity по значению):
 *  - нет Solid-обёртки, нет lazy, нет компонента;
 *  - factory вызывается на module-load time;
 *  - результат — frozen plain object.
 *
 * В будущем (Phase 2): сюда попадут validators, transforms, relations.
 */
export type IEntityWrapper = <T extends IEntityDefinition>(
  factory: IEntityFactory<T>,
) => T;
