import { createEffect, createUniqueId, mergeProps, onCleanup, splitProps } from 'solid-js';
import type { ICtx } from './ctx';
import {
  type AnyEvent,
  TAG_TO_INPUT_TYPE,
  deriveInputType,
  deriveName,
  getTargetData,
} from './derivation';

export { TAG_TO_INPUT_TYPE, deriveInputType, deriveName, getTargetData };

/**
 * Закрытый набор перехватываемых событий (см. ADR 009).
 * `updateStore: true` означает: после события компонент пишет в store.components[id]
 * свой target (актуально для inputs / selects — value/checked-флаг сохраняется
 * в reactive-снапшот).
 */
type EventName = 'onClick' | 'onInput' | 'onChange' | 'onBlur' | 'onFocus' | 'onKeyDown';
const EVENT_HANDLERS: Record<EventName, { updateStore: boolean }> = {
  onClick: { updateStore: false },
  onInput: { updateStore: true },
  onChange: { updateStore: true },
  onBlur: { updateStore: false },
  onFocus: { updateStore: false },
  onKeyDown: { updateStore: false },
};

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
): any => {
  if (!OriginalComponent) return undefined;

  if (typeof OriginalComponent !== 'function' && typeof OriginalComponent !== 'object') {
    return OriginalComponent;
  }

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

    // Реактивная регистрация: на mount + при любом изменении props
    createEffect(() => {
      const name = deriveName(props.meta);
      ctx.store.registerComponent({
        [id]: { ...props, ...(name ? { name } : {}) },
      });
    });

    onCleanup(() => {
      ctx.store.unregisterComponent(id);
    });

    const eventBindings: Record<string, (e: AnyEvent) => void> = {};
    for (const [eventName, opts] of Object.entries(EVENT_HANDLERS)) {
      const flag = `__capsule_${eventName}__`;
      eventBindings[eventName] = (e: AnyEvent) => {
        // Дедупликация на bubbling: первый сработавший handler помечает event,
        // верхние обёртки в DOM-цепочке пропускают повторные вызовы.
        if ((e as any)[flag]) return;
        (e as any)[flag] = true;

        const data = getTargetData(e, props, deriveName(props.meta));
        if (opts.updateStore && data.name) {
          ctx.store.update({ [id]: data });
        }
        safeCall(ctx.controller[eventName], data, ctx.store.ctx);
        safeCall(props[eventName], e);
      };
    }

    const dynamicProps = {
      get class() {
        const name = deriveName(props.meta);
        const custom = name ? ctx.store.styles?.[name] || '' : '';
        return `${props.class || ''} ${custom}`.trim();
      },
      get disabled() {
        return ctx.store.loading || props.disabled;
      },
      // name прокидывается под капотом — для нативных DOM-элементов (input/button/select),
      // которым нужно name-атрибут (form-data, accessibility, label-for-by-id).
      get name() {
        return deriveName(props.meta);
      },
      // type DOM-инпута, выведенный из тега (password / email / phone / number / text).
      // Если автор Entity указал `type="..."` явно — уважаем его (props.type win'ит).
      get type() {
        return props.type ?? deriveInputType(props.meta);
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
export const UiProxy = (Ui: Record<string, any>, ctx: ICtx<any>, wrapperProps: any) =>
  new Proxy(
    { ...Ui },
    {
      get(target, propName: string) {
        return wrapComponent(ctx, wrapperProps, (target as any)[propName]);
      },
    },
  );
