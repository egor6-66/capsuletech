import type { CapsuleZ } from '@capsuletech/shared-zod';
import type { Component, JSX, ValidComponent } from 'solid-js';
import type { ZodArray, ZodTypeAny, z as zod } from 'zod';

/** Поля, которые Shape передаёт template-компоненту по умолчанию. */
export interface IShapeTemplateProps {
  meta?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  children?: JSX.Element;
  [k: string]: unknown;
}

/**
 * Path-tracker для второго аргумента factory'и (`ui`). Структурно — выглядит
 * как объединённый namespace:
 *  - top-level: Ui primitives (`ui.Field`, `ui.Button`) — backward-compat;
 *  - `ui.Views.<Group>.<Name>` — user-defined composite Views.
 *
 * Реально — Proxy, фиксирующий путь. Резолв реального компонента происходит
 * в момент рендера через `ShapeUiContext` (combined namespace `{ ...Ui, Views }`).
 *
 * Тип намеренно гибкий (Record<string, any>) — tracker — это Proxy без реальной
 * структуры; `Views` описана отдельным ключом для IDE-подсказки.
 */
export type IShapeUi = Record<string, any> & {
  /** Views registry — composite user Views (`ui.Views.Forms.Field`). */
  Views: Record<string, any>;
};

/** Определение Shape — то что возвращает factory-функция. */
export interface IShapeDefinition<S extends ZodArray<ZodTypeAny> = ZodArray<ZodTypeAny>> {
  /** zod-схема массива элементов (только array-форма в v1). */
  schema: S;
  /** Дефолтные данные — рендерятся если в JSX не передан `data` prop. */
  defaults?: zod.infer<S>;
  /**
   * Default template — используется если в JSX не передан `as`. Принимает:
   *  - path-tracker (`ui.Navigation.Item`) — резолв через `ShapeUiContext` (получает proxied Ui).
   *  - готовый компонент.
   * Если `as` нигде не задан — Shape отрисует `props.children` (из mapper'а) без обёртки.
   */
  as?: ValidComponent;
  /**
   * Map item → props для template-компонента. Если не задан — item передаётся
   * template'у as-is (поля item = props).
   */
  props?: (item: ShapeItem<S>) => IShapeTemplateProps;
}

export type IShapeFactory<S extends ZodArray<ZodTypeAny> = ZodArray<ZodTypeAny>> = (
  z: CapsuleZ,
  ui: IShapeUi,
) => IShapeDefinition<S>;

export type ShapeItem<S extends ZodArray<ZodTypeAny>> =
  S extends ZodArray<infer E> ? (E extends ZodTypeAny ? zod.infer<E> : never) : never;

export type IShapeRender<TItem> = (item: TItem, index: () => number) => JSX.Element;

export interface IShapeComponentProps<TItem> {
  /** Override данных. Приоритет: `data` > `defaults`. */
  data?: readonly TItem[];
  /** Override template'а из definition. */
  as?: ValidComponent;
  /** Escape hatch — кастомный render-prop. Приоритетнее `as` и default. */
  children?: IShapeRender<TItem>;
}

export type IShapeComponent<TItem> = Component<IShapeComponentProps<TItem>>;

export type IShapeWrapper = <S extends ZodArray<ZodTypeAny>>(
  factory: IShapeFactory<S>,
) => IShapeComponent<ShapeItem<S>>;
