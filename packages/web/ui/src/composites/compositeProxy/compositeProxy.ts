import { createContext } from 'solid-js';
import type { JSX } from 'solid-js';

/**
 * Events-only proxy context for composite row/item components.
 *
 * web-core fills `wrap` with an events-binding wrapper so that repeated-item
 * components (DataTable rows, List items) can emit HCA events to the parent
 * Controller/Feature without the composite needing to import web-core.
 *
 * Default is an empty object → `wrap` is undefined → identity (no wrap).
 * This means composites work standalone in Storybook / unit tests unchanged.
 *
 * Contract for `wrap`:
 *   wrap<P>(Comp, name?) => WrappedComp
 *
 *   - `Comp` is the inner component function: (props: P) => JSX.Element
 *   - `name` is an optional display-name hint for DevTools / profiling
 *   - Returns a new component with the same prop shape `P` that forwards all
 *     props to `Comp` while binding HCA events from `meta` / `payload` props.
 *   - `wrap` MUST be idempotent per call-site: composites call it once at
 *     component-definition time (outside render loops), not per-row.
 *
 * Generic over the wrapped component's props `P` with no constraint — so a
 * component with a named-interface props type (e.g. IDataRowProps) is accepted.
 * Returns a component with the same props shape. web-core's implementation reads
 * any HCA `meta`/`payload` off the props internally; this contract stays
 * HCA-agnostic (web-ui must not know about HCA semantics).
 */
export interface ICompositeProxyContext {
  wrap?: <P>(Comp: (props: P) => JSX.Element, name?: string) => (props: P) => JSX.Element;
}

export const CompositeProxyContext = createContext<ICompositeProxyContext>({});
