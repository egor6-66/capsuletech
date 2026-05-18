import * as path from 'node:path';
import { generateFiles, names } from '@nx/devkit';
import { FsTree, flushChanges } from 'nx/src/generators/tree.js';

/**
 * Раскатывает файл-дерево из `sourceDir` (с `.template`-суффиксами) в `targetDir`
 * через `@nx/devkit.generateFiles`. Шаблоны процессятся как EJS — переменные из
 * `vars` + `names(name)` (даёт `fileName`, `className`, `propertyName`, `constantName`).
 * Префикс `__dot__` в имени файла → `.` при материализации (так шаблоны вида
 * `__dot__gitignore.template` едут в публикуемом пакете без сюрпризов).
 *
 * Раньше жил в `@capsuletech/shared-file-manager`. Перенесён сюда, потому что
 * CLI — единственный реальный потребитель (остальные модули пакета не
 * использовались), а сами шаблоны лежат тут же в `src/templates/`.
 */
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

    changes.forEach((change) => {
      console.log(`✨ Создаю: ${change.path}`);
    });

    flushChanges(projectRoot, changes);

    console.log('✅ Успешно!');
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}
