import { build, createServer as createViteServer, preview, type UserConfig } from 'vite';

import { appConfig, capsuleConfig } from './defines';

export const createDevCapsuleServer = async (
  config: UserConfig,
  root: string,
  workspaceRoot: string,
): Promise<void> => {
  const finalConfig = capsuleConfig({ config, root, workspaceRoot, isDev: true });
  const server = await createViteServer(finalConfig);
  await server.listen();
  server.printUrls();
};

export const createDevWebServer = async (config: UserConfig): Promise<void> => {
  const finalConfig = appConfig(config, true);
  const server = await createViteServer(finalConfig);
  await server.listen();
  server.printUrls();
};

export const createPreviewServer = async (config: UserConfig): Promise<void> => {
  const server = await preview(appConfig(config, false));
  server.printUrls();
};
export const buildApp = async (config: any, idDev: boolean) => {
  await build(appConfig(config, idDev));
  console.log(`Сборка в режиме ${idDev ? 'develop' : 'production'} завершена успешно!`);
};

export const buildCapsuleApp = async (
  config: UserConfig,
  root: string,
  workspaceRoot: string,
): Promise<void> => {
  const finalConfig = capsuleConfig({ config, root, workspaceRoot, isDev: false });
  await build(finalConfig);
};
