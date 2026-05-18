import {
  addNode,
  createEmptyTree,
  EditorOpError,
  moveNode,
  removeNode,
  reorderChildren,
  updateNode,
} from './operations';
import type {
  IAddNodePayload,
  IEditorContext,
  IEditorTree,
  IMoveNodePayload,
  IRemoveNodePayload,
  IReorderChildrenPayload,
  IUpdateNodePayload,
  NodeId,
} from './types';

export interface ICreateEditorSchemaOptions {
  /** Стартовое дерево. По умолчанию пустое с корнем `ui.Card`. */
  initialTree?: IEditorTree;
  rootType?: string;
}

/**
 * Возвращает HCA-схему (для `Feature(...)`) с одним стейтом `idle` и набором
 * методов-обработчиков. Каждый метод — pure-операция + commit через
 * `store.update({ tree, selectedId })`.
 *
 * Обёртка над пакетом-операциями — нужна чтобы внутри editor-app можно было:
 * ```ts
 * import { createEditorSchema } from '@capsuletech/editor-state';
 * const State = Feature(() => createEditorSchema());
 * export default State;
 * ```
 *
 * Методы вызываются через `next('addNode')` из дочернего Controller'а с
 * payload в `target.payload`.
 */
export const createEditorSchema = (options: ICreateEditorSchemaOptions = {}) => {
  const initialContext: IEditorContext = {
    tree: options.initialTree ?? createEmptyTree(options.rootType),
    selectedId: null,
  };

  return {
    initial: 'idle',
    context: initialContext,
    states: {
      idle: {
        addNode: ({ target, store }: any) => {
          const payload = target.payload as IAddNodePayload;
          try {
            const { tree, nodeId } = addNode(store.ctx.tree, payload);
            store.update({ tree, selectedId: nodeId });
          } catch (err) {
            if (err instanceof EditorOpError) {
              store.setErrors({ editor: err.message });
            } else {
              throw err;
            }
          }
        },

        moveNode: ({ target, store }: any) => {
          const payload = target.payload as IMoveNodePayload;
          try {
            const tree = moveNode(store.ctx.tree, payload);
            store.update({ tree });
          } catch (err) {
            if (err instanceof EditorOpError) {
              store.setErrors({ editor: err.message });
            } else {
              throw err;
            }
          }
        },

        removeNode: ({ target, store }: any) => {
          const payload = target.payload as IRemoveNodePayload;
          try {
            const tree = removeNode(store.ctx.tree, payload);
            // Если удаляли selected — сбрасываем selection
            const selectedId =
              store.ctx.selectedId === payload.nodeId ? null : store.ctx.selectedId;
            store.update({ tree, selectedId });
          } catch (err) {
            if (err instanceof EditorOpError) {
              store.setErrors({ editor: err.message });
            } else {
              throw err;
            }
          }
        },

        updateNode: ({ target, store }: any) => {
          const payload = target.payload as IUpdateNodePayload;
          try {
            const tree = updateNode(store.ctx.tree, payload);
            store.update({ tree });
          } catch (err) {
            if (err instanceof EditorOpError) {
              store.setErrors({ editor: err.message });
            } else {
              throw err;
            }
          }
        },

        reorderChildren: ({ target, store }: any) => {
          const payload = target.payload as IReorderChildrenPayload;
          try {
            const tree = reorderChildren(store.ctx.tree, payload);
            store.update({ tree });
          } catch (err) {
            if (err instanceof EditorOpError) {
              store.setErrors({ editor: err.message });
            } else {
              throw err;
            }
          }
        },

        selectNode: ({ target, store }: any) => {
          const id = target.payload as NodeId | null;
          store.update({ selectedId: id });
        },
      },
    },
  };
};
