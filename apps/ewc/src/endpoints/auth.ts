/**
 * Auth endpoints namespace.
 *
 * `services.api.auth.login(input)` — генерируется EndpointsRegistryPlugin'ом.
 * Mock через `preRequest` — `resolve(data)` короткозамыкает pipeline без сетевого запроса.
 *
 * Mock creds: `login-user` / `pass-123`. Возвращает `{ token: 'mock-jwt-...' }`.
 * Любые другие — reject `Error('Invalid credentials')`.
 *
 * 800ms задержка симулирует сетевой round-trip — чтобы наглядно увидеть
 * submitting-state в UI (spinner на кнопке + disabled inputs).
 */

const MOCK_LATENCY_MS = 800;

export const login = defineEndpoint((z) => ({
  method: 'POST',
  path: '/auth/login',
  request: z.object({
    login: z.string(),
    password: z.string(),
  }),
  response: z.object({
    token: z.string(),
  }),
  preRequest: async ({ input, resolve, reject }) => {
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
    if (input.login === 'login-user' && input.password === 'pass-123') {
      resolve({ token: `mock-jwt-${Date.now()}` });
      return;
    }
    reject(new Error('Invalid credentials'));
  },
}));
