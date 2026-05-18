export type NodeId = string;

/**
 * Узел дерева редактора. Полностью описывает один JSX-узел в формате,
 * совместимом с `@capsuletech/renderer` (`ISchema.components.nodes[id]`).
 *
 * Никакого UI-state'а (selected/expanded/etc.) — это отдельный концерн
 * редактора и хранится вне дерева.
 */
export interface IEditorNode {
  id: NodeId;
  /** Dot-path в registry, напр. `'ui.Button'`. */
  type: string;
  parentId: NodeId | null;
  /** Порядок имеет значение — массив, а не Set. */
  children: NodeId[];
  props: Record<string, unknown>;
  meta: Record<string, unknown>;
  styles: Record<string, string>;
}

export interface IEditorTree {
  root: NodeId;
  nodes: Record<NodeId, IEditorNode>;
}

/**
 * Полный контекст редактора. Кроме дерева — UI-state (выбранная нода).
 * Лежит в XState `context.data` через бридж.
 */
export interface IEditorContext {
  tree: IEditorTree;
  selectedId: NodeId | null;
}

/** Payload'ы для операций — типизированы отдельно для использования в Feature handlers. */
export interface IAddNodePayload {
  type: string;
  parentId: NodeId;
  /** Куда вставить среди детей родителя. По умолчанию — в конец. */
  index?: number;
  /** Опциональный override дефолтных пропсов из манифеста. */
  props?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface IMoveNodePayload {
  nodeId: NodeId;
  newParentId: NodeId;
  index?: number;
}

export interface IRemoveNodePayload {
  nodeId: NodeId;
}

export interface IUpdateNodePayload {
  nodeId: NodeId;
  patch: {
    props?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    styles?: Record<string, string>;
  };
}

export interface IReorderChildrenPayload {
  parentId: NodeId;
  newOrder: NodeId[];
}
