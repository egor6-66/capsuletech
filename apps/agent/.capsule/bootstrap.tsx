import { BaseProviders } from '@capsuletech/web-core/providers';
import './app-config.gen';
import * as _registry from './registry/wrappers';
import { routeTree } from './routes/routeTree.gen';

// Кладём registry-объекты (Widgets, Entities, Controllers, Features, Shapes)
// на globalThis. Wrapper'ы в @capsuletech/web-core (Page/Widget/Entity) читают
// их оттуда — это работает после публикации пакета в npm, когда AutoImport
// уже не может транспилировать собранный dist.
Object.assign(globalThis, _registry);

export const Bootstrap = () => {
  return <BaseProviders routeTree={routeTree} />;
};
