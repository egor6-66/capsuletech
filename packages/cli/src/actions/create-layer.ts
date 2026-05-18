import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CommandAction } from '../commands/types';
import { kit } from '../kit';
import { LAYER_LABELS, type Layer, layerTemplates } from '../templates/layers';

const NAME_RE = /^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)*$/;

const toPascal = (s: string) => s.replace(/(^|-)([a-z])/g, (_m, _p, c: string) => c.toUpperCase());

export const createLayer: CommandAction = async (ctx, params) => {
  if (ctx.type !== 'app') {
    kit.log.error('Создавать слой можно только внутри apps/<name>/');
    return;
  }
  const layer = params.layer as Layer;
  const rawName = params.name as string | undefined;
  if (!rawName) {
    kit.log.error('Не указано имя');
    return;
  }
  if (!NAME_RE.test(rawName)) {
    kit.log.error('Имя: kebab-case, разделитель `/` для вложенности');
    return;
  }

  const parts = rawName.split('/');
  const fileName = parts.pop()!;
  const subPath = parts.join('/');
  const Name = toPascal(fileName);

  const layerRoot = join(ctx.cwd, 'src', layer);
  const targetDir = subPath ? join(layerRoot, subPath) : layerRoot;
  const filePath = join(targetDir, `${fileName}.tsx`);
  const relPath = `src/${layer}/${subPath ? `${subPath}/` : ''}${fileName}.tsx`;

  if (existsSync(filePath)) {
    kit.log.error(`Уже существует: ${relPath}`);
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(filePath, layerTemplates[layer](Name), 'utf-8');

  kit.log.success(`${LAYER_LABELS[layer]}: ${relPath}`);
};
