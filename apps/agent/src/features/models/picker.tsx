import type { CatalogModel, InstalledModel } from '../../services/models-api';
import {
  deleteModel,
  fetchModels,
  loadModel,
  pullModel,
  unloadModel,
} from '../../services/models-api';

const DEFAULT_MODEL = 'qwen2.5:14b';

const Picker = Feature(() => {
  let activeModel = '';
  const pullProgress = new Map<string, number>(); // name → 0..100

  const broadcast = (name: string) => {
    window.dispatchEvent(new CustomEvent('capsule:model-change', { detail: { name } }));
  };

  const refresh = async (store: any) => {
    const data = await fetchModels();

    if (!activeModel) {
      const preferred = data.installed.find((m) => m.name === DEFAULT_MODEL);
      activeModel = preferred?.name ?? data.installed[0]?.name ?? '';
      if (activeModel) broadcast(activeModel);
    }

    const installed: InstalledModel[] = data.installed.map((m) => ({
      name: m.name,
      size_gb: +(m.size / 1e9).toFixed(2),
      running: data.running.includes(m.name),
    }));

    // Скрываем из каталога уже установленные модели
    const catalog: Array<CatalogModel & { pullProgress?: number }> = data.catalog
      .filter((c) => !data.installed.some((i) => i.name === c.name))
      .map((c) => ({ ...c, pullProgress: pullProgress.get(c.name) }));

    store.patch(['list-installed'], { items: installed });
    store.patch(['list-catalog'], { items: catalog });
    store.patch(['model-trigger'], { children: activeModel || '— pick model —' });
  };

  return {
    initial: 'idle',
    states: {
      idle: {
        onInit: async ({ store }: any) => {
          try {
            await refresh(store);
          } catch (e) {
            console.error('[models] initial fetch failed', e);
          }
        },

        modelAction: async ({ target, store }: any) => {
          // Controller picker зовёт `next.with({action, name})` после деривации
          // action из meta.tags → читаем из target.from.
          const { action, name } = (target.from ?? {}) as { action: string; name: string };
          if (!name) return;

          try {
            switch (action) {
              case 'activate':
                activeModel = name;
                broadcast(name);
                break;

              case 'load':
                await loadModel(name);
                break;

              case 'unload':
                await unloadModel(name);
                break;

              case 'delete':
                await deleteModel(name);
                if (activeModel === name) {
                  activeModel = '';
                  broadcast('');
                }
                break;

              case 'pull':
                pullProgress.set(name, 0);
                await refresh(store);
                await pullModel(name, (p) => {
                  const pct = p.total ? Math.floor(((p.completed ?? 0) / p.total) * 100) : 0;
                  pullProgress.set(name, pct);
                  refresh(store).catch(() => {});
                });
                pullProgress.delete(name);
                break;
            }

            await refresh(store);
          } catch (err) {
            console.error('[models]', action, name, err);
            pullProgress.delete(name);
            await refresh(store).catch(() => {});
          }
        },
      },
    },
  };
});

export default Picker;
