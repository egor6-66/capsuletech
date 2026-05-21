import { z } from '@capsuletech/shared-zod';
import { mergeProps, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useShapeUi } from './context';
import type { IShapeComponentProps, IShapeWrapper } from './types';
import { createUiTracker, getTrackerPath, resolveByPath } from './ui-tracker';

/**
 * Shape wrapper — single batch flow (v0.4.0+).
 *
 * Shape НЕ итерирует данные. Вся итерация — ответственность batch-template
 * (`Ui.List`, `Ui.DataTable` или пользовательского компонента, переданного в `as`).
 *
 * Flow:
 *  1. Factory вызывается на module-load: `{ schema, defaults, as, ...extras }`.
 *  2. При рендере:
 *     a. `data` = consumer JSX `data` ?? definition `defaults` ?? undefined.
 *     b. template = consumer JSX `as` ?? resolveTemplate(definition.as) ?? undefined.
 *     c. extras из definition (за исключением `schema`/`defaults`/`as`) + consumer JSX
 *        props (consumer wins) → все передаются в template.
 *  3. `<Dynamic component={Template} data={data} {...extras} {...consumerProps} />`
 *
 * Реактивность: `consumerProps` — Solid-реактивный proxy. `mergeProps` и `splitProps`
 * сохраняют реактивный tracking, поэтому сигнальные props обновляют template.
 *
 * Path-tracker (`definition.as = ui.Navigation.Item`) резолвится **lazy** на
 * каждый рендер через `useShapeUi()` — получает proxied Ui из родительского
 * View/Widget, что важно для UiProxy event-binding'а.
 *
 * Если template не определён ни в definition, ни в consumer JSX — Shape рендерит null.
 *
 * **BREAKING (v0.4.0):**
 *  - `props: (item) => ...` per-item mapper — УДАЛЁН. Используй batch-template.
 *  - `children` render-prop — УДАЛЁН. Используй batch-template или View/Widget.
 */
const shape = (factory: any) => {
  // Factory вызывается на module-load. `ui` — path-tracker (real Ui ещё нет).
  const definition = factory(z, createUiTracker());

  // Деструктурируем известные Shape-internal поля; оставшееся — extras.
  // `_deprecatedPropsFn` поглощает старое поле `props` на случай если app-код
  // ещё его передаёт — предотвращает прокидку в template.
  const {
    schema: _schema,
    defaults,
    as: defaultAs,
    props: _deprecatedPropsFn,
    ...definitionExtras
  } = definition;

  return (consumerProps: IShapeComponentProps<unknown>) => {
    const realUi = useShapeUi();

    /** Резолв batch-template: consumer `as` > definition.as (path-tracker резолв) > undefined. */
    const resolveTemplate = (): unknown => {
      if (consumerProps.as) return consumerProps.as;
      if (!defaultAs) return undefined;
      const path = getTrackerPath(defaultAs);
      if (path && realUi) return resolveByPath(realUi, path);
      return defaultAs;
    };

    const Template = resolveTemplate();
    if (!Template) return null;

    // Разделяем Shape-internal props из consumerProps: `as` и `data` выводим отдельно.
    // Всё остальное (`rest`) — consumer extras, мерджятся поверх definition extras.
    const [ownProps, rest] = splitProps(consumerProps as Record<string, unknown>, ['as', 'data']);

    // mergeProps: definitionExtras (статика) < rest (реактивные consumer extras).
    // mergeProps от Solid сохраняет реактивность — сигналы в `rest` работают.
    const mergedExtras = mergeProps(definitionExtras, rest);

    // data: consumer `data` overrides definition `defaults`.
    // Читаем ownProps.data прямо в JSX-разметке (через геттер) чтобы сохранить
    // реактивный tracking Solid — иначе computed-значение вне JSX теряет tracking.
    // `'data' in consumerProps` проверяем через наличие ключа в ownProps (splitProps
    // копирует only own-keys): если consumer передал data=[], ownProps.data === [].
    const hasConsumerData = 'data' in (consumerProps as Record<string, unknown>);

    return (
      <Dynamic
        component={Template as any}
        data={hasConsumerData ? ownProps.data : defaults}
        {...(mergedExtras as Record<string, unknown>)}
      />
    );
  };
};

export const Shape = shape as unknown as IShapeWrapper;
