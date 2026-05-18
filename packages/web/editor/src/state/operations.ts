import { canAcceptChild, getManifest } from '../manifests';
import { generateId, ROOT_ID } from './ids';
import type {
  IAddNodePayload,
  IEditorNode,
  IEditorTree,
  IMoveNodePayload,
  IRemoveNodePayload,
  IReorderChildrenPayload,
  IUpdateNodePayload,
  NodeId,
} from './types';

/** Ошибка операции с понятным сообщением — Feature/Controller сможет показать юзеру. */
export class EditorOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorOpError';
  }
}

/** Пустое дерево с одним корнем (`Wrapper` или указанный тип). */
export const createEmptyTree = (rootType = 'ui.Card'): IEditorTree => ({
  root: ROOT_ID,
  nodes: {
    [ROOT_ID]: {
      id: ROOT_ID,
      type: rootType,
      parentId: null,
      children: [],
      props: {},
      meta: {},
      styles: {},
    },
  },
});

const cloneNode = (n: IEditorNode): IEditorNode => ({
  ...n,
  children: [...n.children],
  props: { ...n.props },
  meta: { ...n.meta },
  styles: { ...n.styles },
});

const requireNode = (tree: IEditorTree, id: NodeId): IEditorNode => {
  const n = tree.nodes[id];
  if (!n) throw new EditorOpError(`node "${id}" not found`);
  return n;
};

/** Глубже ли `descendantId` под `ancestorId`. Включая равенство. */
const isDescendantOrSelf = (
  tree: IEditorTree,
  ancestorId: NodeId,
  descendantId: NodeId,
): boolean => {
  let cur: NodeId | null = descendantId;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = tree.nodes[cur]?.parentId ?? null;
  }
  return false;
};

const insertAt = <T>(arr: T[], item: T, index?: number): T[] => {
  if (index === undefined || index < 0 || index >= arr.length) return [...arr, item];
  return [...arr.slice(0, index), item, ...arr.slice(index)];
};

/**
 * Добавить новую ноду к `parentId`. Валидирует:
 *  - parent существует;
 *  - parent не leaf (через манифест);
 *  - parent.accepts(type) (через манифест).
 *
 * Возвращает новое дерево + id созданной ноды.
 */
export const addNode = (
  tree: IEditorTree,
  payload: IAddNodePayload,
): { tree: IEditorTree; nodeId: NodeId } => {
  const parent = requireNode(tree, payload.parentId);
  if (!canAcceptChild(parent.type, payload.type)) {
    throw new EditorOpError(
      `node type "${parent.type}" не принимает "${payload.type}" как ребёнка`,
    );
  }
  const manifest = getManifest(payload.type);
  const id = generateId();
  const node: IEditorNode = {
    id,
    type: payload.type,
    parentId: parent.id,
    children: [],
    props: { ...(manifest?.defaultProps ?? {}), ...(payload.props ?? {}) },
    meta: { ...(payload.meta ?? {}) },
    styles: {},
  };
  const nextParent = cloneNode(parent);
  nextParent.children = insertAt(nextParent.children, id, payload.index);
  return {
    nodeId: id,
    tree: {
      ...tree,
      nodes: {
        ...tree.nodes,
        [id]: node,
        [parent.id]: nextParent,
      },
    },
  };
};

/**
 * Переместить ноду. Запрещает:
 *  - перемещать root;
 *  - перемещать ноду внутрь себя/своих потомков;
 *  - перемещать в leaf или в parent, который не принимает этот тип.
 */
export const moveNode = (tree: IEditorTree, payload: IMoveNodePayload): IEditorTree => {
  if (payload.nodeId === tree.root) {
    throw new EditorOpError('root cannot be moved');
  }
  const node = requireNode(tree, payload.nodeId);
  const newParent = requireNode(tree, payload.newParentId);
  if (isDescendantOrSelf(tree, payload.nodeId, payload.newParentId)) {
    throw new EditorOpError('cannot move a node into its own subtree');
  }
  if (!canAcceptChild(newParent.type, node.type)) {
    throw new EditorOpError(
      `node type "${newParent.type}" не принимает "${node.type}" как ребёнка`,
    );
  }
  const oldParent = requireNode(tree, node.parentId!);
  const nextOldParent = cloneNode(oldParent);
  nextOldParent.children = nextOldParent.children.filter((c) => c !== node.id);

  // Если parent тот же — сначала удаляем из старого, потом вставляем в новый
  // (правильный индекс может «съехать» при том же родителе — calculate accordingly).
  const isSameParent = oldParent.id === newParent.id;
  const targetParent = isSameParent ? nextOldParent : cloneNode(newParent);
  targetParent.children = insertAt(targetParent.children, node.id, payload.index);

  const nextNode = cloneNode(node);
  nextNode.parentId = newParent.id;

  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [node.id]: nextNode,
      [oldParent.id]: nextOldParent,
      ...(isSameParent ? {} : { [newParent.id]: targetParent }),
    },
  };
};

/**
 * Удалить ноду и весь её subtree. Root удалить нельзя.
 */
export const removeNode = (tree: IEditorTree, payload: IRemoveNodePayload): IEditorTree => {
  if (payload.nodeId === tree.root) {
    throw new EditorOpError('root cannot be removed');
  }
  const node = requireNode(tree, payload.nodeId);
  const parent = requireNode(tree, node.parentId!);

  // Собираем все ноды subtree для удаления
  const toDelete = new Set<NodeId>();
  const stack: NodeId[] = [node.id];
  while (stack.length) {
    const id = stack.pop()!;
    if (toDelete.has(id)) continue;
    toDelete.add(id);
    const n = tree.nodes[id];
    if (n) stack.push(...n.children);
  }

  const nextParent = cloneNode(parent);
  nextParent.children = nextParent.children.filter((c) => c !== node.id);

  const nextNodes: Record<NodeId, IEditorNode> = {};
  for (const [id, n] of Object.entries(tree.nodes)) {
    if (!toDelete.has(id)) nextNodes[id] = n;
  }
  nextNodes[parent.id] = nextParent;

  return { ...tree, nodes: nextNodes };
};

/**
 * Patch props/meta/styles конкретной ноды. Не валидирует props против
 * `propsSchema` — это работа инспектора при вводе. Тут только мердж.
 */
export const updateNode = (tree: IEditorTree, payload: IUpdateNodePayload): IEditorTree => {
  const node = requireNode(tree, payload.nodeId);
  const next = cloneNode(node);
  if (payload.patch.props) next.props = { ...next.props, ...payload.patch.props };
  if (payload.patch.meta) next.meta = { ...next.meta, ...payload.patch.meta };
  if (payload.patch.styles) next.styles = { ...next.styles, ...payload.patch.styles };
  return {
    ...tree,
    nodes: { ...tree.nodes, [node.id]: next },
  };
};

/**
 * Переупорядочить детей. `newOrder` должен содержать **те же id**, что и
 * текущие children parent'а — иначе ошибка (это симптом несогласованного
 * обновления и проще упасть, чем тихо потерять/добавить ноды).
 */
export const reorderChildren = (
  tree: IEditorTree,
  payload: IReorderChildrenPayload,
): IEditorTree => {
  const parent = requireNode(tree, payload.parentId);
  const current = new Set(parent.children);
  const next = new Set(payload.newOrder);
  if (current.size !== next.size || [...current].some((id) => !next.has(id))) {
    throw new EditorOpError(
      'reorderChildren: newOrder должен содержать ровно тех же детей что и parent',
    );
  }
  const nextParent = cloneNode(parent);
  nextParent.children = [...payload.newOrder];
  return { ...tree, nodes: { ...tree.nodes, [parent.id]: nextParent } };
};
