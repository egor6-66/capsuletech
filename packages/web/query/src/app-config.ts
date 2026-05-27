// DEPRECATED: используй @capsuletech/web-core/app-config. Re-export для backward compat.
// Старый код, который импортит `from '@capsuletech/web-query/app-config'`, продолжит работать.
export type { IAppConfig } from '@capsuletech/web-core/app-config';
export { defineAppConfig } from '@capsuletech/web-core/app-config';
import './app-config-augment'; // активировать augmentation
