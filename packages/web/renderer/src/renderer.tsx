import { type Component, For, Suspense, createMemo, mergeProps } from 'solid-js';
import { createComponent } from 'solid-js/web';
import { resolvePath } from './resolve';
import type { IInteraction, IRendererProps, ISchema, NodeId, Registry, RenderMode } from './types';

/** Default-fallback: dev-warning + ничего. */
const DefaultFallback: Component<{ type: string; nodeId: NodeId }> = (p) => {
  console.warn(`[@capsuletech/renderer] cannot resolve component "${p.type}" for node "${p.nodeId}"`);
  return null;
};

/**
 * Какие interactions активны в данном моде. Логика отрезана сюда, чтобы можно
 * было её расширить под `full` без правок рендера.
 */
const activeInteractions = (list: IInteraction[] | undefined, mode: RenderMode): IInteraction[] => {
  if (!list || mode === 'static') return [];
  const out: IInteraction[] = [];
  for (const it of list) {
    if (it.ref) {
      out.push(it);
      continue;
    }
    if (it.inline) {
      if (mode === 'controlled') {
        console.warn(
          `[@capsuletech/renderer] interaction "${it.id}" has inline schema but mode is "controlled" — ignored. Use mode="full" once supported.`,
        );
        continue;
      }
      // mode === 'full' — пока не реализовано, см. v1.2 (R3).
      console.warn(
        `[@capsuletech/renderer] interaction "${it.id}" inline schema requires mode="full" (not implemented yet).`,
      );
    }
  }
  return out;
};

interface IRenderNodeProps {
  nodeId: NodeId;
  schema: ISchema;
  registry: Registry;
  mode: RenderMode;
  fallback: Component<{ type: string; nodeId: NodeId }>;
  /** Pre-indexed: nodeId → interactions, активные в текущем моде. */
  interactionsByNode: Record<NodeId, IInteraction[]>;
}

/**
 * Рендерит одну ноду + её детей рекурсивно. Оборачивает поддерево в
 * Controllers/Features из `interactionsByNode[nodeId]` (внешний interaction
 * — наружный wrapper).
 *
 * Используем `createComponent` напрямую вместо `<Dynamic>` — это то же, во
 * что компилируется обычный JSX `<X />`. Solid'овский `<Dynamic>` оборачивает
 * вызов компонента в `createMemo + untrack(c(others))`, что в нашем случае
 * (лениво-резолвящиеся Feature → Controller → Entity) ломает цепочку
 * `useCtx()` — Entity внутри отрендеренного через Renderer'а Controller'а
 * не видит ctx, UiProxy не подцепляется, события не доходят до Controller.
 */
const RenderNode: Component<IRenderNodeProps> = (props) => {
  const node = () => props.schema.components.nodes[props.nodeId];

  const resolved = createMemo(() => {
    const n = node();
    if (!n) return undefined;
    return resolvePath(props.registry, n.type);
  });

  /**
   * Создаёт JSX-компонент для текущей ноды. Все props читаются через **функ-
   * циональные источники** в `mergeProps` — так при изменении дерева
   * (`updateNode` / `addNode` / `removeNode`) изменения попадают в компонент
   * без полного re-mount (Solid диффит через `<For>`/реактивные пропы).
   *
   * `children` собирается реактивным getter'ом: если у ноды есть дети-узлы,
   * рендерим `<For>`; если нет — отдаём `props.children` из node.props
   * (текстовый контент для leaf'ов вроде `<Card.Title>CAPSULE</Card.Title>`).
   */
  const renderedTree = () => {
    const n = node();
    if (!n) return null;
    const Comp = resolved();
    if (!Comp) {
      const Fb = props.fallback;
      return createComponent(Fb as any, { type: n.type, nodeId: n.id });
    }
    const mergedProps = mergeProps(() => node()?.props ?? {}, {
      get meta() {
        return node()?.meta;
      },
      get children() {
        const cur = node();
        if (!cur) return null;
        if (cur.children.length === 0) {
          // Нет схема-детей → пропускаем `props.children` (текст) из самой ноды.
          return cur.props?.children as any;
        }
        return (
          <For each={node()?.children ?? []}>
            {(childId) => (
              <RenderNode
                nodeId={childId}
                schema={props.schema}
                registry={props.registry}
                mode={props.mode}
                fallback={props.fallback}
                interactionsByNode={props.interactionsByNode}
              />
            )}
          </For>
        );
      },
    });
    return createComponent(Comp as any, mergedProps);
  };

  // Оборачиваем поддерево wrapper'ами из interactions. Первый interaction в
  // массиве — самый наружный wrapper; идём с конца, чтобы вложение получалось
  // <A><B>{node}</B></A>.
  //
  // КРИТИЧЕСКОЕ: внутреннее поддерево строится **через thunk-цепочку**, не
  // как готовое JSX-значение. `createComponent(Comp, ...)` синхронно вызывает
  // `Comp(props)` — то есть жадно выполняет компонент в **текущем** owner'е.
  // Если построить inner и потом обернуть его в Wrapper — Comp успеет
  // отработать ДО того, как Wrapper установит свой Context.Provider, и
  // `useCtx()` внутри Entity вернёт `undefined`.
  //
  // Поэтому каждый шаг цикла копит **функцию**, которая создаст inner; в
  // children-getter родительского wrapper'а эта функция и вызывается — уже
  // внутри его Context.Provider, где ctx уже выставлен.
  const wrapped = () => {
    const its = props.interactionsByNode[props.nodeId];
    if (!its || its.length === 0) return renderedTree();
    let buildAcc: () => any = () => renderedTree();
    for (let i = its.length - 1; i >= 0; i--) {
      const it = its[i];
      const Wrapper = it.ref
        ? (resolvePath(props.registry, it.ref) as Component<any> | undefined)
        : undefined;
      if (!Wrapper) {
        console.warn(
          `[@capsuletech/renderer] interaction "${it.id}" ref "${it.ref}" not found in registry — skipped.`,
        );
        continue;
      }
      const prevBuild = buildAcc;
      const wrapperPropsStatic = it.props ?? {};
      buildAcc = () =>
        createComponent(Wrapper as any, {
          ...wrapperPropsStatic,
          get children() {
            return prevBuild();
          },
        });
    }
    return buildAcc();
  };

  // Фрагмент с function-child делает выражение реактивным: Solid обернёт его
  // в memo и пересчитает, когда любой signal внутри `wrapped()` изменится
  // (в основном — `node()`, т.е. реакция на правки дерева в редакторе).
  return <>{() => wrapped()}</>;
};

/**
 * Public entry. Принимает schema + registry, рендерит дерево от root'а.
 *
 * Renderer — это «обобщённый Widget»: композиция Entity-узлов + навешенных
 * Controllers/Features. Используется и в редакторе (превью), и в host-app
 * (production-render), что гарантирует идентичный рендер в обоих контекстах.
 */
export const Renderer: Component<IRendererProps> = (props) => {
  const mode = () => props.mode ?? 'controlled';
  const fallback = () => props.fallback ?? DefaultFallback;

  const interactionsByNode = createMemo(() => {
    const idx: Record<NodeId, IInteraction[]> = {};
    for (const it of activeInteractions(props.schema.interactions, mode())) {
      if (!idx[it.nodeId]) idx[it.nodeId] = [];
      idx[it.nodeId].push(it);
    }
    return idx;
  });

  return (
    <Suspense>
      <RenderNode
        nodeId={props.schema.components.root}
        schema={props.schema}
        registry={props.registry}
        mode={mode()}
        fallback={fallback()}
        interactionsByNode={interactionsByNode()}
      />
    </Suspense>
  );
};
