import type { ICapsuleConfig } from '@capsuletech/vite-builder';
import type { IAppConfig } from '@capsuletech/web-core';

declare global {
  function defineCapsuleConfig(config: ICapsuleConfig): ICapsuleConfig;
  function defineAppConfig<const T extends IAppConfig>(config: T): T;
}
