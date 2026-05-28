/**
 * Navigation — batch-shape для основной навигации приложения.
 *
 * Schema: `z.array({ label, to })` — массив роут-пунктов.
 * Defaults: текущие активные роуты (`/workspace`, `/reports`).
 * Template (`as`): `ui.Group` — batch-контейнер от UI-kit.
 *
 * Group получает `data` (от Shape) + extras (`itemAs`/`itemProps`/`orientation`/`gap`)
 * и итерирует сам: `<Dynamic component={itemAs} {...itemProps(item)} />` на каждый
 * элемент. Items рендерятся через `ui.Button as={ui.Link}` — Button-стили
 * накладываются на TanStack `Link`, получаем кликабельную навигационную кнопку,
 * которая ходит через router (не reload).
 *
 * Этот файл — глобал `Shapes.Navigation`. Mount-сайт — `Widgets.Headers.Main`
 * (см. workspace header). Чтобы переиспользовать в других местах — просто
 * `<Shapes.Navigation />` без props (defaults сработают) либо
 * `<Shapes.Navigation data={[...]} />` чтобы переопределить список пунктов.
 */
const Navigation = Shape((z, ui) => ({
  schema: z.array(
    z.object({
      label: z.string(),
      to: z.string(),
    }),
  ),
  defaults: [
    { label: 'Dashboard', to: '/workspace/dashboard' },
    { label: 'Cards', to: '/workspace/cards' },
    { label: 'Reports', to: '/workspace/reports' },
  ],
  as: ui.Group,
  itemAs: ui.Button,
  itemProps: (item: { label: string; to: string }) => ({
    as: ui.Link,
    to: item.to,
    variant: 'outline',
    // Активный link получает aria-current='page' от TanStack Router — на этом
    // селекторе подсвечиваем кнопку аксентом, чтобы было видно где находишься.
    // `font-semibold` усиливает читаемость; `pointer-events-none` блокирует
    // повторный клик/hover-flicker на текущей странице. Сам hover/active
    // transition наследуется от Button base (`duration-fast` = 200ms).
    class:
      'aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground aria-[current=page]:font-semibold aria-[current=page]:pointer-events-none',
    children: item.label,
  }),
  orientation: 'horizontal',
  variant: 'attached',
}));

export default Navigation;
