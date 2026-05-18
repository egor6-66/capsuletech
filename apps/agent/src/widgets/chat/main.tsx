/**
 * Composes the chat: header strip (links + model picker) + chat body
 * (Features.Chat wraps Controllers.Chat wraps Entities.Chat).
 *
 * ModelPicker сидит рядом, не внутри Entity — Entity ничего не знает о
 * других widget'ах. Связь Models→Chat идёт через `capsule:model-change`
 * window-event (см. memory/project_pending_cross_feature_pubsub).
 */
const Main = Widget((_Ui, Features, Controllers, Entities, Widgets) => (
  <div class="flex flex-col h-full w-full">
    <header class="flex items-center justify-between px-6 py-3 border-b border-border/60 bg-background/80 backdrop-blur">
      <div class="flex items-center gap-3">
        <div class="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.45)]" />
        <h1 class="text-base font-semibold tracking-tight">capsule · agent</h1>
      </div>
      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        <a href="/lab" class="px-2 py-0.5 rounded-md border border-border/50 hover:bg-muted/60">
          /lab →
        </a>
        <Widgets.Models.Picker />
      </div>
    </header>

    <div class="flex-1 min-h-0">
      <Features.Chat.Main>
        <Controllers.Chat.Main overrides={{ onClick: 'sendMessage', onKeyDown: 'sendMessage' }}>
          <Entities.Chat.Main meta={{ tags: ['@chat'] }} />
        </Controllers.Chat.Main>
      </Features.Chat.Main>
    </div>
  </div>
));

export default Main;
