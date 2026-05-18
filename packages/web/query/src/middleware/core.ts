import { NetworkError, ValidationError } from '../errors';
import type { Middleware } from '../pipeline';
import type { RequestConfig } from '../types';

const PATH_PARAM = /:(\w+)/g;

/** Прогоняет `ctx.input` через `endpoint.request` zod-схему. Если схемы нет — no-op. */
export const validateInput = (): Middleware => async (ctx, next) => {
  const schema = ctx.config.request;
  if (schema) {
    const parsed = schema.safeParse(ctx.input);
    if (!parsed.success) throw new ValidationError('request', parsed.error.issues);
    ctx.input = parsed.data;
  }
  await next();
};

/**
 * Превращает `ctx.input` в `ctx.request`:
 *  - подставляет `:param`-плейсхолдеры из соответствующих полей input'а;
 *  - оставшиеся поля — в `params` (для GET/HEAD/DELETE) или в `body` (иначе).
 */
export const buildRequest = (): Middleware => async (ctx, next) => {
  const { method, path, base } = ctx.config;
  const input = (ctx.input ?? {}) as Record<string, unknown>;

  const usedKeys = new Set<string>();
  const url = path.replace(PATH_PARAM, (_, key: string) => {
    usedKeys.add(key);
    const value = input[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing path param ":${key}" for endpoint ${ctx.endpointName}`);
    }
    return encodeURIComponent(String(value));
  });

  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!usedKeys.has(k)) rest[k] = v;
  }

  const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';
  const req: RequestConfig = { method, url, base };
  if (hasBody) {
    if (Object.keys(rest).length > 0) req.body = rest;
  } else {
    // Передаём rest как есть — `client.resolveUrl` сам решает что делать с
    // undefined/null/массивами. Раньше тут было ручное `String(v)`-преобразование,
    // которое теряло массивы и схлопывало undefined в строку "undefined".
    const params: RequestConfig['params'] = {};
    let hasAny = false;
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined || v === null) continue;
      params[k] = v as RequestConfig['params'] extends Record<string, infer V> ? V : never;
      hasAny = true;
    }
    if (hasAny) req.params = params;
  }
  ctx.request = req;

  await next();
};

/**
 * HTTP-transport: дёргает `QueryClient.fetch` (для GET) или `.mutate` (иначе).
 * Кэш используется только на GET — остальное uncached mutation.
 *
 * `QueryClient` уже умеет кидать `Error` с `.status` на non-2xx — это сырое
 * исключение пробрасывается дальше, `statusMapper` конвертит в типизированное.
 */
export const httpTransport = (): Middleware => async (ctx, next) => {
  const { method } = ctx.request;
  const client = ctx.client;

  try {
    if (method === 'GET') {
      ctx.response = await client.fetch(
        ['__endpoint', ctx.endpointName, (ctx.input ?? null) as object | null],
        { ...ctx.request, staleTime: ctx.config.staleTime },
      );
    } else {
      ctx.response = await client.mutate({ ...ctx.request, name: ctx.endpointName });
    }
  } catch (err) {
    if (err && typeof (err as { status?: number }).status === 'number') throw err;
    throw new NetworkError({ cause: err });
  }

  await next();
};

/** Прогоняет `ctx.response` через `endpoint.response` zod-схему. */
export const validateResponse = (): Middleware => async (ctx, next) => {
  const schema = ctx.config.response;
  if (schema) {
    const parsed = schema.safeParse(ctx.response);
    if (!parsed.success) throw new ValidationError('response', parsed.error.issues);
    ctx.response = parsed.data;
  }
  await next();
};

/** Применяет `endpoint.map(dto)` — финальная domain-форма. Если `map` не задан — `data = response`. */
export const mapDomain = (): Middleware => async (ctx, next) => {
  ctx.data = ctx.config.map ? ctx.config.map(ctx.response) : ctx.response;
  await next();
};
