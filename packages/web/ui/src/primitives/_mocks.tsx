/**
 * Демо-компоненты для Storybook (`layout.stories.tsx`, `resizable.stories.tsx`).
 *
 * Не экспортируются из публичного `index.ts` — только для stories. Файл лежит
 * на корне `primitives/`, поэтому vite-конфиг библиотеки его игнорирует
 * (entry-loop сканирует только директории внутри `primitives/*`).
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

export const MockHeader = () => (
  <div class="flex h-full items-center justify-between gap-4 border-b border-white/10 px-4">
    <div class="flex items-center gap-2 text-sm font-semibold">
      <FolderTree class="size-4 opacity-70" />
      <span>Capsule UI</span>
      <ChevronRight class="size-3 opacity-40" />
      <span class="opacity-60">workspace</span>
    </div>
    <div class="flex items-center gap-2 text-xs opacity-70">
      <button type="button" class="rounded px-2 py-1 hover:bg-white/5">Docs</button>
      <button type="button" class="rounded px-2 py-1 hover:bg-white/5">Releases</button>
      <Search class="size-4" />
      <Bell class="size-4" />
      <User class="size-4" />
    </div>
  </div>
);

export const MockSidebar = () => (
  <nav class="flex h-full w-full flex-col gap-0.5 border-r border-white/10 bg-white/[0.02] p-3 text-sm">
    <div class="px-2 pb-2 text-[10px] uppercase tracking-widest opacity-50">Navigation</div>
    <For each={NAV}>
      {(item) => (
        <button
          type="button"
          class={`flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${
            item.active ? 'bg-white/10 text-white' : 'opacity-80 hover:bg-white/5 hover:opacity-100'
          }`}
        >
          <item.Icon class="size-4 opacity-70" />
          <span>{item.label}</span>
        </button>
      )}
    </For>
  </nav>
);

const Card = (props: { title: string; body: string; tag?: string }) => (
  <div class="rounded-md border border-white/10 bg-white/[0.03] p-3">
    <div class="flex items-center justify-between text-xs">
      <span class="font-medium">{props.title}</span>
      {props.tag ? (
        <span class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider opacity-70">
          {props.tag}
        </span>
      ) : null}
    </div>
    <p class="mt-2 text-xs leading-relaxed opacity-70">{props.body}</p>
  </div>
);

export const MockMain = () => (
  <main class="flex h-full w-full flex-col gap-4 overflow-auto p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">Dashboard</h1>
        <p class="text-xs opacity-60">Layout slots preview · drag handles to resize</p>
      </div>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5"
      >
        <Sparkles class="size-3.5" /> Action
      </button>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <Card title="Capsules" body="Active workspace capsules — auto-synced." tag="live" />
      <Card title="Recent activity" body="Last 24 hours across all branches." />
      <Card title="Open PRs" body="3 ready for review, 1 draft." />
      <Card title="System health" body="All services nominal." tag="ok" />
    </div>
    <div class="rounded-md border border-dashed border-white/10 p-4 text-xs opacity-60">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
      labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
      laboris nisi ut aliquip ex ea commodo consequat.
    </div>
  </main>
);

export const MockRightBar = () => (
  <aside class="flex h-full w-full flex-col gap-3 border-l border-white/10 bg-white/[0.02] p-4 text-xs">
    <div class="text-[10px] uppercase tracking-widest opacity-50">Inspector</div>
    <div class="space-y-2">
      <div class="flex justify-between">
        <span class="opacity-60">id</span>
        <span class="font-mono">cap_42</span>
      </div>
      <div class="flex justify-between">
        <span class="opacity-60">status</span>
        <span class="text-emerald-400">running</span>
      </div>
      <div class="flex justify-between">
        <span class="opacity-60">cpu</span>
        <span>12%</span>
      </div>
      <div class="flex justify-between">
        <span class="opacity-60">memory</span>
        <span>340 Mb</span>
      </div>
    </div>
    <div class="mt-2 rounded border border-white/10 bg-white/[0.04] p-2 leading-relaxed opacity-70">
      Drag the left handle to resize this panel. When this slot is marked as `resizable: false`, the
      handle next to it disappears.
    </div>
  </aside>
);

export const MockFooter = () => (
  <div class="flex h-full items-center justify-between border-t border-white/10 px-4 text-[11px] opacity-60">
    <span>© Capsule — internal preview</span>
    <span class="font-mono">v0.1.1</span>
  </div>
);

export const MockBlock = (props: { label: string; tone?: 'a' | 'b' | 'c' }) => (
  <div
    class={`flex h-full w-full flex-col items-center justify-center gap-1 text-xs uppercase tracking-widest ${
      props.tone === 'b'
        ? 'bg-white/[0.06]'
        : props.tone === 'c'
          ? 'bg-white/[0.09]'
          : 'bg-white/[0.03]'
    }`}
  >
    <span class="opacity-90">{props.label}</span>
    <span class="text-[9px] opacity-40">slot</span>
  </div>
);
