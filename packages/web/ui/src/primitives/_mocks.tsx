/**
 * Демо-компоненты для Storybook (`layout.stories.tsx`, `resizable.stories.tsx`,
 * `grid.stories.tsx`, `flex.stories.tsx`).
 *
 * Не экспортируются из публичного `index.ts` — только для stories. Файл лежит
 * на корне `primitives/`, поэтому vite-конфиг библиотеки его игнорирует
 * (entry-loop сканирует только директории внутри `primitives/*`).
 *
 * **Принципы оформления:**
 *  - Используем только темовые токены (`bg-card`, `bg-muted`, `bg-primary`, …)
 *    и компоненты из самого ui-kit (Button, Card, Typography). При смене
 *    темы через toolbar Storybook мокы перекрашиваются вместе со всем.
 *  - Каждый слот имеет крупный цветной баннер сверху — чтобы границы
 *    раскладки были видны с одного взгляда (особенно для Layout / Resizable).
 *  - Mock-компонент сам занимает `h-full w-full` — слот-обёртка Layout
 *    («bg-muted/40 border-r p-…») остаётся фоном вокруг.
 */
import {
  Bell,
  ChevronRight,
  FileText,
  FolderTree,
  Home,
  Inbox,
  type LucideProps,
  Search,
  Settings,
  Sparkles,
  User,
} from 'lucide-solid';
import { For, type JSX } from 'solid-js';
import { Button } from './button';
import { Card } from './card';
import { Typography } from './typography';

type LucideIcon = (props: LucideProps) => JSX.Element;

interface INavItem {
  label: string;
  Icon: LucideIcon;
  active?: boolean;
}

const NAV: INavItem[] = [
  { label: 'Home', Icon: Home, active: true },
  { label: 'Inbox', Icon: Inbox },
  { label: 'Files', Icon: FileText },
  { label: 'Settings', Icon: Settings },
];

/**
 * Цветной баннер «название слота». Делает границы раскладки видимыми
 * вне зависимости от темы. `tone` маппится на темовые токены.
 */
const SlotBanner = (props: {
  label: string;
  tone: 'primary' | 'accent' | 'secondary' | 'muted' | 'destructive';
}) => {
  const map = {
    primary: 'bg-primary text-primary-foreground',
    accent: 'bg-accent text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    muted: 'bg-muted text-muted-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
  } as const;
  return (
    <div
      class={`flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] ${map[props.tone]}`}
    >
      <span>{props.label}</span>
      <span class="opacity-60">slot</span>
    </div>
  );
};

export const MockHeader = () => (
  <div class="flex h-full w-full flex-col bg-card text-card-foreground">
    <SlotBanner label="header" tone="primary" />
    <div class="flex flex-1 items-center justify-between gap-4 border-b border-border px-4">
      <div class="flex items-center gap-2 text-sm font-semibold">
        <FolderTree class="size-4 opacity-70" />
        <span>Capsule UI</span>
        <ChevronRight class="size-3 opacity-40" />
        <Typography variant="p" color="muted" class="text-xs">
          workspace
        </Typography>
      </div>
      <div class="flex items-center gap-1">
        <Button variant="ghost" size="sm">
          Docs
        </Button>
        <Button variant="ghost" size="sm">
          Releases
        </Button>
        <Button variant="ghost" size="icon" aria-label="search">
          <Search class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="notifications">
          <Bell class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="account">
          <User class="size-4" />
        </Button>
      </div>
    </div>
  </div>
);

export const MockSidebar = () => (
  <nav class="flex h-full w-full flex-col bg-card text-card-foreground">
    <SlotBanner label="sidebar" tone="accent" />
    <div class="flex flex-1 flex-col gap-1 p-3">
      <Typography variant="p" color="muted" class="px-2 pb-1 text-[10px] uppercase tracking-widest">
        Navigation
      </Typography>
      <For each={NAV}>
        {(item) => (
          <Button
            variant={item.active ? 'secondary' : 'ghost'}
            size="sm"
            class="w-full justify-start gap-2"
          >
            <item.Icon class="size-4" />
            {item.label}
          </Button>
        )}
      </For>
    </div>
  </nav>
);

interface ITileProps {
  title: string;
  body: string;
  tag?: string;
}

const Tile = (props: ITileProps) => (
  <Card>
    <Card.Header>
      <div class="flex items-center justify-between">
        <Card.Title class="text-sm">{props.title}</Card.Title>
        {props.tag ? (
          <span class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
            {props.tag}
          </span>
        ) : null}
      </div>
    </Card.Header>
    <Card.Content class="pt-0">
      <Card.Description>{props.body}</Card.Description>
    </Card.Content>
  </Card>
);

export const MockMain = () => (
  <main class="flex h-full w-full flex-col bg-background text-foreground">
    <SlotBanner label="main" tone="secondary" />
    <div class="flex flex-1 flex-col gap-4 overflow-auto p-6">
      <div class="flex items-center justify-between">
        <div>
          <Typography variant="h2" class="border-0 pb-0 text-xl">
            Dashboard
          </Typography>
          <Typography variant="p" color="muted" class="text-xs">
            Layout slots preview · drag handles to resize
          </Typography>
        </div>
        <Button size="sm" class="gap-1.5">
          <Sparkles class="size-3.5" /> Action
        </Button>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Tile title="Capsules" body="Active workspace capsules — auto-synced." tag="live" />
        <Tile title="Recent activity" body="Last 24 hours across all branches." />
        <Tile title="Open PRs" body="3 ready for review, 1 draft." />
        <Tile title="System health" body="All services nominal." tag="ok" />
      </div>
      <Card class="border-dashed">
        <Card.Content>
          <Typography variant="p" color="muted" class="text-xs">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </Typography>
        </Card.Content>
      </Card>
    </div>
  </main>
);

const InspectorRow = (props: { label: string; value: string; tone?: 'default' | 'success' }) => (
  <div class="flex items-center justify-between border-b border-border/50 py-1.5 text-xs last:border-0">
    <Typography variant="p" color="muted" class="text-xs">
      {props.label}
    </Typography>
    <span
      class={`font-mono text-xs ${props.tone === 'success' ? 'text-primary' : 'text-foreground'}`}
    >
      {props.value}
    </span>
  </div>
);

export const MockRightBar = () => (
  <aside class="flex h-full w-full flex-col bg-card text-card-foreground">
    <SlotBanner label="rightBar" tone="muted" />
    <div class="flex flex-1 flex-col gap-3 overflow-auto p-4">
      <Typography variant="p" color="muted" class="text-[10px] uppercase tracking-widest">
        Inspector
      </Typography>
      <div class="rounded-md border border-border bg-background/50 px-3 py-2">
        <InspectorRow label="id" value="cap_42" />
        <InspectorRow label="status" value="running" tone="success" />
        <InspectorRow label="cpu" value="12%" />
        <InspectorRow label="memory" value="340 Mb" />
        <InspectorRow label="uptime" value="2d 4h" />
      </div>
      <Card>
        <Card.Content class="text-xs leading-relaxed">
          <Typography variant="p" color="muted" class="text-xs">
            Drag the left handle to resize this panel. With{' '}
            <code class="rounded bg-muted px-1">resizable: false</code> the handle next to it
            disappears.
          </Typography>
        </Card.Content>
      </Card>
    </div>
  </aside>
);

export const MockFooter = () => (
  <div class="flex h-full w-full flex-col bg-card text-card-foreground">
    <SlotBanner label="footer" tone="primary" />
    <div class="flex flex-1 items-center justify-between border-t border-border px-4 text-[11px] text-muted-foreground">
      <span>© Capsule — internal preview</span>
      <span class="font-mono">v0.1.1</span>
    </div>
  </div>
);

/**
 * `MockBlock` — универсальный «один слот = один блок» (для Grid/Flex/Resizable
 * stories, где не нужны полноценные Header/Sidebar). `tone` — оттенок через
 * темовые токены, лейбл подписан крупно по центру.
 */
export const MockBlock = (props: { label: string; tone?: 'a' | 'b' | 'c' }) => {
  const tone = {
    a: 'bg-primary/15 text-primary border-primary/30',
    b: 'bg-accent/40 text-accent-foreground border-accent',
    c: 'bg-secondary text-secondary-foreground border-border',
  } as const;
  return (
    <div
      class={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-md border text-xs font-semibold uppercase tracking-widest ${tone[props.tone ?? 'a']}`}
    >
      <span class="text-sm">{props.label}</span>
      <span class="text-[9px] opacity-60">slot</span>
    </div>
  );
};
