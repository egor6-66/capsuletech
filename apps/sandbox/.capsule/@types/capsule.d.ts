import type { ICapsuleConfig } from '@capsuletech/vite-builder';
import type { IAppConfig } from '@capsuletech/web-query/app-config';

declare global {
  function defineCapsuleConfig(config: ICapsuleConfig): ICapsuleConfig;
  function defineAppConfig<const T extends IAppConfig>(config: T): T;
}
