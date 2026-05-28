/**
 * Incidents endpoints namespace.
 *
 * `services.api.incidents.list()` — генерируется EndpointsRegistryPlugin'ом.
 * Response schema — `Entities.Incident.schema` (global, доступен после systemic
 * layer init ordering fix в ExportGeneratorPlugin). Mock через `preRequest` —
 * `resolve(data)` короткозамыкает pipeline без сетевого запроса. Latency 400ms
 * симулирует round-trip — видно loading-state в UI.
 */
import { INCIDENTS_MOCK } from '../mocks/incidents';

const MOCK_LATENCY_MS = 400;

export const list = defineEndpoint((z) => ({
  method: 'GET',
  path: '/incidents',
  request: z.object({}),
  response: z.array(Entities.Incident.schema),
  preRequest: async ({ resolve }) => {
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
    resolve(INCIDENTS_MOCK);
  },
}));
