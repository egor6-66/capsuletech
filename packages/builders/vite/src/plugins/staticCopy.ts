import fs from 'node:fs';

export interface StaticCopyTarget {
  src: string;
  dest: string;
}

export const staticCopyPlugin = (targets: StaticCopyTarget[]) => ({
  name: 'copy-templates-post-build',
  closeBundle() {
    for (const target of targets) {
      const { src, dest } = target;

      if (fs.existsSync(src)) {
        // recursive: true автоматически создаст целевую папку, если её нет
        fs.cpSync(src, dest, { recursive: true });
        console.log(`\x1b[32m✅ Copied:\x1b[0m ${src} -> ${dest}`);
      } else {
        console.error(`\x1b[31m❌ Source directory not found:\x1b[0m ${src}`);
      }
    }
  },
});
