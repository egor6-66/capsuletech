import type { CommandAction } from '../commands/types';
import { kit } from '../kit';
import { scaffoldEntity } from './_scaffold';

export const createApp: CommandAction = async (ctx, params) => {
  const result = await scaffoldEntity({
    kind: 'app',
    title: 'App',
    subDir: 'apps',
    name: params.name as string | undefined,
    mode: ctx.mode,
  });
  if (!result) return;
  kit.note(`cd apps/${result.name}\ncapsule dev`, `App «${result.name}» готов`);
};
