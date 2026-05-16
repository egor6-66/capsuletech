import { type ISchema, Renderer } from '@capsuletech/renderer';

// JSON-эквивалент `widgets/forms/_auth.tsx`. По сравнению с оригиналом ничего
// руками не «допиливалось»: то же дерево, те же meta-теги, тот же
// `Controllers.Universal.Form` с тем же `overrides`, та же оборачивающая
// `Features.Viewer.Auth`.
const schema: ISchema = {
  components: {
    root: 'animate',
    nodes: {
      animate: {
        id: 'animate',
        type: 'ui.Animate',
        parentId: null,
        children: ['card'],
        props: { variant: 'scale', duration: 0.3 },
      },
      card: {
        id: 'card',
        type: 'ui.Card',
        parentId: 'animate',
        children: ['cardHeader', 'cardContent'],
        props: { class: 'w-full max-w-sm border-none' },
      },
      cardHeader: {
        id: 'cardHeader',
        type: 'ui.Card.Header',
        parentId: 'card',
        children: ['cardTitle', 'cardDescription'],
        props: { class: 'text-center' },
      },
      cardTitle: {
        id: 'cardTitle',
        type: 'ui.Card.Title',
        parentId: 'cardHeader',
        children: [],
        props: { class: 'text-xl', children: 'CAPSULE' },
      },
      cardDescription: {
        id: 'cardDescription',
        type: 'ui.Card.Description',
        parentId: 'cardHeader',
        children: [],
        props: { children: 'Демо логин-формы' },
      },
      cardContent: {
        id: 'cardContent',
        type: 'ui.Card.Content',
        parentId: 'card',
        children: ['loginForm'],
      },
      loginForm: {
        id: 'loginForm',
        type: 'Entities.Viewer.LoginForm',
        parentId: 'cardContent',
        children: [],
        meta: { tags: ['@login-form'] },
      },
    },
  },
  // Порядок имеет значение: первый interaction = самый наружный wrapper.
  // Получается `<Feature.Auth><Controller.Form>{tree}</Controller.Form></Feature.Auth>`,
  // как в оригинальном Widget'е.
  interactions: [
    {
      id: '_auth-feature',
      nodeId: 'animate',
      kind: 'feature',
      ref: 'Features.Viewer.Auth',
    },
    {
      id: 'form-controller',
      nodeId: 'animate',
      kind: 'controller',
      ref: 'Controllers.Universal.Form',
      props: { overrides: { onClick: 'authByLogin' } },
    },
  ],
};

const RendererAuth = Widget((Ui, Features, Controllers, Entities) => {
  const registry = { ui: Ui, Entities, Controllers, Features };
  return <Renderer schema={schema} registry={registry} />;
});

export default RendererAuth;
