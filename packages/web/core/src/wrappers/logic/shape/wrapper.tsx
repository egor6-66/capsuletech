import { z } from '@capsuletech/shared-zod';
import { For } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useShapeUi } from './context';
import type { IShapeComponentProps, IShapeTemplateProps, IShapeWrapper } from './types';
import { createUiTracker, getTrackerPath, resolveByPath } from './ui-tracker';

/**
 * Shape wrapper — описывает форму данных + дефолты + маппинг item → templateProps,
 * отдаёт polymorphic-компонент.
 *
 * Приоритет рендера каждого item'а:
 *  1. `props.children` (render-prop) — escape hatch для сложной композиции.
 *  2. `props.as` от JSX-сайта — explicit override.
 *  3. `definition.as` от factory — default template (резолвится через context
 *     если это path-tracker, иначе используется напрямую).
 *  4. default — рендерит `templateProps.children` без обёртки.
 *
 * Path-tracker (`definition.as = ui.Navigation.Item`) резолвится **lazy** на
 * каждый рендер через `useShapeUi()` — это даёт PROXIED Ui из родительского
 * Entity, что важно для UiProxy event-binding'а / payload-tracking'а.
 */
const shape = (factory: any) => {
  // Factory вызывается на module-load. `ui` — path-tracker (real Ui ещё нет).
  const definition = factory(z, createUiTracker());
  const { defaults, props: propsFn, as: defaultAs } = definition;

  return (props: IShapeComponentProps<unknown>) => {
    const realUi = useShapeUi();
    const data = () => props.data ?? defaults ?? [];

    /** Резолв template'а: explicit `as` > definition.as (резолв пути) > undefined. */
    const resolveTemplate = (): unknown => {
      if (props.as) return props.as;
      if (!defaultAs) return undefined;
      const path = getTrackerPath(defaultAs);
      if (path && realUi) return resolveByPath(realUi, path);
      return defaultAs;
    };

    return (
      <For each={data() as readonly unknown[]}>
        {(item, index) => {
          if (props.children) return props.children(item, index);

          const tplProps: IShapeTemplateProps = propsFn
            ? propsFn(item)
            : (item as IShapeTemplateProps);

          const Template = resolveTemplate();
          if (Template) {
            return (
              <Dynamic component={Template as any} {...(tplProps as Record<string, unknown>)} />
            );
          }
          return <>{tplProps.children ?? null}</>;
        }}
      </For>
    );
  };
};

export const Shape = shape as unknown as IShapeWrapper;
