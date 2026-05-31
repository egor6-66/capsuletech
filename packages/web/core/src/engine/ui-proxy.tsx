import type { JSX } from 'solid-js';
import { createEffect, createUniqueId, mergeProps, onCleanup, splitProps } from 'solid-js';
import type { ICtx } from './ctx';
import {
  type AnyEvent,
  deriveInputType,
  deriveName,
  getTargetData,
  TAG_TO_INPUT_TYPE,
} from './derivation';

export { deriveInputType, deriveName, getTargetData, TAG_TO_INPUT_TYPE };

/**
 * Закрытый набор перехватываемых событий (см. ADR 009).
 * `updateStore: true` означает: после события компонент пишет в store.components[id]
 * свой target (актуально для inputs / selects — value/checked-флаг сохраняется
 * в reactive-снапшот).
 */
type EventName =
  | 'onClick'
  | 'onDblClick'
  | 'onInput'
  | 'onChange'
  | 'onBlur'
  | 'onFocus'
  | 'onKeyDown';

/**
 * Whitelist primitive'ов UI-кита, для которых UiProxy автоматически инжектит
 * kind-tag в `meta.tags` перед registerComponent / event-binding.
 *
 * Расширять осознанно: каждый entry означает что apps смогут опустить явный тег
 * и store.pick / deriveName получат его автоматически.
 * Радио / Switch и т.п. — пока не добавляем (не используются в ewc).
 */
const KIND_TAGS: Record<string, string> = {
  Input: 'input',
  Textarea: 'input',
  Select: 'input',
  Checkbox: 'input',
  Button: 'button',
};

const EVENT_HANDLERS: Record<EventName, { updateStore: boolean }> = {
  onClick: { updateStore: false },
  onDblClick: { updateStore: false },
  onInput: { updateStore: true },
  onChange: { updateStore: true },
  onBlur: { updateStore: false },
  onFocus: { updateStore: false },
  onKeyDown: { updateStore: false },
};

/**
 * Префикс/маркер для дедупликации bubbling. Один markup-узел получает несколько
 * `addEventListener`'ов через mergeProps (когда обёртка вложена в обёртку через
 * рекурсивный wrapper-proxy), и при bubble первый сработавший handler ставит
 * флаг, остальные skip'ают. Имя префикса — часть _внутреннего_ контракта,
 * не появляется в публичном API, но фиксируем константой чтобы не плодить
 * template strings в hot path.
 */
const EVENT_MARKER_PREFIX = '__capsule_';
const EVENT_MARKER_SUFFIX = '__';
export const eventMarker = (name: string): string =>
  `${EVENT_MARKER_PREFIX}${name}${EVENT_MARKER_SUFFIX}`;

/**
 * Pre-computed список событий — каждый item уже содержит готовый marker,
 * чтобы внутри `wrapComponent` не делать `Object.entries` на каждый mount
 * (`wrapComponent` зовётся под Proxy-get'ом, hot path).
 */
const EVENT_ENTRIES: ReadonlyArray<{
  name: EventName;
  updateStore: boolean;
  marker: string;
}> = (Object.entries(EVENT_HANDLERS) as [EventName, { updateStore: boolean }][]).map(
  ([name, { updateStore }]) => ({ name, updateStore, marker: eventMarker(name) }),
);

const safeCall = (fn: any, ...args: any[]) => {
  try {
    const r = fn?.(...args);
    if (r && typeof r.catch === 'function') {
      r.catch((err: any) => console.error('[UiProxy] async handler failed:', err));
    }
    return r;
  } catch (err) {
    console.error('[UiProxy] sync handler threw:', err);
  }
};

/**
 * Внутренний хелпер: строит объект с 6 event-handlers с дедупликацией bubbling
 * и диспатчингом в ctx.controller. Используется как `wrapComponent` (full path),
 * так и `bindEvents` (events-only path для composite-строк).
 *
 * @param ctx           — текущий ControllerContext (controller + store)
 * @param getEffMeta    — геттер effective meta (может содержать kind-tag inject)
 * @param getProps      — геттер текущих merged props (для value/payload/name/userHandlers)
 * @param onUpdateStore — опциональный callback для `updateStore=true` событий;
 *                        `wrapComponent` передаёт closure с id; `bindEvents` — undefined.
 */
const buildEventBindings = (
  ctx: ICtx<any>,
  getEffMeta: () => any,
  getProps: () => any,
  onUpdateStore?: (data: ReturnType<typeof getTargetData>) => void,
): Record<string, (e: AnyEvent) => void> => {
  const bindings: Record<string, (e: AnyEvent) => void> = {};
  for (const { name, updateStore, marker } of EVENT_ENTRIES) {
    bindings[name] = (e: AnyEvent) => {
      // Дедупликация на bubbling: первый сработавший handler помечает event,
      // верхние обёртки в DOM-цепочке пропускают повторные вызовы.
      if ((e as any)[marker]) return;
      (e as any)[marker] = true;

      const props = getProps();
      const effectiveMeta = getEffMeta();
      const data = getTargetData(e, { ...props, meta: effectiveMeta }, deriveName(effectiveMeta));
      if (updateStore && data.name && onUpdateStore) {
        onUpdateStore(data);
      }
      safeCall(ctx.controller[name], data, ctx.store.ctx);
      safeCall(props[name], e);
    };
  }
  return bindings;
};

/**
 * Events-only binder для composite-внутренних строк (DataTable.Row, List.Item и т.д.).
 *
 * Возвращает обёртку над `Comp`, которая:
 *  - читает `props.meta` / `props.payload` и строит target через `getTargetData`;
 *  - навешивает те же 6 событий с тем же `eventMarker`-дедупом что и `wrapComponent`,
 *    т.е. innermost-handler отрабатывает первым и маркирует event, outer-wrapper
 *    (если есть) пропустит;
 *  - диспатчит `safeCall(ctx.controller[eventName], target, ctx.store.ctx)` и
 *    форвардит `props[eventName]` (user-handler) — идентичная семантика;
 *  - НЕ передаёт `meta` / `payload` в `Comp` (потребляет их — иначе они осядут
 *    как `[object Object]` на DOM-узле);
 *  - НЕ регистрирует в store, НЕ создаёт id, НЕ читает store.styles/loading;
 *    composite-строки не нужно регистрировать индивидуально.
 *
 * Предназначен для заполнения `ICompositeProxyContext.wrap` в `logic-wrapper.tsx`.
 * Вызывается ОДИН РАЗ на construction-time (вне render-loop), как того требует
 * контракт `ICompositeProxyContext.wrap` (idempotent per call-site).
 */
export const bindEvents = <P,>(
  ctx: ICtx<any>,
  Comp: (props: P) => JSX.Element,
  _name?: string,
): ((props: P) => JSX.Element) => {
  return (props: P) => {
    // Потребляем meta и payload — они нужны только для target-построения,
    // не должны попасть в DOM (иначе React-подобные предупреждения + [object Object]).
    // Локальный cast: web-core владеет HCA-семантикой meta/payload; контракт P не ограничен.
    const hca = props as P & { meta?: any; payload?: unknown };
    const { meta, payload, ...rest } = hca as any;

    const getEffMeta = () => meta;
    const getProps = () => ({ ...rest, meta, payload });

    const eventBindings = buildEventBindings(ctx, getEffMeta, getProps);

    // mergeProps: rest (без meta/payload) < eventBindings. Solid корректно
    // мержит обработчики — user-handler вызывается через safeCall внутри binding'а.
    const finalProps = mergeProps(rest, eventBindings) as P;
    const C = Comp as any;
    return <C {...finalProps} />;
  };
};

/**
 * Оборачивает один компонент (или namespace вроде `Field` с подкомпонентами):
 *  - при отсутствии собственного `meta` — рендерит через; рекурсивно wrap'ит
 *    sub-component'ы;
 *  - при наличии `meta` — регистрирует в store.components, навешивает 6
 *    event handlers (с дедупликацией bubbling), injectит реактивные
 *    class/disabled/name/type, мержит patch'и `store.setProps(id)` в final-props.
 *
 * Экспортирован отдельно (не closure внутри `UiProxy`), чтобы тесты могли
 * скармливать произвольный stub-компонент без поднятия всего `web-ui` lazy-graph'а.
 * Public-API контракт (UiProxy returns Proxy over Ui) сохранён 1:1.
 */
export const wrapComponent = (
  ctx: ICtx<any>,
  wrapperProps: any,
  OriginalComponent: any,
  componentName?: string,
): any => {
  if (!OriginalComponent) return undefined;

  if (typeof OriginalComponent !== 'function' && typeof OriginalComponent !== 'object') {
    return OriginalComponent;
  }

  // kind-tag для данного primitive'а (undefined если не в whitelist).
  // Вычисляется один раз на wrap-time — componentName стабилен.
  const kindTag = componentName ? KIND_TAGS[componentName] : undefined;

  const ComponentWrapper = (componentProps: any) => {
    const merged = mergeProps(wrapperProps, componentProps, {
      dynamicMeta: wrapperProps?.meta,
    });
    const [local, props] = splitProps(merged, ['children']);

    // Политика C: элемент попадает в реестр и получает event-binding ТОЛЬКО
    // если разработчик явно указал собственный meta на этом JSX-узле.
    // Унаследованный dynamicMeta (от Entity) — не повод регистрировать
    // структурные обёртки (Field, Field.Label и т.д.).
    const hasOwnMeta = !!componentProps?.meta;

    if (!hasOwnMeta) {
      // Сквозной рендер без побочных эффектов — обёртка только ради
      // рекурсивного wrap'а под-компонентов через Proxy выше.
      const finalProps = mergeProps(props, local);
      return <OriginalComponent {...finalProps} />;
    }

    const id = createUniqueId();

    // effectiveMeta — геттер, чтобы при обновлении props.meta (dynamicMeta-патч)
    // все читатели ниже автоматически получали свежий объект с kind-tag.
    // Если kindTag уже присутствует в tags — не дублируем.
    const getEffectiveMeta = () => {
      const baseMeta = props.meta;
      if (!kindTag) return baseMeta;
      const userTags: readonly string[] = baseMeta?.tags ?? [];
      const tagsWithKind = userTags.includes(kindTag) ? userTags : [...userTags, kindTag];
      return { ...baseMeta, tags: tagsWithKind };
    };

    // Реактивная регистрация: на mount + при любом изменении props
    createEffect(() => {
      const effectiveMeta = getEffectiveMeta();
      const name = deriveName(effectiveMeta);
      ctx.store.registerComponent({
        [id]: { ...props, meta: effectiveMeta, ...(name ? { name } : {}) },
      });
    });

    onCleanup(() => {
      ctx.store.unregisterComponent(id);
    });

    const eventBindings = buildEventBindings(
      ctx,
      getEffectiveMeta,
      () => props,
      (data) => {
        // Patch только runtime-меняющиеся поля. meta/name уже в components[id] через
        // registerComponent (mount-time, единоразово). Раньше тут был ctx.store.update
        // (SET_DATA), который шумил весь target в user namespace `context.data` —
        // см. историю про разделение register/update в docs/09-packages/state.md.
        ctx.store.updateComponent({ [id]: { value: data.value, type: data.type } });
      },
    );

    const dynamicProps = {
      get class() {
        const name = deriveName(getEffectiveMeta());
        const custom = name ? ctx.store.styles?.[name] || '' : '';
        return `${props.class || ''} ${custom}`.trim();
      },
      get disabled() {
        return ctx.store.loading || props.disabled;
      },
      // name прокидывается под капотом — для нативных DOM-элементов (input/button/select),
      // которым нужно name-атрибут (form-data, accessibility, label-for-by-id).
      get name() {
        return deriveName(getEffectiveMeta());
      },
      // type DOM-инпута, выведенный из тега (password / email / phone / number / text).
      // Если автор Entity указал `type="..."` явно — уважаем его (props.type win'ит).
      get type() {
        return props.type ?? deriveInputType(getEffectiveMeta());
      },
      ...eventBindings,
    };

    // Порядок mergeProps: позже = выигрывает. Дефолтные props < dynamicProps
    // (class/disabled/name/type) < patch'и от Controller (`store.setProps`) < children.
    //
    // Patch-источник передан **функцией** — Solid'овский mergeProps вызывает её
    // на КАЖДОМ чтении и пробрасывает реактивность от @xstate/solid (createStore)
    // в потребителя (`splitProps` / JSX-spread).
    const finalProps = mergeProps(props, dynamicProps, () => ctx.store.props?.[id] ?? {}, local);
    return <OriginalComponent {...finalProps} />;
  };

  return new Proxy(ComponentWrapper, {
    get(target, prop: string) {
      const subComponent = (OriginalComponent as any)[prop];
      if (subComponent) {
        // Sub-components (Card.Header, Field.Label и т.д.) — componentName не передаём,
        // они не в KIND_TAGS whitelist и auto-tag для них не нужен.
        return wrapComponent(ctx, wrapperProps, subComponent);
      }
      return (target as any)[prop];
    },
  });
};

/**
 * Создаёт Proxy над переданным UI-kit'ом — каждый доступ к компоненту
 * возвращает `wrapComponent`-обёртку. Ui приходит аргументом (а не импортится
 * из `../ui-kit`), чтобы:
 *  - тесты могли скармливать stub-Ui без поднятия lazy-graph'а;
 *  - сам файл `ui-proxy.tsx` не имел top-module side-effects от ui-kit и
 *    был testing-friendly (ui-kit lazy-импортит `@capsuletech/web-ui`,
 *    который тянет `@tanstack/solid-router` с `.jsx`-файлами в dev-conditions —
 *    они валят vitest в jsdom env).
 *
 * Caller (`wrappers/entity.tsx`) импортит `Ui as BaseUi` и передаёт сюда.
 */
/**
 * Keys on the Ui object that must bypass `wrapComponent` entirely and be
 * returned raw from the Proxy. Add to this set when a new namespace contains
 * render-prop–based primitives (control-flow, portals, etc.) that would break
 * if wrapped in a ComponentWrapper.
 *
 * Current entries:
 *  - 'Flow': Solid control-flow primitives (For/Show/Switch/Match/Index/Dynamic).
 *    Wrapping them would interfere with their function-child / fallback /
 *    nesting semantics and add pointless overhead.
 */
const RAW_PASSTHROUGH_KEYS = new Set<string>(['Flow']);

export const UiProxy = (Ui: Record<string, any>, ctx: ICtx<any>, wrapperProps: any) =>
  new Proxy(
    { ...Ui },
    {
      get(target, propName: string) {
        if (RAW_PASSTHROUGH_KEYS.has(propName)) {
          return (target as any)[propName];
        }
        return wrapComponent(ctx, wrapperProps, (target as any)[propName], propName);
      },
    },
  );
