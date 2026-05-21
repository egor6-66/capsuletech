export type Layer = 'pages' | 'views' | 'controllers' | 'features' | 'widgets' | 'shapes';

export const LAYER_LABELS: Record<Layer, string> = {
  pages: 'Page',
  views: 'View',
  controllers: 'Controller',
  features: 'Feature',
  widgets: 'Widget',
  shapes: 'Shape',
};

/**
 * Curated double-width эмодзи без VS16 (см. `src/cli/tui/icons.ts` про политику).
 * Заменены `🎛`, `⚡`, `🔷` — все default-text, ломают ширину.
 */
export const LAYER_ICONS: Record<Layer, string> = {
  pages: '📄',
  views: '🧱',
  controllers: '🎮',
  features: '🪄',
  widgets: '🧰',
  shapes: '🟦',
};

export const layerTemplates: Record<Layer, (Name: string) => string> = {
  pages: (Name) => `const ${Name} = Page((Ui, _Widgets) => (
  <Ui.Layout slots={{ main: <div>${Name}</div> }} />
));

export default ${Name};
`,

  views: (Name) => `const ${Name} = View(({ Button }) => (
  <Button meta={{ tags: ['click'] }}>${Name}</Button>
));

export default ${Name};
`,

  controllers: (Name) => `const ${Name} = Controller(() => ({
  initial: 'idle',
  states: {
    idle: {},
  },
}));

export default ${Name};
`,

  features: (Name) => `const ${Name} = Feature((_services) => ({
  initial: 'idle',
  states: {
    idle: {},
  },
}));

export default ${Name};
`,

  widgets: (Name) => `const ${Name} = Widget((Ui, _Features, _Controllers, _Views) => (
  <div>${Name}</div>
));

export default ${Name};
`,

  shapes: (Name) => `const ${Name} = Shape((z, _ui) => ({
  schema: z.array(z.object({})),
  defaults: [],
  as: 'div',
  props: () => ({}),
}));

export default ${Name};
`,
};
