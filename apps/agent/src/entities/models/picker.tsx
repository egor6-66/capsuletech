import { Popover } from '@kobalte/core/popover';
import { Download, Loader2, Play, Square, Trash2 } from 'lucide-solid';

interface InstalledModel {
  name: string;
  size_gb: number;
  running: boolean;
}

interface CatalogModel {
  name: string;
  description: string;
  size_gb: number;
  recommended_vram_gb: number;
  recommended_ram_gb: number;
  tags: string[];
  pullProgress?: number;
}

/**
 * Важно: все clickable-элементы — это `Button` из деструктуры (даже если
 * визуально row или icon). Только обёрнутые Ui-примитивы получают UiProxy
 * event-binding и `store.patch` реактивность. Raw `<button>` / `<div>` с
 * `meta` — мертвая семантика, UiProxy их не интерсептит.
 */
const Picker = Entity(({ Button, List, Separator }) => (
  <Popover placement="bottom-end" gutter={6}>
    <Popover.Trigger
      as={Button}
      meta={{ tags: ['model-trigger'] }}
      variant="outline"
      class="h-7 px-2 text-xs font-mono"
    >
      —
    </Popover.Trigger>

    <Popover.Portal>
      <Popover.Content class="z-50 w-80 rounded-lg border border-border bg-background/95 backdrop-blur-md shadow-xl overflow-hidden">
        <div class="flex flex-col max-h-[28rem]">
          <header class="px-3 py-2 border-b border-border/50">
            <h2 class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Installed
            </h2>
          </header>

          <List
            meta={{ tags: ['list-installed'] }}
            items={[] as InstalledModel[]}
            class="px-1.5 py-1.5 space-y-0.5"
          >
            {(m: InstalledModel) => (
              <Button
                as="div"
                variant="ghost"
                meta={{ tags: ['model-activate'], payload: { name: m.name } }}
                class="w-full justify-start gap-2 px-2 py-1.5 h-auto rounded-md cursor-pointer"
              >
                <code class="text-xs font-mono text-foreground flex-1 truncate text-left">
                  {m.name}
                </code>
                <span class="text-[10px] text-muted-foreground whitespace-nowrap">
                  {m.size_gb.toFixed(1)} GB
                </span>
                {m.running ? (
                  <span class="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
                ) : null}
                {m.running ? (
                  <Button
                    meta={{ tags: ['btn-unload'], payload: { name: m.name } }}
                    variant="ghost"
                    class="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title="Unload (free VRAM)"
                  >
                    <Square size={12} />
                  </Button>
                ) : (
                  <Button
                    meta={{ tags: ['btn-load'], payload: { name: m.name } }}
                    variant="ghost"
                    class="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title="Load into memory"
                  >
                    <Play size={12} />
                  </Button>
                )}
                <Button
                  meta={{ tags: ['btn-delete'], payload: { name: m.name } }}
                  variant="ghost"
                  class="h-6 w-6 p-0 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </Button>
              </Button>
            )}
          </List>

          <Separator />

          <header class="px-3 py-2 border-b border-border/50">
            <h2 class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Available to download
            </h2>
          </header>

          <List
            meta={{ tags: ['list-catalog'] }}
            items={[] as CatalogModel[]}
            class="px-1.5 py-1.5 space-y-1 overflow-y-auto"
          >
            {(c: CatalogModel) => (
              <div class="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40">
                <div class="flex-1 min-w-0 space-y-0.5">
                  <code class="text-xs font-mono text-foreground block truncate">{c.name}</code>
                  <p class="text-[11px] text-muted-foreground/90 leading-snug line-clamp-2">
                    {c.description}
                  </p>
                  <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 pt-0.5">
                    <span>{c.size_gb.toFixed(1)} GB</span>
                    <span class="opacity-50">·</span>
                    <span>RAM {c.recommended_ram_gb}GB</span>
                    <span class="opacity-50">·</span>
                    <span>VRAM {c.recommended_vram_gb}GB</span>
                  </div>
                </div>
                <Button
                  meta={{ tags: ['btn-pull'], payload: { name: c.name } }}
                  variant="ghost"
                  class="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  disabled={c.pullProgress !== undefined}
                  title="Download model"
                >
                  {c.pullProgress !== undefined ? (
                    <>
                      <Loader2 size={12} class="animate-spin" />
                      <span class="font-mono text-[10px]">{c.pullProgress}%</span>
                    </>
                  ) : (
                    <Download size={12} />
                  )}
                </Button>
              </div>
            )}
          </List>
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover>
));

export default Picker;
