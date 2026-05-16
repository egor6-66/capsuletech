import { getAllManifests, getCategories, listByCategory } from '@capsuletech/web-manifests';
import { For } from 'solid-js';

const Manifests = Widget(() => {
  const categories = getCategories();
  const total = getAllManifests().length;
  return (
    <div class="flex flex-col gap-6 p-6 w-full max-w-4xl">
      <div>
        <div class="text-2xl font-semibold">Component manifests</div>
        <div class="text-sm opacity-60">всего: {total}</div>
      </div>
      <For each={categories}>
        {(cat) => (
          <div>
            <div class="text-xs uppercase tracking-wide opacity-60 mb-2">{cat}</div>
            <div class="flex gap-2 flex-wrap">
              <For each={listByCategory(cat)}>
                {(m) => (
                  <div
                    class="px-3 py-2 border rounded shadow-sm flex items-center gap-2 min-w-40"
                    title={m.description}
                  >
                    <span class="text-lg">{m.icon()}</span>
                    <div class="flex flex-col">
                      <span class="text-sm font-medium">{m.label}</span>
                      <span class="text-xs opacity-50">{m.type}</span>
                    </div>
                    {m.isLeaf && <span class="ml-auto text-[10px] uppercase opacity-50">leaf</span>}
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
});

export default Manifests;
