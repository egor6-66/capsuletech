import {
  ArrowUpRight,
  LayoutTemplate,
  Library,
  LogIn,
  MousePointer2,
  Network,
  Palette,
  SlidersHorizontal,
  Wand2,
} from 'lucide-solid';
import { For } from 'solid-js';

const DEMOS = [
  {
    path: '/auth',
    title: 'Original Auth Form',
    description:
      'Исходный widget авторизации, написан как обычный JSX. Точка отсчёта для всех остальных демо.',
    icon: LogIn,
  },
  {
    path: '/demos/renderer-demo',
    title: 'Renderer Side-by-Side',
    description:
      'JSON-схема vs JSX-сборка той же формы. Валидация контракта @capsuletech/renderer.',
    icon: LayoutTemplate,
  },
  {
    path: '/demos/dnd-demo',
    title: 'DnD Primitives',
    description:
      'Палитра, drop-зоны с accepts, sortable. Pointer events работают на mouse и touch.',
    icon: MousePointer2,
  },
  {
    path: '/demos/editor-state-demo',
    title: 'Tree DnD Editor',
    description:
      'Собрать дерево компонентов через drag-and-drop. Sort, reorder, удаление + live preview.',
    icon: Network,
  },
  {
    path: '/demos/manifests-demo',
    title: 'Component Manifests',
    description: 'Все зарегистрированные манифесты с иконками, категориями и accepts-правилами.',
    icon: Library,
  },
  {
    path: '/demos/inspector-demo',
    title: 'Props Inspector',
    description:
      'Универсальный редактор props с категориями basic / advanced и типизированными полями.',
    icon: SlidersHorizontal,
  },
  {
    path: '/demos/theme-editor',
    title: 'Theme Editor',
    description: 'shadcn-style настройка дизайн-системы: цвет primary, радиус, отступы, шрифт.',
    icon: Palette,
  },
  {
    path: '/demos/argtypes-editor-demo',
    title: 'argTypes Editor',
    description:
      'Форма редактирования пропсов генерируется из schema (а-ля Storybook argTypes). Добавил поле → редактор подхватил.',
    icon: Wand2,
  },
];

const DemosHub = Widget((Ui) => (
  <div class="bg-background min-h-screen text-foreground">
    <div class="max-w-6xl mx-auto px-6 py-12 md:py-16">
      <header class="mb-10">
        <h1 class="text-3xl md:text-4xl font-semibold tracking-tight">
          Capsule — Playground редактора
        </h1>
        <p class="text-sm md:text-base text-muted-foreground max-w-2xl mt-3 leading-relaxed">
          Набор интерактивных демо для всех кубиков редактора. Drag-and-drop, manifests, inspector,
          theme — всё, что мы успели собрать, в одном месте.
        </p>
      </header>

      <Ui.Animate variant="slide-up" duration={0.35}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={DEMOS}>
            {(demo) => (
              <Ui.Link
                to={demo.path}
                class="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              >
                <Ui.Card class="relative h-full bg-card border-border transition-all duration-200 group-hover:border-foreground/30 group-hover:shadow-lg group-hover:-translate-y-0.5">
                  <ArrowUpRight
                    size={16}
                    class="absolute top-4 right-4 text-muted-foreground transition-colors group-hover:text-primary"
                  />
                  <Ui.Card.Header>
                    <div class="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary mb-3">
                      <demo.icon size={20} />
                    </div>
                    <Ui.Card.Title class="text-base font-semibold leading-tight">
                      {demo.title}
                    </Ui.Card.Title>
                    <Ui.Card.Description class="text-xs leading-relaxed">
                      {demo.description}
                    </Ui.Card.Description>
                  </Ui.Card.Header>
                </Ui.Card>
              </Ui.Link>
            )}
          </For>
          <Ui.Outlet />
        </div>
      </Ui.Animate>
    </div>
  </div>
));

export default DemosHub;
