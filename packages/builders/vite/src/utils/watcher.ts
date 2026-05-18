import { normalize, resolve, sep } from 'node:path';
import type { ViteDevServer } from 'vite';
import type { StructureEvent } from '../interfaces';

interface IPaths {
  file: string;
  root: string;
}
interface WatcherCallbacks {
  onStructureChange?: (event: StructureEvent, filePath: IPaths) => void;
  onContentChange?: (filePath: IPaths) => void;
}

class WatcherManager {
  private registry = new Map<
    string,
    {
      subscribers: WatcherCallbacks[];
      isWatching: boolean;
      originalRoot: string;
    }
  >();

  private getAbsolutePath(serverRoot: string, targetPath: string): string {
    const absolute = resolve(serverRoot, targetPath);
    return normalize(absolute).replace(new RegExp(`\\${sep}$`), '');
  }

  subscribe(targetDir: string, callbacks: WatcherCallbacks) {
    if (!this.registry.has(targetDir)) {
      this.registry.set(targetDir, { subscribers: [], isWatching: false, originalRoot: targetDir });
    }
    this.registry.get(targetDir)!.subscribers.push(callbacks);
  }

  init(server: ViteDevServer, targetDir: string) {
    const absPath = this.getAbsolutePath(server.config.root, targetDir);
    const folder = this.registry.get(targetDir);

    if (!folder || folder.isWatching) return;

    folder.isWatching = true;

    server.watcher.add(absPath);
    server.watcher.on('all', (event, file) => {
      const normalizedFile = normalize(file);
      if (!normalizedFile.startsWith(absPath)) return;

      const paths = { file: normalizedFile, root: targetDir };

      folder.subscribers.forEach((cb) => {
        if (event === 'change') {
          cb.onContentChange?.(paths);
        } else if (['add', 'unlink', 'addDir', 'unlinkDir'].includes(event)) {
          cb.onStructureChange?.(event as any, paths);
        }
      });
    });
  }
}

const watcherManager = new WatcherManager();

export { watcherManager };
