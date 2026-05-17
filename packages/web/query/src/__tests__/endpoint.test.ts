import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { type Endpoint, type InferInput, type InferOutput, defineEndpoint } from '../endpoint';

// defineEndpoint — фабрика, factory принимает CapsuleZ.
// Тесты держат runtime-shape и type-inference сигнатур.

describe('defineEndpoint — runtime', () => {
  it('returns { config } with shape from factory', () => {
    const ep = defineEndpoint((z) => ({
      method: 'GET',
      path: '/users/:id',
      request: z.object({ id: z.string() }),
      response: z.object({ id: z.string(), email: z.string() }),
    }));
    expect(ep.config.method).toBe('GET');
    expect(ep.config.path).toBe('/users/:id');
    expect(ep.config.request).toBeDefined();
    expect(ep.config.response).toBeDefined();
  });

  it('does NOT call request/response schemas at definition time', () => {
    let called = false;
    const dummy = z.object({}).transform((v) => {
      called = true;
      return v;
    });
    defineEndpoint(() => ({
      method: 'GET',
      path: '/x',
      response: dummy,
    }));
    expect(called).toBe(false);
  });

  it('preserves map / staleTime / middleware / base', () => {
    const map = (dto: any) => ({ ...dto, wrapped: true });
    const ep = defineEndpoint((z) => ({
      method: 'GET',
      path: '/x',
      base: 'cdn',
      response: z.object({ a: z.number() }),
      map,
      staleTime: 10_000,
      middleware: [],
    }));
    expect(ep.config.base).toBe('cdn');
    expect(ep.config.map).toBe(map);
    expect(ep.config.staleTime).toBe(10_000);
    expect(ep.config.middleware).toEqual([]);
  });
});

describe('defineEndpoint — type inference', () => {
  it('InferInput uses request-schema OUTPUT (after parse)', () => {
    const ep = defineEndpoint((z) => ({
      method: 'GET',
      path: '/x',
      request: z.object({ id: z.string() }),
      response: z.any(),
    }));
    type I = InferInput<typeof ep>;
    expectTypeOf<I>().toEqualTypeOf<{ id: string }>();
  });

  it('InferOutput defaults to response-schema OUTPUT when no map', () => {
    const ep = defineEndpoint((z) => ({
      method: 'GET',
      path: '/x',
      response: z.object({ email: z.string() }),
    }));
    type O = InferOutput<typeof ep>;
    expectTypeOf<O>().toEqualTypeOf<{ email: string }>();
  });

  it('InferOutput uses map return type when map is provided', () => {
    const ep = defineEndpoint((z) => ({
      method: 'GET',
      path: '/x',
      response: z.object({ createdAt: z.string() }),
      map: (dto) => ({ createdAt: new Date(dto.createdAt) }),
    }));
    type O = InferOutput<typeof ep>;
    expectTypeOf<O>().toEqualTypeOf<{ createdAt: Date }>();
  });

  it('Endpoint type can be used as a polymorphic key (covers RegistryNode contract)', () => {
    const ep1 = defineEndpoint((z) => ({ method: 'GET', path: '/x', response: z.any() }));
    const ep2 = defineEndpoint((z) => ({ method: 'POST', path: '/y', response: z.any() }));
    const registry: Record<string, Endpoint> = { a: ep1, b: ep2 };
    expect(registry.a.config.method).toBe('GET');
    expect(registry.b.config.method).toBe('POST');
  });
});
