import { Button } from '@capsuletech/web-ui/button';
import { ArrowRight, type LucideProps, Plus, Send, Trash2 } from 'lucide-solid';
import { type Component, createSignal, createUniqueId, For, Show } from 'solid-js';

/*
 * ──────────────────────────────────────────────────────────────────────────
 *  Демо: argTypes-driven editor.
 *
 *  Идея — то же, что у Storybook Controls: схема пропсов компонента
 *  описывается декларативно (control-тип + options + дефолт), а UI редактора
 *  не пишется руками — он генерируется из схемы.
 *
 *  Что показывает этот файл:
 *   1. Schema (buttonSchema) — это просто другая форма Storybook `argTypes`.
 *      В реальной интеграции схема может импортироваться прямо из stories.
 *   2. ArgField/ArgForm — generic-рендерер. Добавил поле в схему — оно
 *      появляется в редакторе автоматически. Никаких правок UI.
 *   3. «Tree» из 3 узлов, у каждого свой набор args. Клик → выбран → форма
 *      редактирует именно его args, превью обновляется live.
 * ──────────────────────────────────────────────────────────────────────────
 */

// 1. ── Schema ─────────────────────────────────────────────────────────────

const ICONS: Record<string, Component<LucideProps> | null> = {
  none: null,
  Plus,
  Send,
  ArrowRight,
  Trash2,
};

type Control =
  | { type: 'select'; options: readonly string[] }
  | { type: 'boolean' }
  | { type: 'text' };

interface IArgType {
  control: Control;
  defaultValue?: unknown;
  description?: string;
}

type Schema = Record<string, IArgType>;

const buttonSchema: Schema = {
  variant: {
    control: {
      type: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    defaultValue: 'default',
  },
  size: {
    control: { type: 'select', options: ['default', 'sm', 'lg', 'icon'] },
    defaultValue: 'default',
  },
  disabled: { control: { type: 'boolean' }, defaultValue: false },
  label: { control: { type: 'text' }, defaultValue: 'Button' },
  icon: {
    control: { type: 'select', options: Object.keys(ICONS) },
    defaultValue: 'none',
  },
};

// 2. ── Generic field renderer ─────────────────────────────────────────────

interface IArgFieldProps {
  name: string;
  argType: IArgType;
  value: unknown;
  onChange: (v: unknown) => void;
}

const ArgField = (props: IArgFieldProps) => (
  <div class="flex flex-col gap-1">
    {/* biome-ignore lint/a11y/noLabelWithoutControl: demo widget — control is rendered in sibling Show branches below, not nested. Storybook-only, not a production a11y concern. */}
    <label class="text-xs uppercase tracking-wide opacity-60">{props.name}</label>
    <Show when={props.argType.control.type === 'select'}>
      <select
        class="bg-black/30 border border-white/20 rounded px-2 py-1 text-sm"
        value={(props.value as string) ?? ''}
        onChange={(e) => props.onChange(e.currentTarget.value)}
      >
        <For each={(props.argType.control as Extract<Control, { type: 'select' }>).options}>
          {(opt) => <option value={opt}>{opt}</option>}
        </For>
      </select>
    </Show>
    <Show when={props.argType.control.type === 'boolean'}>
      <input
        type="checkbox"
        class="self-start size-4 accent-blue-500"
        checked={!!props.value}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
    </Show>
    <Show when={props.argType.control.type === 'text'}>
      <input
        type="text"
        class="bg-black/30 border border-white/20 rounded px-2 py-1 text-sm"
        value={(props.value as string) ?? ''}
        onInput={(e) => props.onChange(e.currentTarget.value)}
      />
    </Show>
  </div>
);

interface IArgFormProps {
  schema: Schema;
  args: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

const ArgForm = (props: IArgFormProps) => (
  <div class="flex flex-col gap-3">
    <For each={Object.entries(props.schema)}>
      {([name, argType]) => (
        <ArgField
          name={name}
          argType={argType}
          value={props.args[name]}
          onChange={(v) => props.onChange({ ...props.args, [name]: v })}
        />
      )}
    </For>
  </div>
);

// 3. ── Render component from args ─────────────────────────────────────────
// Здесь специфика Button. В реальной системе будет
// registry: type → (args) => JSX, где `Button` это один из вариантов.

const RenderButton = (props: { args: Record<string, unknown> }) => (
  <Button
    variant={props.args.variant as never}
    size={props.args.size as never}
    disabled={props.args.disabled as boolean}
  >
    <Show when={ICONS[(props.args.icon as string) ?? 'none']} keyed>
      {(Icon) => <Icon />}
    </Show>
    <Show when={props.args.size !== 'icon'}>{props.args.label as string}</Show>
  </Button>
);

// 4. ── Demo ───────────────────────────────────────────────────────────────

interface INode {
  id: string;
  args: Record<string, unknown>;
}

const defaultArgs = (schema: Schema): Record<string, unknown> =>
  Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, v.defaultValue]));

const ArgtypesEditor = Widget(() => {
  const [nodes, setNodes] = createSignal<INode[]>([
    { id: createUniqueId(), args: defaultArgs(buttonSchema) },
    {
      id: createUniqueId(),
      args: { ...defaultArgs(buttonSchema), variant: 'ghost', label: 'Ghost', icon: 'Plus' },
    },
    {
      id: createUniqueId(),
      args: { ...defaultArgs(buttonSchema), size: 'icon', icon: 'Trash2', variant: 'outline' },
    },
  ]);
  const [selectedId, setSelectedId] = createSignal<string>(nodes()[0].id);

  const selected = () => nodes().find((n) => n.id === selectedId());
  const updateSelected = (next: Record<string, unknown>) =>
    setNodes((prev) => prev.map((n) => (n.id === selectedId() ? { ...n, args: next } : n)));
  const addNode = () => {
    const node = { id: createUniqueId(), args: defaultArgs(buttonSchema) };
    setNodes((prev) => [...prev, node]);
    setSelectedId(node.id);
  };

  return (
    <div class="flex flex-col gap-4 p-6 w-full max-w-5xl">
      <div>
        <div class="text-2xl font-semibold">argTypes-driven editor</div>
        <div class="text-sm opacity-60 max-w-2xl">
          Форма генерируется из <code>buttonSchema</code>. Это та же структура, что у Storybook{' '}
          <code>argTypes</code>. Добавь новое поле в схему — редактор подхватит его без правок UI.
        </div>
      </div>

      <div class="grid grid-cols-[1fr_300px] gap-4">
        <div class="border border-white/20 rounded p-4 flex flex-col gap-2 min-h-[300px]">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs uppercase tracking-wide opacity-60">Tree</span>
            <button
              type="button"
              class="ml-auto text-xs px-2 py-1 border border-white/20 rounded hover:bg-white/5"
              onClick={addNode}
            >
              + Button
            </button>
          </div>
          <For each={nodes()}>
            {(node) => (
              <button
                type="button"
                class="text-left rounded p-3 transition-colors flex items-center gap-3"
                classList={{
                  'ring-1 ring-white/40 bg-white/5': selectedId() === node.id,
                  'hover:bg-white/5': selectedId() !== node.id,
                }}
                onClick={() => setSelectedId(node.id)}
              >
                <RenderButton args={node.args} />
                <span class="text-xs opacity-50 ml-auto font-mono">#{node.id.slice(-4)}</span>
              </button>
            )}
          </For>
        </div>

        <div class="border border-white/20 rounded p-4 flex flex-col gap-3">
          <div class="text-xs uppercase tracking-wide opacity-60 mb-1">
            Props · #{selectedId().slice(-4)}
          </div>
          <Show when={selected()} keyed>
            {(node) => <ArgForm schema={buttonSchema} args={node.args} onChange={updateSelected} />}
          </Show>
        </div>
      </div>

      <details class="text-xs opacity-60">
        <summary class="cursor-pointer">Schema (это и есть Storybook argTypes)</summary>
        <pre class="mt-2 p-3 bg-black/30 rounded overflow-auto">
          {JSON.stringify(buttonSchema, null, 2)}
        </pre>
      </details>
    </div>
  );
});

export default ArgtypesEditor;
