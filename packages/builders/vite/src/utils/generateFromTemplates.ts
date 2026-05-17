import * as path from 'node:path';
import { generateFiles, names } from '@nx/devkit';
import { FsTree, flushChanges } from 'nx/src/generators/tree.js';

// Локальная копия `generateFromTemplates` из `@capsuletech/shared-file-manager`.
// Заинлайнено, чтобы разорвать цикл: shared-vite -> file-manager (runtime),
// file-manager devDep -> shared-vite (для своей сборки через libConfig).
// RouterPlugin был единственным потребителем — выносить ради него ещё один
// workspace-пакет в runtime smysla net.
export async function generateFromTemplates({
  sourceDir,
  name,
  targetDir,
  vars,
}: {
  name: string;
  sourceDir: string;
  targetDir: string;
  vars?: Record<string, unknown>;
}) {
  const projectRoot = process.cwd();
  const tree = new FsTree(projectRoot, false);

  try {
    const relativeSource = path.relative(projectRoot, sourceDir);
    const relativeTarget = path.relative(projectRoot, targetDir);

    generateFiles(tree, relativeSource, relativeTarget, {
      ...names(name),
      ...vars,
      tmpl: '',
    });

    const changes = tree.listChanges();

    if (changes.length === 0) {
      console.warn('⚠️ Изменений нет. Проверь: файлы должны называться name.tsx.template');
      return;
    }

    for (const change of changes) console.log(`✨ Создаю: ${change.path}`);
    flushChanges(projectRoot, changes);
    console.log('✅ Успешно!');
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}
