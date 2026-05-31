/**
 * Incidents — shared state hub для группы виджетов, работающих
 * с единым списком карточек происшествий.
 *
 * State machine:
 *   idle → loading → loaded
 *                 ↘ error
 *
 * Single source of truth: виджеты читают данные через store. Выбор карточки —
 * через универсальный `onClick`-роутер (ниже): клик по строке таблицы или
 * маркеру карты несёт тег `incident` + payload `{ id }`; роутер резолвит
 * incident из `items` и кладёт **готовый объект** в `store.selected`. Виджеты
 * НЕ знают про id/поиск — читают `selected` и рисуют.
 *
 * Wiring:
 * ```tsx
 * <Features.Incidents>
 *   <Widgets.Tables.Incidents />
 *   <Widgets.Maps.World />
 *   <Widgets.Sidebars.Main />
 * </Features.Incidents>
 * ```
 *
 * Context shape (user fields живут в `context.data`, доступ через
 * `store.ctx.data.X` или handler param `context.data.X`):
 * ```ts
 * {
 *   items: IIncident[];           // загруженный список
 *   selected: IIncident | null;   // выбранная карточка (готова к отрисовке)
 *   error: string | null;         // последнее сообщение об ошибке
 * }
 * ```
 *
 * Mutations: только через `store.update({ field: value })` — direct
 * `context.X = Y` запрещено Solid Store (выкинет "Cannot mutate a Store
 * directly"). Read через `context.data.X`.
 */

import { unwrap } from 'solid-js/store';
import type { z } from 'zod';

export type IIncident = z.infer<typeof Entities.Incident.schema>;

/** Shape of Features.Incidents user-state — read via `store.ctx.data` / `context.data`. */
export interface IIncidentsContext {
  items: IIncident[];
  selected: IIncident | null;
  error: string | null;
}

const Incidents = Feature(({ api, router }) => ({
  initial: 'idle' as const,

  context: {
    items: [] as IIncident[],
    selected: null as IIncident | null,
    error: null as string | null,
  },

  /**
   * onClick — универсальный роутер кликов по `target.meta.tags`.
   *
   * Top-level (вне `states`) → ControllerProxy находит его как fallback после
   * `states[current]`, значит ловит клик в любом стейте.
   *   `incident`  → select: резолвит incident из `items` (по payload `{ id }`)
   *                 и кладёт готовый объект в `selected` (idempotent), чтобы
   *                 виджеты читали его без знания про id/поиск.
   *   `open-card` → navigate: переход на детальную карточку выбранного incident'а.
   */
  onClick: ({ target, store }) => {
    const tags = (target as { meta?: { tags?: string[] } }).meta?.tags ?? [];

    if (tags.includes('incident')) {
      const id = (target as { payload?: { id?: string } }).payload?.id;
      if (!id || store.ctx.data.selected?.id === id) return;
      const item = store.ctx.data.items.find((i: IIncident) => i.id === id);
      // Store a plain deep clone, NOT the live `items[k]` store-proxy node:
      // putting a store node into another store field aliases them in
      // @xstate/solid's reconcile, which corrupts items[k] on the next select.
      store.update({ selected: item ? structuredClone(unwrap(item)) : null });
    }

    if (tags.includes('open-card')) {
      const id = store.ctx.data.selected?.id;
      if (id) router.goTo(`/workspace/cards/${id}`);
    }
  },

  /**
   * onDblClick — даблклик по строке таблицы или маркеру (тег `incident`) →
   * сразу переход на детальную карточку по payload `{ id }` (минуя выбор).
   * Single-click фиксирует `selected`, double-click открывает.
   */
  onDblClick: ({ target }) => {
    const tags = (target as { meta?: { tags?: string[] } }).meta?.tags ?? [];
    if (tags.includes('incident')) {
      const id = (target as { payload?: { id?: string } }).payload?.id;
      if (id) router.goTo(`/workspace/cards/${id}`);
    }
  },

  states: {
    /**
     * idle — стартовое состояние. onInit немедленно запускает загрузку:
     * переходит в `loading`, не делая сам API-вызов (разделение ответственности).
     */
    idle: {
      onInit: ({ state }) => {
        state.set('loading');
      },
    },

    /**
     * loading — единственный стейт, где происходит API-вызов.
     * На success → `loaded`, на error → `error`.
     */
    loading: {
      onInit: async ({ store, state }) => {
        if (!api) {
          // eslint-disable-next-line no-console
          console.error('[incidents] api client not initialized — check capsule.app.ts > api');
          store.update({ error: 'API client not initialized' });
          state.set('error');
          return;
        }

        try {
          const result = await api.incidents.list({});
          const items = Entities.Incident.schema.array().parse(result) as IIncident[];

          store.update({ items, error: null });
          state.set('loaded');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // eslint-disable-next-line no-console
          console.error('[incidents] load failed:', message);
          store.update({ error: message });
          state.set('error');
        }
      },
    },

    /** loaded — данные загружены. Выбор карточки идёт через top-level `onClick`. */
    loaded: {},

    /** error — загрузка не удалась; `context.error` содержит сообщение. */
    error: {},
  },
}));

export default Incidents;
