import type { Accessor, JSX } from 'solid-js';

export type DraggableId = string;
export type DroppableId = string;

/**
 * Полезная нагрузка перетаскиваемого элемента. Произвольная — библиотека к
 * содержимому не привязана. Потребитель сам сужает тип в `accepts` / `onDrop`.
 */
export type DragData = Record<string, unknown>;

export interface IPoint {
  x: number;
  y: number;
}

export interface IDraggableEntry<T extends DragData = DragData> {
  id: DraggableId;
  /** Реактивный геттер — payload может меняться (e.g. имя ноды в дереве). */
  data: Accessor<T>;
  el: HTMLElement;
}

export interface IDroppableEntry<T extends DragData = DragData> {
  id: DroppableId;
  el: HTMLElement;
  /** Предикат, разрешающий или запрещающий drop конкретного draggable'а. */
  accepts: (data: T) => boolean;
  onDrop?: (data: T, info: IDropInfo) => void;
  /** Доп. данные о droppable'е (e.g. parent-id ноды в дереве) — пробрасываются в onDrop. */
  data?: T;
}

export interface IDropInfo {
  /** Источник drag'а. */
  draggableId: DraggableId;
  /** Цель drop'а. */
  droppableId: DroppableId;
  /** Координаты pointer'а в момент drop'а (viewport). */
  pointer: IPoint;
  /** Координаты pointer'а относительно droppable-элемента (0..1 нормализовано). */
  ratio: IPoint;
}

export interface IDraggableOptions<T extends DragData = DragData> {
  id: DraggableId;
  /** Реактивная функция → payload. Вызывается при каждом start drag. */
  data: Accessor<T> | T;
  /** Отключить draggable (e.g. disabled state). */
  disabled?: Accessor<boolean>;
}

export interface IDraggable {
  ref: (el: HTMLElement) => void;
  isDragging: Accessor<boolean>;
}

export interface IDroppableOptions<T extends DragData = DragData> {
  id: DroppableId;
  /** По умолчанию принимает всё. */
  accepts?: (data: T) => boolean;
  onDrop?: (data: T, info: IDropInfo) => void;
  /** Опциональные мета-данные droppable'а. */
  data?: T;
  disabled?: Accessor<boolean>;
}

export interface IDroppable {
  ref: (el: HTMLElement) => void;
  /** Курсор сейчас над этим droppable. */
  isOver: Accessor<boolean>;
  /** isOver && accepts(activeData) — удобный shorthand. */
  canDrop: Accessor<boolean>;
}

export interface IDnDProviderProps {
  children: JSX.Element;
  /** Скроллить window когда pointer у края viewport'а. По умолчанию off. */
  autoScroll?: boolean;
  onDragStart?: (data: DragData, draggableId: DraggableId) => void;
  onDragEnd?: (result: IDragEndResult) => void;
  /**
   * Автоматически рендерить минимальный drag-ghost (полупрозрачный прямоугольник
   * 48×48) при отсутствии явного <DragOverlay>. Удобно для matrix/swap сценариев
   * где consumer не хочет самостоятельно монтировать overlay.
   * По умолчанию off.
   */
  showDefaultOverlay?: boolean;
}

export type IDragEndResult =
  | { kind: 'drop'; data: DragData; info: IDropInfo }
  | { kind: 'cancel'; data: DragData; draggableId: DraggableId };
