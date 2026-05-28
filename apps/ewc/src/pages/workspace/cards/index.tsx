// import { useRouter } from '@capsuletech/web-router';

/**
 * Cards layout (`/workspace/cards`) — sandbox-каталог для генерации форм.
 *
 * Раньше содержал собственный matrix (header/main/rightBar/footer мокнутые).
 * После переноса под workspace shell — упрощён: workspace уже даёт header
 * и общий каркас. Здесь только локальный toolbar + Outlet для `[id]/`.
 *
 * Кнопка Generate навигирует на `/workspace/cards/${Date.now()}` — `[id]`
 * пересчитывает форму из id-seed (детерминированно, URL копипастится).
 */
const Cards = Page((Ui) => {
  // const router = useRouter();
  // const onGenerate = () => router.goTo(`/workspace/cards/${Date.now()}`);

  return (
    <Ui.Layout.Flex direction="col" gap={3} class="p-4 h-full">
      Cards
      {/*<Ui.Layout.Flex align="center" gap={3}>*/}
      {/*  /!*<Ui.Button onClick={onGenerate}>Generate new</Ui.Button>*!/*/}
      {/*  <div class="text-xs opacity-60">click → /workspace/cards/&lt;timestamp&gt;</div>*/}
      {/*</Ui.Layout.Flex>*/}
      {/*<div class="flex-1 overflow-auto">*/}
      {/*  <Ui.Outlet />*/}
      {/*</div>*/}
    </Ui.Layout.Flex>
  );
});

export default Cards;
