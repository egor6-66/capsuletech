import type { ICapsuleConfig } from '@capsuletech/shared-vite';
import type { IAppConfig } from '@capsuletech/web-core';

declare global {
  function defineCapsuleConfig(config: ICapsuleConfig): ICapsuleConfig;
  function defineAppConfig<const T extends IAppConfig>(config: T): T;
}
