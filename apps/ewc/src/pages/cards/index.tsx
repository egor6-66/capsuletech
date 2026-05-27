import { useRouter } from '@capsuletech/web-router';

/**
 * Cards layout (`/cards`) — sandbox-каталог для генерации форм через
 * `@capsuletech/web-ui-creator/generators` + `@capsuletech/web-renderer`.
 *
 * Структура:
 *   header   — mock (inline placeholder)
 *   main     — toolbar (Generate-кнопка) + `<Ui.Outlet/>`
 *   rightBar — mock
 *   footer   — mock
 *
 * Все слоты `resizable: false`, без `draggable`/`swapGroup` — ресайз и DnD
 * отключены. Layout-mode жёстко 'view'.
 *
 * Кнопка Generate навигирует на `/cards/${Date.now()}` — `[id]/index.tsx`
 * пересчитывает форму из seed (id трактуется как seed-источник). Так
 * получается персистентный URL (его можно копипастить, обновлять — форма
 * детерминирована от id).
 */
const Cards = Page((Ui) => {
  const router = useRouter();
  const onGenerate = () => router.goTo(`/cards/${Date.now()}`);

  return (
    <Ui.Layout.Matrix
      layoutMode="view"
      preset="app-shell"
      slots={{
        header: {
          children: <div class="p-3 text-sm opacity-60">cards / header (mock)</div>,
          resizable: false,
          initialSize: 0.06,
        },
        main: {
          children: (
            <Ui.Layout.Flex direction="col" gap={3} class="p-4 h-full">
              <Ui.Layout.Flex align="center" gap={3}>
                <Ui.Button onClick={onGenerate}>Generate new</Ui.Button>
                <div class="text-xs opacity-60">click → /cards/&lt;timestamp&gt;</div>
              </Ui.Layout.Flex>
              <div class="flex-1 overflow-auto">
                <Ui.Outlet />
              </div>
            </Ui.Layout.Flex>
          ),
          resizable: false,
        },
        rightBar: {
          children: <div class="p-3 text-sm opacity-60">rightBar (mock)</div>,
          resizable: false,
          initialSize: 0.25,
        },
        footer: {
          children: <div class="p-3 text-sm opacity-60">footer (mock)</div>,
          resizable: false,
          initialSize: 0.08,
        },
      }}
    />
  );
});

export default Cards;
