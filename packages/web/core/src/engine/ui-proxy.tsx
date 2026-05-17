import { createEffect, createUniqueId, mergeProps, onCleanup, splitProps } from 'solid-js';
import { Ui as UI } from '../ui-kit';
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

export const UiProxy = (ctx: ICtx<any>, wrapperProps: any) => {
  const wrap = (OriginalComponent: any): any => {
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
          return wrap(subComponent);
        }
        return (target as any)[prop];
      },
    });
  };

  return new Proxy(
    { ...UI },
    {
      get(target, propName: string) {
        return wrap((target as any)[propName]);
      },
    },
  );
};
