import type { CapsuleZ } from '@capsuletech/shared-zod';
import type { Component, ValidComponent } from 'solid-js';
import type { ZodArray, ZodTypeAny, z as zod } from 'zod';

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

/**
 * Определение Shape — то что возвращает factory-функция.
 *
 * **v0.4.0 BREAKING:** per-item `props?: (item) => ...` mapper удалён.
 * Shape больше не итерирует данные — итерацией занимается batch-template
 * (`Ui.List` / `Ui.DataTable` / пользовательский компонент). Shape передаёт
 * весь массив `data` + дополнительные поля (`...extras`) в `as`-компонент.
 *
 * Extras: любые поля за пределами `schema` / `defaults` / `as` транзитно
 * передаются в template-компонент как props (например `columns`, `sorting`,
 * `infinite`, `itemAs`).
 */
export interface IShapeDefinition<S extends ZodArray<ZodTypeAny> = ZodArray<ZodTypeAny>> {
  /** zod-схема массива элементов (только array-форма в v1). */
  schema: S;
  /** Дефолтные данные — рендерятся если в JSX не передан `data` prop. */
  defaults?: zod.infer<S>;
  /**
   * Default batch-template — используется если в JSX не передан `as`. Принимает:
   *  - path-tracker (`ui.Navigation.Item`) — резолв через `ShapeUiContext`
   *    (получает proxied Ui для event-binding).
   *  - готовый компонент (Ui.List, Ui.DataTable, пользовательский).
   *
   * Template получает `data` (массив целиком) + extras из definition + consumer JSX props.
   * Итерация — ответственность template'а.
   */
  as?: ValidComponent;
  /**
   * Любые дополнительные поля definition транзитно передаются в `as`-компонент.
   * Примеры: `columns`, `sorting`, `infinite`, `itemAs`, `emptyState`, etc.
   */
  [extraKey: string]: unknown;
}

export type IShapeFactory<S extends ZodArray<ZodTypeAny> = ZodArray<ZodTypeAny>> = (
  z: CapsuleZ,
  ui: IShapeUi,
) => IShapeDefinition<S>;

export type ShapeItem<S extends ZodArray<ZodTypeAny>> =
  S extends ZodArray<infer E> ? (E extends ZodTypeAny ? zod.infer<E> : never) : never;

/**
 * Props компонента Shape на JSX-сайте (consumer).
 *
 * **v0.4.0 BREAKING:** `children` render-prop удалён — per-item escape hatch
 * более не поддерживается. Используй batch-template (`as`) или напиши
 * полноценный View/Widget для сложной композиции.
 *
 * Consumer может передать любые дополнительные props — они мерджатся поверх
 * definition extras и прокидываются в `as`-компонент (consumer wins).
 */
export interface IShapeComponentProps<TItem> {
  /** Override данных. Приоритет: consumer `data` > definition `defaults`. */
  data?: readonly TItem[];
  /** Override batch-template из definition. */
  as?: ValidComponent;
  /** Любые дополнительные props → прокидываются в template поверх definition extras. */
  [extraKey: string]: unknown;
}

export type IShapeComponent<TItem> = Component<IShapeComponentProps<TItem>>;

export type IShapeWrapper = <S extends ZodArray<ZodTypeAny>>(
  factory: IShapeFactory<S>,
) => IShapeComponent<ShapeItem<S>>;
