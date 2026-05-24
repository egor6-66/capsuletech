const Routes = Shape((z, ui) => ({
  schema: z.array(
    z.object({
      to: z.string(),
      label: z.string(),
      tags: z.array(z.string()),
    }),
  ),
  defaults: [
    { to: '/spaces', label: 'Spaces', tags: ['main'] },
    { to: '/scriber', label: 'Scriber', tags: ['main'] },
  ],
  // Batch flow:
  //  - `as: ui.Group` — batch-template (Shape extracts).
  //  - `itemAs: ui.Button` — per-item template (Group reads).
  //  - `itemProps`: maps each route → Button props (as Link + to + children).
  //  - `tags` (consumer prop) — фильтр в самом Group.
  as: ui.Group,
  itemAs: ui.Button,
  itemProps: (item: { to: string; label: string }) => ({
    as: ui.Link,
    variant: 'ghost',
    size: 'sm',
    to: item.to,
    children: item.label,
  }),
  variant: 'attached' as const,
}));

export default Routes;
