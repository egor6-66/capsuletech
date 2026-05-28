/**
 * Incidents — shared state hub для группы виджетов, работающих
 * с единым списком карточек происшествий.
 *
 * State machine:
 *   idle → loading → loaded
 *                 ↘ error → loading (retry)
 *   loaded → loading (retry / refresh)
 *
 * Single source of truth: все три виджета читают данные через store,
 * операции (select / toggle visibility) диспатчатся через controller
 * next()-bubbling к этому Feature.
 *
 * Wiring (Phase 2):
 * ```tsx
 * <Features.Incidents>
 *   <Widgets.Tables.Incidents />
 *   <Widgets.Maps.World />
 *   <Widgets.Sidebars.Main />
 * </Features.Incidents>
 * ```
 *
 * Context shape (user fields живут в `context.data`, доступ через
 * `useCtx().store.ctx.data.X` или handler param `context.data.X`):
 * ```ts
 * {
 *   items: IIncident[];          // загруженный список
 *   visibleIds: Set<string>;     // ids видимых на карте маркеров
 *   selectedId: string | null;   // выбранный incident (sidebar)
 *   error: string | null;        // последнее сообщение об ошибке
 * }
 * ```
 *
 * Mutations: только через `store.update({ field: value })` — direct
 * `context.X = Y` запрещено Solid Store (выкинет "Cannot mutate a Store
 * directly"). Read через `context.data.X` (handler context = весь
 * IMachineContext, user-state лежит в `.data`).
 */

import type { z } from 'zod';

export type IIncident = z.infer<typeof Entities.Incident.schema>;

/** Shape of Features.Incidents user-state — read via `store.ctx.data` / `context.data`. */
export interface IIncidentsContext {
  items: IIncident[];
  visibleIds: Set<string>;
  selectedId: string | null;
  error: string | null;
}

const Incidents = Feature(({ api }) => ({
  initial: 'idle' as const,

  context: {
    items: [] as IIncident[],
    visibleIds: new Set<string>(),
    selectedId: null as string | null,
    error: null as string | null,
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
     * onInit вызывается при каждом входе (включая retry/refresh).
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

          store.update({
            items,
            visibleIds: new Set(items.map((i: IIncident) => i.id)),
            error: null,
          });

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

    /**
     * loaded — основной рабочий стейт. Доступны все методы управления
     * списком: выбор, visibility-фильтрация, refresh.
     */
    loaded: {
      /**
       * selectOne — устанавливает выбранный incident.
       * Idempotent: повторный вызов с тем же id ничего не меняет.
       */
      selectOne: ({ target, context, store }) => {
        const id = (target as { payload?: { id?: string } }).payload?.id;
        if (!id) return;
        if (context.data.selectedId === id) return;
        store.update({ selectedId: id });
      },

      /**
       * clearSelection — сбрасывает выбор (sidebar переходит в пустое состояние).
       */
      clearSelection: ({ store }) => {
        store.update({ selectedId: null });
      },

      /**
       * toggleVisible — переключает видимость одного маркера на карте.
       * Иммутабельное обновление через new Set.
       */
      toggleVisible: ({ target, context, store }) => {
        const id = (target as { payload?: { id?: string } }).payload?.id;
        if (!id) return;
        const next = new Set(context.data.visibleIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        store.update({ visibleIds: next });
      },

      /**
       * setAllVisible — массовое управление видимостью.
       * visible=true → показать все; visible=false → скрыть все.
       */
      setAllVisible: ({ target, context, store }) => {
        const visible = (target as { payload?: { visible?: boolean } }).payload?.visible;
        if (visible === true) {
          store.update({
            visibleIds: new Set(context.data.items.map((i: IIncident) => i.id)),
          });
        } else {
          store.update({ visibleIds: new Set() });
        }
      },

      /**
       * retry — форсированный refresh: сбрасывает данные и уходит в loading.
       * Доступен из loaded (ручное обновление), а также пробрасывается из error.
       */
      retry: ({ store, state }) => {
        store.update({
          items: [],
          visibleIds: new Set(),
          error: null,
        });
        state.set('loading');
      },
    },

    /**
     * error — стейт ошибки загрузки. context.error содержит сообщение.
     * Единственный выход — retry().
     */
    error: {
      /**
       * retry — сброс в loading для повторной попытки загрузки.
       */
      retry: ({ store, state }) => {
        store.update({ error: null });
        state.set('loading');
      },
    },
  },
}));

export default Incidents;
