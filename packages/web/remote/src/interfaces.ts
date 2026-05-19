/**
 * Public type contracts for @capsuletech/web-remote.
 *
 * See ADR 015 (docs/01-architecture/adr/015-remote-modules.md) for the rationale.
 * This file is the SOURCE OF TRUTH for the API shape — runtime in subsequent
 * Phases (1..5) must implement these types unchanged.
 *
 * @module
 */

import type { JSX } from 'solid-js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration (input to <RemoteProvider>)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single remote module entry passed into <RemoteProvider modules={[...]}>.
 */
export interface IRemoteModuleConfig {
  /** Stable name used as lookup key (`<Remote name="..." />`, `remote('...')`). */
  name: string;
  /** Origin where the module is hosted. Manifest is fetched from `${url}/capsule.manifest.json`. */
  url: string;
  /** Default props passed to every instance of this module. Per-instance props override. */
  props?: Record<string, unknown>;
  /** Optional explicit standalone-route URL (defaults to `${url}/standalone`). */
  standaloneUrl?: string;
}

/**
 * Props for the root provider. One per app, mounted above <RouterProvider>.
 */
export interface IRemoteProviderProps {
  /**
   * Optional transport-server URL. Required only for cross-origin standalone
   * windows (after refresh, when `window.opener` is lost) and cross-device.
   * Same-origin and embedded scenarios work without it.
   */
  serverUrl?: string;
  /** List of remote modules available in this app. Reactive — can be mutated at runtime. */
  modules: IRemoteModuleConfig[];
  children?: JSX.Element;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifest (published by every remote module at /capsule.manifest.json)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manifest a remote module publishes alongside its built bundle.
 * Generated at build time by the upcoming RemoteManifestPlugin (Phase 4).
 */
export interface IRemoteManifest {
  name: string;
  version: string;
  /** Path to the ESM entry (relative to module origin). */
  entry: string;
  /** CSS files to inject as <link rel="stylesheet"> (relative to module origin). */
  styles?: string[];
  /** zod-to-json-schema serialization of the props schema. */
  props?: unknown;
  /** Map of `eventName → zod-to-json-schema(payload)`. */
  events?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component API (<Remote>)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props of the <Remote /> component returned from useRemote().
 * Any extra props are forwarded to the remote module as-is (validated against
 * its zod schema at mount time once Phase 4 lands).
 */
export interface IRemoteComponentProps {
  /** Module name as registered in <RemoteProvider modules>. */
  name: string;
  /**
   * Stable per-instance identifier. Optional — generated via createUniqueId()
   * if omitted. Provide explicitly when you need to address the instance from
   * outside (e.g. `remote('geo', 'left')`).
   */
  instanceId?: string;
  /** Fallback shown during load / on error. */
  fallback?: (status: 'loading' | 'error' | 'success') => JSX.Element;
  /** Anything else is forwarded to the remote module. */
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Communication API (useRemote / remote(...))
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response from a request/response round-trip.
 */
export interface IRemoteResponse<T = unknown> {
  status: 'success' | 'error';
  payload?: T;
  error?: string;
}

/**
 * Per-module communication handle. Returned from `remote(name, instanceId?)`.
 *
 * - `send(event, payload)` — fire-and-forget, no return value
 * - `request(event, payload, timeoutMs?)` — awaitable, default 5s timeout
 * - `on(event, cb)` — subscribe, returns unsubscribe function
 * - `openStandalone(props)` — open this module in a separate window
 */
export interface IRemoteHandle {
  send: (event: string, payload?: unknown) => void;
  request: <T = unknown>(event: string, payload?: unknown, timeoutMs?: number) => Promise<IRemoteResponse<T>>;
  on: (event: string, cb: (payload?: unknown) => void) => () => void;
  openStandalone: (props?: Record<string, unknown>) => void;
}

/**
 * Context shape exposed via useRemote(). Includes both the <Remote> component
 * factory and runtime helpers for mutating the registry / addressing instances.
 */
export interface IRemoteContext {
  /** Component to mount a remote module by name. */
  Remote: (props: IRemoteComponentProps) => JSX.Element;
  /** Get a communication handle for a remote module. */
  remote: (name: string, instanceId?: string) => IRemoteHandle;
  /** Mutate a module entry at runtime (e.g. swap URL after receiving a "new version" notification). */
  updateModule: (name: string, patch: Partial<IRemoteModuleConfig>) => void;
  /** Currently registered modules (reactive snapshot). */
  modules: Readonly<Record<string, IRemoteModuleConfig>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport layer (internal, but exported as a public contract because
// custom transports may be plugged in by consumers in Phase 3+)
// ─────────────────────────────────────────────────────────────────────────────

export type TransportKind = 'local' | 'broadcast-channel' | 'post-message' | 'socket';

/**
 * Message envelope used uniformly across all transports.
 * The server-side router (Phase 3) uses `(to, toInstance, sessionId)` as the
 * routing key — `instanceId` is intentionally part of the key to support
 * multiple standalone instances of the same module per session.
 */
export interface IRemoteMessage {
  from: string;
  fromInstance: string;
  to: string;
  /** Undefined = broadcast to all instances of `to`. */
  toInstance?: string;
  sessionId: string;
  eventName: string;
  payload?: unknown;
  /** Present on request/response pairs. */
  requestId?: string;
  /** True when this message is the response to a prior request. */
  isResponse?: boolean;
  status?: 'success' | 'error';
  error?: string;
}

/**
 * Pluggable transport contract. Each transport advertises which (from, to)
 * pairs it can route; the resolver picks the lightest one available.
 */
export interface ITransport {
  kind: TransportKind;
  /** Can this transport deliver to the given target? */
  canReach: (target: { name: string; instanceId?: string; isStandalone: boolean; sameOrigin: boolean }) => boolean;
  send: (msg: IRemoteMessage) => void;
  onMessage: (cb: (msg: IRemoteMessage) => void) => () => void;
  dispose: () => void;
}
