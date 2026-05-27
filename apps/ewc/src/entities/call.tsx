/**
 * Call — карточка экстренного обращения (incident report).
 *
 * Пользователь звонит → диспетчер заносит карточку: кто заявитель,
 * где (координаты), что произошло. Каждый звонок — отдельная карточка.
 *
 * Single-item shape (`z.object`). Списки строятся через Shape (`z.array(...schema)`)
 * — см. shapes/callsTable.tsx.
 */
const Call = Entity((z) => ({
  schema: z.object({
    id: z.string(),
    applicant: z.object({
      name: z.string(),
      phone: z.string(),
    }),
    location: z.object({
      lng: z.number(),
      lat: z.number(),
    }),
    description: z.string(),
    createdAt: z.string(), // ISO timestamp
  }),
}));

export default Call;
