import { CALLS_MOCK } from '../mocks/calls';

/**
 * CallsTable — батч-вид списка экстренных карточек через Ui.DataTable.
 *
 * Schema: `z.array(Entities.Call.schema)` — batch-list поверх per-item Entity.
 * Defaults: 200 mock-карточек (apps/ewc/src/mocks/calls.ts) — заменятся реальным
 *   списком когда добавим services.api.calls.list().
 * Template: ui.DataTable (composite с sorting + infinite scroll).
 *
 * Extras (columns/sorting/infinite) транзитно идут в DataTable.
 */
const CallsTable = Shape((z, ui) => ({
  schema: z.array(Entities.Call.schema),
  defaults: CALLS_MOCK,
  as: ui.DataTable,
  sorting: true,
  infinite: { itemHeight: 40 },
  columns: [
    { accessorKey: 'id', header: 'ID' },
    {
      header: 'Заявитель',
      accessorFn: (row: (typeof CALLS_MOCK)[number]) => row.applicant.name,
      id: 'applicantName',
    },
    {
      header: 'Телефон',
      accessorFn: (row: (typeof CALLS_MOCK)[number]) => row.applicant.phone,
      id: 'applicantPhone',
    },
    {
      header: 'Координаты',
      id: 'location',
      accessorFn: (row: (typeof CALLS_MOCK)[number]) =>
        `${row.location.lat}, ${row.location.lng}`,
    },
    { accessorKey: 'description', header: 'Описание' },
    {
      accessorKey: 'createdAt',
      header: 'Создано',
      cell: (info: { getValue: () => unknown }) =>
        new Date(String(info.getValue())).toLocaleString('ru-RU'),
    },
  ],
}));

export default CallsTable;
