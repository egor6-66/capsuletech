import { type CapsuleZ, z } from '@capsuletech/shared-zod';
import type { ZodType } from 'zod';
import type { Middleware } from './pipeline';
import type { HttpMethod } from './types';

/** Извлекает Output-тип из ZodType (то, что отдаёт `safeParse(...).data`). */
type ZOut<T> = T extends ZodType<infer O, any, any> ? O : unknown;

/**
 * Описание одного endpoint'а — generic над zod-схемами (а не по их парсенным
 * типам). Это нужно чтобы TS успешно прокинул `R = ZOut<response>` в параметр
 * `map: (dto) => D`: иначе при двухуровневом обобщении (`request: ZodType<I>`)
 * вывод теряется и `dto` становится `unknown`.
 */
export interface EndpointConfig<
  TReq extends ZodType = ZodType,
  TRes extends ZodType = ZodType,
  D = ZOut<TRes>,
> {
  method: HttpMethod;
  path: string;
  /** Имя из `bases` в IAppConfig.api — определяет baseURL. `'default'` если не задано. */
  base?: string;
  /** Zod-схема входа. Невалидный input — `ValidationError('request')`. */
  request?: TReq;
  /** Zod-схема ответа. Невалидный response — `ValidationError('response')`. */
  response?: TRes;
  /** dto (валидированный response) → domain. Если не задан — domain === dto. */
  map?: (dto: ZOut<TRes>) => D;
  /** Опционально staleTime для cached запросов (только GET). */
  staleTime?: number;
  /** Per-endpoint middleware — применяется в самом конце pipeline (после mapDomain). */
  middleware?: ReadonlyArray<Middleware>;
}

declare const __input: unique symbol;
declare const __output: unique symbol;

/**
 * Phantom-типы — носят `I` и `D` через границы вызовов, чтобы `createApi`
 * мог их вывести в финальный тип `(input: I) => Promise<D>`.
 */
export interface Endpoint<I = unknown, D = unknown> {
  readonly config: EndpointConfig;
  readonly [__input]?: I;
  readonly [__output]?: D;
}

export type InferInput<E> = E extends Endpoint<infer I, any> ? I : never;
export type InferOutput<E> = E extends Endpoint<any, infer D> ? D : never;

/**
 * Фабрика endpoint'а. Получает `z` (CapsuleZ из `@capsuletech/shared-zod`),
 * возвращает конфиг. Дизайн повторяет `Shape((z, ui) => ...)`:
 * пользователь не импортирует zod руками.
 *
 * ```ts
 * export const get = defineEndpoint((z) => ({
 *   method: 'GET',
 *   path: '/users/:id',
 *   request: z.object({ id: z.string() }),
 *   response: z.object({ id: z.string(), email: z.string() }),
 * }));
 * ```
 */
export const defineEndpoint = <TReq extends ZodType, TRes extends ZodType, D = ZOut<TRes>>(
  factory: (z: CapsuleZ) => EndpointConfig<TReq, TRes, D>,
): Endpoint<ZOut<TReq>, D> => {
  const config = factory(z);
  return { config: config as EndpointConfig } as Endpoint<ZOut<TReq>, D>;
};
