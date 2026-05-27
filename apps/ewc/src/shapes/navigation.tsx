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
    { label: 'Workspace', to: '/workspace' },
    { label: 'Reports', to: '/reports' },
  ],
  as: ui.Group,
  itemAs: ui.Button,
  itemProps: (item: { label: string; to: string }) => ({
    as: ui.Link,
    to: item.to,
    variant: 'ghost',
    children: item.label,
  }),
  orientation: 'horizontal',
  gap: 1,
}));

export default Navigation;
