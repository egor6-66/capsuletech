// Ambient declarations for Capsule's config-level globals.
//
// `defineCapsuleConfig` / `defineAppConfig` are installed on `globalThis` at
// runtime by `packages/cli/src/cli/defines.ts`. The IDE / `tsc` need this
// declaration to know their types.
//
// This file is wired into every app via `tsconfig.json.include`
// (see `packages/cli/src/templates/app/tsconfig.json.template`). Edit here —
// the change propagates to every app without per-app duplication.

import type { ICapsuleConfig } from '@capsuletech/vite-builder';
import type { IAppConfig } from '@capsuletech/web-query/app-config';

declare global {
  /**
   * Returns the given Capsule build/runtime config unchanged. The function
   * exists purely to provide TypeScript narrowing in `capsule.config.ts`.
   */
  function defineCapsuleConfig(config: ICapsuleConfig): ICapsuleConfig;

  /**
   * Returns the given app-domain config unchanged. The function exists
   * purely to provide TypeScript narrowing in `capsule.app.ts`.
   *
   * `<const T>` сохраняет литеральные типы (нужно чтобы callback-поля типа
   * `api: ({ mw }) => ...` корректно получали контекстный тип `mw`).
   */
  function defineAppConfig<const T extends IAppConfig>(config: T): T;
}
