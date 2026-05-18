import type { IMachineContext } from './create';
import { matchByTags, matchEntryByTags, omitByTags, pickByTags } from './helpers';

/**
 * Аргумент `state` у `createBridge`. По форме совпадает с reactive-snapshot,
 * который отдаёт `useMachine(...)` из `@xstate/solid`. Bridge'у достаточно
 * `.context` — он не различает `value`/`status`/etc.
 */
export interface IBridgeStateSnapshot {
  context: IMachineContext;
}

/**
 * `send` у Bridge'а — тот же, что и у XState-actor'а (`actor.send`).
 * Bridge формирует events с известными `type`'ами (SET_DATA, REGISTER_COMPONENT, и т.п.);
 * остальные поля event'а — payload/value/styles/...
 */
export type IBridgeSend = (event: { type: string; [k: string]: unknown }) => void;

export interface BridgeMatchOptions {
  /** Учитывать ли dynamicMeta.tags. По умолчанию true. */
  lookDynamic?: boolean;
  /** Раскрывать ли алиасы тегов. По умолчанию true. */
  expandAliases?: boolean;
}

/**
 * Запись о смонтированном UI-элементе в `store.components`. Заполняется
 * UiProxy'ем при регистрации (для элементов с собственной `meta`).
 *
 *  - `meta` — идентификация: теги (роли), которыми элемент описал себя.
 *  - `payload` — произвольные данные, которые автор Entity явно прикрепил
 *    к элементу для контроллера (например `{ href: '/branches' }` у nav-итема).
 *    JSX: `<Nav.Item meta={{tags:['nav']}} payload={{href:'/branches'}} />`.
 *  - `dynamicMeta` — сценарная окраска от родительского Widget'а.
 *  - `name`, `value`, `type` — DOM-derived (для инпутов/кнопок).
 */
export interface IRegisteredComponent {
  meta?: { tags?: readonly string[]; [k: string]: unknown };
  dynamicMeta?: { tags?: readonly string[]; [k: string]: unknown };
  payload?: Record<string, unknown>;
  name?: string;
  value?: unknown;
  type?: string;
  [k: string]: unknown;
}

/** Тип возвращаемого Bridge'ем API — для type-аннотаций в Controller/Feature. */
export type IBridge = ReturnType<typeof createBridge>;

export const createBridge = (state: IBridgeStateSnapshot, send: IBridgeSend) => {
  return {
    // снимки
    get ctx() {
      return state.context;
    },
    get loading() {
      return state.context?.loading;
    },
    get styles() {
      return state.context?.styles ?? {};
    },
    get errors() {
      return state.context?.errors ?? {};
    },
    get components() {
      return state.context?.components ?? {};
    },
    get props() {
      return state.context?.props ?? {};
    },

    // мутации
    update: (payload: Record<string, any>) => send({ type: 'SET_DATA', payload }),
    setLoading: (value: boolean) => send({ type: 'SET_LOADING', value }),
    setStyles: (styles: Record<string, string>) => send({ type: 'SET_STYLES', styles }),
    setErrors: (errors: Record<string, string>) => send({ type: 'SET_ERRORS', errors }),
    /**
     * Patch'ит дополнительные props у компонентов по id. Каждый id мержится:
     * `setProps({ id1: { active: true } })` оставит другие поля у id1 нетронутыми.
     * UiProxy подмешивает эти props при рендере поверх статичных prop'ов JSX.
     *
     * Низкоуровневый API — для адресных patch'ей по уже известному id.
     * Для tag-based update'ов используй `patch(tags, ...)` ниже.
     */
    setProps: (payload: Record<string, Record<string, any>>) => {
      send({ type: 'SET_PROPS', payload });
    },
    registerComponent: (payload: Record<string, any>) =>
      send({ type: 'REGISTER_COMPONENT', payload }),
    unregisterComponent: (id: string) => send({ type: 'UNREGISTER_COMPONENT', id }),

    // tag-операции (объединяют meta.tags + dynamicMeta.tags, раскрывают алиасы)
    pick: (tags: readonly string[], opts?: BridgeMatchOptions) =>
      pickByTags(state.context?.components ?? {}, tags, opts),
    omit: (tags: readonly string[], opts?: BridgeMatchOptions) =>
      omitByTags(state.context?.components ?? {}, tags, opts),
    match: (tags: readonly string[], opts?: BridgeMatchOptions) =>
      matchByTags(state.context?.components ?? {}, tags, opts),
    matchEntry: (tags: readonly string[], opts?: BridgeMatchOptions) =>
      matchEntryByTags(state.context?.components ?? {}, tags, opts),

    /**
     * Tag-based мутатор — симметричен `pick/omit/match/matchEntry`. Находит
     * компоненты по тегам (та же логика что у `pick`) и мержит patch к их
     * runtime-props (через SET_PROPS).
     *
     * `patchOrFn`:
     *   - **объект** → один и тот же patch применяется ко всем совпадениям:
     *     `store.patch(['logout'], { disabled: true })`
     *   - **функция** `(comp, id) => patch | null | undefined` → per-component
     *     patch; возврат falsy/`{}` пропускает этот id:
     *     `store.patch(['nav'], (c) => ({ active: c.meta?.href === path }))`
     *
     * `opts` — те же что у `pick` (`lookDynamic`, `expandAliases`).
     *
     * Один `send({type: 'SET_PROPS'})` на все совпадения — атомарный update,
     * без N-кратных перерендеров.
     */
    patch: (
      tags: readonly string[],
      patchOrFn:
        | Record<string, any>
        | ((comp: IRegisteredComponent, id: string) => Record<string, any> | null | undefined),
      opts?: BridgeMatchOptions,
    ) => {
      const matched = pickByTags(state.context?.components ?? {}, tags, opts);
      const payload: Record<string, Record<string, any>> = {};
      for (const [id, comp] of Object.entries(matched)) {
        const p =
          typeof patchOrFn === 'function' ? patchOrFn(comp as IRegisteredComponent, id) : patchOrFn;
        if (p && Object.keys(p).length) payload[id] = p;
      }
      if (Object.keys(payload).length) send({ type: 'SET_PROPS', payload });
    },
  };
};
