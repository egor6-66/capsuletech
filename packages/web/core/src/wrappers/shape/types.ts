import type { CapsuleZ } from '@capsuletech/shared-zod';
import type { Component, ValidComponent } from 'solid-js';
import type { ZodArray, ZodType, ZodTypeAny, z as zod } from 'zod';

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
 * весь `data` + дополнительные поля (`...extras`) в `as`-компонент.
 *
 * **v0.5.0:** `schema` принимает как `ZodArray` (batch/list), так и `ZodObject`
 * или любой `ZodType` (single-object / config-driven view). Runtime уже работает
 * обоими — только types были ограничены array-only.
 *
 * Extras: любые поля за пределами `schema` / `defaults` / `as` транзитно
 * передаются в template-компонент как props (например `columns`, `sorting`,
 * `infinite`, `itemAs`).
 */
export interface IShapeDefinition<S extends ZodType = ZodType> {
  /**
   * zod-схема данных.
   *  - `ZodArray` → batch/list semantics (data: T[]).
   *  - `ZodObject` / любой `ZodType` → single-object semantics (data: T).
   */
  schema: S;
  /** Дефолтные данные — рендерятся если в JSX не передан `data` prop. */
  defaults?: zod.infer<S>;
  /**
   * Default batch-template — используется если в JSX не передан `as`. Принимает:
   *  - path-tracker (`ui.Navigation.Item`) — резолв через `ShapeUiContext`
   *    (получает proxied Ui для event-binding).
   *  - готовый компонент (Ui.List, Ui.DataTable, пользовательский).
   *
   * Template получает `data` + extras из definition + consumer JSX props.
   * Для batch-схем итерация — ответственность template'а.
   */
  as?: ValidComponent;
  /**
   * Любые дополнительные поля definition транзитно передаются в `as`-компонент.
   * Примеры: `columns`, `sorting`, `infinite`, `itemAs`, `emptyState`, etc.
   */
  [extraKey: string]: unknown;
}

export type IShapeFactory<S extends ZodType = ZodType> = (
  z: CapsuleZ,
  ui: IShapeUi,
) => IShapeDefinition<S>;

/**
 * Извлекает тип `data` из схемы Shape:
 *  - `ZodArray<E>` → `zod.infer<E>[]` (array items, batch flow).
 *  - Любой другой `ZodType` → `zod.infer<S>` (single value / object).
 */
export type ShapeData<S extends ZodType> =
  S extends ZodArray<infer E>
    ? E extends ZodTypeAny
      ? zod.infer<E>[]
      : never
    : zod.infer<S>;

/** @deprecated Use `ShapeData<S>` for generic schema support. Kept for backward-compat with array-only callers. */
export type ShapeItem<S extends ZodArray<ZodTypeAny>> =
  S extends ZodArray<infer E> ? (E extends ZodTypeAny ? zod.infer<E> : never) : never;

/**
 * Props компонента Shape на JSX-сайте (consumer).
 *
 * **v0.4.0 BREAKING:** `children` render-prop удалён — per-item escape hatch
 * более не поддерживается. Используй batch-template (`as`) или напиши
 * полноценный View/Widget для сложной композиции.
 *
 * **v0.5.0:** `data` типизирован через `ShapeData<S>` — поддерживает как
 * array (batch), так и single-object схемы.
 *
 * Consumer может передать любые дополнительные props — они мерджатся поверх
 * definition extras и прокидываются в `as`-компонент (consumer wins).
 */
export interface IShapeComponentProps<TData> {
  /** Override данных. Приоритет: consumer `data` > definition `defaults`. */
  data?: TData;
  /** Override batch-template из definition. */
  as?: ValidComponent;
  /** Любые дополнительные props → прокидываются в template поверх definition extras. */
  [extraKey: string]: unknown;
}

export type IShapeComponent<TData> = Component<IShapeComponentProps<TData>>;

export type IShapeWrapper = <S extends ZodType>(
  factory: IShapeFactory<S>,
) => IShapeComponent<ShapeData<S>>;
